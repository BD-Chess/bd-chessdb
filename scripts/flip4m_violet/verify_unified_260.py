#!/usr/bin/env python3
from __future__ import annotations
import argparse, functools, hashlib, http.server, json, subprocess, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
R=[]
def check(name,ok,detail=None):
 R.append({"name":name,"pass":bool(ok),"detail":detail})
 print(("PASS " if ok else "FAIL ")+name,flush=True)
 if not ok: raise AssertionError(name+": "+str(detail))
def git_hash(data:bytes): return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
def wait_idle(page): page.wait_for_function("window.F4MLab&&!F4MLab.status().loading&&!F4MLab.status().thinking&&!F4MLab.status().animating",timeout=25000)
def snap(page): return page.evaluate("() => {const s=F4MLab.snapshot();return {cursor:s.cursor,states:s.states,moves:s.moves,records:s.records,game:s.game};}")
def drop(page,col): page.locator(f'#matrix .cell[data-c="{col}"]').last.click();wait_idle(page)
def seed_db(page,name,checkpoint,probe=None):
 page.evaluate("""async ([name,data,probe])=>{await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>{const db=r.result,tx=db.transaction('state','readwrite'),s=tx.objectStore('state');s.put(data,'checkpoint');if(probe)s.put(probe,'run:migration-probe');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};r.onerror=()=>reject(r.error);});}""",[name,checkpoint,probe])
def read_key(page,name,key):
 return page.evaluate("""async ([name,key])=>await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('state')){db.close();resolve(null);return;}const q=db.transaction('state').objectStore('state').get(key);q.onsuccess=()=>{db.close();resolve(q.result||null);};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);})""",[name,key])
