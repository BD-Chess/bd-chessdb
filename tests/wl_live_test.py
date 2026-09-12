"""Production browser acceptance. No password or private body is logged."""
import os, shutil, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
URL='https://www.mdlxdcc.org/WL/'
secret=os.environ['WL_TEST_PASSWORD']
checks=0
with sync_playwright() as p:
    exe=shutil.which('google-chrome') or shutil.which('chromium')
    opts={'headless':True,'args':['--no-sandbox']}
    if exe: opts['executable_path']=exe
    b=p.chromium.launch(**opts)
    for width in (320,390,1440):
        page=b.new_page(viewport={'width':width,'height':1000})
        page.goto(URL,wait_until='domcontentloaded',timeout=60000)
        assert page.locator('#app').is_hidden();checks+=1
        assert page.locator('#rulesText').inner_text()=='';checks+=1
        page.fill('#pw','incorrect-test-password');page.click('#unlock')
        expect(page.locator('#error')).to_contain_text('Odklep ni uspel',timeout=60000)
        assert page.locator('#app').is_hidden();checks+=1
        page.fill('#pw',secret);page.click('#unlock')
        page.wait_for_selector('#app',state='visible',timeout=60000)
        page.wait_for_function("!!sessionStorage.getItem('wl-v2-session')",timeout=30000)
        assert page.locator('.member').count()==11 and page.locator('.entry').count()>=1;checks+=1
        assert page.locator('#rulesVersion').inner_text()=='v1.0.0';checks+=1
        page.locator('#rulesPanel summary').click()
        expect(page.locator('#rulesText')).to_contain_text('R16',timeout=30000)
        expect(page.locator('#rulesStatus')).to_contain_text('Potrdilo branja ni dokaz');checks+=1
        for i in range(10):page.click('#fontPlus')
        assert page.locator('#fontReset').inner_text()=='200%'
        assert page.evaluate('() => document.documentElement.scrollWidth <= innerWidth+1');checks+=1
        page.click('#fontReset');assert page.locator('#fontReset').inner_text()=='100%';checks+=1
        page.click('#theme');assert page.locator('html').get_attribute('data-theme')=='light';checks+=1
        page.reload(wait_until='domcontentloaded');page.wait_for_selector('#app',state='visible',timeout=60000);checks+=1
        page.click('#lock');assert page.locator('#app').is_hidden() and page.locator('.entry').count()==0;checks+=1
        assert not page.evaluate("() => sessionStorage.getItem('wl-v2-session')");checks+=1
        assert all(page.locator('#'+x).inner_text()=='' for x in ['rulesText','rulesStatus','question','updated','execution','retained']);checks+=1
        page.close()
        print('WL viewport',width,': 13 checks PASS',flush=True)
    # A local intercepted corrupt response must fail closed, not alter real production.
    page=b.new_page(viewport={'width':390,'height':1000})
    page.route('**/rules.manifest.json*',lambda route:route.fulfill(status=200,content_type='application/json',body='{}'))
    page.goto(URL,wait_until='domcontentloaded',timeout=60000)
    page.fill('#pw',secret);page.click('#unlock')
    expect(page.locator('#error')).to_contain_text('Odklep ni uspel',timeout=60000)
    assert page.locator('#app').is_hidden() and page.locator('#rulesText').inner_text()=='';checks+=1
    page.close()
    # Controls are in a closed disclosure. Restore original pause, even on failure.
    page=b.new_page(viewport={'width':390,'height':1000})
    page.goto(URL,wait_until='domcontentloaded',timeout=60000)
    page.fill('#pw',secret);page.click('#unlock')
    page.wait_for_selector('#app',state='visible',timeout=60000)
    page.get_by_text('Izvajanje in nadzor',exact=True).click()
    runtime=page.request.get('https://www.mdlxdcc.org/api/wl/runtime').json()
    assert runtime['ok'] and runtime['protocol']=='WL-RUNTIME-2';checks+=1
    prior=runtime['paused']
    try:
        page.click('#pause');expect(page.locator('#control')).to_have_text('ZAUSTAVLJENO',timeout=30000);checks+=1
        page.click('#resume');expect(page.locator('#control')).to_have_text('DOVOLJENO',timeout=30000);checks+=1
        page.click('#pulse');expect(page.locator('#notice')).to_contain_text('Pulse je zapisan',timeout=30000);checks+=1
    finally:
        page.click('#pause' if prior else '#resume')
        expect(page.locator('#control')).to_have_text('ZAUSTAVLJENO' if prior else 'DOVOLJENO',timeout=30000)
    page.close();b.close()
assert checks==44
Path('/tmp/wl-live-result.json').write_text(json.dumps({'checks':checks,'rules_version':'1.0.0','status':'PASS'}))
print('WL live browser acceptance:',checks,'PASS')
