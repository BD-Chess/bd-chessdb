"""Owner-authorized five-file static correction. Preserve all other production bytes."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.parse

spec=importlib.util.spec_from_file_location('roads_snapshot','scripts/deploy-andaluzija-roads-20261021.py')
p=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
p.BASE='6ad8f36a5dbc88a9b9653680'
p.SOURCE='ccd352bfc4a2f6e242d4a75929455873a7d7d837'
OUT=Path('corrections-release-evidence');OUT.mkdir(exist_ok=True)
EXPECTED_CIPHER='3d90570f96a6353d5767415157a6f9685f019a84d3fe9151f8499beaec2117ff'
ASSETS=['andaluzija-2027.css','andaluzija-2027.js','andaluzija-ai.css','andaluzija-private.8zs.json']

def main():
 subprocess.run(['git','fetch','--depth=1','--filter=blob:none','origin',p.SOURCE],check=True)
 p.guard();before=p.request('deploys/'+p.BASE)
 p.files={f['path'].lstrip('/').lower():f['sha'] for f in p.request('sites/'+p.SITE+'/files')}
 assert len(p.files)==4655
 original_files=dict(p.files);overlay={}
 for name in ASSETS:
  path='bd/o/izleti/'+name;src='public/BD/O/izleti/'+name
  assert p.raw_file(path)==p.git_bytes(src),'Unreviewed live asset: '+name
  overlay[path]=Path(src).read_bytes()
 cipher='bd/o/izleti/andaluzija-private.8zs.json'
 assert p.sha(overlay[cipher])==EXPECTED_CIPHER
 envelope=json.loads(overlay[cipher]);assert envelope['header']['domain']=='www.mdlxdcc.org' and envelope['header']['kind']=='sections' and envelope['header']['version']==4 and envelope['header']['iterations']>=600000
 page='bd/o/izleti/andaluzija-2027.html';src='public/BD/O/izleti/andaluzija-2027.html'
 overlay[page]=p.merge_lines(p.git_bytes(src),Path(src).read_bytes(),p.raw_file(page))
 assert b'bd-password-manager.js' in overlay[page]
 assert b'class="andaluzija-trip"' in overlay[page]
 # Current functions are the exact legacy packages plus the already-published AI overlay.
 root=Path(os.environ['ALBUM_FROZEN_ROOT'])
 old={b['name']:b for b in json.loads((root/'bundled-functions.json').read_text())}
 newer={b['name']:b for b in json.loads((root/'bundled-upgrade.json').read_text())}
 bundles={**old,'andaluzija-ai':newer['andaluzija-ai']}
 functions={n:b['sha256'] for n,b in bundles.items()}
 assert functions=={f['n']:f['d'] for f in before['available_functions']} and len(functions)==30
 for n,b in bundles.items():assert p.sha(Path(b['path']).read_bytes())==functions[n]
 config={}
 for f in before['available_functions']:
  assert f.get('m')==1024 and f.get('rg')=='us-east-2' and not f.get('ero')
  config[f['n']]={long:f[short] for long,short in {'display_name':'dn','generator':'g','build_data':'bd','priority':'p','traffic_rules':'tr'}.items() if f.get(short) is not None}
  if f.get('ro'):config[f['n']]['routes']=[{long:r[short] for long,short in {'pattern':'p','literal':'l','expression':'e','methods':'m','prefer_static':'ps'}.items() if r.get(short) is not None} for r in f['ro']]
 for path,data in overlay.items():p.files[path]=p.sha(data,'sha1')
 changed=[path for path in p.files if p.files[path]!=original_files[path]]
 assert set(changed)==set(overlay) and len(changed)==5
 p.guard()
 title='Andaluzija protected flights and portrait corrections '+os.environ['GITHUB_SHA']+' base='+p.BASE
 dep=p.request('sites/'+p.SITE+'/deploys?title='+urllib.parse.quote(title)+'&commit_ref='+os.environ['GITHUB_SHA'],{'files':p.files,'functions':functions,'functions_config':config,'function_schedules':before['function_schedules'],'branch':'main','async':True,'draft':False},'POST')
 did=dep['id'];(OUT/'created.json').write_text(json.dumps({'deploy_id':did,'source':os.environ['GITHUB_SHA']})+'\n')
 for _ in range(90):
  dep=p.request('deploys/'+did);assert dep['state']!='error'
  if dep['state'] not in ['preparing','enqueued','building']:break
  time.sleep(3)
 by_sha={p.sha(data,'sha1'):(path,data) for path,data in overlay.items()}
 assert all(h in by_sha for h in dep.get('required',[]))
 assert not dep.get('required_edge_functions') and not dep.get('required_server')
 p.guard()
 for h in dep.get('required',[]):
  path,data=by_sha[h];p.request('deploys/'+did+'/files/'+urllib.parse.quote(path,safe='/'),data,'PUT')
 by_fn={b['sha256']:b for b in bundles.values()}
 for h in dep.get('required_functions',[]):
  b=by_fn[h];query={'runtime':b.get('runtimeVersion') or b['runtime']}
  if b.get('invocationMode'):query['invocation_mode']=b['invocationMode']
  if b.get('timeout'):query['timeout']=b['timeout']
  p.request('deploys/'+did+'/functions/'+b['name']+'?'+urllib.parse.urlencode(query),Path(b['path']).read_bytes(),'PUT')
 for _ in range(120):
  dep=p.request('deploys/'+did)
  if dep['state'] in ['ready','error']:break
  time.sleep(3)
 assert dep['state']=='ready' and dep['context']=='production'
 assert p.request('sites/'+p.SITE)['published_deploy']['id']==did
 assert {f['n']:f['d'] for f in dep['available_functions']}==functions
 for key in ['bd','p','tr','ro','ero','r','rg','m','im']:
  assert {f['n']:f.get(key) for f in before['available_functions']}=={f['n']:f.get(key) for f in dep['available_functions']},key
 assert dep['function_schedules']==before['function_schedules']
 after={f['path'].lstrip('/').lower():f['sha'] for f in p.request('sites/'+p.SITE+'/files')};assert after==p.files
 for path,data in overlay.items():assert p.raw_file(path)==data
 receipt={'deploy_id':did,'state':dep['state'],'published_at':dep['published_at'],'source':os.environ['GITHUB_SHA'],'previous_deploy':p.BASE,'changed_files':changed,'static_file_count':len(after),'all_other_static_files_identical':True,'unchanged_functions':30,'all_function_configuration_and_schedules_identical':True,'private_cipher_sha256':EXPECTED_CIPHER,'private_plaintext_published':False,'shared_dualframe_assets_unchanged':True,'skill_unchanged':True,'url':'https://www.mdlxdcc.org/bd/o/izleti/andaluzija-2027'}
 (OUT/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt),flush=True)

if __name__=='__main__':main()
