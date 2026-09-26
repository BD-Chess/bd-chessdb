
/* 8zSudoku DCC Navigator 0.2.0 — deterministic, answer-blind proof work.
   Known Sudoku rules are shared capabilities, not claims of MDL invention.
   Scores rank checked proposals; only the independent rule checker admits them. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SudokuNavCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const VERSION='0.2.0', CODEC='SUDOKU_LITERAL_PROOF_U8_V1', FULL=511;
const NAMES=['naked_single','hidden_single','pointing','claiming','naked_subset','hidden_subset','x_wing','xy_wing','digit_path'];
const LABELS=['Naked single','Hidden single','Pointing','Claiming','Naked subset','Hidden subset','X-Wing','XY-Wing','Digit-path support'];
const RANK=[0,0,1,1,2,2,3,3,4], FAMILIES=['P0','P1','P2','P3','PATH'];
const U=Array.from({length:27},(_,u)=>Array.from({length:9},(_,k)=>u<9?u*9+k:u<18?k*9+u-9:(Math.floor((u-18)/3)*3+Math.floor(k/3))*9+(u-18)%3*3+k%3));
const box=i=>18+Math.floor(i/27)*3+Math.floor(i%9/3), units=i=>[Math.floor(i/9),9+i%9,box(i)];
const P=Array.from({length:81},(_,i)=>[...new Set(units(i).flatMap(u=>U[u]))].filter(j=>j!==i));
const bit=d=>1<<(d-1), pop=m=>{let n=0;for(;m;m&=m-1)n++;return n;}, digits=m=>[1,2,3,4,5,6,7,8,9].filter(d=>m&bit(d));
const rc=i=>`R${Math.floor(i/9)+1}C${i%9+1}`, unitName=u=>u<9?`row ${u+1}`:u<18?`column ${u-8}`:`box ${u-17}`;
const copy=x=>JSON.parse(JSON.stringify(x)), equal=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
function flat(x){const a=typeof x==='string'?x.replace(/\./g,'0').split('').map(Number):Array.isArray(x)?x.flat():null;if(!a||a.length!==81||a.some(v=>!Number.isInteger(v)||v<0||v>9))throw Error('INVALID_BOARD');return a.slice();}
function basic(b,i){let m=FULL;for(const j of P[i])if(b[j])m&=~bit(b[j]);return m;}
function state(b){b=flat(b);const s={b,m:b.map((v,i)=>v?0:basic(b,i))};validate(s);return s;}
function clone(s){return{b:s.b.slice(),m:s.m.slice()};}
function key(s){return s.b.join('')+':'+s.m.map(x=>x.toString(16)).join(',');}
function validate(s){
 const b=flat(s.b);if(!Array.isArray(s.m)||s.m.length!==81)throw Error('INVALID_DOMAINS');
 for(let i=0;i<81;i++){const m=s.m[i];if(!Number.isInteger(m)||m<0||m>FULL||b[i]&&m||!b[i]&&(!m||(m&~basic(b,i))))throw Error('INVALID_DOMAIN_'+i);}
 for(const u of U){let used=0;for(const i of u)if(b[i]){if(used&bit(b[i]))throw Error('DUPLICATE_DIGIT');used|=bit(b[i]);}let sup=used;for(const i of u)sup|=s.m[i];if(sup!==FULL)throw Error('ZERO_UNIT_SUPPORT');}return true;
}
class Work{constructor(max=180000){this.max=Math.max(0,max);this.n=0;this.counts={};}add(n=1,k='scan'){if(this.n+n>this.max)throw Error('LIMIT');this.n+=n;this.counts[k]=(this.counts[k]||0)+n;}}
const support=(s,u,d)=>U[u].filter(i=>s.m[i]&bit(d));
function proof(t,src=[],es=[],extra={}){return{t,src:src.slice(),es:es.map(e=>e.slice()),u:-1,d:0,c:-1,v:0,o:0,ds:[],...extra};}
function effects(q){return q.c>=0?`P:${q.c}:${q.v}`:'E:'+q.es.map(e=>e.join('.')).sort().join(',');}
function enumerate(s,family,work=new Work(),cap=96){
 const out=[];let complete=true;const add=q=>{if(out.length<cap)out.push(q);else complete=false;};
 try{
 if(family==='P0'){
  for(let i=0;i<81;i++){work.add();if(pop(s.m[i])===1)add(proof(0,[i],[],{c:i,v:digits(s.m[i])[0]}));}
  for(let u=0;u<27;u++)for(let d=1;d<=9;d++){work.add(9);const a=support(s,u,d);if(a.length===1)add(proof(1,a,[],{u,d,c:a[0],v:d}));}
 }else if(family==='P1'){
  for(let u=0;u<27;u++)for(let d=1;d<=9;d++){
   work.add(9);const a=support(s,u,d);if(a.length<2)continue;
   if(u>=18){for(let o=0;o<2;o++){const line=o?9+a[0]%9:Math.floor(a[0]/9);if(a.every(i=>U[line].includes(i))){const es=support(s,line,d).filter(i=>!U[u].includes(i)).map(i=>[i,d]);if(es.length)add(proof(2,a,es,{u,d,o}));}}}
   else{const b=box(a[0]);if(a.every(i=>box(i)===b)){const es=support(s,b,d).filter(i=>!U[u].includes(i)).map(i=>[i,d]);if(es.length)add(proof(3,a,es,{u,d}));}}
  }
 }else if(family==='P2'){
  for(let u=0;u<27;u++)for(let size=2;size<=3;size++){
   const cells=U[u].filter(i=>pop(s.m[i])>=2&&pop(s.m[i])<=size);
   combinations(cells,size,a=>{work.add(size);const m=a.reduce((v,i)=>v|s.m[i],0);if(pop(m)!==size)return;const es=[];for(const i of U[u])if(!a.includes(i))for(const d of digits(s.m[i]&m))es.push([i,d]);if(es.length)add(proof(4,a,es,{u,ds:digits(m)}));});
   const ds=[1,2,3,4,5,6,7,8,9].filter(d=>{const n=support(s,u,d).length;return n>0&&n<=size;});
   combinations(ds,size,dd=>{work.add(9*size);const a=[...new Set(dd.flatMap(d=>support(s,u,d)))];if(a.length!==size)return;const m=dd.reduce((n,d)=>n|bit(d),0),es=[];for(const i of a)for(const d of digits(s.m[i]&~m))es.push([i,d]);if(es.length)add(proof(5,a,es,{u,ds:dd}));});
  }
 }else if(family==='P3'){
  for(let o=0;o<2;o++)for(let d=1;d<=9;d++){
   const rows=[];for(let r=0;r<9;r++){work.add(9);const a=support(s,(o?9:0)+r,d);if(a.length===2)rows.push(a);}
   combinations(rows,2,aa=>{work.add(4);const a=aa.flat(),cross=i=>o?Math.floor(i/9):i%9;if(!equal(aa[0].map(cross),aa[1].map(cross)))return;const covers=[...new Set(a.map(cross))],es=[];for(const c of covers)for(const i of U[(o?0:9)+c])if(!a.includes(i)&&(s.m[i]&bit(d)))es.push([i,d]);if(es.length)add(proof(6,a,es,{d,o}));});
  }
  for(let p=0;p<81;p++)if(pop(s.m[p])===2){const wings=P[p].filter(i=>pop(s.m[i])===2&&pop(s.m[i]&s.m[p])===1);
   combinations(wings,2,aa=>{work.add(25);const[a,b]=aa,common=s.m[a]&s.m[b];if(pop(common)!==1||(common&s.m[p])||pop(s.m[a]|s.m[b]|s.m[p])!==3||((s.m[a]&s.m[p])===(s.m[b]&s.m[p])))return;const d=digits(common)[0],es=P[a].filter(i=>i!==p&&i!==a&&i!==b&&P[b].includes(i)&&(s.m[i]&common)).map(i=>[i,d]);if(es.length)add(proof(7,[p,a,b],es,{d}));});
  }
 }else if(family==='PATH'){
  for(let d=1;d<=9;d++){const query=pathQuery(s,d,work);if(!query.total)throw Error('NO_DIGIT_PATH');const es=[];for(let i=0;i<81;i++)if(s.m[i]&bit(d)){if(!query.support[i])es.push([i,d]);else if(query.support[i]===query.total)for(const v of digits(s.m[i]&~bit(d)))es.push([i,v]);}if(es.length)add(proof(8,[],es,{d}));}
 }else throw Error('UNKNOWN_FAMILY');
 }catch(e){if(e.message!=='LIMIT')throw e;complete=false;}
 return{out,complete,status:out.length?'FIRE':complete?'NO_FIRE':'LIMIT'};
}
function combinations(a,n,visit,start=0,p=[]){if(!n){visit(p);return;}for(let i=start;i<=a.length-n;i++)combinations(a,n-1,visit,i+1,p.concat([a[i]]));}
function pathQuery(s,d,work=new Work(250000)){
 const opts=Array.from({length:9},(_,r)=>{const fixed=U[r].filter(i=>s.b[i]===d);return(fixed.length?fixed:U[r].filter(i=>s.m[i]&bit(d))).map(i=>i%9);}),memo=new Map();
 function count(r,used,stacks){work.add(1,'path');if(r===9)return 1;const k=r+','+used+','+stacks;if(memo.has(k))return memo.get(k);let n=0;for(const c of opts[r]){const bm=1<<Math.floor(c/3);if(!(used&(1<<c))&&!(stacks&bm))n+=count(r+1,used|(1<<c),r%3===2?0:stacks|bm);}memo.set(k,n);return n;}
 const total=count(0,0,0),sup=Array(81).fill(0);let layer=new Map([['0,0',1]]);
 for(let r=0;r<9;r++){const next=new Map();for(const[k,before]of layer){const[used,stacks]=k.split(',').map(Number);for(const c of opts[r]){work.add(1,'path');const bm=1<<Math.floor(c/3);if(used&(1<<c)||stacks&bm)continue;const cm=used|(1<<c),sm=r%3===2?0:stacks|bm,n=count(r+1,cm,sm);if(!n)continue;sup[r*9+c]+=before*n;const nk=cm+','+sm;next.set(nk,(next.get(nk)||0)+before);}}layer=next;}
 return{total,support:sup,nodes:memo.size};
}
// Independent certificate checker: no calls to the proposal enumerator.
function check(s,q,work=new Work(300000)){
 try{
  work.add(81,'check');validate(s);
  if(!q||!Number.isInteger(q.t)||q.t<0||q.t>=NAMES.length||!Array.isArray(q.src)||!Array.isArray(q.es)||!Array.isArray(q.ds)||q.src.length>81||q.es.length>729)return false;
  if(q.src.some(i=>!Number.isInteger(i)||i<0||i>80)||new Set(q.src).size!==q.src.length)return false;
  if(!Number.isInteger(q.u)||q.u< -1||q.u>26||![0,1].includes(q.o)||!Number.isInteger(q.d)||q.d<0||q.d>9)return false;
  if(q.t<2){if(q.es.length||q.c<0||q.c>80||!Number.isInteger(q.v)||q.v<1||q.v>9||s.b[q.c]||!(s.m[q.c]&bit(q.v)))return false;
   if(q.t===0)return s.m[q.c]===bit(q.v)&&equal(q.src,[q.c]);
   return q.u>=0&&q.d===q.v&&equal(q.src,[q.c])&&U[q.u].includes(q.c)&&U[q.u].every(i=>i===q.c||!(s.m[i]&bit(q.v)));
  }
  if(q.c!==-1||q.v!==0||!q.es.length||new Set(q.es.map(e=>e.join(':'))).size!==q.es.length)return false;
  if(q.es.some(e=>!Array.isArray(e)||e.length!==2||!Number.isInteger(e[0])||e[0]<0||e[0]>80||!Number.isInteger(e[1])||e[1]<1||e[1]>9||s.b[e[0]]||!(s.m[e[0]]&bit(e[1]))))return false;
  const a=q.src,allSameDigit=q.es.every(e=>e[1]===q.d);
  if(q.t===2||q.t===3){if(q.u<0||q.d<1||!allSameDigit||a.length<2||!equal(a,support(s,q.u,q.d)))return false;
   if(q.t===2){if(q.u<18)return false;const line=q.o?9+a[0]%9:Math.floor(a[0]/9);if(!a.every(i=>U[line].includes(i))||!q.es.every(([i])=>U[line].includes(i)&&!U[q.u].includes(i)))return false;}
   else{if(q.u>=18)return false;const b=box(a[0]);if(!a.every(i=>box(i)===b)||!q.es.every(([i])=>box(i)===b&&!U[q.u].includes(i)))return false;}
  }else if(q.t===4||q.t===5){if(q.u<0||q.ds.length<2||q.ds.length>3||a.length!==q.ds.length||new Set(q.ds).size!==q.ds.length||q.ds.some(d=>!Number.isInteger(d)||d<1||d>9)||!a.every(i=>U[q.u].includes(i)&&s.m[i]))return false;const m=q.ds.reduce((x,d)=>x|bit(d),0);
   if(q.t===4){if(a.reduce((m,i)=>m|s.m[i],0)!==m||!q.es.every(([i,d])=>U[q.u].includes(i)&&!a.includes(i)&&(m&bit(d))))return false;}
   else{const cells=[...new Set(q.ds.flatMap(d=>support(s,q.u,d)))];if(q.ds.some(d=>!support(s,q.u,d).length)||!equal(a,cells)||!q.es.every(([i,d])=>a.includes(i)&&!(m&bit(d))))return false;}
  }else if(q.t===6){if(!allSameDigit||q.d<1||a.length!==4)return false;const base=i=>q.o?9+i%9:Math.floor(i/9),cross=i=>q.o?Math.floor(i/9):9+i%9;
   const bs=[...new Set(a.map(base))],cs=[...new Set(a.map(cross))];if(bs.length!==2||cs.length!==2||!bs.every(u=>equal(support(s,u,q.d),a.filter(i=>U[u].includes(i))))||!q.es.every(([i])=>cs.includes(cross(i))&&!bs.includes(base(i))))return false;
  }else if(q.t===7){if(!allSameDigit||a.length!==3||q.d<1)return false;const[p,w1,w2]=a,x=s.m[p],y=s.m[w1],z=s.m[w2];if([x,y,z].some(m=>pop(m)!==2)||!P[p].includes(w1)||!P[p].includes(w2)||(y&z)!==bit(q.d)||(x&bit(q.d))||pop(x|y|z)!==3||(x&y)===(x&z)||!q.es.every(([i])=>!a.includes(i)&&P[w1].includes(i)&&P[w2].includes(i)))return false;
  }else if(q.t===8){if(q.d<1||a.length||!pathCheck(s,q,work))return false;}
  const next=clone(s);for(const[i,d]of q.es)next.m[i]&=~bit(d);validate(next);return true;
 }catch(e){if(e.message==='LIMIT')throw e;return false;}
}
// Reference PATH witness validation is exhaustive row/column/box DFS, not the DAG.
function pathCheck(s,q,work){
 const choices=Array.from({length:9},(_,r)=>{const x=U[r].filter(i=>s.b[i]===q.d);return x.length?x:U[r].filter(i=>s.m[i]&bit(q.d));});
 const found=Array(81).fill(0);let count=0;const path=[];
 function dfs(r,cols,boxes){work.add(1,'path_check');if(r===9){count++;for(const i of path)found[i]++;return;}for(const i of choices[r]){const c=1<<(i%9),b=1<<(box(i)-18);if(cols&c||boxes&b)continue;path.push(i);dfs(r+1,cols|c,boxes|b);path.pop();}}
 dfs(0,0,0);return count>0&&q.es.every(([i,d])=>d===q.d?found[i]===0:found[i]===count);
}
function apply(s,q,work=new Work(300000)){if(!check(s,q,work))throw Error('INVALID_PROOF');const n=clone(s);if(q.c>=0){n.b[q.c]=q.v;n.m[q.c]=0;for(const i of P[q.c])n.m[i]&=~bit(q.v);}else for(const[i,d]of q.es)n.m[i]&=~bit(d);validate(n);return n;}
function encode(q){if(q.t<2)return q.t===0?[1,q.t,q.c,q.v]:[1,q.t,q.c,q.v,q.u];const a=[1,q.t,q.u+1,q.o,q.d,q.src.length,...q.src,q.ds.length,...q.ds,q.es.length&255,q.es.length>>8];for(const e of q.es)a.push(...e);return a;}
function decode(a){if(!Array.isArray(a)||a.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('CODEC_BYTES');let n=0;const get=()=>{if(n>=a.length)throw Error('CODEC_SHORT');return a[n++];};if(get()!==1)throw Error('CODEC_VERSION');const t=get();if(t>=NAMES.length)throw Error('CODEC_TECHNIQUE');let q;if(t<2){const c=get(),v=get();q=proof(t,[c],[],{c,v,...(t===1?{u:get(),d:v}:{})});}else{const u=get()-1,o=get(),d=get(),count=get(),src=[];for(let i=0;i<count;i++)src.push(get());const ds=[],nd=get();for(let i=0;i<nd;i++)ds.push(get());const ne=get()+(get()<<8),es=[];if(ne>729)throw Error('CODEC_COUNT');for(let i=0;i<ne;i++)es.push([get(),get()]);q=proof(t,src,es,{u,o,d,ds});}if(n!==a.length)throw Error('CODEC_TRAILING');return q;}
function codecRoundtrip(s,q,w){const bytes=encode(q),p=decode(bytes);if(!check(s,p,w))throw Error('CODEC_PROOF');return bytes;}
function countCandidates(s){return s.m.reduce((a,m)=>a+pop(m),0);}
function singles(s,w){const r=enumerate(s,'P0',w,256);const m=new Map();for(const q of r.out)if(!m.has(effects(q)))m.set(effects(q),q);return [...m.values()];}
function consequences(s,q,horizon,w){const known=new Set(singles(s,w).map(effects)),before=countCandidates(s);let n=apply(s,q,w);const next=singles(n,w),newOnes=next.filter(z=>!known.has(effects(z)));const path=[],deltas=[];let prev=countCandidates(n);
 for(let k=0;k<horizon;k++){const a=singles(n,w);if(!a.length)break;const p=a[0];n=apply(n,p,w);const now=countCandidates(n);path.push(p);deltas.push(prev-now);prev=now;}
 return{peerEliminations:before-countCandidates(apply(s,q,w))-(q.c>=0?pop(s.m[q.c]):0),newSingles:newOnes.length,newSingleCells:newOnes.map(x=>x.c),path,pathGain:s.b.filter(v=>!v).length-n.b.filter(v=>!v).length,remaining:n.b.filter(v=>!v).length,deltas,horizon,checked:true};
}
function sensors(xs){if(xs.length<8)return{eligible:false,lz:null,gini:null,adsr:'insufficient',density:null};const a=xs.slice(-32),sum=a.reduce((s,x)=>s+x,0),sorted=a.slice().sort((a,b)=>a-b);let g=0;for(let i=0;i<sorted.length;i++)g+=(2*i-sorted.length+1)*sorted[i];const med=sorted[Math.floor(sorted.length/2)],word=a.map(x=>x>med?'1':'0').join('');let pos=0,lz=0;while(pos<word.length){let k=1;while(pos+k<=word.length&&word.slice(0,pos).includes(word.slice(pos,pos+k)))k++;pos+=k;lz++;}const changes=a.slice(1).map((x,i)=>Math.abs(x-a[i]));return{eligible:true,lz:lz/word.length,gini:sum?g/(a.length*sum):0,density:changes.reduce((a,b)=>a+b,0)/changes.length,adsr:a.slice(-3).every(x=>x===0)?'stalled':a.at(-1)>med?'building':'mixed'};}
function context(s,h=[]){const sizes=s.m.map(pop),sens=sensors(h);return[Math.floor(sizes.filter(x=>x>0).length/21),Math.min(2,Math.floor(sizes.filter(x=>x===2).length/8)),sens.eligible&&sens.adsr==='stalled'?1:0].join('.');}
function emptyModel(){return{version:VERSION,observations:[],models:[{name:'POOLED',bits:8,loss:0,table:{}},{name:'FAMILY',bits:16,loss:0,table:{}},{name:'CONTEXT',bits:24,loss:0,table:{}}],censored:0};}
function modelKey(model,ctx,fam){return model.name==='POOLED'?'all':model.name==='FAMILY'?fam:fam+':'+ctx;}
function predict(bank,ctx,fam){const selected=bank.models.slice().sort((a,b)=>a.bits+a.loss-b.bits-b.loss)[0],get=model=>{const x=model.table[modelKey(model,ctx,fam)]||{n:0,fire:0,cost:0,gain:0};return{p:(x.fire+1)/(x.n+2),cost:x.n?x.cost/x.n:1,gain:x.fire?x.gain/x.fire:1,n:x.n};};return{...get(selected),model:selected.name,idealBits:selected.loss,modelBits:selected.bits,all:bank.models.map(x=>({name:x.name,...get(x)}))};}
function observe(bank,event){if(!event||typeof event.id!=='string'||event.id.length>600||!FAMILIES.includes(event.family)||!/^[0-3]\.[0-2]\.[01]$/.test(event.ctx)||!['FIRE','NO_FIRE','LIMIT'].includes(event.status)||!Number.isFinite(event.cost)||event.cost<0||!Number.isFinite(event.gain)||event.gain<0)throw Error('INVALID_OBSERVATION');if(bank.observations.some(x=>x.id===event.id))return false;if(bank.observations.length>=2048)throw Error('MEMORY_LIMIT_EXPORT_RESET');bank.observations.push(copy(event));if(event.status==='LIMIT'){bank.censored++;return true;}
 for(const model of bank.models){const k=modelKey(model,event.ctx,event.family),x=model.table[k]||{n:0,fire:0,cost:0,gain:0},p=(x.fire+1)/(x.n+2);model.loss-=Math.log2(event.status==='FIRE'?p:1-p);x.n++;x.fire+=event.status==='FIRE'?1:0;x.cost+=event.cost;x.gain+=event.gain;model.table[k]=x;}return true;}
function restoreModel(data){if(!data||data.version!==VERSION||!Array.isArray(data.observations)||data.observations.length>2048)throw Error('MODEL_VERSION_OR_LIMIT');const b=emptyModel();for(const e of data.observations)if(!observe(b,e))throw Error('DUPLICATE_EVENT');return b;}
function search(s,opts={},bank=emptyModel()){
 validate(s);const work=new Work(opts.budget??180000),events=[],all=[],h=opts.history||[],ctx=context(s,h),mode=opts.policy||'REAL';let families=['P0','P1','P2','P3'];if(opts.deep)families.push('PATH');
 let chosenOrder=families.slice();if(mode==='REAL'||mode==='SHAM'||mode==='ORDINARY'){
  work.add(81,'features');const order=families.slice(1).map(f=>({f,p:predict(bank,ctx,f)}));work.add(order.length*3,'model');
  if(mode==='ORDINARY')order.sort((a,b)=>b.p.p-a.p.p||FAMILIES.indexOf(a.f)-FAMILIES.indexOf(b.f));
  else order.sort((a,b)=>(b.p.p*b.p.gain/Math.max(1,b.p.cost))-(a.p.p*a.p.gain/Math.max(1,a.p.cost))||FAMILIES.indexOf(a.f)-FAMILIES.indexOf(b.f));
  if(mode==='SHAM')order.reverse();chosenOrder=['P0',...order.map(x=>x.f)];
 }
 const target=Number.isInteger(opts.target)?opts.target:1;if(opts.goal==='PRACTICE'){const f=FAMILIES[RANK[target]];chosenOrder=[f,...chosenOrder.filter(x=>x!==f)];}
 let status='NO_WITNESS_FOUND';
 try{for(const f of chosenOrder){const before=work.n,pred=mode==='OFF'?null:predict(bank,ctx,f);const r=enumerate(s,f,work);const checked=[];
  for(const q of r.out){if(check(s,q,work)){const bytes=codecRoundtrip(s,q,work);checked.push({q,bits:bytes.length*8,bytes,consequence:effects(q)});}}
  all.push(...checked);const e={id:(opts.eventPrefix||'session')+':'+key(s)+':'+f,ctx,family:f,status:checked.length?'FIRE':r.complete?'NO_FIRE':'LIMIT',cost:work.n-before,gain:checked.length?new Set(checked.map(x=>x.consequence)).size:0,prediction:pred};events.push(e);
  if(checked.length){status='FOUND_ONLY';if(opts.goal!=='PRACTICE'||checked.some(x=>x.q.t===target))break;}if(!r.complete){status=all.length?'FOUND_PARTIAL':'LIMIT';break;}
 }}catch(e){if(e.message!=='LIMIT')throw e;status=all.length?'FOUND_PARTIAL':'LIMIT';}
 const witnessCount=all.length,groups=new Map();for(const a of all){const prev=groups.get(a.consequence);if(!prev)groups.set(a.consequence,{...a,witnesses:[a.q]});else{prev.witnesses.push(a.q);if(a.bits<prev.bits){prev.q=a.q;prev.bits=a.bits;prev.bytes=a.bytes;}}}
 let candidates=[...groups.values()].sort((a,b)=>RANK[a.q.t]-RANK[b.q.t]||a.bits-b.bits||a.consequence.localeCompare(b.consequence));
 if(opts.goal==='PRACTICE')candidates.sort((a,b)=>Number(b.q.t===target)-Number(a.q.t===target)||RANK[a.q.t]-RANK[b.q.t]||a.bits-b.bits||a.consequence.localeCompare(b.consequence));
 const baseline=candidates[0]?.consequence??null;let measured=0,reason='Cheapest checked explanation; no additional intervention.';
 if(mode!=='OFF'&&candidates.length>1){
  const contenders=candidates.filter(x=>RANK[x.q.t]===RANK[candidates[0].q.t]&&x.bits<=candidates[0].bits+24).slice(0,4),horizon=3;
  for(const a of contenders){try{a.flow=consequences(s,a.q,horizon,work);measured++;}catch(e){if(e.message!=='LIMIT')throw e;break;}}
  if(measured===contenders.length){let ranked=contenders.slice();
   if(mode==='SHAM'){const signals=ranked.map(x=>x.flow).reverse();ranked.forEach((x,i)=>x.rankFlow=signals[i]);}
   const sig=x=>x.rankFlow||x.flow;
   ranked.sort((a,b)=>sig(b).newSingles-sig(a).newSingles||sig(b).pathGain-sig(a).pathGain||a.bits-b.bits||a.consequence.localeCompare(b.consequence));
   const pick=ranked[0];if(pick){candidates=[pick,...candidates.filter(x=>x!==pick)];reason=pick.consequence===baseline?'NO_INTERVENTION: base choice retained after equal-horizon comparison.':'DCC preference: more newly opened singles, then bounded path progress, within the same technique tier.';}
  }else reason='Incomplete comparable coverage: original checked choice retained.';
 }
 return{version:VERSION,stateKey:key(s),status,candidates:candidates.slice(0,16),witnessCount,foundConsequences:groups.size,baseline,chosen:candidates[0]?.consequence??null,changed:!!candidates.length&&candidates[0].consequence!==baseline,reason,events,order:chosenOrder,ctx,sensors:mode==='OFF'?{eligible:false}:sensors(h),work:work.n,counts:work.counts,measured,policy:mode,codec:CODEC,coverage:'FOUND_ONLY; bounded family scans, at most 4 compared paths'};
}
function review(s,cell,value,opts={}){
 validate(s);const w=new Work(opts.budget??180000),path=[];let current=clone(s),found=null,status='NO_WITNESS_FOUND';
 try{for(let depth=0;depth<100;depth++){
  // Actual action first: direct witness is searched before unrelated alternatives.
  const direct=enumerate(current,'P0',w,256).out.filter(q=>q.c===cell&&q.v===value).sort((a,b)=>encode(a).length-encode(b).length);
  if(direct.length){found=direct[0];path.push(found);apply(current,found,w);status='FOUND';break;}
  if(current.b[cell])break;let next=null;for(const family of ['P0','P1','P2','P3']){const scan=enumerate(current,family,w);if(scan.out.length){next=scan.out[0];break;}if(!scan.complete)throw Error('LIMIT');}
  if(!next)break;current=apply(current,next,w);path.push(next);
 }}catch(e){if(e.message!=='LIMIT')throw e;status='LIMIT';}
 let bits=null,bytes=null;const replayWork=new Work(100000);if(found){let n=clone(s);bytes=[];for(const q of path){const b=codecRoundtrip(n,q,replayWork);replayWork.add(b.length,'codec');bytes.push(b);n=apply(n,q,replayWork);}bits=bytes.reduce((x,b)=>x+b.length*8,0);}
 return{status,reasoning_status:'UNKNOWN_REASONING',cell,value,found:!!found,technique:found?NAMES[found.t]:null,proof:found?found:null,path:found?path:[],proofBytes:bytes,reference_proof_bits:bits,codec:CODEC,work:w.n+replayWork.n,discoveryWork:w.n,replayWork:replayWork.n,coverage:'Shortest found in the declared bounded path, not a global optimum'};
}
function exact(board,maxNodes=100000,random=null){const b=flat(board);for(const u of U){const a=u.map(i=>b[i]).filter(Boolean);if(new Set(a).size!==a.length)return{count:0,complete:true,solution:null,nodes:0};}let count=0,answer=null,nodes=0,limit=false;
 function go(){if(++nodes>maxNodes){limit=true;return;}let c=-1,ds=null;for(let i=0;i<81;i++)if(!b[i]){const a=digits(basic(b,i));if(!a.length)return;if(!ds||a.length<ds.length){c=i;ds=a;if(a.length===1)break;}}
 if(c<0){count++;if(!answer)answer=b.slice();return;}if(random)shuffle(ds,random);for(const d of ds){b[c]=d;go();b[c]=0;if(count>=(random?1:2)||limit)return;}}
 go();return{count,complete:!limit,solution:answer,nodes};}
function rng(seed){let x=(seed>>>0)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function shuffle(a,rand){for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function generate(opts={}){
 const rand=rng(opts.seed||1),requested={easy:39,medium:32,hard:27,evil:24}[opts.diff||'medium']||32,target=opts.target,attempts=target==null?1:12;let totalNodes=0;
 for(let attempt=0;attempt<attempts;attempt++){
  const full=exact(Array(81).fill(0),100000,rand);totalNodes+=full.nodes;if(!full.solution)continue;const b=full.solution.slice(),order=shuffle([...Array(81).keys()],rand);let givens=81;
  for(const i of order){if(givens<=requested)break;const d=b[i];b[i]=0;const r=exact(b,18000);totalNodes+=r.nodes;if(r.complete&&r.count===1)givens--;else b[i]=d;}
  const cert=exact(b,100000);totalNodes+=cert.nodes;if(!cert.complete||cert.count!==1)continue;
  let s=state(b),prefix=[],exercise=null;const w=new Work(700000);
  if(target!=null){try{for(let j=0;j<90;j++){const f=FAMILIES[RANK[target]],a=enumerate(s,f,w).out.filter(q=>q.t===target);if(a.length){exercise={state:clone(s),witness:a[0],prefix,profile:'PATH_CONTAINS_TECHNIQUE',technique:NAMES[target]};break;}let q=null;for(const family of ['P0','P1','P2','P3']){const a=enumerate(s,family,w);if(a.out.length){q=a.out[0];break;}}if(!q)break;s=apply(s,q,w);prefix.push(q);}}catch(e){if(e.message!=='LIMIT')throw e;}if(!exercise)continue;}
  return{status:'GENERATED',puzzle:b,solution:cert.solution,unique:true,givens,requestedGivens:requested,seed:opts.seed,attempts:attempt+1,nodes:totalNodes,exercise,profile:exercise?'PATH_CONTAINS_TECHNIQUE':'CLUE_COUNT_PROFILE',requiresTechnique:false};
 }return{status:'PROFILE_UNFULFILLED',target,attempts,nodes:totalNodes};
}
function describe(q,level='reveal'){
 const label=LABELS[q.t],areas=[...new Set(q.src.map(box))],u=q.u>=0?q.u:areas[0]??18;
 if(level==='nudge')return`Inspect ${unitName(u)}${q.t===6?' and its crossing lines':''}. A checked ${label.toLowerCase()} relationship is available. No answer has been revealed.`;
 if(level==='explain'){
  if(q.t===0)return`In ${unitName(u)}, one empty cell has only one remaining candidate. Compare its row, column and box.`;
  if(q.t===1)return`Look at the possible positions for one digit in ${unitName(q.u)}. Only one cell supports it.`;
  if(q.t===2||q.t===3)return`Digit ${q.d} is confined to ${q.src.map(rc).join(', ')} in ${unitName(q.u)}. Follow the shared ${q.t===2?'line':'box'} to find exclusions.`;
  if(q.t===4||q.t===5)return`${q.ds.join('/')} are confined to ${q.src.map(rc).join(', ')} in ${unitName(q.u)}. ${q.t===4?'Other cells cannot use those digits.':'Those cells cannot use other digits.'}`;
  if(q.t===6)return`Digit ${q.d} occupies two matching supports on ${q.o?'columns':'rows'}: ${q.src.map(rc).join(', ')}. The two crossing lines are reserved.`;
  if(q.t===7)return`Pivot ${rc(q.src[0])} links the bivalue wings ${rc(q.src[1])} and ${rc(q.src[2])}. Either pivot value makes one wing contain ${q.d}.`;
  return`An exhaustive single-digit path check for ${q.d} excludes unsupported possibilities. This is not a guessed completed grid.`;
 }
 return q.c>=0?`${label}: ${rc(q.c)} = ${q.v}.`:`${label}: remove ${q.es.map(([i,d])=>d+'@'+rc(i)).join(', ')}. The player grid is not filled automatically.`;
}
return{VERSION,CODEC,NAMES,LABELS,RANK,FAMILIES,U,P,bit,pop,digits,rc,unitName,box,flat,state,validate,clone,key,Work,enumerate,check,apply,encode,decode,codecRoundtrip,effects,consequences,sensors,context,emptyModel,predict,observe,restoreModel,search,review,exact,rng,generate,describe,pathQuery,countCandidates};
});

