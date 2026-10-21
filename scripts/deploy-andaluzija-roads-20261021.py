"""BD-authorized scoped roads/map release, over the exact current production.
Only listed assets, four page CSP rules and andaluzija-ai may change.
Credentials stay inside GitHub Actions; no environment values are printed.
"""
import copy
import difflib
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import tomllib
import urllib.error
import urllib.parse
import urllib.request

SITE = '17b4124d-c197-4c0a-a711-8b2c08d91088'
BASE = '6ad8b7e388788b37611bbe89'
SOURCE = '6bb34255fbf20a294d6704e5b9ae16e02ecbd900'
OUT = Path('roads-release-evidence')
OUT.mkdir(exist_ok=True)
ASSETS = ['andaluzija-2027.css', 'andaluzija-2027.js', 'andaluzija-ai-actions.mjs',
 'andaluzija-ai.css', 'andaluzija-ai.mjs', 'andaluzija-map.mjs',
 'andaluzija-optimize.mjs', 'andaluzija-page.mjs', 'andaluzija-planner.mjs',
 'andaluzija-worker.js', 'andaluzija-trip-interface-v1.json']
SKILLS = ['SKILL.md', 'references/actions.md', 'references/page-guide.md']

def sha(data, kind='sha256'):
 return hashlib.new(kind, data).hexdigest()

def request(path, data=None, method=None, raw=False):
 headers = {'Authorization':'Bearer '+os.environ['NETLIFY_AUTH_TOKEN'], 'Content-Type':'application/vnd.bitballoon.v1.raw' if raw else 'application/json' if isinstance(data,dict) or data is None else 'application/octet-stream'}
 req=urllib.request.Request('https://api.netlify.com/api/v1/'+path,data=json.dumps(data).encode() if isinstance(data,dict) else data,method=method,headers=headers)
 for attempt in range(4 if req.get_method() in ['GET','PUT'] else 1):
  try:
   with urllib.request.urlopen(req,timeout=45) as r:
    return r.read() if raw else json.load(r)
  except (urllib.error.URLError,ConnectionResetError,TimeoutError) as e:
   if isinstance(e,urllib.error.HTTPError) and e.code not in [429,500,502,503,504]: raise
   if attempt==3 or req.get_method() not in ['GET','PUT']: raise
   time.sleep(2**attempt)

def guard():
 assert request('sites/'+SITE)['published_deploy']['id']==BASE, 'Production lease changed; no overwrite'

def git_bytes(path):
 return subprocess.check_output(['git','show',SOURCE+':'+path])

def raw_file(path):
 data=request('sites/'+SITE+'/files/'+urllib.parse.quote(path,safe='/'),raw=True)
 assert sha(data,'sha1')==files[path], 'Source snapshot drift: '+path
 return data

def merge_lines(original,updated,live):
 # Apply only exact reviewed source line changes to the uploaded HTML. This
 # preserves password-manager injection and canonical links inserted at build.
 a,b=original.decode().splitlines(keepends=True),updated.decode().splitlines(keepends=True)
 text=live.decode()
 for tag,i,j,k,l in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes():
  if tag=='equal': continue
  old,new=''.join(a[i:j]),''.join(b[k:l])
  if tag=='insert':
   assert i<len(a), 'Unexpected EOF insertion'
   old=a[i];new=new+old
  assert old and text.count(old)==1, 'Ambiguous live HTML hunk'
  text=text.replace(old,new,1)
 return text.encode()

