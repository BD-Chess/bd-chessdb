import {authenticate,env} from './lib/mdlxdcc-guide/access.mjs';
import {buildRequest,canonical,digest,signingKey,publicKey,planToken,confirmPlan,githubClient,mailbox,readQueued,verifyQueued,submit,fail} from './lib/cli-loops-inbox.mjs';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(value,status=200)=>Response.json(value,{status,headers});
export function makeInboxHandler({auth=authenticate,getEnv=env,fetcher=fetch,now=()=>new Date()}={}){
 return async (req,context={})=>{
  if(context.site?.name&&context.site.name!=='mdlxdcc')return json({error:{code:'SITE_UNAVAILABLE'}},404);
  if(!['GET','POST'].includes(req.method))return json({error:{code:'METHOD_NOT_ALLOWED'}},405);
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')return json({error:{code:'ORIGIN_NOT_ALLOWED'}},403);
  try{
   let actor;try{actor=await auth(req);}catch(error){if(error.code==='AUTH_REQUIRED')return json({authenticated:false,error:{code:'AUTH_REQUIRED'}},401);throw error;}
   if(actor.role!=='owner')fail('OWNER_REQUIRED',403);
   const configured=!!getEnv('CLI_LOOPS_GITHUB_TOKEN')&&!!getEnv('CLI_LOOPS_INBOX_SIGNING_KEY');
   if(req.method==='GET'){
    const query=new URL(req.url).searchParams;
    if(query.get('action')==='status'){
     const api=githubClient(getEnv('CLI_LOOPS_GITHUB_TOKEN'),fetcher);await mailbox(api);const found=await readQueued(api,query.get('host'),query.get('request_id'));
     if(found)verifyQueued(found,signingKey(getEnv('CLI_LOOPS_INBOX_SIGNING_KEY')));
     return json(found?{state:'FOUND_GITHUB',request_id:found.e.request_id,target_host:found.e.target_host,request_sha256:found.e.request_sha256,blob_sha:found.file.sha,execution:'NOT_YET_CONFIRMED'}:{state:'NOT_FOUND',execution:'NOT_YET_CONFIRMED'});
    }
    return json({authenticated:true,configured,transport:'GITHUB',...(configured?{public_key:publicKey(signingKey(getEnv('CLI_LOOPS_INBOX_SIGNING_KEY')))}:{})});
   }
   if(!req.headers.get('content-type')?.startsWith('application/json'))fail('INVALID_JSON',415);
   const raw=await req.text();if(Buffer.byteLength(raw)>250000)fail('REQUEST_TOO_LARGE',413);let body;try{body=JSON.parse(raw);}catch{fail('INVALID_JSON');}
   const key=signingKey(getEnv('CLI_LOOPS_INBOX_SIGNING_KEY'));
   if(body.action==='preview'){const request=buildRequest(body.values,{now:now()});return json({request,plan_sha256:request.approval.plan_sha256,request_sha256:digest(canonical(request)),confirmation:planToken(request,actor.id,key)});}
   if(body.action!=='submit')fail('INVALID_ACTION');confirmPlan(body.request,body.confirmation,actor.id,key,now());
   return json(await submit(githubClient(getEnv('CLI_LOOPS_GITHUB_TOKEN'),fetcher),body.request,key));
  }catch(error){const code=typeof error.code==='string'&&/^[A-Z_]+$/.test(error.code)?error.code:'INBOX_UNAVAILABLE';return json({error:{code}},Number.isInteger(error.status)&&error.status>=400&&error.status<=503?error.status:503);}
 };
}
export default makeInboxHandler();
export const config={rateLimit:{windowLimit:24,windowSize:60,aggregateBy:['ip','domain']}};
