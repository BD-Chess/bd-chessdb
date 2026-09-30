#!/usr/bin/env python3
"""Bounded UI acceptance on disposable browser profiles, locally or on owned live pages.
No external AI calls, no tournaments, no user checkpoints. Saves measured geometry,
screenshots and JSON receipts. A failure aborts and preserves diagnostic output.
"""
from __future__ import annotations
import argparse, functools, hashlib, http.server, json, threading, datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

RESULTS=[]
def check(name, ok, detail=None):
    RESULTS.append({'name':name,'pass':bool(ok),'detail':detail})
    if not ok: raise AssertionError(name+': '+str(detail))

def idle(p):
    p.wait_for_function('window.F4MLab && !F4MLab.status().loading && !F4MLab.status().animating && !F4MLab.status().thinking',timeout=15000)

def snap(p): return p.evaluate('F4MLab.snapshot()')
def state(p): return p.evaluate('F4MLab.snapshot().states[F4MLab.status().cursor]')
def resume(p):
    if p.evaluate('F4MLab.status().paused'): p.locator('#pause').click()

def drop(p,col):
    resume(p);p.locator(f'.cell[data-r="0"][data-c="{col}"]').click();idle(p)

AUDIT=r'''angle=>{
 document.documentElement.style.setProperty('--angle',angle+'deg');
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};};
 const cells=[...document.querySelectorAll('.cell')].map(rect);
 const slots=[...document.querySelectorAll('.mag-slot')];
 const markers=slots.map(b=>rect(b.querySelector('.mag-marker')));
 const hits=slots.map(rect),issues=[];
 const intersects=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.1;
 slots.forEach((b,i)=>{
  const side=+b.dataset.side,idx=+b.dataset.idx,m=markers[i],h=hits[i];
  const cellIndex=side===0?idx:side===2?56+idx:side===1?idx*8+7:idx*8;
  const c=cells[cellIndex],horizontal=(side%2===0)===(Math.abs(angle)%180===0);
  if(cells.some(c=>intersects(m,c)))issues.push('marker overlaps hole '+side+':'+idx);
  if(Math.abs(horizontal?m.cx-c.cx:m.cy-c.cy)>.8)issues.push('lane alignment '+side+':'+idx);
  if(Math.min(m.w,m.h)>12.2||Math.max(m.w,m.h)>28.2)issues.push('oversized marker '+i);
  if(Math.min(h.w,h.h)<23.5)issues.push('small hit target '+i);
  if(hits.some((other,j)=>j!==i&&intersects(h,other)))issues.push('overlapping hit targets '+i);
 });
 const arena=rect(document.getElementById('arena')),rotor=rect(document.getElementById('rotor'));
 return {issues,arena,rotor,markers:markers.length,hitMin:Math.min(...hits.map(h=>Math.min(h.w,h.h))),sample:markers[3]};
}'''


def geometry(p,label,out):
    idle(p)
    check(label+' has 32 real magnet targets',p.locator('.mag-slot').count()==32 and p.locator('.mag-marker').count()==32)
    inactive=p.evaluate("[...document.querySelectorAll('.mag-slot')].every(b=>getComputedStyle(b).pointerEvents==='none')")
    check(label+' rim does not intercept normal play',inactive)
    before=p.locator('#rotor').bounding_box()
    resume(p);p.locator('#magnet').click()
    check(label+' Magnet mode enables targets',p.evaluate("[...document.querySelectorAll('.mag-slot')].every(b=>!b.disabled&&getComputedStyle(b).pointerEvents==='auto')"))
    after=p.locator('#rotor').bounding_box()
    check(label+' Magnet mode preserves board dimensions',abs(before['width']-after['width'])<.1 and abs(before['height']-after['height'])<.1)
    measurements=[]
    for size,ratio in (('standard',.78),('large',.84),('max',.90)):
        p.evaluate('s=>F4MShell.setBoardSize(s)',size)
        for angle in (0,90,180,270):
            result=p.evaluate(AUDIT,angle);measurements.append({'size':size,'angle':angle,**result})
            check(label+f' {size} / {angle}deg compact aligned clear rim',not result['issues'] and result['markers']==32,result['issues'])
            check(label+f' {size} / {angle}deg original scale',abs(result['rotor']['w']/result['arena']['w']-ratio)<.003)
    p.evaluate("document.documentElement.style.setProperty('--angle','0deg')")
    p.locator('#magnet').click()
    (out/(label+'-geometry.json')).write_text(json.dumps(measurements,indent=2)+'\n')


