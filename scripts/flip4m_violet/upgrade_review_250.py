#!/usr/bin/env python3
"""Build the approved APP-only Flip4M 2.5.0 Review package.
LAB/CURRENT/PREVIOUS and immutable APP archives are checked but never written.
"""
from __future__ import annotations
import argparse, hashlib, json, shutil
from pathlib import Path
VERSION='2.5.0-petrol'
OLD_VERSION='2.4.1-petrol'
OLD_SHARED=Path('_shared/petrol-2.4.1')
NEW_SHARED=Path('_shared/petrol-2.5.0')
HERE=Path(__file__).resolve().parent
ARCHIVE_SHA={'index.html':'1cdf34d658d71dce2088621bf4fdc2e12d5b9fd4','manifest.webmanifest':'a4c85c0fdac7179982ddba03724bca2ec9c2bfa9','release.json':'5e394e73634374cb20bd35365f68563080641be2','sw.js':'b870d9b6ae7371eba5dbab9d9f96d2aaf521981d'}
def git_hash(data):
 return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def one(text,old,new,label):
 if text.count(old)!=1: raise ValueError(label)
 return text.replace(old,new,1)
def build(public):
 root=public/'F4M';old=root/OLD_SHARED;new=root/NEW_SHARED;app=root/'app'
 if new.exists(): raise ValueError('target shared runtime already exists')
 for name,sha in ARCHIVE_SHA.items():
  p=app/'old/002'/name
  if not p.exists() or git_hash(p.read_bytes())!=sha: raise ValueError('old/002 drift '+name)
 protected={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'new/index.html',root/'new/manifest.webmanifest',root/'new/release.json',root/'new/sw.js',root/'index.html',root/'release.json']}
 shutil.copytree(old,new)
 (new/'build-manifest.json').unlink(missing_ok=True)
 ui=(new/'f4m-ui.js').read_text();ui=one(ui,"const VERSION='2.4.1-petrol'","const VERSION='2.5.0-petrol'",'runtime version');(new/'f4m-ui.js').write_text(ui)
 pwa=(new/'pwa.js').read_text();pwa=one(pwa,"build:'2.4.1-petrol'","build:'2.5.0-petrol'",'pwa build');(new/'pwa.js').write_text(pwa)
 (new/'f4m-review.js').write_bytes((HERE/'review-2.5.0.js').read_bytes());(new/'f4m-review.css').write_bytes((HERE/'review-2.5.0.css').read_bytes())
 html=(app/'index.html').read_text().replace('../_shared/petrol-2.4.1/','../_shared/petrol-2.5.0/')
 html=one(html,'<link rel="stylesheet" href="../_shared/petrol-2.5.0/violet.css">','<link rel="stylesheet" href="../_shared/petrol-2.5.0/violet.css"><link rel="stylesheet" href="../_shared/petrol-2.5.0/f4m-review.css">','review css')
 html=one(html,'<script src="../_shared/petrol-2.5.0/shell.js" defer></script>','<script src="../_shared/petrol-2.5.0/shell.js" defer></script>\n<script src="../_shared/petrol-2.5.0/f4m-review.js" defer></script>','review js')
 html=html.replace('Flip4M APP · 2.4.1-petrol','Flip4M APP · 2.5.0-petrol');(app/'index.html').write_text(html)
 manifest=json.loads((app/'manifest.webmanifest').read_text())
 for icon in manifest.get('icons',[]): icon['src']=icon['src'].replace('_shared/petrol-2.4.1','_shared/petrol-2.5.0')
 (app/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 release=json.loads((app/'release.json').read_text());release.update({'version':VERSION,'date':'2026-10-01','base':OLD_VERSION,'shared_path':NEW_SHARED.as_posix(),'review':{'version':'1.0','mode':'read-only','stored_analysis_only':True,'live_cursor_unchanged':True}})
 (app/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
 sw=(app/'sw.js').read_text();tail=sw.split('\n',2)[2]
 shared_names=sorted(p.name for p in new.iterdir() if p.is_file() and p.name!='build-manifest.json')
 assets=['','index.html','manifest.webmanifest','release.json']+[f'../{NEW_SHARED.as_posix()}/{n}' for n in shared_names]
 (app/'sw.js').write_text('const BUILD='+json.dumps(VERSION)+';\nconst ASSETS='+json.dumps(assets)+';\n'+tail)
 outputs=[p for p in new.iterdir() if p.is_file()]+[app/x for x in ('index.html','manifest.webmanifest','release.json','sw.js')]
 hashes={str(p.relative_to(root)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(outputs)}
 (new/'build-manifest.json').write_text(json.dumps(hashes,indent=2)+'\n');outputs.append(new/'build-manifest.json')
 for p,d in protected.items():
  if hashlib.sha256(p.read_bytes()).hexdigest()!=d: raise AssertionError('protected surface changed '+str(p))
 print(json.dumps({'version':VERSION,'outputs':len(outputs),'archive_002':'PASS','lab_unchanged':'PASS'}))
 return [str(p.relative_to(root)).replace('\\','/') for p in outputs]
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--public',type=Path,default=Path('public'));a=ap.parse_args();build(a.public)
