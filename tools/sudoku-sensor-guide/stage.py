import pathlib, hashlib, json, os, urllib.request, subprocess
BASE='67828be99c7eb704efd037b58d4f33945581bab0'
ROOT='9ee32bc63e1298ef0b23e8593da450b5ba2f7059'
out=pathlib.Path('sudoku-guide-evidence')
report=json.loads((out/'solve-browser.json').read_text())
assert report['status']=='PASS' and report['sensorGuideCases']==4 and len(report['cases'])==20
api='https://api.github.com/repos/'+os.environ['GITHUB_REPOSITORY']
def post(route,body):
 req=urllib.request.Request(api+route,data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
def entries(ref):
 result=[]
 for item in subprocess.check_output(['git','ls-tree','-z',ref]).split(b'\0'):
  if not item:continue
  meta,name=item.split(b'\t',1);mode,kind,sha=meta.decode().split()
  result.append({'path':name.decode(),'mode':mode,'type':kind,'sha':sha})
 return result
paths=['public/S/app/app-solve-playback.js','public/S/app/app.html','public/S/app/sw.js','public/S/app/release.json','tests/sudoku-app-sensor-guide-browser.cjs']
tree=[];files={}
for name in paths:
 b=pathlib.Path(name).read_bytes();expected=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
 r=post('/git/blobs',{'content':b.decode(),'encoding':'utf-8'});assert r['sha']==expected
 tree.append({'path':name,'mode':'100644','type':'blob','sha':expected})
 files[name]={'blob':expected,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
existing={e['path'] for e in entries(BASE+':public/S/app/old')};n=1
while f'{n:03}' in existing:n+=1
archive='public/S/app/old/'+f'{n:03}'
a=post('/git/trees',{'tree':[e for e in entries(BASE+':public/S/app') if e['path']!='old']})
tree.append({'path':archive,'mode':'040000','type':'tree','sha':a['sha']})
r=post('/git/trees',{'base_tree':ROOT,'tree':tree})
commit=post('/git/commits',{'message':'feat(sudoku): full-screen bilingual sensor guide\n\nPause-safe overview, individual sheets retained, accessible close/focus/scroll. Generated APP and PWA rebuilt; Chromium/WebKit phone/framed checks PASS. CURRENT/LAB/native unchanged.','tree':r['sha'],'parents':[BASE]})
receipt={'status':'PASS','base':BASE,'candidate':commit['sha'],'tree':r['sha'],'archive':archive,'files':files,'browser_cases':20,'guide_configurations':4,'branch_updated':False,'release_id':json.loads(pathlib.Path('public/S/app/release.json').read_text())['release_id']}
(out/'candidate.json').write_text(json.dumps(receipt,indent=2)+'\n');print('SENSOR_GUIDE_CANDIDATE '+json.dumps(receipt))
