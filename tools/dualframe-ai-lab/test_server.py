"""Focused zero-network tests. Provider transport is an explicit test double."""
import io
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest import mock
import urllib.error
import urllib.request
from PIL import Image, ImageCms, PngImagePlugin
from server import Config, Engine, Server, GateError, PUBLIC_PUBLISH_ROOT, digest, image_info, geometry, protect_original
from providers import BriaAdapter, FalAdapter, FAL_MODELS, FAL_PRIVACY_HEADERS, fal_payload, fal_state, require_short_signed_asset, ProviderError, bria_payload, parse_response, validate_remote_url

TOKEN_A='test-invite-A-000000000000000000000000'
TOKEN_B='test-invite-B-000000000000000000000000'


def review_record():
    return {'reviewer':'independent-test-reviewer','submitter':'fixture-owner','retention_reviewed':True,'asset_private_access_verified':True,'input_private_transport_verified':True,'privacy_evidence_sha256':'a'*64,'entitlement_evidence_sha256':'b'*64,'account_free_requests':1,'allowed_endpoint_ids':['https://engine.prod.bria-api.com/v2/image/edit/expand']+[m['endpoint_id'] for m in FAL_MODELS.values()],'qualities':['hd','4k'],'review_expires_at':time.time()+3600}


def fixture(w=96,h=54,format='PNG',exif=None):
    image=Image.new('RGB',(w,h),(122,77,25));data=io.BytesIO();image.save(data,format=format,**({'exif':exif} if exif else {}));return data.getvalue()


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.cfg=Config(self.tmp.name,[TOKEN_A,TOKEN_B],{});self.engine=Engine(self.cfg);self.owner=self.engine.auth(TOKEN_A);self.other=self.engine.auth(TOKEN_B)

    def tearDown(self):
        self.engine.close();self.tmp.cleanup()

    def request(self,pair,**patch):
        data=dict(pair_id=pair['pair_id'],input_sha256=pair['original']['sha256'],target='landscape' if pair['original']['source_orientation']=='portrait' else 'portrait',mode='faithful',position='center',prompt='',seed=42,consent=False,provider='demo',idempotency_key=digest(b'test-job'))
        data.update(patch);return data

    def wait(self,id_):
        for _ in range(200):
            j=self.engine.job(self.owner,id_)
            if j['status'] not in ('PENDING','RUNNING'):
                return j
            time.sleep(.005)
        self.fail('job did not complete within 1 second')

    def test_original_byte_hash_is_retained_and_duplicates_share_identity(self):
        raw=fixture();p=self.engine.upload(self.owner,raw);self.assertEqual(p['original']['sha256'],digest(raw));self.assertEqual(self.engine.asset(self.owner,p['pair_id']+'_original')[0],raw);self.assertEqual(self.engine.upload(self.owner,raw)['pair_id'],p['pair_id']);self.assertEqual(len(self.engine.pairs(self.owner)),1)

    def test_exif_rotated_jpeg_and_metadata_free_delivery(self):
        exif=Image.Exif();exif[274]=6;exif[270]='private description';raw=fixture(96,54,'JPEG',exif);source,png,_=image_info(raw);self.assertEqual(source.size,(54,96));self.assertEqual(len(Image.open(io.BytesIO(png)).getexif()),0);p=self.engine.upload(self.owner,raw);self.assertEqual(p['original']['source_orientation'],'portrait');self.assertEqual(p['original']['sha256'],digest(raw))

    def test_icc_normalization_preserves_alpha_and_removes_private_metadata(self):
        source=Image.new('RGBA',(4,1));source.putdata([(22,44,66,a) for a in (0,37,128,255)])
        metadata=PngImagePlugin.PngInfo();metadata.add_text('private-note','private location')
        exif=Image.Exif();exif[270]='private description'
        raw=io.BytesIO();source.save(raw,format='PNG',icc_profile=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes(),pnginfo=metadata,exif=exif)
        normalized,png,_=image_info(raw.getvalue())
        self.assertEqual(normalized.getchannel('A').tobytes(),source.getchannel('A').tobytes())
        with Image.open(io.BytesIO(png)) as delivery:
            self.assertEqual(delivery.info,{});self.assertEqual(len(delivery.getexif()),0)
        pair=self.engine.upload(self.owner,raw.getvalue());job=self.wait(self.engine.expand(self.owner,self.request(pair))['job_id'])
        self.assertEqual(job['status'],'READY');self.assertEqual(job['output']['pixel_proof']['channel_difference_count'],0)
        output,_=self.engine.asset(self.owner,job['output']['asset_id']);placement=job['source_placement']
        with Image.open(io.BytesIO(output)) as delivery:
            region=delivery.crop((placement['x'],placement['y'],placement['x']+4,placement['y']+1))
            self.assertEqual(region.getchannel('A').tobytes(),source.getchannel('A').tobytes());self.assertEqual(delivery.info,{})

    def test_corrupt_svg_and_oversized_images_are_rejected(self):
        for raw in [b'<svg onload="alert(1)"></svg>',b'\x89PNG\r\n\x1a\ncorrupt',b'not image']:
            with self.assertRaises(GateError):
                self.engine.upload(self.owner,raw)
        with self.assertRaises(GateError):
            self.engine.upload(self.owner,b'x'*(12*1024*1024+1))
        self.assertEqual(self.engine.pairs(self.owner),[])

    def test_directions_and_faithful_pixels_are_losslessly_preserved(self):
        for w,h in [(96,54),(54,96)]:
            raw=fixture(w,h);p=self.engine.upload(self.owner,raw);request=self.request(p,idempotency_key=digest(raw));j=self.wait(self.engine.expand(self.owner,request)['job_id']);self.assertEqual(j['status'],'READY');content,mime=self.engine.asset(self.owner,j['output']['asset_id']);result=Image.open(io.BytesIO(content)).convert('RGBA');source,_,_=image_info(raw);box=j['source_placement'];region=result.crop((box['x'],box['y'],box['x']+w,box['y']+h));self.assertEqual(region.tobytes(),source.tobytes());self.assertEqual(result.width/result.height,9/16 if w>h else 16/9);self.assertEqual(mime,'image/png');self.assertNotEqual(digest(content),p['original']['sha256'])

    def test_ownership_for_pair_job_asset_and_deletion(self):
        p=self.engine.upload(self.owner,fixture());j=self.wait(self.engine.expand(self.owner,self.request(p))['job_id']);
        for action in [lambda:self.engine.pair(self.other,p['pair_id']),lambda:self.engine.job(self.other,j['job_id']),lambda:self.engine.asset(self.other,j['output']['asset_id']),lambda:self.engine.delete(self.other,p['pair_id'])]:
            with self.assertRaises(GateError) as e:
                action()
            self.assertEqual(e.exception.status,404)
        self.assertEqual(len(self.engine.pairs(self.owner)),1)

    def test_persisted_idempotency_token_prevents_duplicates_and_parameter_reuse(self):
        p=self.engine.upload(self.owner,fixture());r=self.request(p);j=self.engine.expand(self.owner,r);self.assertEqual(j['job_id'],self.engine.expand(self.owner,r)['job_id']);self.wait(j['job_id']);self.assertEqual(j['job_id'],self.engine.expand(self.owner,r)['job_id']);
        with self.assertRaises(GateError) as error:
            self.engine.expand(self.owner,{**r,'seed':43})
        self.assertEqual(error.exception.code,'IDEMPOTENCY_CONFLICT')
        self.engine.close();self.engine=Engine(self.cfg);self.assertEqual(j['job_id'],self.engine.expand(self.owner,r)['job_id'])

    def test_wrong_input_target_prompt_cost_admin_and_seed_are_rejected(self):
        p=self.engine.upload(self.owner,fixture());
        for patch in [{'input_sha256':'0'*64},{'target':'landscape'},{'mode':'unknown'},{'seed':True},{'seed':-1},{'prompt':'x'*801},{'provider':'open-proxy'},{'cost':0},{'admin':True}]:
            with self.assertRaises(GateError):
                self.engine.expand(self.owner,self.request(p,**patch))

    def test_no_external_consent_no_billing(self):
        p=self.engine.upload(self.owner,fixture());
        with self.assertRaises(GateError) as error:
            self.engine.expand(self.owner,self.request(p,provider='bria'))
        self.assertEqual(error.exception.code,'EXTERNAL_CONSENT_REQUIRED')
        j=self.engine.expand(self.owner,self.request(p,provider='bria',consent=True));self.assertEqual(j['status'],'HELD');self.assertEqual(j['generation_attempts'],0);self.assertEqual(self.engine.db.execute('SELECT COUNT(*) FROM usage').fetchone()[0],0)

    def test_global_verified_free_cap_is_one_and_survives_restart(self):
        self.cfg.live_requested=True;self.cfg.free_verified=True;self.cfg.retention_reviewed=True;self.cfg.free_cap=1;self.cfg.bria_token='TEST_DOUBLE_ONLY';self.cfg.asset_hosts=('assets.example.invalid',);self.cfg.evidence={'bria':review_record()}
        class FakeAdapter:
            calls=0
            def expand(self,*args):
                self.calls+=1;raise ProviderError('PROVIDER_RATE_LIMIT')
        fake=FakeAdapter();self.engine.adapter=fake;p=self.engine.upload(self.owner,fixture());first=self.engine.expand(self.owner,self.request(p,provider='bria',consent=True));self.wait(first['job_id']);second=self.engine.expand(self.owner,self.request(p,provider='bria',consent=True,idempotency_key=digest(b'second')));self.assertEqual(second['status'],'HELD');self.assertEqual(fake.calls,1);self.assertEqual(self.engine.db.execute("SELECT n FROM usage WHERE name='global_live'").fetchone()[0],1)
        self.engine.close();self.engine=Engine(self.cfg,adapter=fake);third=self.engine.expand(self.owner,self.request(p,provider='bria',consent=True,idempotency_key=digest(b'third')));self.assertEqual(third['status'],'HELD');self.assertEqual(fake.calls,1)

    def test_cancel_is_terminal_and_delete_removes_private_files(self):
        p=self.engine.upload(self.owner,fixture());j=self.engine.expand(self.owner,self.request(p,provider='bria',consent=True));r=self.engine.cancel(self.owner,j['job_id']);self.assertEqual(r['status'],'CANCELLED');self.assertFalse(r['upstream_cancel_guaranteed']);self.engine.delete(self.owner,p['pair_id']);self.assertFalse(any(self.engine.root.glob(p['pair_id']+'_*')));self.assertEqual(self.engine.pairs(self.owner),[])

    def test_ttl_purge_removes_assets_and_manifest(self):
        p=self.engine.upload(self.owner,fixture());self.engine.db.execute('UPDATE pairs SET created=? WHERE id=?',(time.time()-90000,p['pair_id']));self.engine.db.commit();self.assertEqual(self.engine.purge(),1);self.assertFalse(any(self.engine.root.glob(p['pair_id']+'_*')))

    def test_comparison_scores_lock_and_client_eligibility_is_not_trusted(self):
        p=self.engine.upload(self.owner,fixture());s={'comparison_id':'d'*64,'pair_id':p['pair_id'],'original_sha256':p['original']['sha256'],'eligible':True};saved=self.engine.compare(self.owner,s);self.assertTrue(saved['locked']);self.assertFalse(saved['controlled_aggregate']);
        with self.assertRaises(GateError) as error:
            self.engine.compare(self.owner,s)
        self.assertEqual(error.exception.code,'SCORE_LOCKED')

    def test_rate_limit_blocks_further_authenticated_requests(self):
        for _ in range(120):
            self.engine.rate(self.owner)
        with self.assertRaises(GateError) as error:
            self.engine.rate(self.owner)
        self.assertEqual(error.exception.status,429)

    def test_crash_recovery_holds_in_flight_job_without_repeating_provider_request(self):
        p=self.engine.upload(self.owner,fixture());j=self.engine.expand(self.owner,self.request(p,provider='bria',consent=True));j['status']='RUNNING';self.engine._save_job(j);self.engine.close();self.engine=Engine(self.cfg);self.assertEqual(self.engine.job(self.owner,j['job_id'])['status'],'HELD');self.assertEqual(self.engine.job(self.owner,j['job_id'])['error'],'INTERRUPTED_REQUIRES_OPERATOR_RECONCILIATION')