def main():
 subprocess.run(['git','fetch','--depth=1','--filter=blob:none','origin',SOURCE],check=True)
 guard()
 before=request('deploys/'+BASE)
 global files
 files={f['path'].lstrip('/').lower():f['sha'] for f in request('sites/'+SITE+'/files')}
 assert len(files)==4654 and 'netlify.toml' in files
 original_files=dict(files)
 overlay={}
 for name in ASSETS:
  path='bd/o/izleti/'+name;src='public/BD/O/izleti/'+name
  if path in files: assert raw_file(path)==git_bytes(src), 'Unreviewed live page asset: '+name
  else: assert name=='andaluzija-map.mjs'
  overlay[path]=Path(src).read_bytes()
 page='bd/o/izleti/andaluzija-2027.html'
 overlay[page]=merge_lines(git_bytes('public/BD/O/izleti/andaluzija-2027.html'),Path('public/BD/O/izleti/andaluzija-2027.html').read_bytes(),raw_file(page))
 assert b'bd-password-manager.js' in overlay[page]
 for name in SKILLS:
  path='ai/skills/andaluzija-2027-guide/'+name
  assert raw_file(path)==git_bytes('public/'+path)
  overlay[path]=Path('public/'+path).read_bytes()
 registry_path='ai/skills/registry.json'
 original_registry=json.loads(raw_file(registry_path))
 registry=copy.deepcopy(original_registry)
 proposed=json.loads(Path('public/'+registry_path).read_text())
 entry,=[e for e in proposed['skills'] if e['id']=='andaluzija-2027-guide']
 registry['skills']=[entry if e['id']==entry['id'] else e for e in registry['skills']]
 assert [e for e in registry['skills'] if e['id']!=entry['id']]==[e for e in original_registry['skills'] if e['id']!=entry['id']]
 overlay[registry_path]=(json.dumps(registry,ensure_ascii=False,indent=2)+'\n').encode()
 # Read original serialized CLI TOML through the documented raw-file media type.
 # Replace only four exact page CSP values; all unrelated TOML bytes survive.
 config=raw_file('netlify.toml');parsed=tomllib.loads(config.decode());new=tomllib.loads(Path('netlify.toml').read_text())
 old_csp,new_csp=set(),set()
 for row in parsed['headers']:
  if row['for'].lower().removesuffix('.html')=='/bd/o/izleti/andaluzija-2027':
   old_csp.add(row['values']['Content-Security-Policy'])
 for row in new['headers']:
  if row['for'].lower().removesuffix('.html')=='/bd/o/izleti/andaluzija-2027':new_csp.add(row['values']['Content-Security-Policy'])
 assert len(old_csp)==len(new_csp)==1
 old_csp,new_csp=old_csp.pop(),new_csp.pop()
 assert config.count(old_csp.encode())==4
 updated_config=config.replace(old_csp.encode(),new_csp.encode())
 check=copy.deepcopy(parsed)
 for row in check['headers']:
  if row['for'].lower().removesuffix('.html')=='/bd/o/izleti/andaluzija-2027':row['values']['Content-Security-Policy']=new_csp
 assert tomllib.loads(updated_config.decode())==check
 overlay['netlify.toml']=updated_config
 # All Google content and private ciphers remain untouched outside this overlay.
 cipher='bd/o/izleti/andaluzija-private.8zs.json'
 assert sha(raw_file(cipher))=='873c812e4182bcc8e2633e805f1e0ae62665965a40b3f16e927542663616afaa'
 baseline_functions={f['n']:f['d'] for f in before['available_functions']}
 root=Path(os.environ['ALBUM_FROZEN_ROOT'])
 old_bundles={b['name']:b for b in json.loads((root/'bundled-functions.json').read_text())}
 assert {n:b['sha256'] for n,b in old_bundles.items()}==baseline_functions and len(old_bundles)==30
 upgrade={b['name']:b for b in json.loads((root/'bundled-upgrade.json').read_text())}
 bundles={**old_bundles,'andaluzija-ai':upgrade['andaluzija-ai']}
 functions={n:b['sha256'] for n,b in bundles.items()}
 assert [n for n in functions if functions[n]!=baseline_functions[n]]==['andaluzija-ai']
 for n,b in bundles.items():assert sha(Path(b['path']).read_bytes())==functions[n]
 config_functions={}
 for f in before['available_functions']:
  assert f.get('m')==1024 and f.get('rg')=='us-east-2' and not f.get('ero')
  config_functions[f['n']]={long:f[short] for long,short in {'display_name':'dn','generator':'g','build_data':'bd','priority':'p','traffic_rules':'tr'}.items() if f.get(short) is not None}
  if f.get('ro'):config_functions[f['n']]['routes']=[{long:r[short] for long,short in {'pattern':'p','literal':'l','expression':'e','methods':'m','prefer_static':'ps'}.items() if r.get(short) is not None} for r in f['ro']]
 for p,data in overlay.items():files[p]=sha(data,'sha1')
 guard()
 title='Andaluzija Google roads, 5s DeepOpti and fullscreen AI '+os.environ['GITHUB_SHA']+' base='+BASE
 dep=request('sites/'+SITE+'/deploys?title='+urllib.parse.quote(title)+'&commit_ref='+os.environ['GITHUB_SHA'],{'files':files,'functions':functions,'functions_config':config_functions,'function_schedules':before['function_schedules'],'branch':'main','async':True,'draft':False},'POST')
 did=dep['id'];(OUT/'created.json').write_text(json.dumps({'deploy_id':did,'source':os.environ['GITHUB_SHA']})+'\n')
 for _ in range(90):
  dep=request('deploys/'+did);assert dep['state']!='error'
  if dep['state'] not in ['preparing','enqueued','building']:break
  time.sleep(3)
 by_sha={sha(data,'sha1'):(p,data) for p,data in overlay.items()}
 assert all(h in by_sha for h in dep.get('required',[]))
 assert not dep.get('required_edge_functions') and not dep.get('required_server')
 guard()
 for h in dep.get('required',[]):
  p,data=by_sha[h];request('deploys/'+did+'/files/'+urllib.parse.quote(p,safe='/'),data,'PUT')
 by_fn={b['sha256']:b for b in bundles.values()}
 for h in dep.get('required_functions',[]):
  b=by_fn[h];query={'runtime':b.get('runtimeVersion') or b['runtime']}
  if b.get('invocationMode'):query['invocation_mode']=b['invocationMode']
  if b.get('timeout'):query['timeout']=b['timeout']
  request('deploys/'+did+'/functions/'+b['name']+'?'+urllib.parse.urlencode(query),Path(b['path']).read_bytes(),'PUT')
 for _ in range(120):
  dep=request('deploys/'+did)
  if dep['state'] in ['ready','error']:break
  time.sleep(3)
 assert dep['state']=='ready' and dep['context']=='production'
 assert request('sites/'+SITE)['published_deploy']['id']==did
 for key in ['bd','p','tr','ro','ero','r','rg','m','im']:
  assert {f['n']:f.get(key) for f in before['available_functions']}=={f['n']:f.get(key) for f in dep['available_functions']},key
 assert {f['n']:f['d'] for f in dep['available_functions']}==functions
 assert dep['function_schedules']==before['function_schedules']
 after_files={f['path'].lstrip('/').lower():f['sha'] for f in request('sites/'+SITE+'/files')}
 assert after_files==files
 for p,data in overlay.items():assert raw_file(p)==data
 receipt={'deploy_id':did,'state':dep['state'],'published_at':dep['published_at'],'source':os.environ['GITHUB_SHA'],'previous_deploy':BASE,'changed_files':list(overlay),'all_other_static_files_identical':True,'static_file_count':len(files),'unchanged_functions':29,'changed_function':'andaluzija-ai','all_function_configuration_and_schedules_identical':True,'private_cipher_unchanged':True,'dualframe_unchanged':True,'skill_version':'1.2.0','url':'https://www.mdlxdcc.org/bd/o/izleti/andaluzija-2027'}
 (OUT/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt),flush=True)

if __name__=='__main__':main()
