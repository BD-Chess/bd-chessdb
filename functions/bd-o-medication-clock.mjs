import { getStore } from '@netlify/blobs';

const STORE='bd-o-medication-v1';
const FORM_NAME='bd-med-reminder';
const SITE='https://www.mdlxdcc.org/';
function env(name){try{return Netlify.env.get(name)||''}catch(_){return ''}}
function ljDate(d=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day}`;
}
function gmailReady(){
 return Boolean(env('BD_MED_GMAIL_CLIENT_ID')&&env('BD_MED_GMAIL_CLIENT_SECRET')&&env('BD_MED_GMAIL_REFRESH_TOKEN')&&env('BD_MED_REMINDER_TO'));
}
function netlifyEmailReady(){return env('BD_MED_NETLIFY_FORM_EMAIL')==='1'&&Boolean(env('BD_MED_REMINDER_TO'))}
function emailReady(){return gmailReady()||netlifyEmailReady()}
function localTime(iso){return new Intl.DateTimeFormat('sl-SI',{timeZone:'Europe/Ljubljana',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}
function b64url(s){return Buffer.from(s,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function gmailAccessToken(){
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:env('BD_MED_GMAIL_CLIENT_ID'),client_secret:env('BD_MED_GMAIL_CLIENT_SECRET'),refresh_token:env('BD_MED_GMAIL_REFRESH_TOKEN'),grant_type:'refresh_token'})});
 if(!r.ok)throw new Error('gmail_token_'+r.status);
 const x=await r.json();if(!x.access_token)throw new Error('gmail_token_missing');return x.access_token;
}
async function sendGmail(dueAt,labels){
 const access=await gmailAccessToken(),to=env('BD_MED_REMINDER_TO');
 const local=localTime(dueAt),names=labels.filter(Boolean),what=names.length?names.join(' + '):'načrtovani odmerek';
 const subject=`Opomnik: ${what}`;
 const body=`${what} je bil načrtovan ob ${local} in še ni označen kot vzet več kot 30 minut po času.\n\nOdpri: https://www.mdlxdcc.org/BD/O/tablete.html\n\nSamodejni opomnik BD · Osebno`;
 const raw=`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`;
 const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({raw:b64url(raw)})});
 if(!r.ok)throw new Error('gmail_send_'+r.status);
}
async function sendNetlifyForm(dueAt,count){
 const local=localTime(dueAt);
 const body=new URLSearchParams({
  'form-name':FORM_NAME,
  subject:'Opomnik: čas za tableto',
  message:`${count>1?'Več načrtovanih odmerkov je':'Načrtovani odmerek je'} že več kot 30 minut čez nastavljeno uro. Odpri dnevni načrt in označi, kar si vzel.`,
  due_at:local
 });
 const r=await fetch(SITE,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,redirect:'follow'});
 if(!r.ok)throw new Error('netlify_form_'+r.status);
}
export default async()=>{
 const store=getStore({name:STORE,consistency:'strong'});
 const date=ljDate(),key='day-'+date,x=await store.get(key,{type:'json'});if(!x||!Array.isArray(x.blocks))return;
 const now=Date.now(),grace=30*60000;let dirty=false;
 const groups=new Map();
 for(const b of x.blocks){
  if(!b||b.remind===false||b.reminderSentAt)continue;
  const due=Date.parse(b.dueAt);if(!Number.isFinite(due)||now<due+grace)continue;
  const pending=(b.itemIds||[]).filter(id=>!x.items?.[id]?.takenAt);
  if(!pending.length)continue;
  b.reminderDueAt=b.reminderDueAt||new Date().toISOString();dirty=true;
  const minuteKey=new Date(Math.floor(due/60000)*60000).toISOString();
  if(!groups.has(minuteKey))groups.set(minuteKey,[]);
  groups.get(minuteKey).push(b);
 }
 for(const blocks of groups.values()){
  const dueAt=blocks[0].dueAt,labels=blocks.map(b=>b.label||'').filter(Boolean),sentAt=new Date().toISOString();
  try{
   let channel='';
   if(gmailReady()){await sendGmail(dueAt,labels);channel='gmail'}
   else if(netlifyEmailReady()){await sendNetlifyForm(dueAt,blocks.length);channel='netlify-form'}
   else {console.log(JSON.stringify({event:'bd-med-reminder-due-email-unconfigured',date,dueAt,count:blocks.length}));continue}
   for(const b of blocks)b.reminderSentAt=sentAt;
   dirty=true;
   console.log(JSON.stringify({event:'bd-med-reminder-sent',channel,date,dueAt,count:blocks.length}));
  }catch(e){console.error('bd-med-reminder-email',e)}
 }
 if(dirty){x.updatedAt=new Date().toISOString();x.emailReady=emailReady();await store.setJSON(key,x)}
};
export const config={schedule:'*/5 * * * *'};