class ProviderTests(unittest.TestCase):
    def test_optional_empty_prompt_and_malformed_pending_response(self):
        for job in [{'seed':42}, {'seed':42,'prompt':''}]:
            self.assertNotIn('prompt', bria_payload(b'png',job,geometry(96,54,'portrait')))
        for status in (200,202,420,423):
            for payload in (None,[], 'not-an-object'):
                with self.assertRaises(ProviderError) as error:
                    parse_response(status,payload)
                self.assertEqual(error.exception.code,'PROVIDER_INVALID_RESPONSE')

    def test_explicit_geometry_payload_never_uses_crop_prone_aspect_ratio(self):
        p=geometry(96,54,'portrait');body=bria_payload(b'png',{'seed':42,'prompt':'Continue scenery'},p);self.assertNotIn('aspect_ratio',body);self.assertEqual(body['canvas_size'],[1080,1920]);self.assertEqual(body['original_image_size'],[96,54]);self.assertTrue(body['visual_input_content_moderation']);
        with self.assertRaises(ProviderError):
            bria_payload(b'png',{'seed':42,'prompt':'okolica č'},p)

    def test_response_contract_200_202_pending_errors_429(self):
        self.assertEqual(parse_response(200,{'request_id':'x','result':{'image_url':'https://assets.example.invalid/x.png'}})['state'],'ready');self.assertEqual(parse_response(202,{'request_id':'x','status_url':'https://engine.prod.bria-api.com/v2/status/x'})['state'],'pending');self.assertEqual(parse_response(423,{})['state'],'pending')
        for status,payload in [(429,{}),(500,{}),(200,{'status':'FAILED'}),(200,{})]:
            with self.assertRaises(ProviderError):
                parse_response(status,payload)

    def test_ssrf_credentials_redirect_and_untrusted_output_hosts_rejected(self):
        for url in ['http://assets.example.invalid/x','https://localhost/x','https://assets.example.invalid.evil/x','https://user:secret@assets.example.invalid/x','https://127.0.0.1/x']:
            with self.assertRaises(ProviderError):
                validate_remote_url(url,('assets.example.invalid',),resolve=False)
        self.assertEqual(validate_remote_url('https://assets.example.invalid/x',('assets.example.invalid',),resolve=False),'https://assets.example.invalid/x')

    def test_malformed_provider_url_values_are_rejected_without_network(self):
        for url in (None, {}, ['https://assets.example.invalid/x'], 123, b'https://assets.example.invalid/x', '', 'x'*8193):
            with self.subTest(url_type=type(url).__name__):
                with self.assertRaises(ProviderError) as error:
                    validate_remote_url(url, ('assets.example.invalid',), resolve=False)
                self.assertEqual(error.exception.code, 'PROVIDER_URL_DENIED')

    def test_async_success_is_one_submit_then_polls_and_download(self):
        calls=[]
        def transport(method,url,body,auth):
            calls.append((method,url,auth));
            if method=='POST':
                return 202,{'request_id':'req1','status_url':'https://engine.prod.bria-api.com/v2/status/req1'}
            if auth:
                return 200,{'status':'COMPLETED','result':{'image_url':'https://assets.example.invalid/image.png?X-Amz-Signature=TEST&X-Amz-Credential=TEST&X-Amz-Expires=300&X-Amz-Date=20261013T000000Z','seed':42}}
            return 200,b'pngbytes'
        receipts=[];adapter=BriaAdapter('TEST_ONLY',('assets.example.invalid',),transport,interval=0);data,r=adapter.expand(b'png',{'seed':42,'prompt':''},geometry(96,54,'portrait'),on_submit=receipts.append);self.assertEqual(data,b'pngbytes');self.assertEqual(r['provider_request_id'],'req1');self.assertEqual(sum(m=='POST' for m,_,_ in calls),1);self.assertIsNone(r['provider_cost']);self.assertEqual(len(receipts),1);self.assertFalse(calls[-1][2])

    def test_pending_timeout_and_cancel_do_not_retry_generation(self):
        calls=[]
        def transport(method,*args):
            calls.append(method);return 202,{'request_id':'x','status_url':'https://engine.prod.bria-api.com/v2/status/x'}
        adapter=BriaAdapter('TEST_ONLY',(),transport,polls=2,interval=0)
        with self.assertRaises(ProviderError) as error:
            adapter.expand(b'png',{'seed':42,'prompt':''},geometry(96,54,'portrait'))
        self.assertEqual(error.exception.code,'PROVIDER_PENDING_TIMEOUT');self.assertEqual(calls.count('POST'),1)
        with self.assertRaises(ProviderError) as error:
            adapter.expand(b'png',{'seed':42,'prompt':''},geometry(96,54,'portrait'),cancelled=lambda:True)
        self.assertEqual(error.exception.code,'CANCELLED');self.assertEqual(calls.count('POST'),1)

    def test_pixel_compositing_is_exact_and_wrong_provider_canvas_fails(self):
        source=Image.new('RGBA',(96,54),(1,2,3,128));p=geometry(96,54,'portrait');result=protect_original(Image.new('RGB',(1080,1920),'red'),source,p);self.assertEqual(result.crop((p['x'],p['y'],p['x']+96,p['y']+54)).tobytes(),source.tobytes());
        with self.assertRaises(ProviderError):
            protect_original(Image.new('RGB',(500,500)),source,p)


