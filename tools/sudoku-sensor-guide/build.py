"""Prepare a bounded APP patch; stage tested bytes without moving any branch."""
import hashlib,json,os,pathlib,subprocess,sys,urllib.request
BASE='67828be99c7eb704efd037b58d4f33945581bab0'
ROOT=pathlib.Path(__file__).resolve().parents[2]
os.chdir(ROOT)
OUT=ROOT/'sensor-guide-evidence';OUT.mkdir(exist_ok=True)
SOURCE=pathlib.Path('public/S/app/app-solve-playback.js')
TEST=pathlib.Path('tests/sudoku-app-solve-playback-r5-browser.cjs')
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
def once(text,old,new):
 if text.count(old)!=1:raise RuntimeError('Expected exactly one anchor: '+old[:100])
 return text.replace(old,new,1)
def api(route,body):
 req=urllib.request.Request('https://api.github.com/repos/'+os.environ['GITHUB_REPOSITORY']+route,data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)
if sys.argv[1]=='prepare':
 source=SOURCE.read_text();assert git('hash-object',str(SOURCE))=='b8edb803f72484f8bcd56c1b4a80055cedaab882','Source changed; rebase and inspect before patching'
 source=once(source,"#appSolveReview,#appSolveInstruments,#appSolveSensorModal,#appAssist","#appSolveReview,#appSolveInstruments,#appSolveSensorModal,#appSolveSensorGuide,#appAssist")
 source=once(source,"||!sensorModal.hidden)return;","||!sensorModal.hidden||$('appSolveSensorGuide')?.open)return;")
 # A real header button precedes the five rows; bind colors to identity, not position.
 for n,key in [(2,'gini'),(3,'powr'),(4,'dens'),(5,'adsr')]:source=once(source,'.app-pos-sensor:nth-child('+str(n)+')','.app-pos-sensor[data-sensor='+key+']')
 assert source.rstrip().endswith('})();')
 source=source.rstrip()[:-5]+pathlib.Path('tools/sudoku-sensor-guide/guide.fragment.js').read_text()+'\n})();\n'
 SOURCE.write_text(source)
 test=TEST.read_text()
 anchor="    await page.keyboard.press('ArrowUp');assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),0,'ArrowUp -> first');"
 test=once(test,anchor,pathlib.Path('tools/sudoku-sensor-guide/browser.fragment.cjs').read_text()+'\n'+anchor)
 # The human timeline must be identified honestly by the same overview.
 human_anchor="    await frame.locator('#appSolveTabAI').click();"
 human_extra="    await frame.locator('#appSensorGuideOpen').click();assert.match(await frame.locator('#appSensorGuidePosition').innerText(),phone?/Človek/:/Human/);await frame.locator('#appSensorGuideClose').click();\n"
 test=once(test,human_anchor,human_extra+human_anchor)
 TEST.write_text(test)
 print('APP source and persistent browser regression suite patched; no branch updated.')
elif sys.argv[1]=='stage':
 result=json.loads((OUT/'solve-browser.json').read_text());assert result['status']=='PASS' and len(result['cases'])==20 and result['sensorGuideContexts']==4,result
 changed=['public/S/app/app-solve-playback.js','public/S/app/app.html','public/S/app/sw.js','public/S/app/release.json',str(TEST)]
 base_tree=git('rev-parse',BASE+'^{tree}')
 entries=[]
 for line in git('ls-tree',BASE+':public/S/app').splitlines():
  meta,name=line.split('\t',1);mode,typ,sha=meta.split()
  if name!='old':entries.append({'path':name,'mode':mode,'type':typ,'sha':sha})
 # Snapshot includes current APP assets and sources, but no recursively copied archives.
 archived=api('/git/trees',{'tree':entries})['sha']
 existing=set(git('ls-tree','--name-only',BASE+':public/S/app/old').splitlines())
 slot=next(f'{n:03d}' for n in range(1,1000) if f'{n:03d}' not in existing)
 tree=[{'path':'public/S/app/old/'+slot,'mode':'040000','type':'tree','sha':archived}]
 receipts=[]
 for filename in changed:
  data=pathlib.Path(filename).read_bytes();expected=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
  actual=api('/git/blobs',{'content':data.decode(),'encoding':'utf-8'})['sha'];assert actual==expected
  tree.append({'path':filename,'mode':'100644','type':'blob','sha':actual})
  receipts.append({'path':filename,'blob_sha':actual,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
 release=json.loads(pathlib.Path('public/S/app/release.json').read_text())
 evidence={'base_sha':BASE,'archive':'public/S/app/old/'+slot,'archive_tree':archived,'release_id':release['release_id'],'files':receipts,'browser_status':result['status'],'existing_browser_cases':20,'sensor_guide_contexts':4,'branch_updated':False}
 tree_sha=api('/git/trees',{'base_tree':base_tree,'tree':tree})['sha']
 commit=api('/git/commits',{'message':'feat(sudoku): fullscreen bilingual sensor guide with verified APP package','tree':tree_sha,'parents':[BASE]})['sha']
 evidence.update(candidate_sha=commit,tree_sha=tree_sha)
 (OUT/'staged-release.json').write_text(json.dumps(evidence,indent=2)+'\n')
 print('SENSOR_GUIDE_STAGED '+json.dumps(evidence))
else:raise SystemExit('Use prepare or stage')
