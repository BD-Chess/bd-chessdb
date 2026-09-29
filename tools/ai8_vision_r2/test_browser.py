#!/usr/bin/env python3
"""Bounded visual-family browser acceptance, local or live; no production writes."""
import argparse, hashlib, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

def run(url,manifest,out,browser_kind='chromium',executable=None):
 out=Path(out);out.mkdir(parents=True,exist_ok=True); assets=json.loads(Path(manifest).read_text())['assets'];checks=[]
 with sync_playwright() as p:
  browser=getattr(p,browser_kind).launch(headless=True,**({'executable_path':executable,'args':['--no-sandbox']} if executable else {}))
  for layout,viewport in [('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]:
   for lang in ['sl','en']:
    for theme in ['light','dark']:
     key=f'{lang}-{layout}-{theme}';context=browser.new_context(viewport=viewport,device_scale_factor=1)
     context.add_init_script(f"localStorage.setItem('mdlxdcc-theme','{theme}');")
     page=context.new_page();errors=[];requested=[]
     page.on('pageerror',lambda e:errors.append(str(e)))
     page.on('request',lambda r:requested.append(r.url) if '/ai8-vision/r2/' in r.url and '.webp' in r.url else None)
     page.goto(url+('?lang='+lang if '?' not in url else '&lang='+lang),wait_until='domcontentloaded',timeout=45000)
     page.wait_for_function("typeof window.MDLxDCCLocale==='object'")
     assert page.locator('html').get_attribute('data-theme')==theme
     assert not requested,('not lazy',requested)
     page.locator('#ai8-vision-open').click()
     page.wait_for_selector('#ai8-vision-dialog[data-state="ready"]',timeout=20000)
     assert page.locator('#ai8-vision-dialog').get_attribute('data-variant')==key
     image=page.locator('#ai8-vision-image');src=image.get_attribute('src');assert assets[key]['file'] in src
     page.evaluate("async()=>{await document.querySelector('#ai8-vision-image').decode();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);}")
     state=page.evaluate("""()=>{const d=document.querySelector('#ai8-vision-dialog'),s=document.querySelector('#ai8-vision-scroll'),i=document.querySelector('#ai8-vision-image');return {naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,displayWidth:i.getBoundingClientRect().width,displayHeight:i.getBoundingClientRect().height,scrollHeight:s.scrollHeight,clientHeight:s.clientHeight,horizontalOverflow:d.scrollWidth>d.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,src:i.src,alt:i.alt};}""")
     assert state['naturalWidth']==assets[key]['width'] and state['naturalHeight']==assets[key]['height']
     assert not state['horizontalOverflow'] and not state['pageOverflow'],state
     assert state['displayWidth']>viewport['width']*.85,state
     if layout=='mobile':assert state['displayHeight']>state['clientHeight']*1.5,state
     assert page.locator('#ai8-vision-full-link').get_attribute('href')==src
     response=page.request.get(src);assert response.status==200
     assert hashlib.sha256(response.body()).hexdigest()==assets[key]['sha256']
     assert all(assets[key]['file'] in r for r in requested),requested
     page.screenshot(path=str(out/(browser_kind+'-'+key+'.png')))
     page.locator('#ai8-vision-scroll').evaluate('(e)=>e.scrollTop=e.scrollHeight')
     page.locator('#ai8-vision-transcript summary').click()
     assert page.locator(f'#ai8-vision-transcript .{lang} li').count()==5
     page.keyboard.press('Escape');assert not page.locator('#ai8-vision-dialog').evaluate('(d)=>d.open')
     assert page.locator('#ai8-vision-open').evaluate('(e)=>document.activeElement===e')
     assert not errors,errors
     checks.append({'key':key,'result':'PASS','browser':browser_kind,'image_sha256':assets[key]['sha256'],'state':state})
     context.close()
  # Existing site controls must drive an open dialog too. No independent locale store.
  context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page()
  context.add_init_script("localStorage.setItem('mdlxdcc-theme','dark');")
  page.goto(url+'?lang=sl',wait_until='domcontentloaded');page.locator('#ai8-vision-open').click();page.wait_for_selector('#ai8-vision-dialog[data-variant="sl-mobile-dark"][data-state="ready"]')
  page.locator('[data-vision-lang="en"]').click();page.wait_for_selector('#ai8-vision-dialog[data-variant="en-mobile-dark"][data-state="ready"]')
  page.locator('#ai8-vision-theme-toggle').click();page.wait_for_selector('#ai8-vision-dialog[data-variant="en-mobile-light"][data-state="ready"]')
  page.set_viewport_size({'width':1280,'height':900});page.wait_for_selector('#ai8-vision-dialog[data-variant="en-desktop-light"][data-state="ready"]')
  page.set_viewport_size({'width':320,'height':640});page.wait_for_selector('#ai8-vision-dialog[data-variant="en-mobile-light"][data-state="ready"]')
  assert page.locator('#ai8-vision-dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
  page.locator('#ai8-vision-close').click();page.locator('#ai8-vision-open').click();page.wait_for_selector('#ai8-vision-dialog[data-variant="en-mobile-light"][data-state="ready"]')
  page.keyboard.press('Escape');context.close();checks.append({'key':'live-switch-resize-320-reopen','browser':browser_kind,'result':'PASS'})
  browser.close()
 result={'url':url,'browser':browser_kind,'checks':checks,'result':'PASS','scope':'Eight language/theme/layout variants, lazy loading, bytes, image decode, no overflow, mobile scroll, full-image link, native close/focus, language/theme hot-switch and responsive resize. Not a physical-device test.'}
 (out/(browser_kind+'-results.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'result':'PASS','checks':len(checks),'browser':browser_kind,'url':url}))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('url');a.add_argument('manifest');a.add_argument('output');a.add_argument('--browser',default='chromium');a.add_argument('--executable');x=a.parse_args();run(x.url,x.manifest,x.output,x.browser,x.executable)
