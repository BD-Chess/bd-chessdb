#!/usr/bin/env python3
import argparse, hashlib, json, pathlib, re
REPO=pathlib.Path(__file__).resolve().parents[1]
CW=REPO/'public'/'CW'
def rb(p): return p.read_bytes()
def rt(p): return p.read_text(encoding='utf-8')
def nav_bytes(path, hrefs):
    s=rt(path)
    for key, href in hrefs.items():
        pat=rf'(<a class="channel-link[^"]*" data-channel="{re.escape(key)}" href=")[^"]+("[^>]*>)'
        s,n=re.subn(pat,lambda m:m.group(1)+href+m.group(2),s,count=1)
        if n!=1: raise SystemExit(f'nav target {key} missing in {path}')
    return s.encode()
def sw_bytes(release_id):
    core=['./','./index.html','./manifest.webmanifest','./release.json','./pwa.js','./icon.svg','../cw_puzzles_pack.js','../cw_puzzles_pack.json','../lex/cw_en.json']
    return (f'const RELEASE={json.dumps(release_id)};\nconst CACHE=\'8zCrosswords:LAB:\'+RELEASE;\nconst CORE={json.dumps(core,separators=(",",":"))};\n' + r'''self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('8zCrosswords:LAB:')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting()});
const LAB_PATH=new URL('./',self.registration.scope).pathname;
const SHARED_PATH=new URL('../',self.registration.scope).pathname;
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==location.origin)return;const allowed=u.pathname.startsWith(LAB_PATH)||u.pathname===SHARED_PATH+'cw_puzzles_pack.js'||u.pathname===SHARED_PATH+'cw_puzzles_pack.json'||u.pathname===SHARED_PATH+'lex/cw_en.json';if(!allowed)return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(resp=>{if(resp&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return resp;})))});
''').encode()
def expected():
    out={}
    out[CW/'index.html']=nav_bytes(CW/'index.html',{'current':'./','previous':'old/','lab':'new/','app':'new/?view=app'})
    out[CW/'old/index.html']=nav_bytes(CW/'old/index.html',{'current':'../','previous':'./','lab':'../new/','app':'../new/?view=app'})
    out[CW/'new/index.html']=nav_bytes(CW/'new/index.html',{'current':'../','previous':'../old/','lab':'./','app':'./?view=app'})
    manifest=json.loads(rt(CW/'new/manifest.webmanifest'));manifest['id']='./'
    out[CW/'new/manifest.webmanifest']=(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    pwa=rb(CW/'new/pwa.js');icon=rb(CW/'new/icon.svg')
    parts=[out[CW/'new/index.html'],out[CW/'new/manifest.webmanifest'],pwa,icon,rb(CW/'cw_puzzles_pack.js'),rb(CW/'cw_puzzles_pack.json'),rb(CW/'lex/cw_en.json')]
    package_sha=hashlib.sha256(b''.join(hashlib.sha256(x).digest() for x in parts)).hexdigest();release_id='cw-lab-'+package_sha[:16]
    rel=json.loads(rt(CW/'new/release.json'));rel['release']=release_id;rel['package_sha256']=package_sha
    out[CW/'new/release.json']=(json.dumps(rel,indent=2,sort_keys=True)+'\n').encode();out[CW/'new/sw.js']=sw_bytes(release_id)
    return out,release_id,package_sha
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');a=ap.parse_args()
    out,release_id,package_sha=expected();changed=[]
    for p,b in out.items():
        if not p.exists() or rb(p)!=b:
            changed.append(str(p.relative_to(REPO)))
            if not a.check:p.write_bytes(b)
    if a.check and changed:raise SystemExit('prefix outputs stale: '+', '.join(changed))
    for p in [CW/'index.html',CW/'old/index.html',CW/'new/index.html',CW/'new/manifest.webmanifest',CW/'new/sw.js']:
        t=rt(p)
        if 'href="/CW/' in t or '"id":"/CW/' in t or "startsWith('/CW/" in t:raise SystemExit('host-dependent /CW runtime path: '+str(p))
    print(json.dumps({'status':'PASS','changed':changed,'release':release_id,'package_sha256':package_sha},indent=2))
if __name__=='__main__':main()