def game_checks(p,label,out):
    drop(p,3);drop(p,4);before=state(p)
    p.locator('#magnet').click();p.locator('.mag-slot[data-side="0"][data-idx="3"]').click();idle(p)
    owner=p.evaluate("()=>{const s=F4MLab.snapshot().states[F4MLab.status().cursor];return s.mag[F4M.SIDES[0]][3];}")
    check(label+' placed red magnet shows exact remaining turns',owner and owner['p']==1 and p.locator('.mag-slot[data-side="0"][data-idx="3"] .mag-life').inner_text()==str(owner['life']),owner)
    p.locator('#magnet').click();target=p.locator('.mag-slot[data-side="1"][data-idx="2"]');target.focus();p.keyboard.press('Enter');idle(p)
    check(label+' keyboard places yellow magnet',p.locator('.mag-slot.owned2').count()==1)
    p.locator('#magnet').click();p.screenshot(path=str(out/(label+'-magnets.png')),full_page=True);p.locator('#magnet').click()
    p.locator('#undo').click();idle(p);p.locator('#undo').click();idle(p)
    check(label+' Undo magnets preserves exact state',state(p)==before)
    p.locator('#flipLeft').click();idle(p);p.locator('#undo').click();idle(p)
    check(label+' real rotation and Undo preserve state',state(p)==before)
    p.locator('#newGame').click();p.locator('#mode').select_option('demo')
    check(label+' AI vs AI is in Opponent menu',p.locator('#mode option[value="demo"]').inner_text()=='AI vs AI')
    check(label+' per-side policies shown; human fields hidden',p.locator('#duelPolicies').is_visible() and not p.locator('#cpuEngineField').is_visible() and not p.locator('#firstField').is_visible())
    p.locator('#demoRed').select_option('dcc');p.locator('#demoYellow').select_option('classical');p.locator('#difficulty').select_option('beginner')
    p.screenshot(path=str(out/(label+'-ai-setup.png')),full_page=True)
    p.locator('#start').click()
    p.wait_for_function('F4MLab.status().cursor>=4',timeout=15000);p.locator('#pause').click();idle(p)
    data=snap(p);cursor=data['cursor']
    check(label+' two actual AI policies play a normal game',data['game']['mode']=='demo' and data['game']['policies']=={'1':'dcc','2':'classical'} and not data['inSimulation'] and cursor>=4,{'cursor':cursor,'game':data['game']})
    check(label+' manual drops disabled in AI vs AI',p.evaluate("[...document.querySelectorAll('.cell')].every(b=>b.disabled)"))
    p.wait_for_timeout(650);check(label+' Pause cancels all future moves',snap(p)['cursor']==cursor and p.evaluate('F4MLab.status().paused'))
    p.locator('#undo').click();idle(p);check(label+' AI-vs-AI Undo remains paused',snap(p)['cursor']==cursor-1 and p.evaluate('F4MLab.status().paused'))
    p.locator('#pause').click();p.wait_for_function('n=>F4MLab.status().cursor>n',arg=cursor,timeout=15000);p.locator('#pause').click();idle(p)
    check(label+' AI-vs-AI Continue works',snap(p)['cursor']>cursor)
    p.evaluate('F4MLab.saveForUpdate()');saved=snap(p)
    p.reload();idle(p)
    restored=snap(p)
    check(label+' AI-vs-AI restores paused without losing policies',restored['game']==saved['game'] and restored['states']==saved['states'] and restored['cursor']==saved['cursor'] and p.evaluate('F4MLab.status().paused'))
    p.locator('#tab-history').click()
    with p.expect_download() as event:p.locator('#save').click()
    export=out/(label+'-duel-save.json');event.value.save_as(str(export))
    check(label+' exported AI-vs-AI session is valid',json.loads(export.read_text())['game']==saved['game'])
    p.locator('#file').set_input_files(str(export));idle(p)
    check(label+' AI-vs-AI import preserves board and policies',snap(p)['game']==saved['game'] and state(p)==saved['states'][saved['cursor']])
    p.locator('#tab-board').click()
    p.wait_for_function("F4MPWA.state==='ready'",timeout=25000)
    p.context.set_offline(True);p.goto(p.url);idle(p)
    check(label+' offline cold load preserves duel',snap(p)['game']==saved['game'] and state(p)==saved['states'][saved['cursor']])
    n=snap(p)['cursor'];p.locator('#pause').click();p.wait_for_function('n=>F4MLab.status().cursor>=n+2',arg=n,timeout=15000);p.locator('#pause').click();idle(p)
    check(label+' both AI sides run offline',snap(p)['cursor']>=n+2)
    p.context.set_offline(False)
    # Re-enter ordinary modes via the actual setup controls.
    p.locator('#newGame').click();p.locator('#mode').select_option('cpu')
    check(label+' human-vs-AI fields restored',not p.locator('#duelPolicies').is_visible() and p.locator('#firstField').is_visible() and p.locator('#cpuEngineField').is_visible())
    p.locator('#first').select_option('human');p.locator('#cpuEngine').select_option('classical');p.locator('#start').click();idle(p);drop(p,3)
    p.wait_for_function('F4MLab.status().cursor>=2&&!F4MLab.status().thinking&&!F4MLab.status().animating',timeout=15000)
    check(label+' human-vs-AI still replies',state(p)['ply']==2)
    p.locator('#newGame').click();p.locator('#mode').select_option('pvp');p.locator('#start').click();idle(p);drop(p,2)
    check(label+' PvP still permits manual moves',snap(p)['game']['mode']=='pvp' and state(p)['ply']==1)


