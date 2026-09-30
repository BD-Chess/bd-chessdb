#!/usr/bin/env python3
"""Bounded 2.4.1 changed-mechanism tests; localhost or explicit owned live URL.

Uses disposable browser profiles only. Writes evidence after each check, never
remote user data. No benchmark/tournament, external AI call or unbounded retry.
"""
from __future__ import annotations
import argparse
import functools
import http.server
import json
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

RESULTS = []
OUT = Path('flip4m-241-evidence')


def save(error=None):
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'scope':'2.4.1 compact rim, AI vs AI and Smart Time v2 regression', 'passed':sum(x['pass'] for x in RESULTS), 'checks':len(RESULTS), 'error':error, 'physical_iPhone':'NOT_RUN', 'results':RESULTS}
    tmp=OUT/'targeted-verification.tmp'
    tmp.write_text(json.dumps(report, indent=2)+'\n')
    tmp.replace(OUT/'targeted-verification.json')
    return report


def check(name, ok, detail=None):
    RESULTS.append({'name':name,'pass':bool(ok),'detail':detail})
    save()
    print(('PASS ' if ok else 'FAIL ')+name, flush=True)
    if not ok:
        raise AssertionError(name+': '+str(detail))


def idle(page):
    page.wait_for_function('window.F4MLab&&!F4MLab.status().loading&&!F4MLab.status().thinking&&!F4MLab.status().animating', timeout=15000)


def resume(page):
    if page.evaluate('F4MLab.status().paused'):
        page.locator('#pause').click()


def key(page):
    return page.evaluate('F4M.key(F4MLab.snapshot().states[F4MLab.status().cursor])')


def new_game(page, mode, tools='3'):
    page.locator('#newGame').click()
    page.locator('#mode').select_option(mode)
    page.locator('#tools').select_option(tools)
    page.locator('#difficulty').select_option('beginner')
    if not page.locator('#timeControl').is_visible():
        page.locator('#setupPanel details:has(#timeControl) > summary').click()
    page.locator('#timeControl').select_option('0')
    if mode == 'demo':
        page.locator('#demoRed').select_option('classical')
        page.locator('#demoYellow').select_option('dcc')
    page.locator('#start').click()
    if mode != 'demo':
        idle(page)


GEOMETRY = r'''() => {
 const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
 const a=box(document.getElementById('arena')),f=box(document.querySelector('.board-frame'));
 const angle=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--angle'))||0;
 const rotated=Math.abs(Math.round(angle/90))%2;
 let overlaps=0,clipped=0,misaligned=0,tooSmall=0;
 const caps=[...document.querySelectorAll('#rim .mag-slot')].map(b=>{
  const s=+b.dataset.side,i=+b.dataset.idx,c=b.querySelector('.mag-cap'),v=box(c),h=box(b);
  const r=s===0?0:s===2?7:i,col=s===3?0:s===1?7:i;
  const cell=box(document.querySelector('.cell[data-r="'+r+'"][data-c="'+col+'"]'));
  const alongX=(s%2===0)!==!!rotated;
  const deviation=alongX?Math.abs(v.x+v.w/2-cell.x-cell.w/2):Math.abs(v.y+v.h/2-cell.y-cell.h/2);
  if(deviation>1)misaligned++;
  if(v.x<f.right-.1&&v.right>f.x+.1&&v.y<f.bottom-.1&&v.bottom>f.y+.1)overlaps++;
  if(v.x<a.x-.2||v.y<a.y-.2||v.right>a.right+.2||v.bottom>a.bottom+.2)clipped++;
  const actualW=Math.min(h.right,a.right)-Math.max(h.x,a.x),actualH=Math.min(h.bottom,a.bottom)-Math.max(h.y,a.y);
  if(actualW<23.5||actualH<23.5)tooSmall++;
  return {side:s,index:i,cap:v,hit:h,deviation};
 });
 return {angle,arena:a,frame:f,overlaps,clipped,misaligned,tooSmall,caps};
}'''


