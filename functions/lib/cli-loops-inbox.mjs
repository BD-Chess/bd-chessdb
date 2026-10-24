import {createHash,randomUUID,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';

export const REPOSITORY='BD-Chess/8zListener-Inbox',BRANCH='main',PREFIX='8zlistener/inbox';
export const canonical=value=>JSON.stringify(sort(value),null,2)+'\n';
function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
export const digest=raw=>createHash('sha256').update(raw).digest('hex');
export const fail=(code,status=400)=>{throw Object.assign(Error(code),{code,status});};
const integer=(v,fallback,low,high)=>{const n=v===''||v===undefined||v===null?fallback:Number(v);if(!Number.isInteger(n)||n<low||n>high)fail('INVALID_LIMIT');return n;};
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.includes('\0')||Buffer.byteLength(v.trim())>max||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v))fail('INVALID_TOPIC');return v.trim();};
export function pathFor(host,id){if(!['HOME','WORK'].includes(host)||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id||''))fail('INVALID_ID');return `${PREFIX}/${host}/${id}.json`;}
export function buildRequest(v,{now=new Date(),id=randomUUID()}={}){
 if(!v||typeof v!=='object'||Array.isArray(v))fail('INVALID_PLAN');
 const host=v.host||'HOME',mode=v.mode||'AUTO',full=v.collaboration==='FullRHP',skeptics=full||v.collaboration==='S';
 pathFor(host,id);if(!['AUTO','MIN','XHIGH','MAX'].includes(mode)||host==='WORK'&&['MIN','XHIGH'].includes(mode))fail('UNSUPPORTED_PROFILE');
 if(!['','S','FullRHP'].includes(v.collaboration||'')||!['','DEEP'].includes(v.depth||'')||typeof v.build!=='boolean')fail('INVALID_PLAN');
 let turns=100,seconds=43200;
 if(v.limit){let limit=v.limit;if(limit==='custom')limit=String(v.customLimit||'')+String(v.customUnit||'');const m=/^([1-9][0-9]*)([hms]?)$/.exec(limit);if(!m)fail('INVALID_LIMIT');if(m[2])seconds=integer(Number(m[1])*({h:3600,m:60,s:1}[m[2]]),null,1,43200);else turns=integer(m[1],null,1,100);}
 let target=null,projects=[];
 if(v.build){let project=String(v.buildProject||'').trim();if(project.toUpperCase()==='LISTENER')project='LISTENER';const name=String(v.buildPackage||'').trim();if(!/^[A-Za-z0-9_-]{1,40}$/.test(project)||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name)||typeof v.activate!=='boolean'||v.activate&&project!=='LISTENER')fail('INVALID_BUILD');target={project,package_name:name,activate:v.activate};if(project!=='LISTENER')projects=[project];}
 else if(v.activate)fail('INVALID_BUILD');
 const req={schema:'8zlistener.request.v5',request_id:id,target_host:host,action:target?'cli_loop_build':'cli_loop',topic:text(v.topic,65536),desired_output:'Uskladita uporabne izboljšave, ohranita nesoglasja in shranita preverljiv rezultat.',context:[],requested_at_utc:now.toISOString(),expires_utc:new Date(now.getTime()+7*86400000).toISOString(),max_duration_s:seconds,max_cli_turns:turns,profile:'design_high_standard',lang:'sl',projects,seed_files:[],effort_mode:mode,skeptics,build_requested:!!target,public:false,deep:v.depth==='DEEP',full_rhp:full,max_native_calls:integer(v.calls,160,1,400),max_tokens:v.tokens===''||v.tokens===undefined||v.tokens===null?null:integer(v.tokens,null,1,100000000),build_target:target};
 req.approval={plan_sha256:digest(canonical(req))};return req;
}
export function checkRequest(req,now=new Date()){
 if(!req||typeof req!=='object')fail('INVALID_PLAN');
 const v={host:req.target_host,mode:req.effort_mode,collaboration:req.full_rhp?'FullRHP':req.skeptics?'S':'',depth:req.deep?'DEEP':'',topic:req.topic,build:req.build_requested,activate:req.build_target?.activate||false,buildProject:req.build_target?.project,buildPackage:req.build_target?.package_name,calls:req.max_native_calls,tokens:req.max_tokens};
 const asked=new Date(req.requested_at_utc);if(!Number.isFinite(asked.getTime())||asked>now||now-asked>600000)fail('PREVIEW_EXPIRED',409);
 const expected=buildRequest(v,{now:asked,id:req.request_id});expected.max_cli_turns=integer(req.max_cli_turns,null,1,100);expected.max_duration_s=integer(req.max_duration_s,null,1,43200);delete expected.approval;expected.approval={plan_sha256:digest(canonical(expected))};
 if(canonical(expected)!==canonical(req))fail('PLAN_CHANGED',409);return req;
}
export function signingKey(encoded){try{const key=createPrivateKey({key:Buffer.from(encoded||'','base64'),type:'pkcs8',format:'der'});if(key.asymmetricKeyType!=='ed25519')throw Error();return key;}catch{fail('INBOX_NOT_CONFIGURED',503);}}
export const publicKey=key=>createPublicKey(key).export({type:'spki',format:'der'}).subarray(-32).toString('base64');
const planMessage=(req,actor)=>Buffer.from('8zlistener.plan.v1\0'+actor+'\0'+digest(canonical(req)));
export const planToken=(req,actor,key)=>sign(null,planMessage(req,actor),key).toString('base64');
export function confirmPlan(req,token,actor,key,now){checkRequest(req,now);let signature;try{signature=Buffer.from(token||'','base64');}catch{fail('PLAN_CHANGED',409);}if(!verify(null,planMessage(req,actor),createPublicKey(key),signature))fail('PLAN_CHANGED',409);}
export function envelope(req,key){const e={schema:'8zlistener.github.request.v1',repository:REPOSITORY,branch:BRANCH,path:pathFor(req.target_host,req.request_id),request_id:req.request_id,target_host:req.target_host,request_sha256:digest(canonical(req)),request_base64:Buffer.from(canonical(req)).toString('base64')};e.signature=sign(null,Buffer.from('8zlistener.github.request.v1\0'+canonical(e)),key).toString('base64');return e;}

