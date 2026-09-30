'use strict';
// Extend the existing delivered-APP regression without editing its fixture.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tests/sudoku-app-solve-playback-r5-browser.cjs');
let source=fs.readFileSync(file,'utf8');
const anchor="    await page.keyboard.press('ArrowUp');assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),0,'ArrowUp -> first');";
const extra=String.raw`
    // The top instrument header opens the shared guide, while individual rows
    // retain their original detail sheets. Use real taps on touch viewports.
    const tapGuide=async()=>{const x=frame.locator('#appSensorGuideOpen');if(phone)await x.tap();else await x.click();};
    const closeGuide=async()=>{const x=frame.locator('#appSensorGuideClose');if(phone)await x.tap();else await x.click();};
    const guideState=await capture(),guideIndex=Number(await frame.locator('#appSolveScrub').inputValue());
    const inertBefore=await frame.evaluate(()=>[...document.body.children].filter(n=>!['SCRIPT','STYLE','LINK'].includes(n.tagName)).map(n=>[n.id,n.inert]));
    await tapGuide();
    assert.equal(await frame.locator('#appSolveSensorModal').getAttribute('data-guide'),'true');
    assert.equal(await frame.locator('#appSensorGuide .app-guide-card').count(),5);
    assert.match(await frame.locator('#appSensorGuideTitle').innerText(),phone?/Kaj pomenijo senzorji/:/Understanding the sensors/);
    assert.match(await frame.locator('#appSensorGuideCaution').innerText(),phone?/ne ocena inteligence/:/not an intelligence score/);
    for(const abbr of ['Cplx','Gini','Powr','Dens','ADSR'])assert.ok((await frame.locator('#appSensorGuideCards').innerText()).includes(abbr));
    const geometry=await frame.evaluate(()=>{const r=document.querySelector('#appSensorGuide').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,iw:innerWidth,ih:innerHeight,scroll:document.querySelector('.app-guide-body').scrollHeight,client:document.querySelector('.app-guide-body').clientHeight};});
    assert.ok(Math.abs(geometry.x)<1&&Math.abs(geometry.y)<1&&Math.abs(geometry.w-geometry.iw)<1&&Math.abs(geometry.h-geometry.ih)<1,'guide covers full phone/preview viewport '+JSON.stringify(geometry));
    assert.ok(geometry.scroll>geometry.client,'long guide can scroll');
    await page.keyboard.press('ArrowRight');assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),guideIndex,'guide keys do not move review');
    await page.keyboard.press('Shift+Tab');assert.equal(await frame.locator('#appSensorGuide').evaluate(n=>n.contains(document.activeElement)),true,'focus stays in guide');
    await page.keyboard.press('Tab');assert.equal(await frame.locator('#appSensorGuideClose').evaluate(n=>n===document.activeElement),true,'focus wraps to close');
    await frame.locator('.app-guide-body').evaluate(n=>n.scrollTop=n.scrollHeight);await page.waitForTimeout(30);
    assert.equal(await frame.locator('#appSensorGuideClose').isVisible(),true,'close remains visible after scrolling');
    await page.screenshot({path:path.join(out,name+'-'+mode+'-sensor-guide-end.png'),fullPage:true});
    await frame.locator('.app-guide-body').evaluate(n=>n.scrollTop=0);
    await page.screenshot({path:path.join(out,name+'-'+mode+'-sensor-guide.png'),fullPage:true});
    await closeGuide();assert.equal(await frame.locator('#appSolveSensorModal').evaluate(n=>n.hidden),true);
    assert.equal(await frame.locator('#appSensorGuideOpen').evaluate(n=>n===document.activeElement),true,'focus restored');
    assert.deepEqual(await capture(),guideState,'guide does not modify the game');
    assert.deepEqual(await frame.evaluate(()=>[...document.body.children].filter(n=>!['SCRIPT','STYLE','LINK'].includes(n.tagName)).map(n=>[n.id,n.inert])),inertBefore,'inert states restored');
    await tapGuide();await page.keyboard.press('Escape');assert.equal(await frame.locator('#appSolveSensorModal').evaluate(n=>n.hidden),true);
    // At the start, missing data must not be presented as measured zero.
    await frame.locator('#appSolveFirst').click();await tapGuide();
    assert.match(await frame.locator('[data-guide-sensor="cplx"] .app-guide-value').innerText(),/—/);
    await frame.locator('[data-guide-sensor="cplx"] button').click();
    assert.equal(await frame.locator('#appSolveSensorModal').getAttribute('data-guide'),null);assert.equal(await frame.locator('#appSolveSensorModal').evaluate(n=>n.hidden),false);assert.match(await frame.locator('#appSensorTitle').innerText(),/LZ/);
    await frame.locator('#appSensorClose').click();
    // Opening during animation pauses it, and close does not silently resume.
    await frame.locator('#appSolvePlay').click();await page.waitForTimeout(100);await tapGuide();
    const paused=Number(await frame.locator('#appSolveScrub').inputValue());assert.equal(await frame.locator('#appSolvePlay').innerText(),'▶');
    await page.waitForTimeout(300);assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),paused);
    await closeGuide();await page.waitForTimeout(180);assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),paused);
    // The same guide works for Human review and preserves its selected step.
    await frame.locator('#appSolveTabHuman').click();const hi=Number(await frame.locator('#appSolveScrub').inputValue());await tapGuide();
    assert.match(await frame.locator('#appSensorGuideContext').innerText(),phone?/Človek/:/Human/);await closeGuide();assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),hi);await frame.locator('#appSolveTabAI').click();
    report.sensorGuideCases=(report.sensorGuideCases||0)+1;
`;
if(source.split(anchor).length!==2)throw Error('Expected one R5 navigation anchor');
source=source.replace(anchor,extra+'\n'+anchor);
const run=new Module(file,module);run.filename=file;run.paths=Module._nodeModulePaths(path.dirname(file));run._compile(source,file);
