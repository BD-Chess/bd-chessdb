import copy
import datetime as dt
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('ios_ci',Path(__file__).parents[1]/'scripts'/'ios_ci.py')
ios=importlib.util.module_from_spec(spec);spec.loader.exec_module(ios)

class ReleaseGuard(unittest.TestCase):
    def setUp(self):
        self.env={'GITHUB_REPOSITORY':'BD-Chess/bd-chessdb','GITHUB_EVENT_NAME':'push',
                  'GITHUB_REF':'refs/tags/chessbest-testflight-fixture','GITHUB_SHA':'a'*40,
                  'IOS_APPROVED_SHA':'a'*40,'CHESSBEST_TESTED_SHA':'a'*40,
                  'IOS_UPLOAD_ENABLED':'true','IOS_TEAM_ID':'ABCDEFGHIJ','IOS_BUILD_NUMBER':'1.0.1'}
    def test_exact_candidate_accepts(self):
        ios.approval(self.env)
    def test_wrong_or_missing_gate_rejects(self):
        for key,value in [('GITHUB_REF','refs/tags/8zsudoku-testflight-old'),('GITHUB_REF','refs/heads/feat/chessbest-ios-r2-20260928'),
                          ('IOS_APPROVED_SHA','b'*40),('CHESSBEST_TESTED_SHA',''),('IOS_UPLOAD_ENABLED','false'),('IOS_BUILD_NUMBER',''),('GITHUB_REPOSITORY','fork/bd-chessdb')]:
            with self.subTest(key=key,value=value):
                env=dict(self.env);env[key]=value
                with self.assertRaises(ValueError):ios.approval(env)
    def test_sudoku_profile_rejects(self):
        profile={'ExpirationDate':dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=1),
                 'TeamIdentifier':['ABCDEFGHIJ'],'ApplicationIdentifierPrefix':['ABCDEFGHIJ'],
                 'Entitlements':{'com.apple.developer.team-identifier':'ABCDEFGHIJ','application-identifier':'ABCDEFGHIJ.org.chessbest.eightzsudoku'}}
        with self.assertRaisesRegex(ValueError,'Wrong app'):ios.profile_info(profile,'ABCDEFGHIJ')
    def test_release_patch_binds_identity(self):
        text=(Path(__file__).parents[1]/'ios/App/App.xcodeproj/project.pbxproj').read_text()
        result=ios.patch_release(text,'ABCDEFGHIJ','12345678-1234-1234-1234-123456789abc','A'*40,'1.0.1')
        self.assertIn('CURRENT_PROJECT_VERSION = 1.0.1;',result)
        self.assertIn('PRODUCT_BUNDLE_IDENTIFIER = org.chessbest.chessbest;',result)

if __name__=='__main__':unittest.main()