def run(a):
    out=a.out;out.mkdir(parents=True,exist_ok=True)
    server=None
    if a.base:base=a.base.rstrip('/')+'/'
    else:
        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self,*args): pass
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.public.resolve())))
        threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/F4M/'
        old=a.public/'F4M/_shared/petrol-2.3.1';new=a.public/'F4M/_shared/petrol-2.4.0'
        for name in ('f4m-core.js','f4m-search.js','f4m-classical.js','f4m-dcc.js','f4m-sim.js','f4m-time.js','f4m-smart-time.js','f4m-worker.js','f4m-store.js','f4m.css','shell.js'):
            check('Unmodified '+name,(old/name).read_bytes()==(new/name).read_bytes())
    try:
      with sync_playwright() as pw:
        for engine in a.engines.split(','):
          browser=getattr(pw,engine).launch()
          for channel,width,height,phone in [('app',375,812,True),('app',960,1120,False),('new',390,844,True),('new',1280,1000,False)]:
            label=f'{engine}-{channel}-{width}'
            kwargs={'viewport':{'width':width,'height':height},'accept_downloads':True}
            if phone:kwargs.update(is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
            ctx=browser.new_context(**kwargs)
            ctx.add_init_script("for(const c of ['app','lab'])if(!localStorage.getItem('flip4m.'+c+'.2.2.preferences'))localStorage.setItem('flip4m.'+c+'.2.2.preferences',JSON.stringify({mode:'pvp',difficulty:'beginner',theme:'dark',lang:'sl'}));")
            p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('dialog',lambda d:d.accept())
            p.goto(base+channel+'/');idle(p)
            check(label+' expected build',p.evaluate('F4MLab.version')=='2.4.0-petrol')
            geometry(p,label,out)
            if (channel=='app' and phone) or (channel=='new' and not phone):game_checks(p,label,out)
            else:
                p.locator('#newGame').click();p.locator('#mode').select_option('demo');p.locator('#demoRed').select_option('classical');p.locator('#demoYellow').select_option('classical');p.locator('#start').click()
                p.wait_for_function('F4MLab.status().cursor>=2',timeout=15000);p.locator('#pause').click();idle(p)
                check(label+' same-policy AI-vs-AI also plays',snap(p)['game']['policies']=={'1':'classical','2':'classical'})
            check(label+' no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
            if channel=='app' and not phone:
                p.locator('#tab-board').click();p.set_viewport_size({'width':3840,'height':2160})
                check(label+' fixed centered APP remains at 4K',p.locator('.device').is_visible() and p.url.endswith('/app/'))
                p.set_viewport_size({'width':960,'height':1120});p.screenshot(path=str(out/(label+'-preview.png')),full_page=True)
            check(label+' no JS errors',not errors,errors);ctx.close()
          browser.close()
    finally:
        if server:server.shutdown()

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--public',type=Path,default=Path('public'));ap.add_argument('--out',type=Path,default=Path('magnet-demo-evidence'));ap.add_argument('--base');ap.add_argument('--engines',default='chromium,webkit');a=ap.parse_args();error=None
    try:run(a)
    except Exception as exc:error=repr(exc);print(error)
    a.out.mkdir(parents=True,exist_ok=True)
    report={'version':'2.4.0-petrol','scope':'compact rim geometry and normal AI-vs-AI lifecycle','live_base':a.base,'engines':a.engines,'passed':sum(x['pass'] for x in RESULTS),'checks':len(RESULTS),'error':error,'physical_device':'NOT_RUN','time_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':RESULTS}
    (a.out/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='results'}))
    if error:raise SystemExit(1)
