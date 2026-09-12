/* Flip4M v2.0.0 — BD × AI Lab, 2026-09-12.
 * Rules/physics derived from public/F4M/F4M.html, Git blob
 * fc8993a238c7ceed634329b8f2c31f2cb9fd89da (main 7ba0010f23d448311834cdc30a4e772e0da057ff).
 * Production UI is the rules oracle: action -> settle -> win/full -> decay -> next player.
 * Magnet expiry releases a piece at the NEXT settlement, as in the original UI.
 * The legacy top-left scan precedence for simultaneous lines is deliberately retained.
 * DCC is a bounded, experimental near-equal-score policy, not a consciousness claim.
 */
(function(root){
'use strict';
const VERSION='2.1.0-lab.1', RULES='f4m-production-ui-2026-09', N=8, LIFE=6, MATE=1000000;
const SIDES=['top','right','bottom','left'], CW=[3,0,1,2], CCW=[1,2,3,0];
const copyGrid=g=>g.map(r=>r.slice());
const copyMag=m=>Object.fromEntries(SIDES.map(k=>[k,m[k].map(v=>v?{p:v.p,life:v.life}:null)]));
const copy=s=>({...s,grid:copyGrid(s.grid),mag:copyMag(s.mag),tokens:{1:{...s.tokens[1]},2:{...s.tokens[2]}}});
function create(tools=2){
 if(![0,2,3].includes(tools))throw Error('Unsupported tool preset');
 return {grid:Array.from({length:N},()=>Array(N).fill(0)),mag:Object.fromEntries(SIDES.map(k=>[k,Array(N).fill(null)])),gravityDir:0,curPlayer:1,tokens:{1:{flip:tools,mag:tools},2:{flip:tools,mag:tools}},ply:0,result:0};
}
function isPinned(r,c,m){return !!((r===0&&m.top[c])||(r===7&&m.bottom[c])||(c===0&&m.left[r])||(c===7&&m.right[r]));}
// The order top, bottom, left, right is the original rule, including opposing/crossing fields.
function physicsStep(g,dir,m){
 const a=copyGrid(g);let changed=false;
 for(let c=0;c<N;c++)if(m.top[c]&&!a[0][c])for(let r=1;r<N;r++)if(a[r][c]){a[0][c]=a[r][c];a[r][c]=0;changed=true;break;}
 for(let c=0;c<N;c++)if(m.bottom[c]&&!a[7][c])for(let r=6;r>=0;r--)if(a[r][c]){a[7][c]=a[r][c];a[r][c]=0;changed=true;break;}
 for(let r=0;r<N;r++)if(m.left[r]&&!a[r][0])for(let c=1;c<N;c++)if(a[r][c]){a[r][0]=a[r][c];a[r][c]=0;changed=true;break;}
 for(let r=0;r<N;r++)if(m.right[r]&&!a[r][7])for(let c=6;c>=0;c--)if(a[r][c]){a[r][7]=a[r][c];a[r][c]=0;changed=true;break;}
 if(dir===0){for(let c=0;c<N;c++)for(let r=6;r>=0;r--)if(a[r][c]&&!a[r+1][c]&&!isPinned(r,c,m)){a[r+1][c]=a[r][c];a[r][c]=0;changed=true;}}
 else if(dir===1){for(let r=0;r<N;r++)for(let c=1;c<N;c++)if(a[r][c]&&!a[r][c-1]&&!isPinned(r,c,m)){a[r][c-1]=a[r][c];a[r][c]=0;changed=true;}}
 else if(dir===2){for(let c=0;c<N;c++)for(let r=1;r<N;r++)if(a[r][c]&&!a[r-1][c]&&!isPinned(r,c,m)){a[r-1][c]=a[r][c];a[r][c]=0;changed=true;}}
 else{for(let r=0;r<N;r++)for(let c=6;c>=0;c--)if(a[r][c]&&!a[r][c+1]&&!isPinned(r,c,m)){a[r][c+1]=a[r][c];a[r][c]=0;changed=true;}}
 return {nextG:a,changed};
}
function settle(g,dir,m){
 // Exact fast path; differentially tested against the original 60-step implementation.
 if(!SIDES.some(k=>m[k].some(Boolean))){
  const a=Array.from({length:N},()=>Array(N).fill(0));
  for(let i=0;i<N;i++){
   const vals=[];for(let j=0;j<N;j++){const v=dir%2?g[i][j]:g[j][i];if(v)vals.push(v);}
   const start=(dir===0||dir===3)?N-vals.length:0;
   vals.forEach((v,j)=>{if(dir%2)a[i][start+j]=v;else a[start+j][i]=v;});
  }return a;
 }
 let a=copyGrid(g);
 for(let n=0;n<60;n++){const x=physicsStep(a,dir,m);if(!x.changed)break;a=x.nextG;}
 return a;
}
function dropTarget(g,dir,i){
 if(!Number.isInteger(i)||i<0||i>=N)return null;
 for(let j=0;j<N;j++){
  const r=dir===0?j:dir===2?7-j:i, c=dir===1?7-j:dir===3?j:i;
  // Deliberately retains legacy first-empty-slot entry, even behind a pinned edge token.
  if(!g[r][c])return {r,c};
 }return null;
}
function winningLines(g){
 const lines=[];
 for(let r=0;r<N;r++)for(let c=0;c<N;c++){
  const p=g[r][c];if(!p)continue;
  for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
   const rr=r+3*dr,cc=c+3*dc;if(rr<0||rr>=N||cc<0||cc>=N)continue;
   const cells=Array.from({length:4},(_,i)=>[r+i*dr,c+i*dc]);
   if(cells.every(([a,b])=>g[a][b]===p))lines.push({p,cells});
  }
 }return lines;
}
function winner(g){
 // Keep this hot path allocation-free, with the SAME scan order as legacy checkWin.
 for(let r=0;r<N;r++)for(let c=0;c<N;c++){
  const p=g[r][c];if(!p)continue;
  if(c<=4&&g[r][c+1]===p&&g[r][c+2]===p&&g[r][c+3]===p)return p;
  if(r<=4&&g[r+1][c]===p&&g[r+2][c]===p&&g[r+3][c]===p)return p;
  if(r<=4&&c<=4&&g[r+1][c+1]===p&&g[r+2][c+2]===p&&g[r+3][c+3]===p)return p;
  if(r<=4&&c>=3&&g[r+1][c-1]===p&&g[r+2][c-2]===p&&g[r+3][c-3]===p)return p;
 }return 0;
}
function result(g){return winner(g)||(!g.some(r=>r.includes(0))?3:0);}
function moveId(a){return a.type==='drop'?'d'+a.col:a.type==='flip'?'f'+a.delta:'m'+a.side+'_'+a.idx;}
function legal(s){
 if(s.result)return [];
 const a=[];
 // Original center-first ordering, with stable identifiers for deterministic ties.
 for(const col of [3,4,2,5,1,6,0,7])if(dropTarget(s.grid,s.gravityDir,col))a.push({type:'drop',col});
 if(s.tokens[s.curPlayer].flip>0)a.push({type:'flip',delta:1},{type:'flip',delta:-1});
 if(s.tokens[s.curPlayer].mag>0)for(let side=0;side<4;side++)for(let idx=0;idx<N;idx++){
  const m=s.mag[SIDES[side]][idx];
  // The live UI permits replacement/refresh of an owned magnet too. Never silently prune it.
  a.push({type:'magnet',side,idx});
 }
 return a;
}
function validMove(s,a){
 if(!a||s.result)return false;
 if(a.type==='drop')return !!dropTarget(s.grid,s.gravityDir,a.col);
 if(a.type==='flip')return (a.delta===1||a.delta===-1)&&s.tokens[s.curPlayer].flip>0;
 return a.type==='magnet'&&Number.isInteger(a.side)&&a.side>=0&&a.side<4&&Number.isInteger(a.idx)&&a.idx>=0&&a.idx<N&&s.tokens[s.curPlayer].mag>0;
}
function action(s,a,trace=false){
 if(!validMove(s,a))throw Error('Illegal move: '+JSON.stringify(a));
 const n=copy(s),p=s.curPlayer, paths=[];
 let ids;
 if(trace){ids=Array.from({length:N},()=>Array(N).fill(0));for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(s.grid[r][c]){ids[r][c]=paths.length+1;paths.push({p:s.grid[r][c],r,c});}}
 if(a.type==='drop'){
  const t=dropTarget(n.grid,n.gravityDir,a.col);n.grid[t.r][t.c]=p;
  if(trace){ids[t.r][t.c]=paths.length+1;paths.push({p,r:n.gravityDir===0?-1:n.gravityDir===2?8:t.r,c:n.gravityDir===1?8:n.gravityDir===3?-1:t.c});}
 }else if(a.type==='flip'){
  n.tokens[p].flip--;n.gravityDir=(a.delta===1?CCW:CW)[n.gravityDir];
 }else{
  n.tokens[p].mag--;const op=(a.side+2)%4,om=n.mag[SIDES[op]][a.idx];
  if(om&&om.p===3-p)n.mag[SIDES[op]][a.idx]=null;
  else n.mag[SIDES[a.side]][a.idx]={p,life:LIFE};
 }
 n.grid=settle(n.grid,n.gravityDir,n.mag);
 if(trace){ids=settle(ids,n.gravityDir,n.mag);for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(ids[r][c]){paths[ids[r][c]-1].toR=r;paths[ids[r][c]-1].toC=c;}}
 n.ply=(s.ply||0)+1;n.result=result(n.grid);
 // In production endTurn checks victory before decrementing life. Mirror this exactly.
 if(!n.result){for(const k of SIDES)for(let i=0;i<N;i++){const m=n.mag[k][i];if(m&&--m.life<=0)n.mag[k][i]=null;}n.curPlayer=3-p;}
 return trace?{state:n,paths}:n;
}
function key(s){
 return s.grid.map(r=>r.join('')).join('')+'|'+s.gravityDir+'|'+s.curPlayer+'|'+
 [s.tokens[1].flip,s.tokens[1].mag,s.tokens[2].flip,s.tokens[2].mag].join(',')+'|'+
 SIDES.map(k=>s.mag[k].map(m=>m?m.p+':'+m.life:'0').join(',')).join(';');
}
const LINES=[];
for(let r=0;r<N;r++)for(let c=0;c<N;c++)for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]])if(r+3*dr<N&&c+3*dc>=0&&c+3*dc<N)LINES.push(Array.from({length:4},(_,i)=>[r+i*dr,c+i*dc]));
function evaluate(s,p=s.curPlayer){
 let value=0;const q=3-p,weights=[0,2,20,180,20000];
 for(const line of LINES){let a=0,b=0;for(const [r,c] of line){if(s.grid[r][c]===p)a++;else if(s.grid[r][c]===q)b++;}if(!b)value+=weights[a];if(!a)value-=weights[b];}
 for(let r=0;r<N;r++)for(let c=0;c<N;c++){const v=s.grid[r][c],w=7-Math.abs(3.5-r)-Math.abs(3.5-c);if(v===p)value+=w;else if(v===q)value-=w;}
 value+=22*(s.tokens[p].flip-s.tokens[q].flip)+30*(s.tokens[p].mag-s.tokens[q].mag);
 return value;
}
function validate(raw){
 if(!raw||typeof raw!=='object')throw Error('Missing position');
 const int=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
 if(!Array.isArray(raw.grid)||raw.grid.length!==N||raw.grid.some(r=>!Array.isArray(r)||r.length!==N||r.some(v=>!int(v,0,2))))throw Error('Invalid 8×8 board');
 if(!int(raw.gravityDir,0,3)||!int(raw.curPlayer,1,2))throw Error('Invalid gravity or player');
 for(const k of SIDES)if(!raw.mag||!Array.isArray(raw.mag[k])||raw.mag[k].length!==N||raw.mag[k].some(m=>m!==null&&(!m||!int(m.p,1,2)||!int(m.life,1,LIFE))))throw Error('Invalid magnets');
 for(const p of [1,2])if(!raw.tokens||!raw.tokens[p]||!int(raw.tokens[p].flip,0,64)||!int(raw.tokens[p].mag,0,64))throw Error('Invalid resources');
 return {grid:copyGrid(raw.grid),mag:copyMag(raw.mag),gravityDir:raw.gravityDir,curPlayer:raw.curPlayer,tokens:{1:{flip:raw.tokens[1].flip,mag:raw.tokens[1].mag},2:{flip:raw.tokens[2].flip,mag:raw.tokens[2].mag}},ply:int(raw.ply,0,1024)?raw.ply:0,result:result(raw.grid)};
}
const api={VERSION,RULES,N,LIFE,SIDES,CW,CCW,MATE,create,copy,copyGrid,copyMag,isPinned,physicsStep,settle,dropTarget,winningLines,winner,result,moveId,legal,validMove,action,key,evaluate,validate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.F4M=api;
})(globalThis);