def exercise(page, base, channel, desktop):
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    page.goto(base+channel+'/')
    idle(page)
    page.wait_for_function("F4MPWA.state==='ready'",timeout=30000)
    tag=('desktop ' if desktop else 'phone ')+channel
    check(tag+' version', page.evaluate("F4MLab.version==='2.4.1-petrol'"))
    new_game(page,'pvp')
    for col in (3,4):
        page.locator('.cell[data-r="0"][data-c="'+str(col)+'"]').click()
        idle(page)
    board_before=key(page)
    rotor_before=page.locator('#rotor').bounding_box()['width']
    page.locator('#magnet').click()
    check(tag+' board not reduced by magnet mode',abs(page.locator('#rotor').bounding_box()['width']-rotor_before)<.1)
    matrix=[]
    for size in ('standard','large','max'):
        page.evaluate('(size)=>F4MShell.setBoardSize(size)',size)
        for angle in (0,90,180,270):
            page.evaluate('(angle)=>document.documentElement.style.setProperty("--angle",angle+"deg")',angle)
            measured=page.evaluate(GEOMETRY)
            matrix.append({'size':size,**{k:v for k,v in measured.items() if k!='caps'}})
    check(tag+' all sizes/rotations caps outside board',all(x['overlaps']==0 for x in matrix),matrix)
    check(tag+' all sizes/rotations caps unclipped',all(x['clipped']==0 for x in matrix))
    check(tag+' all sizes/rotations cell alignment',all(x['misaligned']==0 for x in matrix))
    check(tag+' usable transparent hit targets',all(x['tooSmall']==0 for x in matrix))
    page.evaluate('()=>{document.documentElement.style.setProperty("--angle","0deg");F4MShell.setBoardSize("max");}')
    page.locator('#magnet').click()
    check(tag+' inactive rim does not intercept drops',page.evaluate("[...document.querySelectorAll('#rim .mag-slot')].every(b=>b.disabled&&getComputedStyle(b).pointerEvents==='none')"))
    check(tag+' geometry tests preserve game',key(page)==board_before)
    # Each side executes the same physical action as the unchanged core engine.
    for side in range(4):
        before=key(page)
        expected=page.evaluate('(side)=>{const x=F4M.action(F4MLab.snapshot().states[F4MLab.status().cursor],{type:"magnet",side,idx:3});return {key:F4M.key(x),life:x.mag[F4M.SIDES[side]][3].life};}',side)
        resume(page)
        page.locator('#magnet').click()
        slot=page.locator('.mag-slot[data-side="'+str(side)+'"][data-idx="3"]')
        # Click a point in the transparent hit target, not the tiny visible cap.
        rect=slot.bounding_box()
        page.mouse.click(rect['x']+rect['width']/2+(8 if side%2 else 0),rect['y']+rect['height']/2+(0 if side%2 else 8))
        idle(page)
        check(tag+' magnetic hit side '+str(side),key(page)==expected['key'])
        check(tag+' lifetime/owner side '+str(side),slot.locator('.mag-life').inner_text()==str(expected['life']) and 'owned1' in slot.get_attribute('class'))
        page.locator('#undo').click()
        idle(page)
        check(tag+' magnetic undo side '+str(side),key(page)==before)
    # Leave one magnet of each owner for visual evidence.
    for side,idx in ((0,3),(3,4)):
        resume(page);page.locator('#magnet').click()
        page.locator('.mag-slot[data-side="'+str(side)+'"][data-idx="'+str(idx)+'"]').click();idle(page)
    page.locator('#magnet').click()
    page.locator('#arena').screenshot(path=str(OUT/(tag.replace(' ','-')+'-magnets.png')))
    page.screenshot(path=str(OUT/(tag.replace(' ','-')+'-game.png')),full_page=True)
    # Real demo game, using the established journal/single scheduler, not Sim.
    new_game(page,'demo','2')
    page.wait_for_function('F4MLab.status().cursor>=4',timeout=20000)
    page.locator('#pause').click();idle(page)
    snap=page.evaluate('F4MLab.snapshot()')
    check(tag+' real AI vs AI turns',snap['cursor']>=4 and snap['game']['mode']=='demo' and not snap['inSimulation'])
    check(tag+' per-side engine choices',snap['game']['policies']=={'1':'classical','2':'dcc'})
    check(tag+' both AI names',page.locator('#name1').inner_text()=='Classical AI' and page.locator('#name2').inner_text()=='AI + DCC')
    check(tag+' demo caption', 'AI' in page.locator('#instruction').inner_text())
    stopped=key(page);pos=snap['cursor'];page.wait_for_timeout(300)
    check(tag+' pause cancels work',key(page)==stopped and page.evaluate('F4MLab.status().paused&&!F4MLab.status().thinking'))
    check(tag+' no manual AI-game move',page.locator('#magnet').is_disabled() and page.locator('#flipLeft').is_disabled())
    check(tag+' save/readback',page.evaluate('F4MLab.saveForUpdate()') in ('indexeddb','localstorage'))
    page.reload();idle(page)
    check(tag+' reload preserves demo paused',key(page)==stopped and page.evaluate("F4MLab.snapshot().game.mode==='demo'&&F4MLab.status().paused"))
    page.locator('#undo').click();idle(page)
    check(tag+' demo Undo pauses one ply',page.evaluate('F4MLab.status().cursor')==pos-1 and page.evaluate('F4MLab.status().paused'))
    resume(page)
    page.wait_for_function('(pos)=>F4MLab.status().cursor>=pos',arg=pos,timeout=15000)
    page.locator('#pause').click();idle(page)
    check(tag+' demo resumes after Undo',page.evaluate('F4MLab.status().cursor')>=pos)
    # Roundtrip through the actual import UI, retaining per-side policy and game.
    snapshot=page.evaluate('F4MLab.snapshot()');saved_key=key(page)
    file=OUT/(tag.replace(' ','-')+'-demo.json');file.write_text(json.dumps(snapshot))
    page.locator('#file').set_input_files(str(file))
    page.wait_for_timeout(150);idle(page)
    check(tag+' demo JSON import preserves policies',key(page)==saved_key and page.evaluate('F4MLab.snapshot().game.policies')=={'1':'classical','2':'dcc'})
    page.locator('#newGame').click()
    check(tag+' demo selectors visible',page.locator('#demoOptions').is_visible())
    check(tag+' irrelevant human-first hidden',not page.locator('#first').is_visible() and not page.locator('#cpuEngine').is_visible())
    for lang in ('en','sl'):
        page.locator('[data-language="'+lang+'"]').click()
        check(tag+' AI vs AI label '+lang,page.locator('#mode option[value="demo"]').inner_text()=='AI vs AI')
    page.screenshot(path=str(OUT/(tag.replace(' ','-')+'-ai-setup.png')),full_page=True)
    # Changing future setup must not silently replace the current demo.
    page.locator('#mode').select_option('cpu')
    check(tag+' human setup restored',page.locator('#first').is_visible() and page.locator('#cpuEngine').is_visible() and not page.locator('#demoOptions').is_visible())
    check(tag+' setup change not current game change',page.evaluate("F4MLab.snapshot().game.mode==='demo'"))
    page.locator('#tab-board').click()
    check(tag+' no JavaScript errors',not errors,errors)


