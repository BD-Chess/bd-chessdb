#!/usr/bin/env python3
"""Build only the approved Flip4M LAB/APP channels. CURRENT and old are read-only.

Run: python scripts/flip4m_violet/build.py --public public
The original source hashes are verified before any output is written.
"""
from __future__ import annotations
import argparse, hashlib, json, re, struct, zlib
from pathlib import Path

VERSION = '2.2.0-violet'
SHARED = '_shared/violet-2.2.0'
SOURCE_COMMIT = 'd0ed1b4a239c123c6e4bced79648f8325c9168ee'
SOURCE_HASHES = {
'f4m-core.js':'d59c88e5fcf0df2f7973b8bdb2057e497a2b22da',
'f4m-search.js':'e0dc98845c7b12d799f173a2c3ee785c458b2f61',
'f4m-classical.js':'548c2a9e4d6e4f516be2ecc41c51d2d24e403c0c',
'f4m-dcc.js':'49fbeadb3ec0b3a612ef1ab6ebf39d6cfe069d8f',
'f4m-time.js':'c3624d88e8ee08954d333a905c82fe11ac7c81f6',
'f4m-smart-time.js':'18f93866fd1a7d8eccb913eaac75966fd4a199fb',
'f4m-sim.js':'78b9b1540ddef597976088dbbdfd930b7b4fff06',
'f4m-worker.js':'059bdd140189c71856902b25d9784d2d0cefb535',
'f4m-ui.js':'e2e8de46f7f60e0b5435245a0f22937fedf27453',
'f4m.css':'e9462c49607a0250dfd70c65e8a9cf1b2a8dcf85',
}
HERE = Path(__file__).resolve().parent

def git_hash(data: bytes) -> str:
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def replace_once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f'Expected one source anchor, found {text.count(old)}: {old[:90]}')
    return text.replace(old, new, 1)

def icon(size: int) -> bytes:
    """Dependency-free PNG: four game pieces, violet app identity; no fonts."""
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack('!I',len(payload))+kind+payload+struct.pack('!I',zlib.crc32(kind+payload)&0xffffffff)
    data=bytearray()
    for y in range(size):
        data.append(0)
        for x in range(size):
            xx,yy=x/size,y/size
            color=(25,23,37)
            if .17<xx<.83 and .17<yy<.83: color=(69,55,87)
            for i,(cx,cy) in enumerate(((.34,.34),(.66,.34),(.34,.66),(.66,.66))):
                if (xx-cx)**2+(yy-cy)**2<.105**2:
                    color=((243,120,128),(243,205,112),(192,164,242),(192,164,242))[i]
            data.extend(color)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(data),9))+chunk(b'IEND',b'')

def nav(channel: str, cls: str='version-nav') -> str:
    return '<nav class="'+cls+'" aria-label="Flip4M versions">'+''.join(
        ('<span class="dot" aria-hidden="true">·</span>' if i else '')+
        f'<a href="{url}"'+(' aria-current="page"' if name==channel else '')+f'>{name.upper()}</a>'
        for i,(name,url) in enumerate((('current','../'),('previous','../old/'),('lab','../new/'),('app','../app/')))
    )+'</nav>'

