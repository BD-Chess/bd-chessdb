#!/usr/bin/env python3
"""Bounded semantic WKWebView probe on a fresh CI simulator. No user data/log dump."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

simulator, evidence_dir = sys.argv[1:]
evidence = Path(evidence_dir)
evidence.mkdir(parents=True, exist_ok=True)
bundle = 'org.chessbest.chessbest'
token = str(uuid.uuid4())
required = {'visibleBoard','localPieces','storageReady','libraryControl','legalMoveControl','sevenBundledTopPicks','realStockfishDepth3','noStartupErrors'}
metadata = {'commit':os.environ.get('GITHUB_SHA'),'probe_token':token,
            'xcode':subprocess.check_output(['xcodebuild','-version'],text=True).strip(),
            'simulator':simulator,'physical_device_tested':False,'files_share_tested':False}
(evidence/'run.json').write_text(json.dumps(metadata,indent=2)+'\n')
for phase in ['first','relaunch']:
    if phase == 'relaunch':
        subprocess.run(['xcrun','simctl','terminate',simulator,bundle],check=True)
    env = dict(os.environ, SIMCTL_CHILD_CHESSBEST_CI_PROBE='1',
               SIMCTL_CHILD_CHESSBEST_CI_TOKEN=token, SIMCTL_CHILD_CHESSBEST_CI_PHASE=phase)
    value=None
    failure='LAUNCH_FAILED'
    try:
        subprocess.run(['xcrun','simctl','launch',simulator,bundle],env=env,check=True)
        failure='CONTAINER_UNAVAILABLE'
        container=Path(subprocess.check_output(['xcrun','simctl','get_app_container',simulator,bundle,'data'],text=True).strip())
        source=container/'Library'/'Caches'/f'chessbest-{phase}.json'
        deadline=time.monotonic()+100
        while time.monotonic()<deadline:
            try:
                candidate=json.loads(source.read_text())
                if candidate.get('token')==token and candidate.get('phase')==phase:
                    value=candidate
                    break
            except (OSError,ValueError):
                pass
            time.sleep(0.5)
    except subprocess.CalledProcessError:
        value={'ok':False,'phase':phase,'token':token,'code':failure,'checks':{}}
    finally:
        subprocess.run(['xcrun','simctl','io',simulator,'screenshot',str(evidence/f'{phase}.png')],check=False)
    value=value or {'ok':False,'phase':phase,'token':token,'code':'NATIVE_RECEIPT_TIMEOUT','checks':{}}
    phase_required=required|({'studyCommitted'} if phase=='first' else {'studySurvivesTermination','gameSurvivesTermination'})
    value['unmet']=sorted(k for k in phase_required if value.get('checks',{}).get(k) is not True)
    (evidence/f'{phase}.json').write_text(json.dumps(value,indent=2,sort_keys=True)+'\n')
    if not value.get('ok') or value['unmet']:
        raise SystemExit('Native semantic readiness failed: '+phase+'; inspect retained screenshot and receipt')
print('PASS: fresh WKWebView board/PGN/legal move/SF/Study and process relaunch; Files/Share and physical phone remain separate')
