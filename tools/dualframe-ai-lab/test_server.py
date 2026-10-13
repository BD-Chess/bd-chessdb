"""Focused zero-network tests. Provider transport is an explicit test double."""
import io
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from PIL import Image
from server import Config, Engine, Server, GateError, digest, image_info, geometry, protect_original
from providers import BriaAdapter, ProviderError, bria_payload, parse_response, validate_remote_url

TOKEN_A='test-invite-A-000000000000000000000000'
TOKEN_B='test-invite-B-000000000000000000000000'


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
        self.cfg.live_requested=True;self.cfg.free_verified=True;self.cfg.retention_reviewed=True;self.cfg.free_cap=1;self.cfg.bria_token='TEST_DOUBLE_ONLY';self.cfg.asset_hosts=('assets.example.invalid',)
        class FakeAdapter:
            calls=0
            def expand(self,*args):
                self.calls+=1;raise ProviderError('PROVIDER_RATE_LIMIT')
        fake=FakeAdapter();self.engine.adapter=fake;p=self.engine.upload(self.owner,fixture());first=self.engine.expand(self.owner,self.request(p,provider='bria',consent=True));self.wait(first['job_id']);second=self.engine.expand(self.owner,self.request(p,provider='bria',consent=True,idempotency_key=digest(b'second')));self.assertEqual(second['status'],'HELD');self.assertEqual(fake.calls,1);self.assertEqual(self.engine.db.execute("SELECT n FROM usage WHERE name='bria_free'").fetchone()[0],1)
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

    def test_async_success_is_one_submit_then_polls_and_download(self):
        calls=[]
        def transport(method,url,body,auth):
            calls.append((method,url,auth));
            if method=='POST':
                return 202,{'request_id':'req1','status_url':'https://engine.prod.bria-api.com/v2/status/req1'}
            if auth:
                return 200,{'status':'COMPLETED','result':{'image_url':'https://assets.example.invalid/image.png','seed':42}}
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