def document(source: str, channel: str) -> str:
    app=channel=='app'
    play=source.split('  <section class="play-panel"',1)[1].split('  <aside class="sidebar">',1)[0]
    play='  <section class="play-panel"'+play
    play=replace_once(play,'<section class="play-panel"','<section id="playPanel" tabindex="-1" class="play-panel"')
    play=replace_once(play,'   <div class="players">','   <div class="board-head"><span data-shell="board">IGRALNA PLOŠČA</span><span>8Z · MDL×DCC</span></div>\n   <div class="players">')
    pause='<button id="pause" data-i18n="pause">Ⅱ Premor</button>'
    play=replace_once(play,pause,'')
    play=replace_once(play,'<span id="gravity"></span>','<div class="status-actions"><span id="gravity"></span>'+pause+'</div>')
    play=replace_once(play,'<button id="newGame" data-i18n="new">＋ Nova igra</button>','<button id="newGame" data-i18n="new">＋ Nova igra</button><button id="more" data-shell="more" aria-haspopup="dialog" aria-controls="moreDialog">⋯ Več</button>')
    panels=source.split('  <aside class="sidebar">',1)[1].split('  </aside>',1)[0]
    panels=panels.split('   <div class="note">',1)[0]
    panels=replace_once(panels,'<section class="setup card">','<section id="setupPanel" class="setup card workspace-panel" tabindex="-1" aria-label="Game setup">')
    for panel in ('analysisPanel','batchPanel','historyPanel'):
        panels=replace_once(panels,f'<details class="card" id="{panel}">',f'<details class="card workspace-panel" id="{panel}" tabindex="-1" open hidden>')
    panels=replace_once(panels,'<div id="batchStatus"','<button id="newSim" class="sim-launch" data-shell="newSim">＋ Nov poskus</button><div id="batchStatus"')
    panels=re.sub(r'<p class="tiny" data-i18n="longThinkNote">.*?</p>','<p class="tiny" data-shell="longThink"></p>',panels,count=1)
    tabs='<div id="workspaceTabs" class="workspace-tabs" role="tablist" aria-label="Workspace">'+''.join(
        f'<button id="tab-{view}" type="button" role="tab" data-view-tab="{view}" aria-selected="false"><small aria-hidden="true">{symbol}</small><span data-shell="{key}">{key}</span></button>'
        for view,key,symbol in (('board','play','⊞'),('analysis','analysis','⌁'),('sim','sim','▷'),('history','history','▤'))
    )+'</div>'
    header=f'''<header class="brand-header"><div class="brand-group"><div class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div><h1 class="brand-name">Flip<span>4</span>M <span class="channel-badge">{channel.upper()}</span></h1><div class="brand-caption">FLIP · FOUR · MAGNETIC <span>BD × AI LAB</span></div></div></div><div class="header-tools">{nav(channel)}<div class="language" role="group" aria-label="Language"><button type="button" data-language="en">EN</button><span aria-hidden="true">|</span><button type="button" data-language="sl">SL</button></div></div></header>'''
    shell=f'''<div class="f4m-shell">{header}<main class="f4m-main" id="main"><div class="layout">{play}<aside class="workspace"><div class="workspace-heading"><strong data-shell="workspace"></strong><span data-shell="local"></span></div>{tabs}{panels}<div class="workspace-note"><p><strong data-shell="note"></strong><br><span data-shell="noteBody"></span></p></div></aside></div><footer class="site-footer"><span>Bojan Dobrečevič · BD × AI Lab</span><span data-shell="privacy"></span><span>Flip4M {channel.upper()} · {VERSION}</span></footer></main></div>'''
    if app:
        shell=f'''<header class="preview-header"><h2 class="preview-title">Flip4M <span>· APP preview</span></h2>{nav(channel)}<label class="preview-width"><span data-shell="viewWidth">Preview width</span><select id="previewWidth" aria-label="Preview width"><option>375</option><option selected>390</option><option>402</option><option>430</option></select></label></header><div class="preview-stage"><div class="device"><div class="device-top" aria-hidden="true"><span class="island"></span></div><div class="device-screen">{shell}</div><div class="device-bottom" aria-hidden="true"><span></span></div></div></div>'''
    dialogs=source.split('<dialog id="helpDialog">',1)[1].split('</body>',1)[0]
    dialogs='<dialog id="helpDialog">'+dialogs
    # Original source contains no runnable scripts below these dialogs.
    if '<script' in dialogs: raise ValueError('Unexpected script in source dialog tail')
    more='''<button id="sim" class="hidden-hook" type="button" tabindex="-1">Sim</button><button id="lang" class="hidden-hook" type="button" tabindex="-1">EN</button>
<dialog id="moreDialog"><div class="dialog-title"><h2 data-shell="moreTitle">Orodja in nastavitve</h2><button id="closeMore" data-shell="close">Zapri</button></div><div class="more-grid"><button id="openSetup" data-shell="setup"></button><button id="help" data-shell="how"></button><button id="helpDcc" data-shell="dcc"></button><button id="theme" data-shell="theme"></button><a href="../f4m/" data-shell="paper"></a><a href="release.json" data-shell="release"></a></div><h3 class="more-description" data-shell="pwaTitle"></h3><div class="more-grid"><button id="install" class="wide"><span data-shell="install">Namesti</span> CHANNEL</button></div><p id="offlineStatus" class="notice" role="status"></p><p id="installInfo" class="notice" hidden></p></dialog>
<aside id="pwaToast" class="pwa-toast" role="status" hidden><span id="updateText"></span><button id="updateButton" data-shell="update"></button></aside>'''.replace('CHANNEL',channel.upper())
    modules=['f4m-core','f4m-search','f4m-smart-time','f4m-classical','f4m-dcc','f4m-time','f4m-sim','f4m-store','f4m-ui','shell','pwa']
    scripts='\n'.join(f'<script src="../{SHARED}/{name}.js"'+(' data-engine-ui' if name=='f4m-ui' else '')+' defer></script>' for name in modules)
    return f'''<!doctype html>
<html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#100f19"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="author" content="Bojan Dobrečevič"><meta name="description" content="Flip4M: connect four, turn gravity and master magnets. Local Classical / AI+DCC game and reproducible experiments."><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Flip4M {channel.upper()}"><link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="../{SHARED}/icon-180.png"><link rel="icon" href="../{SHARED}/icon-192.png"><title>Flip4M {channel.upper()} · Violet</title><link rel="stylesheet" href="../{SHARED}/f4m.css"><link rel="stylesheet" href="../{SHARED}/violet.css">{scripts}</head><body data-channel="{channel}" class="{'is-app' if app else 'is-lab'}"><a class="skip-link" href="#main">Skip to game / Preskoči na igro</a>{shell}{dialogs}{more}</body></html>\n'''