class UpgradeTests(unittest.TestCase):
    setUp=EngineTests.setUp
    tearDown=EngineTests.tearDown
    request=EngineTests.request
    wait=EngineTests.wait
    def test_creative_geometry_is_exact_requested_canvas_even_for_large_original(self):
        for mode in ('smart','infographic'):
            for quality,expected in [('hd',(1080,1920)),('4k',(2160,3840))]:
                p=geometry(6000,4000,'portrait','center',quality,mode)
                self.assertEqual((p['width'],p['height']),expected);self.assertLess(p['scale'],1);self.assertTrue(p['source_is_resampled']);self.assertEqual(p['source_width'],expected[0])
        with self.assertRaises(GateError):geometry(6000,4000,'portrait','center','hd','faithful')

    def test_seed_and_whitelisted_options_participate_in_task_hash(self):
        p=self.engine.upload(self.owner,fixture())
        one=self.engine.expand(self.owner,self.request(p,provider='fal',model='fal-sunburst',consent=True));two=self.engine.expand(self.owner,self.request(p,provider='fal',model='fal-sunburst',consent=True,seed=43,idempotency_key=digest(b'new-seed')));three=self.engine.expand(self.owner,self.request(p,provider='fal',model='fal-sunburst',consent=True,parameters={'quality':'max'},idempotency_key=digest(b'new-option')))
        self.assertEqual(len({one['task_parameters_hash'],two['task_parameters_hash'],three['task_parameters_hash']}),3)

    def test_evidence_is_exact_endpoint_and_quality_specific(self):
        self.cfg.live_requested=self.cfg.free_verified=self.cfg.retention_reviewed=True;self.cfg.free_cap=1;self.cfg.fal_token='TEST';self.cfg.evidence={'fal':{**review_record(),'allowed_endpoint_ids':['fal-ai/bria/expand'],'qualities':['hd']}}
        self.assertTrue(self.cfg.live_gate('fal','fal-bria','hd'));self.assertFalse(self.cfg.live_gate('fal','fal-bria','4k'));self.assertFalse(self.cfg.live_gate('fal','fal-nano','hd'))
        self.cfg.evidence['fal'].pop('submitter');self.assertFalse(self.cfg.live_gate('fal','fal-bria','hd'))

    def test_private_state_and_evidence_cannot_be_under_any_publishable_subtree(self):
        for path in (PUBLIC_PUBLISH_ROOT,PUBLIC_PUBLISH_ROOT/'private-data',PUBLIC_PUBLISH_ROOT/'Nara/private-data'):
            with self.assertRaises(ValueError):Config(path,[TOKEN_A],{})
        raw=json.dumps({'fal':review_record()}).encode()
        with mock.patch.object(Path,'read_bytes',return_value=raw) as reader:
            cfg=Config(self.tmp.name,[TOKEN_A],{'DUALFRAME_PROVIDER_EVIDENCE_FILE':str(PUBLIC_PUBLISH_ROOT/'Nara/private-data/evidence.json'),'DUALFRAME_PROVIDER_EVIDENCE_SHA256':digest(raw)})
            self.assertEqual(cfg.evidence,{});reader.assert_not_called()

    def test_second_gateway_owner_is_rejected(self):
        with self.assertRaises(ValueError) as e:Engine(self.cfg)
        self.assertEqual(str(e.exception),'ONE_GATEWAY_OWNER_REQUIRED')

    def test_legacy_budget_is_preserved_in_global_ledger(self):
        self.engine.db.execute("INSERT INTO usage VALUES ('bria_free',1)");self.engine.db.commit();self.engine.close();self.engine=Engine(self.cfg)
        self.assertEqual(self.engine.db.execute("SELECT n FROM usage WHERE name='global_live'").fetchone()[0],1)

    def test_three_modes_are_separate_and_pixel_proof_checks_decoded_output(self):
        p=self.engine.upload(self.owner,fixture())
        hashes=[]
        for mode in ('faithful','smart','infographic'):
            j=self.wait(self.engine.expand(self.owner,self.request(p,mode=mode,idempotency_key=digest(mode.encode())))['job_id'])
            self.assertEqual(j['status'],'READY');self.assertEqual(j['output']['mode'],mode)
            proof=j['output']['pixel_proof'];self.assertEqual(proof['checked_scope'],'decoded-saved-output-normalized-rgba' if mode=='faithful' else 'not-applicable-creative-task')
            self.assertEqual(proof['verified'],mode=='faithful');self.assertEqual(j['output']['creative_changes'],mode!='faithful')
            self.assertTrue(j['output']['provenance_verified']);self.assertEqual(j['output']['provenance']['source_sha256'],p['original']['sha256'])
            if mode=='faithful':self.assertEqual(proof['channel_difference_count'],0)
            hashes.append(j['task_parameters_hash'])
        self.assertEqual(len(set(hashes)),3)

    def test_fal_all_models_are_held_without_independent_account_evidence(self):
        p=self.engine.upload(self.owner,fixture())
        for key in FAL_MODELS:
            j=self.engine.expand(self.owner,self.request(p,provider='fal',model=key,consent=True,idempotency_key=digest(key.encode())))
            self.assertEqual(j['status'],'HELD');self.assertEqual(j['generation_attempts'],0)
        self.assertEqual(self.engine.db.execute('SELECT COUNT(*) FROM usage').fetchone()[0],0)
        c=self.engine.capabilities();self.assertEqual(len(c['models']),5);self.assertEqual(c['quotas']['global_real_submissions_max'],1)

    def test_parameter_whitelist_model_mode_and_provider_are_enforced(self):
        p=self.engine.upload(self.owner,fixture())
        for patch in ({'model':'fal-bria'},{'provider':'fal','model':'fal-bria','mode':'infographic','consent':True},{'parameters':{'api_key':'secret'}},{'provider':'fal','model':'fal-nano','parameters':{'thinking_level':'invalid'},'consent':True},{'quality':'8k'}):
            with self.assertRaises(GateError):self.engine.expand(self.owner,self.request(p,**patch))

    def test_legacy_cinematic_maps_to_smart_without_pixel_claim(self):
        p=self.engine.upload(self.owner,fixture());j=self.wait(self.engine.expand(self.owner,self.request(p,mode='cinematic'))['job_id'])
        self.assertEqual(j['mode'],'smart');self.assertFalse(j['output']['pixel_proof']['verified'])

    def test_4k_demo_is_never_native_and_cannot_be_accepted_into_4k_slot(self):
        p=self.engine.upload(self.owner,fixture());j=self.wait(self.engine.expand(self.owner,self.request(p,quality='4k'))['job_id'])
        self.assertEqual((j['output']['width'],j['output']['height']),(2160,3840));self.assertFalse(j['output']['native_4k']);self.assertFalse(j['output']['resolution_verified'])
        with self.assertRaises(GateError) as error:self.engine.accept(self.owner,j['job_id'])
        self.assertEqual(error.exception.code,'QUALITY_4K_NOT_VERIFIED')

    def test_same_task_same_hash_across_models_and_restart_keeps_receipt_hidden(self):
        p=self.engine.upload(self.owner,fixture())
        a=self.engine.expand(self.owner,self.request(p,provider='bria',consent=True));b=self.engine.expand(self.owner,self.request(p,provider='fal',model='fal-sunburst',consent=True,idempotency_key=digest(b'fal')))
        self.assertEqual(a['task_parameters_hash'],b['task_parameters_hash'])
        a.update(status='RUNNING',provider_request_id='known-request',status_url='https://engine.prod.bria-api.com/v2/status/known-request',response_url='SECRET_URL');self.engine._save_job(a)
        self.engine.close();self.engine=Engine(self.cfg)
        recovered=self.engine.job(self.owner,a['job_id']);self.assertEqual(recovered['status'],'HELD');self.assertEqual(recovered['error'],'INTERRUPTED_CAN_RESUME_RECEIPT');self.assertNotIn('status_url',recovered);self.assertNotIn('response_url',recovered)

    def test_global_cap_applies_to_bria_and_fal_concurrent_submissions(self):
        self.cfg.live_requested=self.cfg.free_verified=self.cfg.retention_reviewed=True;self.cfg.free_cap=1;self.cfg.bria_token=self.cfg.fal_token='TEST_DOUBLE';self.cfg.asset_hosts=('assets.example.invalid',);self.cfg.evidence={'bria':review_record(),'fal':review_record()}
        class Fake:
            calls=0
            def expand(self,*args):self.calls+=1;raise ProviderError('PROVIDER_TIMEOUT')
        fake=Fake();self.engine.adapter=self.engine.fal_adapter=fake;p=self.engine.upload(self.owner,fixture());results=[]
        requests=[self.request(p,provider='bria',consent=True),self.request(p,provider='fal',model='fal-bria',consent=True,idempotency_key=digest(b'concurrent'))]
        threads=[threading.Thread(target=lambda r=r:results.append(self.engine.expand(self.owner,r))) for r in requests]
        for t in threads:t.start()
        for t in threads:t.join()
        for j in results:self.wait(j['job_id'])
        self.assertEqual(fake.calls,1);self.assertEqual(self.engine.db.execute("SELECT n FROM usage WHERE name='global_live'").fetchone()[0],1)

    def test_mismatched_canvas_restores_pixels_and_discloses_interpolation(self):
        self.cfg.live_requested=self.cfg.free_verified=self.cfg.retention_reviewed=True;self.cfg.free_cap=1;self.cfg.bria_token='TEST_DOUBLE';self.cfg.asset_hosts=('assets.example.invalid',);self.cfg.evidence={'bria':review_record()}
        class Fake:
            def expand(self,png,job,p,stop,submit):return fixture(64,64),{'provider_request_id':'known','model_or_version':'test-transport','provider_model_id':'test','provider_cost':None}
        self.engine.adapter=Fake();p=self.engine.upload(self.owner,fixture());j=self.wait(self.engine.expand(self.owner,self.request(p,provider='bria',consent=True))['job_id'])
        self.assertEqual(j['status'],'READY');self.assertEqual(j['output']['background_transform']['from'],[64,64]);self.assertFalse(j['output']['native_4k']);self.assertFalse(j['output']['resolution_verified']);self.assertEqual(j['output']['pixel_proof']['channel_difference_count'],0)

    def test_resume_known_request_does_not_submit_or_take_new_quota(self):
        class Fake:
            def resume(self,job,p,stop):return fixture(p['width'],p['height']),{'provider_request_id':job['provider_request_id'],'model_or_version':'resume-fixture','provider_model_id':'test','provider_cost':None}
            def expand(self,*args):raise AssertionError('resume must never expand')
        self.cfg.bria_token='TEST';self.cfg.asset_hosts=('assets.example.invalid',);self.cfg.evidence={'bria':review_record()};self.engine.adapter=Fake();p=self.engine.upload(self.owner,fixture());j=self.engine.expand(self.owner,self.request(p,provider='bria',consent=True));j.update(provider_request_id='known',generation_attempts=1);self.engine._save_job(j)
        resumed=self.wait(self.engine.resume(self.owner,j['job_id'])['job_id']);self.assertEqual(resumed['status'],'READY');self.assertEqual(resumed['generation_attempts'],1);self.assertEqual(self.engine.db.execute('SELECT COUNT(*) FROM usage').fetchone()[0],0)

    def test_malformed_bria_status_url_holds_receipt_and_never_resubmits(self):
        self.cfg.live_requested=self.cfg.free_verified=self.cfg.retention_reviewed=True;self.cfg.free_cap=1;self.cfg.bria_token='TEST_DOUBLE';self.cfg.asset_hosts=('assets.example.invalid',);self.cfg.evidence={'bria':review_record()}
        calls=[]
        def transport(method,url,body,auth):
            calls.append(method)
            return 202,{'request_id':'known-malformed','status_url':{'unexpected':'object'},'status':'PENDING'}
        self.engine.adapter=BriaAdapter('TEST_DOUBLE',self.cfg.asset_hosts,transport=transport,polls=1,interval=0)
        p=self.engine.upload(self.owner,fixture());request=self.request(p,provider='bria',consent=True)
        j=self.wait(self.engine.expand(self.owner,request)['job_id'])
        self.assertEqual(j['status'],'HELD');self.assertEqual(j['error'],'PROVIDER_URL_DENIED');self.assertEqual(j['provider_request_id'],'known-malformed');self.assertNotIn('status_url',j)
        self.assertEqual(self.engine.expand(self.owner,request)['job_id'],j['job_id'])
        resumed=self.wait(self.engine.resume(self.owner,j['job_id'])['job_id'])
        self.assertEqual(resumed['status'],'HELD');self.assertEqual(resumed['provider_request_id'],'known-malformed');self.assertEqual(resumed['generation_attempts'],1)
        self.assertEqual(calls,['POST']);self.assertEqual(self.engine.db.execute("SELECT n FROM usage WHERE name='global_live'").fetchone()[0],1)

    def test_unexpected_worker_fault_is_sanitized_and_known_receipt_can_resume(self):
        self.cfg.live_requested=self.cfg.free_verified=self.cfg.retention_reviewed=True;self.cfg.free_cap=1;self.cfg.bria_token='TEST_DOUBLE';self.cfg.asset_hosts=('assets.example.invalid',);self.cfg.evidence={'bria':review_record()}
        class Fake:
            calls=0
            def expand(self,png,job,p,stop,submit):
                self.calls+=1;submit({'request_id':'known-fault','status_url':'https://engine.prod.bria-api.com/v2/status/known-fault'})
                raise RuntimeError('sensitive-provider-response-and-private-token')
            def resume(self,job,p,stop):
                return fixture(p['width'],p['height']),{'provider_request_id':job['provider_request_id'],'model_or_version':'offline-resume-fixture','provider_model_id':'test','provider_cost':None}
        fake=Fake();self.engine.adapter=fake;p=self.engine.upload(self.owner,fixture());request=self.request(p,provider='bria',consent=True)
        j=self.wait(self.engine.expand(self.owner,request)['job_id'])
        self.assertEqual(j['status'],'HELD');self.assertEqual(j['error'],'PROVIDER_PROCESSING_FAILED');self.assertEqual(j['provider_request_id'],'known-fault');self.assertNotIn('private-token',json.dumps(j))
        resumed=self.wait(self.engine.resume(self.owner,j['job_id'])['job_id'])
        self.assertEqual(resumed['status'],'READY');self.assertEqual(resumed['generation_attempts'],1);self.assertEqual(fake.calls,1)
        self.assertEqual(self.engine.db.execute("SELECT n FROM usage WHERE name='global_live'").fetchone()[0],1)

    def test_hash_bound_evidence_rejects_boolean_only_or_unreviewed_record(self):
        cfg=Config(self.tmp.name,[TOKEN_A],{'BRIA_API_TOKEN':'TEST','BRIA_ASSET_HOSTS':'assets.example.invalid','DUALFRAME_LIVE_ENABLED':'1','DUALFRAME_FREE_ENTITLEMENT_VERIFIED':'1','DUALFRAME_RETENTION_REVIEWED':'1','DUALFRAME_VERIFIED_FREE_REQUESTS':'1'})
        self.assertFalse(cfg.live_gate());cfg.evidence={'bria':{**review_record(),'reviewer':'fixture-owner'}};self.assertFalse(cfg.live_gate())
        path=Path(self.tmp.name)/'review.json';raw=json.dumps({'bria':review_record()}).encode();path.write_bytes(raw)
        cfg=Config(self.tmp.name,[TOKEN_A],{'BRIA_API_TOKEN':'TEST','BRIA_ASSET_HOSTS':'assets.example.invalid','DUALFRAME_LIVE_ENABLED':'1','DUALFRAME_FREE_ENTITLEMENT_VERIFIED':'1','DUALFRAME_RETENTION_REVIEWED':'1','DUALFRAME_VERIFIED_FREE_REQUESTS':'1','DUALFRAME_PROVIDER_EVIDENCE_FILE':str(path),'DUALFRAME_PROVIDER_EVIDENCE_SHA256':digest(raw)})
        self.assertTrue(cfg.live_gate())