export function githubClient(token,fetcher=fetch){
 if(!token)fail('INBOX_NOT_CONFIGURED',503);
 return async (path,{method='GET',body}={})=>{
  let r;try{r=await fetcher('https://api.github.com/repos/'+REPOSITORY+path,{method,redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});}catch{fail('GITHUB_UNAVAILABLE',503);}
  if(r.status===404)return null;if(!r.ok)fail(r.status===401||r.status===403?'GITHUB_AUTH_REQUIRED':r.status===409||r.status===422?'GITHUB_CONFLICT':'GITHUB_UNAVAILABLE',r.status===409||r.status===422?409:503);
  const raw=await r.text();if(Buffer.byteLength(raw)>2500000)fail('GITHUB_RESPONSE_TOO_LARGE',503);try{return JSON.parse(raw);}catch{fail('GITHUB_UNAVAILABLE',503);}
 };
}
export async function mailbox(api){const repo=await api('');if(repo?.private!==true||repo.full_name!==REPOSITORY)fail('PRIVATE_INBOX_REQUIRED',503);const branch=await api('/git/ref/heads/'+BRANCH);if(!branch?.object?.sha)fail('INBOX_BRANCH_MISSING',503);}
const encodedPath=p=>p.split('/').map(encodeURIComponent).join('/');
export async function readQueued(api,host,id){
 const path=pathFor(host,id),file=await api('/contents/'+encodedPath(path)+'?ref='+BRANCH);if(!file)return null;
 if(file.type!=='file'||file.encoding!=='base64'||typeof file.content!=='string'||!Number.isInteger(file.size)||file.size>1500000)fail('GITHUB_CONFLICT',409);
 const raw=Buffer.from(file.content.replace(/\s/g,''),'base64');if(raw.length!==file.size||createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex')!==file.sha)fail('GITHUB_CONFLICT',409);
 let e;try{e=JSON.parse(raw.toString('utf8'));}catch{fail('GITHUB_CONFLICT',409);}if(e.path!==path||e.request_id!==id||e.target_host!==host)fail('GITHUB_CONFLICT',409);
 return {file,e,raw};
}
export function verifyQueued(found,key){
 if(!found)fail('GITHUB_CONFLICT',409);
 try{const unsigned={...found.e};delete unsigned.signature;const raw=Buffer.from(unsigned.request_base64,'base64');const req=JSON.parse(raw.toString('utf8'));
  if(unsigned.schema!=='8zlistener.github.request.v1'||unsigned.repository!==REPOSITORY||unsigned.branch!==BRANCH||unsigned.path!==pathFor(unsigned.target_host,unsigned.request_id)||req.request_id!==unsigned.request_id||req.target_host!==unsigned.target_host||digest(raw)!==unsigned.request_sha256||canonical(req)!==raw.toString('utf8')||!verify(null,Buffer.from('8zlistener.github.request.v1\0'+canonical(unsigned)),createPublicKey(key),Buffer.from(found.e.signature||'','base64')))throw Error();
  return found;
 }catch{fail('GITHUB_CONFLICT',409);}
}
export function queuedReceipt(found,req,key){
 if(!found||canonical(envelope(req,key))!==found.raw.toString('utf8'))fail('GITHUB_CONFLICT',409);
 return {state:'QUEUED_GITHUB',request_id:req.request_id,target_host:req.target_host,request_sha256:found.e.request_sha256,blob_sha:found.file.sha,url:`https://github.com/${REPOSITORY}/blob/${BRANCH}/${found.e.path}`,execution:'NOT_YET_CONFIRMED'};
}
export async function submit(api,req,key){
 await mailbox(api);let found=await readQueued(api,req.target_host,req.request_id);if(found)return queuedReceipt(found,req,key);
 const e=envelope(req,key),raw=canonical(e),path=encodedPath(e.path);let writeError;
 try{await api('/contents/'+path,{method:'PUT',body:{branch:BRANCH,message:'Queue '+req.target_host+' LOOP '+req.request_id,content:Buffer.from(raw).toString('base64')}});}catch(error){writeError=error;}
 // Reconcile the same immutable path, including timeout/409; never issue another PUT here.
 try{found=await readQueued(api,req.target_host,req.request_id);}catch{fail('SUBMISSION_UNCERTAIN',503);}
 if(found)return queuedReceipt(found,req,key);
 if(writeError?.code==='GITHUB_AUTH_REQUIRED')throw writeError;
 fail('SUBMISSION_UNCERTAIN',503);
}
