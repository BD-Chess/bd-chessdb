import { chromium } from 'playwright';
const assert=(c,m)=>{if(!c)throw new Error(m)};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
await page.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle'});

const original=page.locator('#original');
assert(await original.evaluate(el=>el.open),'Four ways in must be open by default');
assert((await original.locator('.summary-name .en').textContent()).trim()==='Four ways in.','Four ways in label wrong');
assert(await page.locator('.hero-demo-pi-caption').evaluate(el=>getComputedStyle(el).display)==='none','Pi demo caption leaked onto landing');

async function gotoNormal(idx){
  // reset to first via DOM nav clicks, preserving real UI behavior.
  while(Number(await page.locator('#study').getAttribute('data-slide'))>0)await page.locator('#hero-prev').click();
  for(let i=0;i<idx;i++)await page.locator('#hero-next').click();
  await page.waitForTimeout(80);
}
for(let i=0;i<3;i++){
  await gotoNormal(i);
  const slide=page.locator('[data-hero-slide].is-active');
  await slide.locator('[data-open-current-detail]').click();
  assert(await page.locator('#hero-dialog').evaluate(d=>d.open),'Hero popup did not open for slide '+(i+1));
  assert((await page.locator('#hero-detail-count').textContent()).trim()===`${i+1} / 3`,'Popup counter wrong for slide '+(i+1));
  await page.locator('#hero-dialog-close').click();
  assert(!(await page.locator('#hero-dialog').evaluate(d=>d.open)),'Hero popup did not close for slide '+(i+1));
}
await gotoNormal(2);
const patternSlide=page.locator('[data-hero-slide="pattern"]');
assert(await patternSlide.evaluate(el=>el.classList.contains('pattern-rainbow-run')),'Pattern rainbow run class missing');
const animName=await patternSlide.locator('.petal').first().evaluate(el=>getComputedStyle(el).animationName);
assert(animName.includes('hero-petal-rainbow'),'Pattern petal rainbow animation not active');

async function demoSlideAndClose(idx){
  await page.locator('#slogan').click();
  await page.waitForFunction(()=>document.documentElement.classList.contains('hero-demo-open'));
  for(let i=0;i<idx;i++)await page.keyboard.press('ArrowRight');
  await page.waitForFunction(i=>document.querySelector('#study')?.dataset.slide===String(i),idx);
  await page.mouse.click(720,450);
  const close=page.locator('#hero-demo-close');
  await close.waitFor({state:'visible'});
  assert(await close.evaluate(el=>getComputedStyle(el).pointerEvents!=='none'),'X is not clickable on demo slide '+(idx+1));
  await close.click({force:true});
  await page.waitForFunction(()=>!document.documentElement.classList.contains('hero-demo-open'));
}
for(let i=0;i<3;i++)await demoSlideAndClose(i);

await page.locator('#slogan').click();
await page.waitForFunction(()=>document.documentElement.classList.contains('hero-demo-open'));
await page.keyboard.press('Escape');
await page.waitForFunction(()=>!document.documentElement.classList.contains('hero-demo-open'));

// Mobile photo-style swipe in fullscreen and popup.
const mobile=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
const merr=[];
mobile.on('pageerror',e=>merr.push('pageerror: '+e.message));
await mobile.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle'});
await mobile.locator('#slogan').tap();
await mobile.waitForFunction(()=>document.documentElement.classList.contains('hero-demo-open'));
await mobile.touchscreen.tap(190,420);
await mobile.evaluate(()=>{
 const el=document.querySelector('#study');
 const mk=(type,x,y)=>new TouchEvent(type,{bubbles:true,cancelable:true,changedTouches:[new Touch({identifier:1,target:el,clientX:x,clientY:y,pageX:x,pageY:y,screenX:x,screenY:y,radiusX:2,radiusY:2,rotationAngle:0,force:1})]});
 el.dispatchEvent(mk('touchstart',320,420));el.dispatchEvent(mk('touchend',80,420));
});
await mobile.waitForFunction(()=>document.querySelector('#study')?.dataset.slide==='1');
await mobile.locator('#hero-demo-close').tap({force:true});
await mobile.waitForFunction(()=>!document.documentElement.classList.contains('hero-demo-open'));

if(errors.length||merr.length)throw new Error('Runtime errors:\n'+errors.concat(merr).join('\n'));
console.log(JSON.stringify({ok:true,desktopPopups:3,demoClose:3,escape:true,originalOpen:true,patternRainbow:true,mobileSwipe:true}));
await browser.close();