def verify(public:Path,out:Path,executable=None):
 root=public/"F4M";shared=root/"_shared/petrol-2.6.2";lab=root/"new";app=root/"app"
 drive_archive="https://drive.google.com/drive/folders/1yWJtX-9Lra6rUpWP5nmaLsCU5I_LkZlL"
 archived_snapshots=[
  ("LAB old/001",lab/"old/001/index.html"),
  ("LAB old/002",lab/"old/002/index.html"),
  ("LAB old/003",lab/"old/003/index.html"),
  ("APP old/003",app/"old/003/index.html"),
  ("Prepromotion CURRENT old/002",root/"old/002/index.html"),
 ]
 for label,path in archived_snapshots:
  notice=path.read_text()
  check(label+" moved to Drive", "Arhiv je preseljen" in notice and drive_archive in notice)
 currentrel=json.loads((root/"release.json").read_text())
 currenthtml=(root/"index.html").read_text()
 check("CURRENT promoted from accepted LAB",currentrel.get("version")=="2.6.2-petrol" and currentrel.get("role")=="CURRENT" and currentrel.get("storage")=="flip4m-current-2.6")
 check("CURRENT hides channel navigation but keeps full game",'data-channel="current"' in currenthtml and '<nav class="version-nav"' not in currenthtml and "f4m-core.js" in currenthtml and "f4m-review.js" in currenthtml)
 check("PREVIOUS index untouched",git_hash((root/"old/index.html").read_bytes())=="2e1d111caf52803eeb95dd2d42fd8e6bcccb36b3")
 check("PREVIOUS release untouched",git_hash((root/"old/release.json").read_bytes())=="8206eb1f2d5587d886c84c05215fd28825a407d9")
 rel=json.loads((lab/"release.json").read_text());check("Unified release metadata",rel["version"]=="2.6.2-petrol" and rel["role"]=="UNIFIED_LAB" and rel["storage"]=="flip4m-unified-2.6" and rel["review"]["mode"]=="read-only")
 v=json.loads((root/"versioning.json").read_text());check("One-source topology metadata",v["topology"]=="ONE_ACTIVE_LAB_SOURCE_THREE_PRESENTATIONS" and v["app_presentation"]=="/f4m/new/?view=app" and v["legacy_app"]=="/f4m/app/")
 apprel=json.loads((app/"release.json").read_text());check("APP root retired",apprel["role"]=="APP_MIGRATION_RECOVERY" and apprel["gameplay_runtime"] is False)
 apphtml=(app/"index.html").read_text();check("Retired APP has no game engine", "f4m-core.js" not in apphtml and 'id="arena"' not in apphtml and "retirement.js" in apphtml)
 labhtml=(lab/"index.html").read_text();check("Single LAB document exposes APP presentation",'data-presentation-link="app"' in labhtml and "?view=app" in labhtml and "presentation.js" in labhtml)
 check("Review present in unified source","f4m-review.js" in labhtml and (shared/"f4m-review.js").exists())
 router=(shared/"presentation.js").read_text();check("LAB/APP links use native navigation","preventDefault" not in router);check("Standalone does not force APP","const app=forced||phone||native" in router)
 check("Routing metadata documents desktop default",rel.get("presentation_routing",{}).get("desktop_default")=="LAB")
 manifest=json.loads((lab/"manifest.webmanifest").read_text());check("LAB is installable standalone PWA",manifest.get("name")=="Flip4M LAB" and manifest.get("start_url")=="./" and manifest.get("scope")=="./" and manifest.get("display")=="standalone")
 swtext=(lab/"sw.js").read_text();pwajs=(shared/"pwa.js").read_text();check("PWA update auto-activates complete package","self.skipWaiting()" in swtext and "self.clients.claim()" in swtext);check("PWA page reports current build","build:'2.6.2-petrol'" in pwajs);check("PWA requests explicit update check","await reg.update()" in pwajs)
 check("Release documents PWA semantics",rel.get("pwa",{}).get("installable") is True and rel.get("pwa",{}).get("desktop_start")=="LAB" and rel.get("pwa",{}).get("phone_start")=="APP")
 active=(labhtml+(shared/"f4m-ui.js").read_text()+(shared/"f4m-core.js").read_text()).lower()
 check("Water/Laser not implemented",all(x not in active for x in ("water","laser","flood","beam")))
 for f in ["presentation.js","f4m-store.js","f4m-ui.js","shell.js","pwa.js","f4m-review.js"]:
  p=shared/f;r=subprocess.run(["node","--check",str(p)],capture_output=True,text=True,timeout=8);check("Syntax "+f,r.returncode==0,r.stderr or None)
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args): pass
 server=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(public.resolve())));threading.Thread(target=server.serve_forever,daemon=True).start();base=f"http://127.0.0.1:{server.server_port}/F4M/"
 try:
  with sync_playwright() as p:
   launch={"headless":True}
   if executable: launch["executable_path"]=executable
   browser=p.chromium.launch(**launch)
   ctx=browser.new_context(viewport={"width":1280,"height":1000},accept_downloads=True);page=ctx.new_page();errors=[];page.on("pageerror",lambda e:errors.append(str(e)));page.on("dialog",lambda d:d.accept())
   page.goto(base+"new/");wait_idle(page);page.wait_for_function("window.F4MReview&&window.F4MPresentation");check("Fresh PWA install has no false update toast",page.locator("#pwaToast").is_hidden())
   check("Desktop default is LAB",page.evaluate("document.body.dataset.presentation==='lab'&&!document.body.classList.contains('is-app')"))
   check("LAB wrapper flattened",page.evaluate("getComputedStyle(document.querySelector('.device')).borderTopWidth==='0px'"))
   check("LAB has Game Review",page.locator("#tab-review").count()==1 and page.locator("#workspaceTabs button").count()==5)
   check("AI-vs-AI controls preserved",page.locator('#mode option[value="demo"]').count()==1 and page.locator("#demoRed").count()==1 and page.locator("#demoYellow").count()==1)
   check("Board size choices preserved",page.locator("#boardSize option").count()==3)
   page.locator("#newGame").click();page.locator("#setupPanel").wait_for(state="visible");page.locator("#mode").select_option("pvp");page.locator("#tools").select_option("2");page.locator("#start").click();wait_idle(page)
   drop(page,3);drop(page,4);page.locator("#flipLeft").click();wait_idle(page);drop(page,2);page.locator("#magnet").click();slot=page.locator(".mag-slot:not(:disabled)").first;check("Magnet action available",slot.count()==1);slot.click();wait_idle(page)
   before=snap(page);check("Playable fixture built",before["cursor"]>=5,before["cursor"]);page.evaluate("F4MLab.flush()")
   page.locator('[data-presentation-link="app"]:visible').first.click();page.wait_for_url("**/F4M/new/?view=app");wait_idle(page);page.wait_for_function("window.F4MReview&&window.F4MPresentation")
   check("Desktop APP is same /new document",page.evaluate("location.pathname.endsWith('/F4M/new/')&&document.body.dataset.presentation==='app'"))
   check("LAB to APP preserves exact session",snap(page)==before)
   check("Desktop APP uses device frame",page.evaluate("getComputedStyle(document.querySelector('.device')).borderTopWidth!=='0px'&&!document.documentElement.classList.contains('app-phone')"))
   page.set_viewport_size({"width":3840,"height":2160});page.wait_for_timeout(150);check("Forced APP survives 4K resize",page.evaluate("document.body.dataset.presentation==='app'&&new URLSearchParams(location.search).get('view')==='app'"))
   page.reload();wait_idle(page);check("Forced APP survives refresh",page.evaluate("document.body.dataset.presentation==='app'"))
   page.locator("#tab-review").click();page.wait_for_function("F4MReview.active()");review_before=snap(page);page.locator("#f4mReviewFirst").click();page.locator("#f4mReviewLast").click();check("Review navigation read-only",snap(page)==review_before);page.locator("#f4mReviewClose").click();check("Review returns paused",page.evaluate("F4MLab.status().paused===true"))
   page.locator('[data-presentation-link="lab"]:visible').first.click();page.wait_for_url("**/F4M/new/");wait_idle(page);check("APP to LAB preserves exact session",snap(page)==review_before)
   standalone_ctx=browser.new_context(viewport={"width":1280,"height":900});standalone_page=standalone_ctx.new_page();standalone_page.add_init_script("Object.defineProperty(navigator,'standalone',{value:true,configurable:true});");standalone_page.goto(base+"new/");wait_idle(standalone_page);check("Desktop standalone PWA remains LAB",standalone_page.evaluate("document.body.dataset.presentation==='lab'&&!document.body.classList.contains('is-app')"));standalone_ctx.close()
   page.wait_for_function("window.F4MPWA&&F4MPWA.state==='ready'",timeout=30000);page.reload();wait_idle(page);page.wait_for_function("!!navigator.serviceWorker.controller",timeout=15000);check("Unified PWA controls LAB",page.evaluate("!!navigator.serviceWorker.controller"))
   ctx.set_offline(True);page.reload();wait_idle(page);page.wait_for_function("window.F4MReview",timeout=15000);check("Offline cold unified load",page.locator("#tab-review").count()==1);ctx.set_offline(False)
   saved=page.evaluate("F4MLab.snapshot()");check("Desktop JS clean",not errors,errors);out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/"desktop-lab.png"),full_page=True);ctx.close()

   mig=browser.new_context(viewport={"width":1280,"height":900});mp=mig.new_page();mp.goto(base+"new/release.json");legacy=cl=None
   legacy=dict(saved);legacy["savedAt"]="2026-10-02T08:00:00Z";legacy["migrationProbe"]="legacy-app"
   seed_db(mp,"flip4m-app-2.2",legacy,{"sentinel":"batch-preserved"});mp.goto(base+"new/?view=app");wait_idle(mp)
   check("Legacy APP auto-copies into empty unified store",mp.evaluate("JSON.parse(localStorage.getItem('flip4m.unified.2.6.migration')).source==='flip4m-app-2.2'"))
   check("Legacy APP game restored",mp.evaluate("F4MLab.snapshot().cursor")==saved["cursor"] and mp.evaluate("F4MLab.snapshot().moves")==saved["moves"])
   check("Legacy experiment entry copied",(read_key(mp,"flip4m-unified-2.6","run:migration-probe") or {}).get("sentinel")=="batch-preserved")
   check("Legacy APP database preserved",(read_key(mp,"flip4m-app-2.2","checkpoint") or {}).get("migrationProbe")=="legacy-app");mig.close()

   priority=browser.new_context(viewport={"width":1000,"height":800});pp=priority.new_page();pp.goto(base+"new/release.json");labdata=dict(saved);labdata["savedAt"]="2026-10-02T07:00:00Z";labdata["migrationProbe"]="legacy-lab";appdata=dict(saved);appdata["savedAt"]="2026-10-02T09:00:00Z";appdata["migrationProbe"]="legacy-app-newer";seed_db(pp,"flip4m-lab-2.1",labdata);seed_db(pp,"flip4m-app-2.2",appdata);pp.goto(base+"new/");wait_idle(pp)
   check("Both legacy stores use deterministic LAB continuity",pp.evaluate("JSON.parse(localStorage.getItem('flip4m.unified.2.6.migration')).source==='flip4m-lab-2.1'"))
   check("APP remains recovery source",(read_key(pp,"flip4m-app-2.2","checkpoint") or {}).get("migrationProbe")=="legacy-app-newer");priority.close()

   retire=browser.new_context(viewport={"width":1000,"height":800});rp=retire.new_page();rp.goto(base+"new/release.json");canonical=dict(saved);canonical["migrationProbe"]="canonical";old=dict(saved);old["migrationProbe"]="retired-app";seed_db(rp,"flip4m-unified-2.6",canonical);seed_db(rp,"flip4m-app-2.2",old);rp.goto(base+"app/?recovery=1");rp.wait_for_function("document.getElementById('status').textContent.includes('NOT overwritten')",timeout=12000)
   check("Retired APP refuses overwrite",(read_key(rp,"flip4m-unified-2.6","checkpoint") or {}).get("migrationProbe")=="canonical")
   check("Retired APP keeps recovery UI",rp.locator("#exportLegacy").count()==1 and rp.locator("#openUnified").count()==1 and rp.locator("#arena").count()==0);retire.close()

   phone_ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1");phone=phone_ctx.new_page();perrors=[];phone.on("pageerror",lambda e:perrors.append(str(e)));phone.goto(base+"new/");wait_idle(phone);phone.wait_for_function("window.F4MReview")
   check("Phone auto-selects APP presentation",phone.evaluate("document.body.dataset.presentation==='app'&&document.documentElement.classList.contains('app-phone')"))
   check("Phone is frameless",phone.evaluate("getComputedStyle(document.querySelector('.device')).borderTopWidth==='0px'"))
   check("Phone Review present",phone.locator("#tab-review").count()==1);check("Phone no horizontal overflow",phone.evaluate("document.documentElement.scrollWidth<=innerWidth"));check("Phone JS clean",not perrors,perrors);phone.screenshot(path=str(out/"phone-app.png"),full_page=True);phone_ctx.close();browser.close()
 finally: server.shutdown()
if __name__=="__main__":
 ap=argparse.ArgumentParser();ap.add_argument("--public",type=Path,default=Path("public"));ap.add_argument("--out",type=Path,default=Path("flip4m-unified-evidence"));ap.add_argument("--executable");a=ap.parse_args();err=None
 try: verify(a.public,a.out,a.executable)
 except Exception as exc: err=repr(exc);print(err)
 a.out.mkdir(parents=True,exist_ok=True);report={"scope":"Flip4M unified LAB/APP 2.6.2 bounded acceptance","passed":sum(x["pass"] for x in R),"checks":len(R),"error":err,"physical_iPhone":"NOT_RUN","results":R};(a.out/"verification.json").write_text(json.dumps(report,indent=2)+"\n");print(json.dumps({k:v for k,v in report.items() if k!="results"}))
 if err: raise SystemExit(1)
