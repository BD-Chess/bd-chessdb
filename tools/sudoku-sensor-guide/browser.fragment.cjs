
    // Full-screen guide: actual touch/mouse activation, modal keyboard safety,
    // scrolling, viewport sizes, all sensors, and unchanged atomic game state.
    const gameBeforeGuide=await capture();
    const overflowBefore=await frame.evaluate(()=>[document.documentElement.style.overflow,document.body.style.overflow]);
    await frame.locator('#appSolveFirst').click();await frame.locator('#appSolvePlay').click();
    await page.waitForTimeout(180);
    const guideTrigger=frame.locator('#appSensorGuideOpen');
    if(phone)await guideTrigger.tap();else await guideTrigger.click();
    await frame.waitForFunction(()=>document.querySelector('#appSolveSensorGuide').open);
    const guideIndex=Number(await frame.locator('#appSolveScrub').inputValue());
    await page.waitForTimeout(400);
    assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),guideIndex,'guide pauses replay at its displayed step');
    assert.equal(await frame.locator('#appSolvePlay').innerText(),'▶');
    assert.match(await frame.locator('#appSensorGuideTitle').innerText(),phone?/Kaj pomenijo/:/What do/);
    assert.match(await frame.locator('#appSensorGuideIntro').innerText(),phone?/niso ocena inteligence/:/not an intelligence score/);
    assert.equal(await frame.locator('[data-guide-sensor]').count(),5);
    for(const key of ['cplx','gini','powr','dens','adsr']){
     assert.equal(await frame.locator('[data-guide-sensor="'+key+'"] dt').count(),2,'lower and higher explained: '+key);
     const actual=await frame.locator('[data-sensor="'+key+'"] .app-pos-value').innerText();
     assert.ok((await frame.locator('[data-guide-sensor="'+key+'"] .app-sensor-guide-value').innerText()).includes(actual),'snapshot agrees with sensor bar: '+key);
    }
    const geometry=async()=>frame.evaluate(()=>{const d=document.querySelector('#appSolveSensorGuide'),r=d.getBoundingClientRect(),body=d.querySelector('.app-sensor-guide-body'),close=document.querySelector('#appSensorGuideClose').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight,scroll:body.scrollHeight,client:body.clientHeight,closeX:close.x,closeY:close.y,closeW:close.width,closeH:close.height};});
    const checkGeometry=async()=>{const g=await geometry();assert.ok(Math.abs(g.x)<2&&Math.abs(g.y)<2,'starts at viewport origin');assert.ok(Math.abs(g.w-g.vw)<2&&Math.abs(g.h-g.vh)<2,'fills real APP viewport');assert.ok(g.closeW>=44&&g.closeH>=44,'44px close target');assert.ok(g.closeX>=0&&g.closeY>=0&&g.closeX+g.closeW<=g.vw+1&&g.closeY+g.closeH<=g.vh,'close remains visible');assert.ok(g.scroll>g.client,'long guide scrolls within modal');return g;};
    await checkGeometry();
    for(const key of ['1','Backspace','ArrowRight','Space'])await page.keyboard.press(key);
    assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),guideIndex,'modal keys do not navigate review');
    assert.deepEqual(await capture(),gameBeforeGuide,'modal keys do not edit board, notes or history');
    await page.keyboard.press('Tab');
    assert.equal(await frame.evaluate(()=>document.querySelector('#appSolveSensorGuide').contains(document.activeElement)),true,'Tab remains in native modal');
    await page.screenshot({path:path.join(out,name+'-'+mode+'-sensor-guide-top.png'),fullPage:true});
    await frame.locator('.app-sensor-guide-body').evaluate(n=>n.scrollTop=n.scrollHeight);
    await checkGeometry();
    await page.screenshot({path:path.join(out,name+'-'+mode+'-sensor-guide-bottom.png'),fullPage:true});
    if(phone){for(const width of [375,390,402,430]){await page.setViewportSize({width,height:734});await page.waitForTimeout(50);await checkGeometry();}await page.setViewportSize({width:402,height:734});}
    await page.keyboard.press('Escape');
    assert.equal(await frame.locator('#appSolveSensorGuide').evaluate(n=>n.open),false,'Escape closes only guide');
    assert.equal(await frame.evaluate(()=>window.SudokuSolveReview.active()),true);
    assert.equal(await frame.evaluate(()=>document.activeElement.id),'appSensorGuideOpen','focus returns to trigger');
    assert.deepEqual(await frame.evaluate(()=>[document.documentElement.style.overflow,document.body.style.overflow]),overflowBefore,'scroll state restored');
    await frame.locator('#appSolveFirst').click();await guideTrigger.click();
    assert.match(await frame.locator('[data-guide-sensor="cplx"] .app-sensor-guide-value').innerText(),/—/,'no fabricated zero before two samples');
    await frame.locator('#appSensorGuideClose').click();
    await frame.locator('#appSolveNext').click();await guideTrigger.click();
    assert.match(await frame.locator('[data-guide-sensor="cplx"] .app-sensor-guide-value').innerText(),/—/,'one sample is still insufficient');
    await frame.locator('#appSensorGuideClose').click();
    // Clicking unused space in the instrument block opens the overview too.
    const block=await frame.locator('#appSolveInstruments').boundingBox();
    if(phone)await page.touchscreen.tap(block.x+block.width-3,block.y+block.height-3);else await page.mouse.click(block.x+block.width-3,block.y+block.height-3);
    assert.equal(await frame.locator('#appSolveSensorGuide').evaluate(n=>n.open),true,'block padding opens guide');
    await frame.locator('#appSensorGuideClose').click();
    for(const key of ['cplx','gini','powr','dens','adsr']){
     const row=frame.locator('[data-sensor="'+key+'"]');if(phone)await row.tap();else await row.click();
     assert.equal(await frame.locator('#appSolveSensorModal').evaluate(n=>n.hidden),false,'individual sensor detail preserved: '+key);
     assert.equal(await frame.locator('#appSolveSensorGuide').evaluate(n=>n.open),false);
     await frame.locator('#appSensorClose').click();
    }
    assert.deepEqual(await capture(),gameBeforeGuide);
    report.sensorGuideContexts=(report.sensorGuideContexts||0)+1;
