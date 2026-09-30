#!/usr/bin/env python3
"""Bounded Flip4M channel acceptance (real localhost origin, Workers and service workers).
Outputs JSON and screenshots. Never talks to AI APIs, changes remote data, or runs tournaments.
"""
from __future__ import annotations
import argparse, functools, hashlib, http.server, json, re, subprocess, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
from build import SOURCE_HASHES, SHARED, VERSION, git_hash

RESULTS=[]
def check(name, condition, detail=None):
    RESULTS.append({'name':name,'pass':bool(condition),'detail':detail})
    if not condition: raise AssertionError(name+': '+str(detail))

def wait_idle(page):
    page.wait_for_function('window.F4MLab && !F4MLab.status().loading && !F4MLab.status().animating && !F4MLab.status().thinking',timeout=15000)

def state(page): return page.evaluate('F4MLab.snapshot().states[F4MLab.status().cursor]')
def resume(page):
    if page.evaluate('F4MLab.status().paused'): page.locator('#pause').click()

def drop(page,col):
    resume(page);page.locator(f'.cell[data-r="0"][data-c="{col}"]').click();wait_idle(page)

def verify(public: Path,out: Path,executable=None):
    out.mkdir(parents=True,exist_ok=True)
    root=public/'F4M'; shared=root/SHARED
    for name,sha in SOURCE_HASHES.items():
        check('CURRENT source '+name,git_hash((root/name).read_bytes())==sha)
        if name!='f4m-ui.js': check('Shared unmodified '+name,git_hash((shared/name).read_bytes())==sha)
    for f in shared.glob('*.js'):
        run=subprocess.run(['node','--check',str(f)],capture_output=True,text=True,timeout=8)
        check('Syntax '+f.name,run.returncode==0,run.stderr or None)
    for channel in ('new','app'):
        html=(root/channel/'index.html').read_text();ids=re.findall(r'\bid="([^"]+)"',html)
        check(channel+' unique IDs',len(ids)==len(set(ids)))
        check(channel+' no separate PWA navigation','href="../PWA/' not in html)
        check(channel+' common shared core',f'../{SHARED}/f4m-core.js' in html)
        m=json.loads((root/channel/'manifest.webmanifest').read_text())
        check(channel+' owned manifest',m['scope']=='./' and m['id']=='./' and m['start_url']=='./')
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(public.resolve())))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    base=f'http://127.0.0.1:{server.server_port}/F4M/'
    original_sw=(root/'new/sw.js').read_text()
    try:
      with sync_playwright() as p:
        args={'headless':True}
        if executable:args['executable_path']=executable
        browser=p.chromium.launch(**args)
        ctx=browser.new_context(viewport={'width':1440,'height':1080},accept_downloads=True)
        ctx.add_init_script("""if(!localStorage.getItem('flip4m.lab.2.2.preferences'))localStorage.setItem('flip4m.lab.2.2.preferences',JSON.stringify({mode:'pvp',difficulty:'beginner'}));if(!localStorage.getItem('flip4m.app.2.2.preferences'))localStorage.setItem('flip4m.app.2.2.preferences',JSON.stringify({mode:'pvp',difficulty:'beginner'}));""")
        page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
        page.goto(base+'new/');wait_idle(page)
        page.wait_for_function("window.F4MPWA?.state==='ready'",timeout=25000)
        check('LAB full offline package ready',True)
        page.reload();wait_idle(page)
        check('LAB service worker controls page',page.evaluate('!!navigator.serviceWorker.controller'))
        check('LAB board has 64 cells',page.locator('.cell').count()==64)
        check('LAB 32 rim positions',page.locator('.mag-slot').count()==32)
        check('Petrol palette active',page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()==='#0b1119'"))
        ratio=lambda pg: pg.locator('#rotor').bounding_box()['width']/pg.locator('#arena').bounding_box()['width']
        check('LAB default board Max',page.locator('body').get_attribute('data-board-size')=='max' and ratio(page)>.89,ratio(page))
        page.locator('#more').click();page.locator('#boardSize').select_option('standard');check('LAB Standard restores 2.2 geometry',.77<ratio(page)<.79,ratio(page));page.locator('#boardSize').select_option('large');check('LAB Large geometry',.83<ratio(page)<.85,ratio(page));page.locator('#boardSize').select_option('max');check('LAB Max geometry',.89<ratio(page)<.91,ratio(page));page.locator('#closeMore').click()
        for col in (3,4,3): drop(page,col)
        before=state(page);page.locator('#flipLeft').click();wait_idle(page)
        check('Rotation uses one complete turn',state(page)['ply']==before['ply']+1)
        page.locator('#undo').click();wait_idle(page)
        check('Undo rotation exact board resources',state(page)==before)
        resume(page);page.locator('#magnet').click();page.locator('.mag-slot[data-side="0"][data-idx="3"]').click();wait_idle(page)
        check('Magnet uses one turn',state(page)['ply']==before['ply']+1)
        page.locator('#undo').click();wait_idle(page);check('Undo magnet exact state',state(page)==before)
        page.locator('[data-language="en"]').click();check('EN switch',page.locator('html').get_attribute('lang')=='en')
        page.locator('[data-language="sl"]').click();check('SL switch',page.locator('html').get_attribute('lang')=='sl')
        page.locator('#more').click();page.locator('#theme').click();check('Light theme',page.locator('html').get_attribute('data-theme')=='light')
        page.locator('#theme').click();page.locator('#closeMore').click()
        page.screenshot(path=str(out/'lab-desktop.png'),full_page=True)
        check('Save/readback before reload',page.evaluate('F4MLab.saveForUpdate()') in ('indexeddb','localstorage'))
        saved_state=state(page);page.reload();wait_idle(page);check('Restored game exact',state(page)==saved_state);check('LAB board size persisted',page.locator('body').get_attribute('data-board-size')=='max')
        # Worker computation: the hint selects within the existing rules without mutating the board.
        page.locator('#hint').click();wait_idle(page)
        page.wait_for_function("F4MLab.status().job>1 && document.getElementById('statNodes').textContent!=='—'",timeout=15000)
        check('Real Worker hint completed',page.locator('#statNodes').inner_text()!='—')
        check('Hint preserves state',state(page)==saved_state)
        page.locator('#tab-history').click()
        with page.expect_download() as event:page.locator('#save').click()
        downloaded=event.value;downloaded.save_as(str(out/'roundtrip-save.json'))
        check('JSON export valid',json.loads((out/'roundtrip-save.json').read_text())['format']=='flip4m.lab.session')
        page.locator('#file').set_input_files(str(out/'roundtrip-save.json'));wait_idle(page)
        check('JSON import exact state',state(page)==saved_state)
        # APP shares the engine, not the game checkpoint.
        app=ctx.new_page();app.on('pageerror',lambda e:errors.append(str(e)));app.on('dialog',lambda d:d.accept())
        app.goto(base+'app/');wait_idle(app)
        app.wait_for_function("window.F4MPWA?.state==='ready'",timeout=25000)
        check('APP independent save',state(app)['ply']==0)
        check('APP default board Max',app.locator('body').get_attribute('data-board-size')=='max' and ratio(app)>.89,ratio(app))
        app.locator('#more').click();app.locator('#boardSize').select_option('standard');check('APP Standard geometry',.77<ratio(app)<.79,ratio(app));app.locator('#boardSize').select_option('max');app.locator('#closeMore').click()
        for width in (375,390,402,430):
          app.locator('#previewWidth').select_option(str(width))
          actual=app.locator('.device-screen').bounding_box()['width']
          check('APP preview width '+str(width),abs(actual-width)<6,actual)
        for width,height in ((1920,1080),(3840,2160),(900,850),(700,900)):
          app.set_viewport_size({'width':width,'height':height})
          check('APP fixed mode '+str(width),app.url.endswith('/app/') and app.locator('.device').is_visible() and app.locator('body').get_attribute('data-channel')=='app')
          check('APP board fills device '+str(width),app.locator('#playPanel').bounding_box()['width']>app.locator('.device-screen').bounding_box()['width']*.90)
        app.set_viewport_size({'width':1440,'height':1080});app.locator('#previewWidth').select_option('390')
        for col in (3,4,3):drop(app,col)
        app.screenshot(path=str(out/'app-desktop.png'),full_page=True)
        for view,panel in (('analysis','analysisPanel'),('sim','batchPanel'),('history','historyPanel')):
          app.locator('#tab-'+view).click();check('APP panel '+view,app.locator('#'+panel).is_visible() and not app.locator('#playPanel').is_visible())
          check('APP pause remains available '+view,app.locator('#pause').is_visible())
          check('APP More remains available '+view,app.locator('#more').is_visible())
        app.locator('#tab-board').click()
        check('APP board return',app.locator('#playPanel').is_visible())
        app.locator('#newGame').click();check('APP setup opens',app.locator('#setupPanel').is_visible())
        app.locator('#mode').select_option('cpu');app.locator('#difficulty').select_option('beginner');app.locator('#cpuEngine').select_option('dcc');app.locator('#start').click();wait_idle(app)
        drop(app,3);app.wait_for_function('F4MLab.status().cursor>=2&&!F4MLab.status().thinking&&!F4MLab.status().animating',timeout=15000)
        check('DCC AI completed legal reply',state(app)['ply']==2)
        app.locator('#undo').click();wait_idle(app);check('Undo complete human+AI turn',state(app)['ply']==0)
        check('LAB untouched by APP game',state(page)==saved_state)
        # Two-channel offline cold navigation and Workers.
        app.reload();wait_idle(app);ctx.set_offline(True)
        page.goto(base+'new/');wait_idle(page);check('LAB offline cold load',state(page)==saved_state)
        app.goto(base+'app/');wait_idle(app);check('APP offline cold load',state(app)['ply']==0)
        app.locator('#hint').click();wait_idle(app)
        app.wait_for_function("document.getElementById('statNodes').textContent!=='—'",timeout=15000)
        check('Offline Worker hint',app.locator('#statNodes').inner_text()!='—')
        ctx.set_offline(False)
        # Real update handshake. Only the test server's SW file is temporarily changed.
        page.locator('#tab-board').click();second=ctx.new_page();second.goto(base+'new/');wait_idle(second)
        navs=[];second.on('framenavigated',lambda f:navs.append(f.url) if f==second.main_frame else None)
        (root/'new/sw.js').write_text(original_sw.replace('const BUILD="2.3.0-petrol"','const BUILD="2.3.0-petrol-test"',1))
        page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
        page.wait_for_function("document.getElementById('pwaToast').hidden===false",timeout=25000)
        check('Update waits for consent',page.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)"))
        page.evaluate("window._realWrite=F4MStore.write;F4MStore.write=()=>Promise.resolve('unavailable')")
        page.locator('#updateButton').click();page.wait_for_timeout(300)
        check('Failed save blocks update',page.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)") and 'JSON' in page.locator('#updateText').inner_text())
        page.evaluate('()=>{F4MStore.write=window._realWrite;}')
        with page.expect_navigation(wait_until='load',timeout=20000):page.locator('#updateButton').click()
        wait_idle(page);check('Saved update restores state',state(page)==saved_state)
        page.wait_for_timeout(300);check('Other tab not auto-reloaded',len(navs)==0)
        second.close()
        # Legacy migration: seed a hydrated old snapshot, copy only into an empty destination.
        migration_ctx=browser.new_context(accept_downloads=True);legacy=migration_ctx.new_page();legacy.goto(base+'PWA/')
        legacy.evaluate("data=>F4MStore.write(data)",page.evaluate('F4MLab.snapshot()'));legacy.reload();legacy.wait_for_function("!document.getElementById('copy').disabled")
        legacy.locator('#copy').click();legacy.wait_for_function("document.getElementById('status').textContent.includes('Kopija preverjena')",timeout=12000)
        check('Legacy copy readback',True)
        legacy.reload();legacy.wait_for_function("!document.getElementById('copy').disabled");legacy.locator('#copy').click();legacy.wait_for_function("document.getElementById('status').textContent.includes('LAB že vsebuje')")
        check('Legacy refuses overwrite',True)
        with legacy.expect_download() as event:legacy.locator('#export').click()
        check('Legacy export preserved',event.value.suggested_filename=='Flip4M-legacy-save.json')
        migration_ctx.close()
        phone_ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
        phone=phone_ctx.new_page();phone.goto(base+'app/');wait_idle(phone)
        check('Phone full screen',phone.locator('html').get_attribute('class')=='app-phone' and not phone.locator('.preview-header').is_visible())
        check('Phone no horizontal overflow',phone.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        phone.screenshot(path=str(out/'app-phone.png'),full_page=True)
        phone.goto(base+'new/');wait_idle(phone)
        check('Mobile LAB no overflow',phone.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        phone.screenshot(path=str(out/'lab-phone.png'),full_page=True)
        phone_ctx.close()
        check('No page JavaScript errors',not errors,errors)
        browser.close()
    finally:
      (root/'new/sw.js').write_text(original_sw)
      server.shutdown()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--public',type=Path,default=Path('public'));parser.add_argument('--out',type=Path,default=Path('flip4m-evidence'));parser.add_argument('--executable');a=parser.parse_args();error=None
    try:verify(a.public,a.out,a.executable)
    except Exception as exc:error=repr(exc);print(error)
    a.out.mkdir(parents=True,exist_ok=True)
    report={'scope':'Flip4M Petrol LAB APP bounded browser acceptance','version':VERSION,'passed':sum(x['pass'] for x in RESULTS),'checks':len(RESULTS),'error':error,'physical_iPhone_test':'NOT_RUN','results':RESULTS}
    (a.out/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='results'}))
    if error:raise SystemExit(1)
