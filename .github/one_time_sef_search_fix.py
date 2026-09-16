#!/usr/bin/env python3
from pathlib import Path

def read(path): return Path(path).read_text(encoding='utf-8')
def write(path,text): Path(path).write_text(text,encoding='utf-8')
def one(text,old,new,label):
    n=text.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 occurrence, found {n}')
    return text.replace(old,new,1)

# Landing private shortcut: exact "sef" opens the private vault page directly.
p=Path('public/index.html'); s=read(p)
s=one(s,"const PRIVATE_SHORTCUTS=Object.freeze({bbsh:'BD/BBSH.html',wl:'WL/index.html',o:'BD/O/index.html'});","const PRIVATE_SHORTCUTS=Object.freeze({bbsh:'BD/BBSH.html',wl:'WL/index.html',o:'BD/O/index.html',sef:'BD/O/sef.html'});",'landing sef shortcut')
write(p,s)

# Sef shell: make assets/navigation work both at domain root and under /bd-chessdb/ GitHub Pages.
p=Path('public/BD/O/sef.html'); s=read(p)
s=one(s,'<script src="/BD/O/sef.js" defer></script>','<script src="./sef.js" defer></script>','sef script path')
s=s.replace('href="/BD/O/"','href="./"')
write(p,s)

# Sef runtime: dynamic project-safe root and return-to-sef login flow.
p=Path('public/BD/O/sef.js'); s=read(p)
s=one(s,"const ROOT='/BD/O/', PORTAL_SESSION='bd-o-v2-session', OLD_SEF_SESSION='bd-o-sef-v1-session';","const ROOT=new URL('./',location.href).pathname, PORTAL_SESSION='bd-o-v2-session', OLD_SEF_SESSION='bd-o-sef-v1-session';",'sef dynamic root')
s=one(s," if(!session){location.replace(ROOT);return;}"," if(!session){location.replace(ROOT+'index.html?next=sef');return;}",'sef login return')
write(p,s)

# Portal unlock: recognise special next=sef after successful password entry.
p=Path('public/BD/O/vault.js'); s=read(p)
old="  const next=new URLSearchParams(location.search).get('next');\n  if(validPage(next)&&next!=='index.html'){location.replace(ROOT+next);return;}"
new="  const next=new URLSearchParams(location.search).get('next');\n  if(next==='sef'){location.replace(ROOT+'sef.html');return;}\n  if(validPage(next)&&next!=='index.html'){location.replace(ROOT+next);return;}"
s=one(s,old,new,'portal sef return')
write(p,s)

# Acceptance.
landing=read('public/index.html')
if "sef:'BD/O/sef.html'" not in landing: raise SystemExit('sef shortcut missing')
sefhtml=read('public/BD/O/sef.html')
if '/BD/O/sef.js' in sefhtml or 'href="/BD/O/"' in sefhtml: raise SystemExit('absolute sef shell path remains')
sefjs=read('public/BD/O/sef.js')
if "const ROOT='/BD/O/'" in sefjs or "index.html?next=sef" not in sefjs: raise SystemExit('sef runtime portability/return missing')
vault=read('public/BD/O/vault.js')
if "if(next==='sef'){location.replace(ROOT+'sef.html');return;}" not in vault: raise SystemExit('portal sef return missing')
print('SEF_SEARCH_FIX_OK')