def build(public: Path) -> list[str]:
    root=public/'F4M'
    source={name:(root/name).read_bytes() for name in SOURCE_HASHES}
    for name,data in source.items():
        if git_hash(data)!=SOURCE_HASHES[name]: raise ValueError('Source drift: '+name)
    # CURRENT is read-only and has the same controller plus smart time as LAB.
    original=(root/'index.html').read_text()
    ui=source['f4m-ui.js'].decode()
    ui=replace_once(ui,"const VERSION='2.1.1',PREF='flip4m.lab.2.1.preferences';", "const VERSION='2.2.0-violet',CHANNEL=document.body.dataset.channel==='app'?'app':'lab',PREF='flip4m.'+CHANNEL+'.2.2.preferences';\nif(CHANNEL==='lab'){try{if(!localStorage.getItem(PREF)){const old=localStorage.getItem('flip4m.lab.2.1.preferences');if(old)localStorage.setItem(PREF,old);}}catch(_){}}")
    ui=replace_once(ui,"else worker=new Worker('f4m-worker.js?v=2.1.1');", "else worker=new Worker(new URL('f4m-worker.js',document.querySelector('script[data-engine-ui]').src));")
    ui=replace_once(ui,"function persist(){if(loading)return;const serial=++saveSerial;Store.write(envelope()).then(status=>{if(serial===saveSerial)$('saveStatus').textContent=t(status==='indexeddb'?'storeIdb':status==='localstorage'?'storeLocal':'storage');});}", "function persist(){if(loading)return Promise.resolve('unavailable');const serial=++saveSerial;return Store.write(envelope()).then(status=>{if(serial===saveSerial)$('saveStatus').textContent=t(status==='indexeddb'?'storeIdb':status==='localstorage'?'storeLocal':'storage');return status;});}")
    ui=replace_once(ui,"document.title='Flip4M Lab — Classical AI × AI+DCC';", "document.title='Flip4M '+CHANNEL.toUpperCase()+' · Violet';")
    ui=replace_once(ui,"validateSave:validateSession,flush:()=>Store.flush()", """validateSave:validateSession,flush:()=>Store.flush(),pause:()=>pauseAll(),setLanguage:lang=>{prefs.lang=lang==='en'?'en':'sl';preferences();translate();persist();document.dispatchEvent(new Event('f4m:language'));},saveForUpdate:async()=>{if(loading)throw Error('Still loading');pauseAll();const expected=JSON.stringify(session()),status=await persist();await Store.flush();if(status==='unavailable')throw Error('Save unavailable');const saved=await Store.read();validateSession(saved);if(JSON.stringify({game:saved.game,states:saved.states,moves:saved.moves,archived:saved.archived,records:saved.records,clocks:saved.clocks,cursor:saved.cursor,timeout:saved.timeout,clock:saved.clock})!==expected)throw Error('Save readback mismatch');return status;}""")
    ui=replace_once(ui,"message(t('restored'));}})();", "message(t('restored'));}document.dispatchEvent(new Event('f4m:language'));})();")
    # Use the pre-existing LAB database; APP is isolated. Do not copy CURRENT's legacy selector patch.
    store=(root/'new/f4m-store.js').read_text()
    if git_hash(store.encode())!='dc9dc02a475a7a607156bd0938259899601adc78': raise ValueError('LAB store source drift')
    store=replace_once(store,"const NAME='flip4m-lab-2.1'", "const NAME=document.body.dataset.channel==='app'?'flip4m-app-2.2':'flip4m-lab-2.1'")
    # If IDB opens but writes fail, read the verified fallback rather than a stale IDB checkpoint.
    store=replace_once(store,'const data=await get(db,KEY);if(!data)return null;', "const data=await get(db,KEY);let fallback=null;try{fallback=JSON.parse(localStorage.getItem(NAME)||'null');}catch(_){}if(fallback&&(!data||String(fallback.savedAt)>String(data.savedAt)))return fallback;if(!data)return null;")
    outputs={}
    for name,data in source.items(): outputs[f'{SHARED}/{name}']=data
    outputs[f'{SHARED}/f4m-ui.js']=ui.encode()
    outputs[f'{SHARED}/f4m-store.js']=store.encode()
    for name in ('violet.css','shell.js','pwa.js'):
        outputs[f'{SHARED}/{name}']=(HERE/name).read_bytes()
    for size in (180,192,512): outputs[f'{SHARED}/icon-{size}.png']=icon(size)
    shared_names=[p.split('/')[-1] for p in outputs]
    for channel,dirname in (('lab','new'),('app','app')):
        outputs[f'{dirname}/index.html']=document(original,channel).encode()
        manifest={'id':'./','name':'Flip4M '+channel.upper(),'short_name':'Flip4M '+channel.upper(),'start_url':'./','scope':'./','display':'standalone','background_color':'#100f19','theme_color':'#100f19','lang':'sl','icons':[{'src':f'../{SHARED}/icon-{s}.png','sizes':f'{s}x{s}','type':'image/png','purpose':'any maskable'} for s in (192,512)]}
        outputs[f'{dirname}/manifest.webmanifest']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
        release={'schema':'flip4m.release.v1','version':VERSION,'date':'2026-09-30','role':channel.upper(),'base':'2.1.2-smart-time','source_commit':SOURCE_COMMIT,'rules_unchanged':True,'source_blobs':SOURCE_HASHES,'shared_path':SHARED,'storage':'flip4m-lab-2.1' if channel=='lab' else 'flip4m-app-2.2','native_app':False,'physical_device_acceptance':'NOT_RUN'}
        outputs[f'{dirname}/release.json']=(json.dumps(release,indent=2)+'\n').encode()
        assets=['','index.html','manifest.webmanifest','release.json']+[f'../{SHARED}/{name}' for name in shared_names]
        sw='const BUILD='+json.dumps(VERSION)+';\nconst ASSETS='+json.dumps(assets)+';\n'+(HERE/'worker-sw.js').read_text()
        outputs[f'{dirname}/sw.js']=sw.encode()
    for name in ('migration.html','migration.js','migration-sw.js'):
        dst={'migration.html':'index.html','migration.js':'migration.js','migration-sw.js':'sw.js'}[name]
        outputs['PWA/'+dst]=(HERE/name).read_bytes()
    # Materialize only after all source anchors and templates have passed.
    for path,data in outputs.items():
        target=root/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    manifest={p:hashlib.sha256(b).hexdigest() for p,b in sorted(outputs.items())}
    (root/SHARED/'build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'version':VERSION,'outputs':len(outputs)+1,'root':str(root),'current_untouched':all((root/n).read_bytes()==d for n,d in source.items())}))
    return list(outputs)+[SHARED+'/build-manifest.json']

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--public',type=Path,default=Path('public'));args=parser.parse_args();build(args.public)
