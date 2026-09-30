import pathlib, hashlib, subprocess, re
BASE='6a54cffc401e4da74c3c04bf9dfb15dd44b165ba'
# Refresh the complete public tree and the concurrently extended regression.
subprocess.run(['git','fetch','--depth=1','origin',BASE],check=True)
subprocess.run(['git','restore','--source='+BASE,'--worktree','--','public','tests/sudoku-app-solve-playback-r5-browser.cjs'],check=True)
p=pathlib.Path('public/S/app/app-solve-playback.js');b=p.read_bytes()
assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()=='58ef0fcd965470a836c8e53fd1af74916ed09104'
s=b.decode()
def replace_once(text,a,b):
 assert text.count(a)==1, ('expected exactly once',a)
 return text.replace(a,b)
# Reconcile the parallel overview, keeping one trigger/dialog and its public IDs.
s,n=re.subn(r"  '<button type=\"button\" class=\"app-sensors-overview-open\"[^\n]+\n",'',s);assert n==1
start=s.index(" const sensorOverview=document.createElement('div');")
end=s.index(' document.body.append(sensorOverview);',start)+len(' document.body.append(sensorOverview);')
s=s[:start]+s[end:]
for prefix in ["  '.app-sensors-overview-open{","  '#appSolveSensorsOverview{"]:
 lines=s.splitlines(True);hits=[line for line in lines if line.startswith(prefix)];assert len(hits)==1
 s=s.replace(hits[0],'')
for prefix in ["  $('appSensorsOverviewKicker').textContent=", "  $('appSensorsOverviewHint').textContent=", "  if(!sensorOverview.hidden){"]:
 lines=s.splitlines(True);hits=[line for line in lines if line.startswith(prefix)];assert len(hits)==1
 s=s.replace(hits[0],'')
s=replace_once(s,';sensorOverview.hidden=true;',';')
start=s.index(' function displaySensorValue(');end=s.index(' function openSensor(',start)
s=s[:start]+s[end:]
s=replace_once(s," $('appSolveSensorsOverviewOpen').onclick=openSensorsOverview;\n",'')
s=replace_once(s," $('appSensorsOverviewClose').onclick=closeSensorsOverview;\n",'')
assert 'sensorOverview' not in s
fragment=pathlib.Path('tools/sudoku-sensor-guide/guide.inc.js').read_text()
fragment=replace_once(fragment,'guidePreviousFocus=document.activeElement;',"guidePreviousFocus=$('appSensorGuideOpen');")
keyguard="  if(sensorModal.dataset.guide!=='true')return;\n  if(event.key==='Escape')"
fragment=replace_once(fragment,keyguard,"  if(sensorModal.dataset.guide!=='true')return;\n  event.stopImmediatePropagation(); // Preserve native scrolling without background game shortcuts.\n  if(event.key==='Escape')")
fragment=replace_once(fragment,'#appSolveSensorModal[data-guide=true]{padding:16px;','#appSolveSensorModal[data-guide=true]{z-index:10000;padding:16px;')
fragment=replace_once(fragment,'To so opisi strukture, ne ocena inteligence, pravilnosti ali dokaz, da je en reševalec boljši.','To ni ocena inteligence ali pravilnosti in ni dokaz, da je en reševalec boljši. Kazalniki opisujejo strukturo.')
fragment=replace_once(fragment,"card.className='app-guide-card';","card.className='app-guide-card app-sensors-overview-item';")
# Both views explain the same actually implemented metrics.
fragment=replace_once(fragment,' let guidePreviousFocus=null,'," Object.keys(sensorDefs).forEach((key,i)=>{sensorDefs[key].enText=guideCopy.en.texts[i];sensorDefs[key].slText=guideCopy.sl.texts[i];sensorDefs[key].dir='context';});\n let guidePreviousFocus=null,")
ids={'appSensorGuideOpen':'appSolveSensorsOverviewOpen','appSensorGuide':'appSolveSensorsOverview','appSensorGuideTitle':'appSensorsOverviewTitle','appSensorGuideClose':'appSensorsOverviewClose','appSensorGuideCaution':'appSensorsOverviewCaveat','appSensorGuideCards':'appSensorsOverviewList'}
def map_ids(text):return re.sub(r'\b('+'|'.join(ids)+r')\b',lambda m:ids[m[0]],text)
fragment=map_ids(fragment)
s=replace_once(s,' const externalRenderObserver=new MutationObserver(',fragment+'\n const externalRenderObserver=new MutationObserver(')
assert s.count('.app-pos-sensor:nth-child(')==4
s=s.replace('.app-pos-sensor:nth-child(','.app-pos-sensor:nth-of-type(')
p.write_text(s)
# Retain the concurrent overview checks, explicitly resume after inspecting it.
r=pathlib.Path('tests/sudoku-app-solve-playback-r5-browser.cjs');test=r.read_text()
needle="await frame.locator('#appSensorsOverviewClose').click();"
test=replace_once(test,needle,needle+"\n    assert.equal(await frame.locator('#appSolvePlay').innerText(),'▶','reading guide pauses playback');await frame.locator('#appSolvePlay').click();")
r.write_text(test)
t=pathlib.Path('tests/sudoku-app-sensor-guide-browser.cjs');test=map_ids(t.read_text())
test=replace_once(test,'phone?/ne ocena inteligence/','phone?/ni ocena inteligence/')
needle="    assert.ok(geometry.scroll>geometry.client,'long guide can scroll');"
test=replace_once(test,needle,needle+"\n    assert.equal(await frame.evaluate(()=>document.querySelector('#appSolveSensorsOverview').contains(document.elementFromPoint(innerWidth/2,innerHeight-12))),true,'guide covers the bottom dock');")
t.write_text(test)
subprocess.run(['node','--check',str(p)],check=True)
subprocess.run(['node','scripts/build-sudoku-app-preview.cjs'],check=True)
subprocess.run(['node','scripts/build-sudoku-app-preview.cjs','--check'],check=True)
