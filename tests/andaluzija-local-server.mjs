/* Isolated acceptance harness: in-memory conditional object storage, synthetic auth.
 * It never opens a Netlify store or calls a paid provider. */
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {makeStateHandler,namespace} from '../functions/andaluzija-state.mjs';
import {makeTripAuth,tripActor,tripCookie} from '../functions/lib/andaluzija-access.mjs';
import '../public/BD/O/izleti/andaluzija-shield-core.js';
export const TEST_PASSWORD='synthetic-acceptance-only';
process.env.MDLXDCC_GUIDE_SESSION_SECRET='synthetic-isolated-session-secret-'.repeat(3);
process.env.MDLXDCC_GUIDE_OWNER_EMAIL='synthetic@example.invalid';
export class MemoryBlobs{
 constructor(){this.data=null;this.etag=null;this.sequence=0;this.afterRead=null;}
 async getWithMetadata(_key,opts){if(opts.consistency!=='strong')throw Error('STRONG_READ_REQUIRED');const r=this.data?{data:structuredClone(this.data),etag:this.etag}:null;if(this.afterRead)await this.afterRead();return r;}
 async setJSON(_key,value,opts){
  if(!(opts.onlyIfNew&&!this.data)&&!(opts.onlyIfMatch&&opts.onlyIfMatch===this.etag))return {modified:false};
  this.data=structuredClone(value);this.etag='"synthetic-'+(++this.sequence)+'"';return {modified:true,etag:this.etag};
 }
}
export const memory=new MemoryBlobs();
export const extraHandlers=new Map();
const context={site:{name:'mdlxdcc'},deploy:{context:'dev',id:'isolated-acceptance'}};
const handler=makeStateHandler({openStore:async()=>memory});
const auth=makeTripAuth({verify:async p=>p===TEST_PASSWORD});
const root=resolve('public'),mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
let privateEnvelope;
async function syntheticPrivate(){
 if(!privateEnvelope){
  if(process.env.ANDALUZIJA_TEST_ENVELOPE){privateEnvelope=JSON.parse(await readFile(process.env.ANDALUZIJA_TEST_ENVELOPE,'utf8'));return privateEnvelope;}
  if(process.env.ANDALUZIJA_PRIVATE_FIXTURE){const value=JSON.parse(await readFile(process.env.ANDALUZIJA_PRIVATE_FIXTURE,'utf8'));value.sections.potrjeno=value.sections.potrjeno.replace('</section>','<p>SYNTHETIC_PRIVATE_MARKER</p></section>');privateEnvelope=await ShieldCore.seal(value,[TEST_PASSWORD],{domain:'www.mdlxdcc.org'});return privateEnvelope;}
  const raw=await readFile(root+'/BD/O/izleti/andaluzija-2027-data.js','utf8');const data=JSON.parse(raw.slice(raw.indexOf('{')).trim().replace(/;$/,''));
  data.trip={startDate:'2030-01-01',endDate:'2030-01-10',flightTimesVerified:false};data.bookings=[];data.purchase={flights:{passengers:3,totalEur:0}};
  privateEnvelope=await ShieldCore.seal({kind:'sections',schema:'andaluzija-private-content-v1',tripId:'andaluzija-2027',data,sections:{potrjeno:'<section id="potrjeno"><p>SYNTHETIC_PRIVATE_MARKER</p></section>'}},[TEST_PASSWORD],{domain:'www.mdlxdcc.org'});
 }return privateEnvelope;
}
export const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://'+req.headers.host);let result;
  if(url.pathname.startsWith('/.netlify/functions/')){
   const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);
   const request=new Request(url,{method:req.method,headers:req.headers,...(req.method!=='GET'&&req.method!=='HEAD'?{body}:{} )});
   result=extraHandlers.has(url.pathname)?await extraHandlers.get(url.pathname)(request,context):url.pathname.endsWith('andaluzija-auth')?await auth(request,context):url.pathname.endsWith('andaluzija-state')?await handler(request,context):new Response('{}',{status:503});
   res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));return;
  }
  if(url.pathname.endsWith('/andaluzija-private.8zs.json')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await syntheticPrivate()));return;}
  const file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+'/'))throw Error('FORBIDDEN');
  if(!(await stat(file)).isFile())throw Error('NOT_FILE');res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
});
if(process.argv[1]?.endsWith('andaluzija-local-server.mjs'))server.listen(8765,'127.0.0.1',()=>console.log('ISOLATED_ACCEPTANCE_SERVER 8765'));
