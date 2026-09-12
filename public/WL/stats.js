/* Private WL observatory projection. No password or private message body is sent here. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const HOUR=60*60*1000;
let timer=null,busy=false;
function duration(value){
 const s=Math.round(Number(value));
 if(!Number.isFinite(s)||s<0)return '—';
 const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
 if(h)return `${h} h ${String(m).padStart(2,'0')} min ${String(sec).padStart(2,'0')} s`;
 if(m)return `${m} min ${String(sec).padStart(2,'0')} s`;
 return `${sec} s`;
}
function integerText(id){const n=Number.parseInt($(id)?.textContent||'',10);return Number.isFinite(n)?n:null}
function localTime(t){return t?new Date(t).toLocaleString('sl-SI',{timeZone:'Europe/Ljubljana'}):'—'}
function set(id,value){const el=$(id);if(el)el.textContent=value??'—'}
function render(data){
 const o=data?.observatory||{},wl=o.wl||{},mail=o.email||{};
 const liveSteps=integerText('steps'),liveAuto=integerText('autosteps');
 set('obsWlMessages',liveSteps??wl.messages??'—');
 set('obsWlScheduled',liveAuto??wl.scheduled_steps??'—');
 set('obsWlAvg',duration(wl.mean_scheduled_publication_interval_seconds));
 set('obsEmailMessages',mail.total_messages??'—');
 set('obsEmailAvg',duration(mail.mean_within_run_interval_seconds));
 set('obsEmailMedian',duration(mail.median_within_run_interval_seconds));
 const A=mail.runs?.A,B=mail.runs?.B;
 set('obsEmailDetail',A&&B?`Tek A: ${A.messages} sporočil · povp. ${duration(A.mean_interval_seconds)}. Tek B: ${B.messages} sporočil · povp. ${duration(B.mean_interval_seconds)}.`:'Email statistika ni na voljo.');
 set('obsStatsTime',`Agregat osvežen: ${localTime(data?.generated_at)} · stran preveri nove agregate vsako uro.`);
}
async function load(){
 if(busy||$('app')?.hidden)return;
 busy=true;
 try{
  const r=await fetch('/data/PREAI8_STATUS.json?t='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  if(!r.ok)throw Error();render(await r.json());
 }catch{set('obsStatsTime','Agregat trenutno ni dosegljiv; zasebni WL prikaz ostaja nespremenjen.')}finally{busy=false}
}
function sync(){
 const open=!$('app')?.hidden;
 if(open&&!timer){load();timer=setInterval(load,HOUR)}
 if(!open&&timer){clearInterval(timer);timer=null}
}
const app=$('app');if(app)new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['hidden']});
$('refresh')?.addEventListener('click',()=>setTimeout(load,0));
sync();
})();
