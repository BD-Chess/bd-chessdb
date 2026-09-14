import { getStore } from '@netlify/blobs';

const STORE='bd-o-medication-v1';
function env(name){try{return Netlify.env.get(name)||''}catch(_){return ''}}
function ljDate(d=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day}`;
}
function gmailReady(){
 return Boolean(env('BD_MED_GMAIL_CLIENT_ID')&&env('BD_MED_GMAIL_CLIENT_SECRET')&&env('BD_MED_GMAIL_REFRESH_TOKEN')&&env('BD_MED_REMINDER_TO'));
}
function b64url(s){return Buffer.from(s,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function gmailAccessToken(){
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:env('BD_MED_GMAIL_CLIENT_ID'),client_secret:env('BD_MED_GMAIL_CLIENT_SECRET'),refresh_token:env('BD_MED_GMAIL_REFRESH_TOKEN'),grant_type:'refresh_token'})});
 if(!r.ok)throw new Error('gmail_token_'+r.status);
 const x=await r.json();if(!x.access_token)throw new Error('gmail_token_missing');return x.access_token;
}
async function sendGmail(dueAt,label){
 const access=await gmailAccessToken(),to=env('BD_MED_REMINDER_TO');
 const local=new Intl.DateTimeFormat('sl-SI',{timeZone:'Europe/Ljubljana',hour:'2-digit',minute:'2-digit'}).format(new Date(dueAt));
 const what=label||'načrtovani odmerek';
 const subject=`Opomnik: ${what}`;
 const body=`${what} je bil načrtovan ob ${local} in še ni označen kot vzet več kot 30 minut po času.\n\nOdpri: https://www.mdlxdcc.org/BD/O/tablete.html\n\nSamodejni opomnik BD · Osebno`;
 const raw=`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`;
 const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({raw:b64url(raw)})});
 if(!r.ok)throw new Error('gmail_send_'+r.status);
}
export default async()=>{
 const store=getStore({name:STORE,consistency:'strong'});
 const date=ljDate(),key='day-'+date,x=await store.get(key,{type:'json'});if(!x||!Array.isArray(x.blocks))return;
 const now=Date.now(),grace=30*60000;let dirty=false;
 for(const b of x.blocks){
  if(!b||b.remind===false||b.reminderSentAt)continue;
  const due=Date.parse(b.dueAt);if(!Number.isFinite(due)||now<due+grace)continue;
  const pending=(b.itemIds||[]).filter(id=>!x.items?.[id]?.takenAt);
  if(!pending.length)continue;
  b.reminderDueAt=b.reminderDueAt||new Date().toISOString();dirty=true;
  if(gmailReady()){
   try{await sendGmail(b.dueAt,b.label);b.reminderSentAt=new Date().toISOString();console.log(JSON.stringify({event:'bd-med-reminder-sent',date,block:b.id,label:b.label,dueAt:b.dueAt}));}
   catch(e){console.error('bd-med-reminder-gmail',e)}
  }else{
   console.log(JSON.stringify({event:'bd-med-reminder-due-email-unconfigured',date,block:b.id,label:b.label,dueAt:b.dueAt}));
  }
 }
 if(dirty){x.updatedAt=new Date().toISOString();x.emailReady=gmailReady();await store.setJSON(key,x)}
};
export const config={schedule:'*/5 * * * *'};