def run(base):
    with sync_playwright() as p:
        browser=p.chromium.launch()
        desktop=browser.new_context(viewport={'width':1440,'height':1080},reduced_motion='reduce')
        desktop.add_init_script("for(const c of ['lab','app']){const k='flip4m.'+c+'.2.2.preferences';if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify({mode:'pvp',difficulty:'beginner'}));}")
        page=desktop.new_page()
        exercise(page,base,'new',True)
        app=desktop.new_page();exercise(app,base,'app',True)
        # Width and canvas checks preserve the approved desktop shell.
        widths=[]
        for width in ('375','390','402','430'):
            app.locator('#previewWidth').select_option(width)
            widths.append({'width':width,'actual':app.locator('.device-screen').bounding_box()['width'],'geometry':app.evaluate(GEOMETRY)['overlaps']})
        check('APP all preview widths retained',all(abs(float(x['width'])-x['actual'])<6 and x['geometry']==0 for x in widths),widths)
        app.set_viewport_size({'width':3840,'height':2160})
        check('APP fixed desktop 4K',app.url.endswith('/app/') and app.locator('.device').is_visible())
        app.set_viewport_size({'width':1440,'height':1080})
        # Cold offline load retains both AI mode and the new rim assets.
        app.evaluate('F4MLab.saveForUpdate()');saved_key=key(app)
        desktop.set_offline(True);app.reload();idle(app)
        check('APP cold offline demo/rim',key(app)==saved_key and app.locator('.mag-cap').count()==32)
        resume(app);n=app.evaluate('F4MLab.status().cursor')
        app.wait_for_function('(n)=>F4MLab.status().cursor>n',arg=n,timeout=15000)
        app.locator('#pause').click();idle(app)
        check('APP real AI vs AI offline',app.evaluate('F4MLab.status().cursor')>n)
        desktop.set_offline(False)
        desktop.close()
        phone=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce',user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
        phone.add_init_script("for(const c of ['lab','app']){const k='flip4m.'+c+'.2.2.preferences';if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify({mode:'pvp',difficulty:'beginner'}));}")
        # The phone profile must not reset saved preferences on every navigation.
        # Seed pvp only once; later reloads retain the tested demo preferences.
        ph=phone.new_page();exercise(ph,base,'app',False)
        check('Phone APP remains fullscreen',ph.locator('html').get_attribute('class')=='app-phone' and not ph.locator('.preview-header').is_visible())
        check('Phone no horizontal overflow',ph.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        phone.close();browser.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--public',type=Path,default=Path('public'));parser.add_argument('--out',type=Path,default=OUT);parser.add_argument('--base-url')
    args=parser.parse_args();OUT=args.out;server=None;error=None
    try:
        if args.base_url:
            if not args.base_url.startswith('https://bd-chess.github.io/bd-chessdb/F4M/'):
                raise ValueError('Only the explicitly owned Flip4M production base is allowed')
            base=args.base_url.rstrip('/')+'/'
        else:
            class Quiet(http.server.SimpleHTTPRequestHandler):
                def log_message(self,*args):pass
            server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(args.public.resolve())))
            threading.Thread(target=server.serve_forever,daemon=True).start()
            base='http://127.0.0.1:'+str(server.server_port)+'/F4M/'
        OUT.mkdir(parents=True,exist_ok=True);run(base)
    except Exception as exc:
        error=repr(exc)
    finally:
        if server:server.shutdown()
        report=save(error);print(json.dumps({k:v for k,v in report.items() if k!='results'}))
    if error:raise SystemExit(1)
