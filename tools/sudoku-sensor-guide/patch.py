import pathlib, hashlib, subprocess
p=pathlib.Path('public/S/app/app-solve-playback.js')
b=p.read_bytes()
assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()=='b8edb803f72484f8bcd56c1b4a80055cedaab882', 'APP changed since review; stop rather than overwrite'
s=b.decode()
a=' const externalRenderObserver=new MutationObserver('
assert s.count(a)==1
fragment=pathlib.Path('tools/sudoku-sensor-guide/guide.inc.js').read_text()
# Safari touch does not always focus the tapped button. Restore the guide trigger.
assert fragment.count('guidePreviousFocus=document.activeElement;')==1
fragment=fragment.replace('guidePreviousFocus=document.activeElement;',"guidePreviousFocus=$('appSensorGuideOpen');")
# Modal keyboard events must not reach the donor's document-level game handler.
keyguard="  if(sensorModal.dataset.guide!=='true')return;\n  if(event.key==='Escape')"
assert fragment.count(keyguard)==1
fragment=fragment.replace(keyguard,"  if(sensorModal.dataset.guide!=='true')return;\n  event.stopImmediatePropagation(); // Keep native scrolling, stop background game shortcuts.\n  if(event.key==='Escape')")
# Fullscreen means above the persistent APP dock (z-index 3003), too.
layer='#appSolveSensorModal[data-guide=true]{padding:16px;'
assert fragment.count(layer)==1
fragment=fragment.replace(layer,'#appSolveSensorModal[data-guide=true]{z-index:10000;padding:16px;')
s=s.replace(a,fragment+'\n'+a)
assert s.count('.app-pos-sensor:nth-child(')==4
s=s.replace('.app-pos-sensor:nth-child(','.app-pos-sensor:nth-of-type(')
p.write_text(s)
# Check actual hit-testing, not just the fullscreen rectangle.
t=pathlib.Path('tests/sudoku-app-sensor-guide-browser.cjs')
test=t.read_text()
needle="    assert.ok(geometry.scroll>geometry.client,'long guide can scroll');"
assert test.count(needle)==1
test=test.replace(needle,needle+"\n    assert.equal(await frame.evaluate(()=>document.querySelector('#appSensorGuide').contains(document.elementFromPoint(innerWidth/2,innerHeight-12))),true,'guide covers the bottom dock');")
t.write_text(test)
subprocess.run(['node','--check',str(p)],check=True)
subprocess.run(['node','scripts/build-sudoku-app-preview.cjs'],check=True)
subprocess.run(['node','scripts/build-sudoku-app-preview.cjs','--check'],check=True)