class FalTests(unittest.TestCase):
    def job(self,model='fal-bria',mode='faithful',quality='hd'):
        return {'model':model,'mode':mode,'quality':quality,'target':'portrait','seed':42,'prompt':'Continue mountains','parameters':{}}

    def test_exact_ids_and_schema_parameter_isolation(self):
        p=geometry(96,54,'portrait');b=fal_payload(b'png',self.job(),p)
        self.assertEqual(b['canvas_size'],[1080,1920]);self.assertNotIn('aspect_ratio',b);self.assertTrue(b['image_url'].startswith('data:image/png;base64,'))
        s=fal_payload(b'png',self.job('fal-sunburst'),p);self.assertEqual(s['image_size'],{'width':1080,'height':1920});self.assertTrue(s['enable_safety_checker']);self.assertNotIn('seed',s)
        n=fal_payload(b'png',self.job('fal-nano',quality='4k'),p);self.assertEqual(n['resolution'],'4K');self.assertTrue(n['limit_generations']);self.assertFalse(n['enable_web_search']);self.assertNotIn('mask_url',n)
        self.assertEqual(FAL_PRIVACY_HEADERS['X-Fal-No-Retry'],'1');self.assertEqual(FAL_PRIVACY_HEADERS['X-Fal-Store-IO'],'0');self.assertEqual(FAL_PRIVACY_HEADERS['x-app-fal-disable-fallback'],'true')

    def test_one_submission_queue_receipt_private_acl_and_bearer_download(self):
        calls=[];receipt=[]
        def transport(method,url,body,access):
            calls.append((method,url,access,body))
            if 'storage/files/acl' in url:return 200,{'default':'forbid','rules':[]}
            if 'storage/auth/token' in url:return 200,{'token':'SERVER_ONLY_PRIVATE_TOKEN'}
            if access=='media':return 200,b'PRIVATE_IMAGE'
            if method=='POST':return 202,{'request_id':'known','status_url':'https://queue.fal.run/fal-ai/bria/requests/known/status','response_url':'https://queue.fal.run/fal-ai/bria/requests/known/response'}
            if url.endswith('/status'):return 200,{'status':'COMPLETED'}
            return 200,{'image':{'url':'https://v3b.fal.media/private.png','width':None},'seed':42}
        adapter=FalAdapter('TEST',transport,polls=3,interval=0);data,r=adapter.expand(b'png',self.job(),geometry(96,54,'portrait'),on_submit=receipt.append)
        self.assertEqual(data,b'PRIVATE_IMAGE');self.assertEqual(r['provider_model_id'],'fal-ai/bria/expand');self.assertIsNone(r['provider_cost']);self.assertEqual(sum(m=='POST' and a=='api' for m,u,a,b in calls),1);self.assertEqual(receipt[0]['request_id'],'known');self.assertNotIn('SERVER_ONLY_PRIVATE_TOKEN',json.dumps(r))
        calls.clear();adapter.resume({**self.job(),'provider_request_id':'known','status_url':receipt[-1]['status_url'],'response_url':receipt[-1]['response_url']},geometry(96,54,'portrait'))
        self.assertEqual(sum(m=='POST' and a=='api' for m,u,a,b in calls),0)

    def test_public_or_unverified_assets_are_held_without_download(self):
        for url in ('https://v3.fal.media/public.png','https://evil.invalid/x.png'):
            def transport(method,url_,body,access):return 200,{'request_id':'known','images':[{'url':url}]}
            with self.assertRaises(ProviderError) as e:FalAdapter('TEST',transport,interval=0).expand(b'png',self.job('fal-nano'),geometry(96,54,'portrait'))
            self.assertEqual(e.exception.code,'PROVIDER_PRIVATE_ASSET_HELD')
        def public_acl(method,url,body,access):return (200,{'default':'allow','rules':[]}) if access=='storage' else (200,{'request_id':'known','images':[{'url':'https://v3b.fal.media/private.png'}]})
        with self.assertRaises(ProviderError) as e:FalAdapter('TEST',public_acl,interval=0).expand(b'png',self.job('fal-nano'),geometry(96,54,'portrait'))
        self.assertEqual(e.exception.code,'PROVIDER_ACL_UNVERIFIED')

    def test_pending_timeout_never_retries_generation_and_response_urls_are_bound(self):
        calls=[]
        def pending(method,url,body,access):
            calls.append(method);return 202,{'request_id':'known','status_url':'https://queue.fal.run/fal-ai/bria/requests/known/status','response_url':'https://queue.fal.run/fal-ai/bria/requests/known/response'}
        with self.assertRaises(ProviderError) as e:FalAdapter('TEST',pending,polls=2,interval=0).expand(b'png',self.job(),geometry(96,54,'portrait'))
        self.assertEqual(e.exception.code,'PROVIDER_PENDING_TIMEOUT');self.assertEqual(calls.count('POST'),1)
        adapter=FalAdapter('TEST',pending)
        for url in ('https://queue.fal.run/fal-ai/bria/requests/other/status','https://evil.invalid/requests/known/status','https://queue.fal.run/requests/known/status?token=x'):
            with self.assertRaises(ProviderError):adapter._queue_url(url,'known')

    def test_optional_actual_billing_matches_request_and_endpoint_only(self):
        def billing(method,url,body,access):return 200,{'billing_events':[{'request_id':'known','endpoint_id':'fal-ai/bria/expand','cost_total':0},{'request_id':'other','endpoint_id':'fal-ai/bria/expand','cost_total':100}],'has_more':False}
        adapter=FalAdapter('TEST',billing,billing_read=True);self.assertEqual(adapter._actual_cost('known','fal-ai/bria/expand'),0);self.assertIsNone(adapter._actual_cost('absent','fal-ai/bria/expand'));self.assertIsNone(adapter._actual_cost('known','google/nano-banana-2.1/edit'))
        self.assertIsNone(FalAdapter('TEST',lambda *args:(_ for _ in ()).throw(AssertionError('billing disabled')))._actual_cost('known','fal-ai/bria/expand'))

    def test_invalid_queue_url_preserves_submitted_request_id(self):
        receipts=[]
        def transport(method,url,body,access):return 202,{'request_id':'known','status_url':'https://evil.invalid/requests/known/status'}
        with self.assertRaises(ProviderError):FalAdapter('TEST',transport).expand(b'png',self.job(),geometry(96,54,'portrait'),on_submit=receipts.append)
        self.assertEqual(receipts,[{'request_id':'known'}])

    def test_direct_unsigned_and_long_signed_assets_are_held(self):
        for url in ('https://assets.example.invalid/public.png','https://assets.example.invalid/x?X-Amz-Signature=x&X-Amz-Credential=x&X-Amz-Expires=86400&X-Amz-Date=x'):
            with self.assertRaises(ProviderError):require_short_signed_asset(url)



class HttpTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.engine=Engine(Config(self.tmp.name,[TOKEN_A],{}));self.server=Server(('127.0.0.1',0),self.engine);self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start();self.url=f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.engine.close();self.tmp.cleanup()

    def request(self,path,method='GET',data=None,token=TOKEN_A,origin=None,mime='application/json'):
        headers={'Content-Type':mime}
        if token:
            headers['Authorization']='Bearer '+token
        if origin:
            headers['Origin']=origin
        request=urllib.request.Request(self.url+path,data=data,headers=headers,method=method)
        try:
            with urllib.request.urlopen(request,timeout=3) as response:
                body=response.read();return response.status,body,dict(response.headers)
        except urllib.error.HTTPError as response:
            return response.code,response.read(),dict(response.headers)

    def test_unauthenticated_upload_and_expand_cannot_create_state(self):
        self.assertEqual(self.request('/api/uploads','POST',fixture(),None,mime='image/png')[0],401);self.assertEqual(self.request('/api/expand','POST',b'{}',None)[0],401);self.assertEqual(len(self.engine.pairs(self.engine.auth(TOKEN_A))),0)

    def test_cors_and_secret_redaction(self):
        status,body,headers=self.request('/api/capabilities',origin='https://evil.invalid');self.assertEqual(status,403);self.assertNotIn('Access-Control-Allow-Origin',headers);status,body,headers=self.request('/api/capabilities',origin='https://bd-chess.github.io');self.assertEqual(status,200);self.assertEqual(headers['Access-Control-Allow-Origin'],'https://bd-chess.github.io');self.assertNotIn(TOKEN_A.encode(),body);self.assertNotIn(b'BRIA_API_TOKEN',body);self.assertFalse(json.loads(body)['live_enabled'])

    def test_mime_mismatch_does_not_delete_an_existing_original(self):
        status,body,_=self.request('/api/uploads','POST',fixture(),mime='image/png');self.assertEqual(status,201);id_=json.loads(body)['pair_id'];self.assertEqual(self.request('/api/uploads','POST',fixture(),mime='image/jpeg')[0],415);self.assertEqual(self.request('/api/pairs/'+id_)[0],200)

    def test_static_files_and_private_storage_boundary(self):
        status,body,headers=self.request('/',token=None);self.assertEqual(status,200);self.assertIn(b'DualFrame',body);self.assertIn('frame-ancestors',headers['Content-Security-Policy']);self.assertEqual(self.request('/app.mjs',token=None)[0],200);self.assertEqual(self.request('/../../tools/dualframe-ai-lab/.env',token=None)[0],404);self.assertEqual(self.request('/.env',token=None)[0],404);self.assertEqual(self.request('/state.sqlite3',token=None)[0],404)


if __name__=='__main__':
    unittest.main(verbosity=2)

