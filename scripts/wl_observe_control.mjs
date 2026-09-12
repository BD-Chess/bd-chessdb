/* Read-only website witness. Publishes no conversation, password, or token. */
const repo='BD-Chess/bd-chessdb',branch='ops/wl-runtime-state',path='control.json';
if(process.env.GITHUB_REPOSITORY!==repo||!process.env.GITHUB_TOKEN)throw Error('wrong runner');
const now=new Date();
const r=await fetch('https://www.mdlxdcc.org/api/wl/runtime?t='+now.getTime(),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
if(!r.ok)throw Error('runtime HTTP '+r.status);
const c=await r.json(), age=Date.now()-Date.parse(c.server_time);
if(c.ok!==true||c.protocol!=='WL-RUNTIME-2'||typeof c.paused!=='boolean'||!Number.isFinite(age)||Math.abs(age)>180000)throw Error('invalid runtime evidence');
const witness={schema:'wl.control.witness.v1',observed_at:new Date().toISOString(),source:'https://www.mdlxdcc.org/api/wl/runtime',protocol:c.protocol,server_time:c.server_time,paused:c.paused,control_updated_at:c.control_updated_at||null,last_pulse_at:c.last_pulse_at||null,workflow_run:process.env.GITHUB_RUN_ID};
async function api(p,method='GET',body=null,allowed=[]){
 const q=await fetch('https://api.github.com/repos/'+repo+p,{method,headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 if(allowed.includes(q.status))return null;if(!q.ok)throw Error('GitHub HTTP '+q.status);return q.status===204?null:q.json();
}
const head=await api('/git/ref/heads/main');
await api('/git/refs','POST',{ref:'refs/heads/'+branch,sha:head.object.sha},[422]);
const old=await api('/contents/'+path+'?ref='+encodeURIComponent(branch),'GET',null,[404]);
await api('/contents/'+path,'PUT',{message:'WL: observe runtime control',branch,content:Buffer.from(JSON.stringify(witness)).toString('base64'),...(old?{sha:old.sha}:{})});
console.log(JSON.stringify(witness));
