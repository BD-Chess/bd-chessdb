import { getStore } from '@netlify/blobs';

const STORE='bd-o-medication-v1';
const headers={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, no-cache, must-revalidate',
  'Pragma':'no-cache',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff',
  'X-Robots-Tag':'noindex, nofollow, noarchive'
};
const answer=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const TIME_RE=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ID_RE=/^[a-z][a-z0-9_-]{0,32}$/i;

function env(name){try{return Netlify.env.get(name)||''}catch(_){return ''}}
function gmailReady(){
 return Boolean(env('BD_MED_GMAIL_CLIENT_ID')&&env('BD_MED_GMAIL_CLIENT_SECRET')&&env('BD_MED_GMAIL_REFRESH_TOKEN')&&env('BD_MED_REMINDER_TO'));
}
function cleanPlan(p){
 if(!p||!DATE_RE.test(String(p.date||''))||!TIME_RE.test(String(p.wake||'')))throw new Error('plan');
 const items={};
 for(const [id,v] of Object.entries(p.items||{})){
  if(!ID_RE.test(id))continue;
  items[id]={takenAt:(v&&typeof v.takenAt==='string'&&v.takenAt.length<40)?v.takenAt:null};
 }
 const blocks=[];
 for(const b of Array.isArray(p.blocks)?p.blocks:[]){
  if(!b||!ID_RE.test(String(b.id||''))||!Array.isArray(b.itemIds)||!Number.isFinite(Date.parse(b.dueAt)))continue;
  const ids=b.itemIds.map(String).filter(x=>ID_RE.test(x)&&x in items).slice(0,12);
  if(!ids.length)continue;
  blocks.push({
   id:String(b.id),
   dueAt:new Date(b.dueAt).toISOString(),
   itemIds:ids,
   remind:b.remind!==false,
   label:typeof b.label==='string'?b.label.slice(0,120):'',
   reminderSentAt:null,
   reminderDueAt:null
  });
 }
 return {date:String(p.date),wake:String(p.wake),timezone:'Europe/Ljubljana',items,blocks,updatedAt:new Date().toISOString(),emailReady:gmailReady()};
}
async function read(store,date){
 const x=await store.get('day-'+date,{type:'json'});
 if(x)x.emailReady=gmailReady();
 return x||null;
}

export default async req=>{
 const store=getStore({name:STORE,consistency:'strong'});
 const url=new URL(req.url);
 if(req.method==='GET'){
  const date=String(url.searchParams.get('date')||'');
  if(!DATE_RE.test(date))return answer({ok:false,error:'date'},400);
  return answer({ok:true,state:await read(store,date),emailReady:gmailReady()});
 }
 if(req.method!=='POST')return answer({ok:false,error:'method'},405);
 let body;try{body=await req.json()}catch(_){return answer({ok:false,error:'json'},400)}
 try{
  if(body.action==='plan'){
   const plan=cleanPlan(body.plan);
   const old=await read(store,plan.date);
   if(old?.items)for(const [id,v] of Object.entries(old.items))if(v?.takenAt&&plan.items[id]&&!plan.items[id].takenAt)plan.items[id].takenAt=v.takenAt;
   if(old?.blocks)for(const b of plan.blocks){const prev=old.blocks.find(x=>x.id===b.id&&x.dueAt===b.dueAt);if(prev){b.reminderSentAt=prev.reminderSentAt||null;b.reminderDueAt=prev.reminderDueAt||null}}
   await store.setJSON('day-'+plan.date,plan);
   return answer({ok:true,state:plan});
  }
  if(body.action==='taken'){
   const date=String(body.date||''),id=String(body.id||'');
   if(!DATE_RE.test(date)||!ID_RE.test(id))return answer({ok:false,error:'input'},400);
   const x=await read(store,date);if(!x||!x.items?.[id])return answer({ok:false,error:'not_found'},404);
   x.items[id].takenAt=body.taken?(Number.isFinite(Date.parse(body.takenAt))?new Date(body.takenAt).toISOString():new Date().toISOString()):null;
   x.updatedAt=new Date().toISOString();x.emailReady=gmailReady();
   await store.setJSON('day-'+date,x);return answer({ok:true,state:x});
  }
  return answer({ok:false,error:'action'},400);
 }catch(e){console.error('bd-o-medication-state',e);return answer({ok:false,error:'invalid'},400)}
};

export const config={path:'/api/bd-o-medication-state'};
