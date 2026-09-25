"""Deterministic synthetic tests; not Apple signing or native Windows acceptance."""
import copy
import datetime as dt
import importlib.util
from pathlib import Path
import plistlib
import sys
import tempfile
import unittest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import ios_ci as ci
import ios_signing_windows as signing

TEAM = 'ABCDEF1234'
UUID = '12345678-1234-1234-1234-123456789ABC'
SHA = 'a' * 40

def good_env():
    return dict(GITHUB_REPOSITORY=ci.REPO, GITHUB_EVENT_NAME='push',
                GITHUB_REF='refs/tags/8zsudoku-testflight-001', GITHUB_SHA=SHA,
                IOS_APPROVED_SHA=SHA, IOS_UPLOAD_ENABLED='true', IOS_TEAM_ID=TEAM)

def good_profile():
    return dict(UUID=UUID, ExpirationDate=dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=2),
                TeamIdentifier=[TEAM], ApplicationIdentifierPrefix=[TEAM], DeveloperCertificates=[b'synthetic-DER'],
                Entitlements={'application-identifier':TEAM+'.'+ci.BUNDLE,
                              'com.apple.developer.team-identifier':TEAM,
                              'get-task-allow':False,'beta-reports-active':True})

class GuardTests(unittest.TestCase):
    def test_explicit_approval(self): ci.approval(good_env())
    def test_fail_closed_each_missing_input(self):
        for key in good_env():
            env=good_env(); del env[key]
            with self.subTest(key=key), self.assertRaises(ValueError): ci.approval(env)
    def test_no_pr_branch_fork_or_changed_sha(self):
        for key,value in [('GITHUB_EVENT_NAME','pull_request'),('GITHUB_REF','refs/heads/main'),
                          ('GITHUB_REPOSITORY','someone/fork'),('IOS_APPROVED_SHA','b'*40),
                          ('IOS_UPLOAD_ENABLED','TRUE'),('IOS_TEAM_ID','invalid')]:
            env=good_env(); env[key]=value
            with self.subTest(key=key), self.assertRaises(ValueError): ci.approval(env)
    def test_build_number_order_and_retries(self):
        versions=[ci.build_number(n,a) for n in (1,2,99,100,999899) for a in (1,2,99)]
        numeric=[tuple(map(int,v.split('.'))) for v in versions]
        self.assertEqual(numeric,sorted(set(numeric)))
    def test_build_number_bounds(self):
        for n,a in [(0,1),(999900,1),(1,0),(1,100)]:
            with self.assertRaises(ValueError): ci.build_number(n,a)
    def test_store_profile_and_old_app_id_prefix(self):
        p=good_profile(); ci.profile_info(p,TEAM)
        p['ApplicationIdentifierPrefix']=['ZZZZZZ9999']; p['Entitlements']['application-identifier']='ZZZZZZ9999.'+ci.BUNDLE
        self.assertEqual(ci.profile_info(p,TEAM)[0],UUID)
    def test_expired_profile(self):
        p=good_profile(); p['ExpirationDate']=dt.datetime(2000,1,1)
        with self.assertRaises(ValueError): ci.profile_info(p,TEAM)
    def test_other_team_or_bundle(self):
        for key,value in [('application-identifier',TEAM+'.wrong'),('com.apple.developer.team-identifier','ZZZZZZ9999')]:
            p=good_profile(); p['Entitlements'][key]=value
            with self.assertRaises(ValueError): ci.profile_info(p,TEAM)
    def test_debug_adhoc_enterprise_rejected(self):
        for key,value in [('ProvisionedDevices',[]),('ProvisionsAllDevices',False)]:
            p=good_profile();p[key]=value
            with self.assertRaises(ValueError):ci.profile_info(p,TEAM)
        p=good_profile();p['Entitlements']['get-task-allow']=True
        with self.assertRaises(ValueError):ci.profile_info(p,TEAM)
    def test_malformed_uuid_and_certificates(self):
        for key,value in [('UUID','../../bad'),('DeveloperCertificates',[]),('DeveloperCertificates',[b'a',b'b'])]:
            p=good_profile();p[key]=value
            with self.assertRaises(ValueError):ci.profile_info(p,TEAM)
    def test_patch_only_app_release(self):
        text='DEBUG_SENTINEL\n'+ci.RELEASE_ID+' /* Release */ = {\nisa = XCBuildConfiguration;\nbuildSettings = {\nCODE_SIGN_STYLE = Automatic;\nCURRENT_PROJECT_VERSION = 1;\nPRODUCT_BUNDLE_IDENTIFIER = '+ci.BUNDLE+';\n};\nname = Release;\n};\nOTHER_TARGET_SENTINEL'
        result=ci.patch_release(text,TEAM,UUID,'B'*40,'1.2.1')
        self.assertTrue(result.startswith('DEBUG_SENTINEL\n'));self.assertTrue(result.endswith('OTHER_TARGET_SENTINEL'))
        self.assertIn('PROVISIONING_PROFILE_SPECIFIER = "'+UUID+'";',result)
        self.assertIn('CURRENT_PROJECT_VERSION = 1.2.1;',result)
        with self.assertRaises(ValueError):ci.patch_release(text.replace(ci.RELEASE_ID,'X'),TEAM,UUID,'B'*40,'1.2.1')
    def test_manual_export_and_no_automatic_version_rewrite(self):
        opts=plistlib.loads(plistlib.dumps(ci.export_options(TEAM,UUID,'B'*40)))
        self.assertEqual(opts['method'],'app-store-connect')
        self.assertEqual(opts['provisioningProfiles'],{ci.BUNDLE:UUID})
        self.assertFalse(opts['manageAppVersionAndBuildNumber'])
    def test_built_bundle_asset_parity(self):
        with tempfile.TemporaryDirectory() as d:
            app=Path(d)/'App.app';web=Path(d)/'web';(app/'public').mkdir(parents=True);web.mkdir()
            (app/'Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier':ci.BUNDLE,'CFBundleDisplayName':'8zSudoku'}))
            for n in ('index.html','bridge.js'):(app/'public'/n).write_bytes(b'test');(web/n).write_bytes(b'test')
            ci.verify_bundle(app,web)
            (web/'bridge.js').write_bytes(b'changed')
            with self.assertRaises(ValueError):ci.verify_bundle(app,web)
    def test_key_directory_refuses_git_and_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);(p/'.git').mkdir()
            with self.assertRaises(ValueError):signing.safe_output(p/'keys',('k',))
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);(p/'k').write_text('keep')
            with self.assertRaises(ValueError):signing.safe_output(p,('k',))
            self.assertEqual((p/'k').read_text(),'keep')
    def test_encrypted_p12_roundtrip_and_mismatched_cert(self):
        key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'SYNTHETIC TEST ONLY')])
        now=dt.datetime.now(dt.timezone.utc)
        cert=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
              .serial_number(1).not_valid_before(now-dt.timedelta(days=1)).not_valid_after(now+dt.timedelta(days=1))
              .sign(key,hashes.SHA256()))
        key_bytes=key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,
                                   serialization.BestAvailableEncryption(b'key-test-password'))
        data=signing.make_p12(key_bytes,b'key-test-password',cert.public_bytes(serialization.Encoding.DER),b'p12-test-password')
        k,c,_=pkcs12.load_key_and_certificates(data,b'p12-test-password')
        self.assertEqual(c.serial_number,1);self.assertEqual(k.private_numbers(),key.private_numbers())
        with self.assertRaises(ValueError):pkcs12.load_key_and_certificates(data,b'wrong')
        other=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        other_bytes=other.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,
                                       serialization.BestAvailableEncryption(b'key-test-password'))
        with self.assertRaises(ValueError):signing.make_p12(other_bytes,b'key-test-password',cert.public_bytes(serialization.Encoding.DER),b'p12-test-password')

if __name__ == '__main__': unittest.main()
