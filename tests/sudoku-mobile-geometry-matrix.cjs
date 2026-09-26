'use strict';
// Phase B only, after the handoff's explicit CONTINUE_TESTS gate.
// Synthetic finite rendered rectangles, independent of givens. These numbers
// measure the layout function; they do NOT validate browser/device hit testing.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/S/new/app.html'),'utf8');
const source=html.match(/<script id="mobile-play-geometry">([\s\S]*?)<\/script>/)[1],context={window:{}};vm.runInNewContext(source,context);const G=context.window.SudokuMobileGeometry;
const cases=[];
for(const [width,height]of [[402,874],[390,844],[320,568],[740,402],[760,900],[761,900],[1440,900]]){
 const mobile=width<=760,size=mobile?Math.max(30,Math.floor((Math.min(width-24,height*.57,476)-18)/9.1)):72,board=size*9+8;
 const left=Math.max(5,(width-board)/2),top=116;
 cases.push({name:`${width}x${height}`,width,height,size,left,top});
 if(mobile)cases.push({name:`${width}x${height}-partly-scrolled`,width,height,size,left,top:-size});
}
cases.push({name:'portrait-visible-iframe-clip',width:402,height:720,size:39,left:20,top:116});
cases.push({name:'portrait-safe-area',width:402,height:874,size:39,left:20,top:116,inset:[4,47,4,34]});
cases.push({name:'enlarged-text-offset',width:390,height:844,size:38,left:15,top:200});
const results=[];
for(const spec of cases){const {width,height,size,left,top}=spec,[il,it,ir,ib]=spec.inset||[4,4,4,4],viewport=G.rect(il,it,width-il-ir,height-it-ib),cells=Array.from({length:81},(_,i)=>G.rect(left+i%9*(size+1),top+Math.floor(i/9)*(size+1),size,size));
 const result={...spec,total:81,feasible:0,fallback:0,reasons:{},sizes:{},slideDistances:[],sampleCells:{}};
 for(let i=0;i<81;i++){
  const a=G.place(cells,i,viewport),again=G.place(cells,i,viewport);assert.equal(JSON.stringify(a),JSON.stringify(again),'deterministic tie break');
  if(!a.ok){result.fallback++;result.reasons[a.reason]=(result.reasons[a.reason]||0)+1;continue;}
  result.feasible++;assert.ok(G.inside(a.footprint,viewport));const row=G.union(cells.slice(Math.floor(i/9)*9,Math.floor(i/9)*9+9)),col=G.union(cells.filter((_,j)=>j%9===i%9));
  for(const r of [cells[i],row,col])assert.ok(!G.overlap(a.footprint,r,a.clearance),`${spec.name} cell ${i} cross clearance`);
  assert.equal(a.targets.length,9);assert.ok(a.size>=44);for(let j=0;j<9;j++){const t=a.targets[j];assert.equal(t.digit,j+1);assert.equal(t.width,a.size);assert.equal(t.height,a.size);assert.ok(G.inside(t,a.footprint));if(j%3)assert.ok(t.left>a.targets[j-1].right);if(j>=3)assert.ok(t.top>a.targets[j-3].bottom);}
  result.sizes[a.size]=(result.sizes[a.size]||0)+1;result.slideDistances.push(a.distance);if([0,4,8,36,40,44,72,76,80].includes(i))result.sampleCells[i]={size:a.size,distance:a.distance,footprint:a.footprint};
 }
 result.slideDistances.sort((a,b)=>a-b);result.distanceSummary=result.feasible?{min:result.slideDistances[0],median:result.slideDistances[Math.floor(result.feasible/2)],max:result.slideDistances.at(-1)}:null;delete result.slideDistances;assert.equal(result.feasible+result.fallback,81);results.push(result);
}
console.log(JSON.stringify({status:'PASS',scope:'SYNTHETIC_GEOMETRY_ONLY',cases:results},null,2));
