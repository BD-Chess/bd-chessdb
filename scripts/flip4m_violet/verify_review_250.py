#!/usr/bin/env python3
from __future__ import annotations
import argparse, functools, hashlib, http.server, json, subprocess, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

RESULTS=[]
def check(name,ok,detail=None):
 RESULTS.append({'name':name,'pass':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok: raise AssertionError(name+': '+str(detail))
def git_hash(data):
 return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def wait_idle(page):
 page.wait_for_function("window.F4MLab&&!F4MLab.status().loading&&!F4MLab.status().thinking&&!F4MLab.status().animating",timeout=25000)
def snap_core(page):
 return page.evaluate("""() => {const s=F4MLab.snapshot();return {cursor:s.cursor,states:s.states,moves:s.moves,records:s.records,game:s.game};}""")
def drop(page,col):
 page.locator(f'#matrix .cell[data-c="{col}"]').last.click();wait_idle(page)
def resume_if_paused(page):
 if page.evaluate('F4MLab.status().paused'): page.locator('#pause').click()
def verify(public:Path,out:Path,executable=None):
 root=public/'F4M';app=root/'app';shared=root/'_shared/petrol-2.5.0'
 archive={'index.html':'1cdf34d658d71dce2088621bf4fdc2e12d5b9fd4','manifest.webmanifest':'a4c85c0fdac7179982ddba03724bca2ec9c2bfa9','release.json':'5e394e73634374cb20bd35365f68563080641be2','sw.js':'b870d9b6ae7371eba5dbab9d9f96d2aaf521981d'}
 for name,sha in archive.items():check('old/002 exact '+name,git_hash((app/'old/002'/name).read_bytes())==sha)
 rel=json.loads((app/'release.json').read_text());check('APP release 2.5.0',rel['version']=='2.5.0-petrol' and rel['shared_path']=='_shared/petrol-2.5.0' and rel['review']['mode']=='read-only')
 check('Review assets materialized',(shared/'f4m-review.js').exists() and (shared/'f4m-review.css').exists())
 check('LAB release remains 2.4.1',json.loads((root/'new/release.json').read_text())['version']=='2.4.1-petrol')
 for f in [shared/'f4m-review.js',shared/'f4m-ui.js',shared/'shell.js',shared/'pwa.js']:
  r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True,timeout=8);check('Syntax '+f.name,r.returncode==0,r.stderr or None)
 html=(app/'index.html').read_text();check('APP uses new shared runtime','_shared/petrol-2.5.0/f4m-ui.js' in html and '_shared/petrol-2.5.0/f4m-review.js' in html)
 check('No old shared runtime references in APP HTML','_shared/petrol-2.4.1/' not in html)
 sw=(app/'sw.js').read_text();check('APP cache owns Review assets','2.5.0-petrol' in sw and 'f4m-review.js' in sw and 'f4m-review.css' in sw)
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(public.resolve())))
 threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/F4M/'
 try:
  with sync_playwright() as p:
   launch={'headless':True}
   if executable:launch['executable_path']=executable
   browser=p.chromium.launch(**launch)
   ctx=browser.new_context(viewport={'width':1280,'height':1000},accept_downloads=True)
   ctx.add_init_script("""localStorage.setItem('flip4m.app.2.2.preferences',JSON.stringify({mode:'pvp',tools:'2',difficulty:'beginner',first:'human',cpuEngine:'classical',demoRed:'classical',demoYellow:'dcc',showTimers:false,showTimestamps:false,timeControl:'0',guard:'12',sensorGs:true,sensorMr:true,sensorThrift:true,sensorPath:true}));""")
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.goto(base+'app/');wait_idle(page);page.wait_for_timeout(800)
   check('Review bootstrap',page.evaluate("typeof window.F4MReview==='object'"),{'errors':errors,'reviewScript':page.locator('script[src*="f4m-review"]').count()})
   page.wait_for_function("window.F4MPWA",timeout=10000);page.wait_for_function("F4MPWA.state==='ready'",timeout=30000)
   check('APP runtime version',page.evaluate("F4MLab.version==='2.5.0-petrol'"))
   check('Review tab added',page.locator('#tab-review').count()==1 and page.locator('#workspaceTabs button').count()==5)
   page.locator('#newGame').click();page.locator('#setupPanel').wait_for(state='visible');page.locator('#mode').select_option('pvp');page.locator('#tools').select_option('2');page.locator('#start').click();wait_idle(page)
   drop(page,3);drop(page,4)
   page.locator('#flipLeft').click();wait_idle(page)
   drop(page,2)
   page.locator('#magnet').click();slot=page.locator('.mag-slot:not(:disabled)').first;check('Legal magnet slot available',slot.count()==1);slot.click();wait_idle(page)
   before=snap_core(page);live_cursor=before['cursor'];check('Review fixture has moves',live_cursor>=5,live_cursor)
   page.locator('#tab-review').click();page.wait_for_function("F4MReview.active()")
   check('Opening Review pauses game',page.evaluate('F4MLab.status().paused===true'))
   check('Review opens at live cursor',page.evaluate('F4MReview.index()')==live_cursor)
   check('Review markers include special events',page.locator('.review-marker').count()>=2,page.locator('.review-marker').count())
   page.locator('#f4mReviewFirst').click();check('First arrow reaches start',page.evaluate('F4MReview.index()')==0)
   page.locator('#f4mReviewNext').click();check('Next arrow advances',page.evaluate('F4MReview.index()')==1)
   check('Step highlights board delta',page.locator('#matrix .review-changed').count()>0)
   page.locator('#f4mReviewLast').click();check('Last arrow reaches end',page.evaluate('F4MReview.index()')==live_cursor)
   page.locator('#f4mReviewPlay').click();page.wait_for_timeout(1000);check('Play review changes review index',page.evaluate('F4MReview.index()')<live_cursor)
   page.locator('#f4mReviewPlay').click()
   after_nav=snap_core(page);check('Review navigation does not mutate session',after_nav==before)
   page.locator('#f4mReviewHistory').click();check('History shortcut exits Review',not page.evaluate('F4MReview.active()') and page.locator('#historyPanel').is_visible())
   check('History shortcut preserves session',snap_core(page)==before)
   page.locator('#tab-board').click()
   # AI-vs-AI provides stored analysis in the same Review without new analysis requests.
   page.locator('#newGame').click();page.locator('#setupPanel').wait_for(state='visible');page.locator('#mode').select_option('demo');page.locator('#difficulty').select_option('beginner');page.locator('#demoRed').select_option('classical');page.locator('#demoYellow').select_option('dcc');page.locator('#start').click()
   page.wait_for_function('F4MLab.status().cursor>=4&&!F4MLab.status().thinking&&!F4MLab.status().animating',timeout=30000);page.locator('#pause').click() if not page.evaluate('F4MLab.status().paused') else None
   ai_before=snap_core(page);page.locator('#tab-review').click();page.wait_for_function('F4MReview.active()');page.locator('#f4mReviewPrev').click()
   check('Stored AI analysis shown',page.locator('#f4mReviewDetail .review-analysis').count()==1)
   check('Review shows measured AI facts',page.locator('#f4mReviewDetail .review-chips span').count()>=2)
   page.locator('#f4mReviewClose').click();check('Back to game keeps exact AI session',snap_core(page)==ai_before)
   check('Back to game leaves explicit pause',page.evaluate('F4MLab.status().paused===true'))
   page.locator('#pause').click();page.wait_for_timeout(80);check('Explicit Continue resumes',page.evaluate('F4MLab.status().paused===false'))
   page.locator('#pause').click();wait_idle(page)
   # PWA/offline: Review module must be cached.
   page.evaluate('F4MLab.saveForUpdate()');page.reload();wait_idle(page);page.wait_for_function("F4MPWA.state==='ready'",timeout=30000);page.wait_for_timeout(250)
   check('APP service worker controls page',page.evaluate('!!navigator.serviceWorker.controller'))
   ctx.set_offline(True);page.reload();wait_idle(page);page.wait_for_function('window.F4MReview',timeout=15000)
   check('Offline cold load includes Review',page.locator('#tab-review').count()==1)
   ctx.set_offline(False);check('Desktop no JS errors',not errors,errors)
   page.screenshot(path=str(out/'app-review-desktop.png'),full_page=True);ctx.close()
   phone_ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
   phone_ctx.add_init_script("""localStorage.setItem('flip4m.app.2.2.preferences',JSON.stringify({mode:'pvp',tools:'2',difficulty:'beginner'}));""")
   phone=phone_ctx.new_page();perrors=[];phone.on('pageerror',lambda e:perrors.append(str(e)));phone.goto(base+'app/');wait_idle(phone);phone.wait_for_function('window.F4MReview',timeout=15000)
   phone.locator('#newGame').click();phone.locator('#setupPanel').wait_for(state='visible');phone.locator('#mode').select_option('pvp');phone.locator('#start').click();wait_idle(phone);drop(phone,3);drop(phone,4);phone.locator('#tab-review').click();phone.wait_for_function('F4MReview.active()')
   check('Phone Review nav has five controls',phone.locator('.review-nav button').count()==5)
   check('Phone Review no horizontal overflow',phone.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   phone.screenshot(path=str(out/'app-review-phone.png'),full_page=True);check('Phone no JS errors',not perrors,perrors);phone_ctx.close()
   browser.close()
 finally:server.shutdown()
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--public',type=Path,default=Path('public'));ap.add_argument('--out',type=Path,default=Path('flip4m-review-evidence'));ap.add_argument('--executable');a=ap.parse_args();error=None
 try:verify(a.public,a.out,a.executable)
 except Exception as exc:error=repr(exc);print(error)
 a.out.mkdir(parents=True,exist_ok=True);report={'scope':'Flip4M APP Review 2.5.0 bounded acceptance','passed':sum(x['pass'] for x in RESULTS),'checks':len(RESULTS),'error':error,'physical_iPhone':'NOT_RUN','results':RESULTS};(a.out/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='results'}))
 if error:raise SystemExit(1)
