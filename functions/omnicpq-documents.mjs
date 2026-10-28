import {createHash} from 'node:crypto';
import {authenticate} from './lib/mdlxdcc-guide/access.mjs';
import {readPrivateDocument,verifyDocuments,documentStore,DOCUMENT_KEY,DOCUMENT_MANIFEST} from './lib/omnicpq/private-documents.mjs';
import {renderVisualGuide,readVisualAsset,isVisualAsset,VISUAL_GUIDE_NAMES} from './lib/omnicpq/visual-documents.mjs';
import {readLearning,verifyLearning,enrichGuide,LEARNING_KEY,LEARNING_NAME,LEARNING_MANIFEST} from './lib/omnicpq/learning.mjs';
import {RELEASE_DOCUMENT_MANIFEST,resolveReleaseName,verifyReleaseDocuments,readReleaseDocument,protectedReleaseRendition} from './lib/omnicpq/private-release.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store',
  Vary:'Cookie, Origin','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'};
const deny=(status,text)=>new Response(text,{status,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
export function makeDocumentHandler({auth=authenticate,reader,storeFactory=documentStore,expected=DOCUMENT_MANIFEST,visualRenderer=renderVisualGuide,learningReader,learningExpected=LEARNING_MANIFEST,enrich=false,currentRelease=null,currentReader}={}){
  return async(req,context={})=>{
    if(context.site?.name&&context.site.name!=='mdlxdcc')return deny(404,'Dokumenti niso na voljo.');
    if(!['GET','HEAD','POST'].includes(req.method))return deny(405,'Metoda ni podprta.');
    const url=new URL(req.url);
    if(req.headers.get('origin')&&req.headers.get('origin')!==url.origin||req.headers.get('sec-fetch-site')==='cross-site')return deny(403,'Dostop z drugega mesta ni dovoljen.');
    let actor;try{actor=await auth(req);}catch(e){return deny(e.code==='AUTH_REQUIRED'?401:503,'Za ogled se prijavi v pomočniku OmniCPQ.');}
    if(actor?.role!=='owner')return deny(403,'Dokumenti so na voljo lastniku pomočnika.');
    if(req.method==='POST'){
      if(url.origin!=='https://www.mdlxdcc.org'||req.headers.get('origin')!==url.origin||!req.headers.get('content-type')?.startsWith('application/json'))return deny(403,'Uvoz zahteva lastniški isti izvor.');
      // Exact immutable release only. No caller-chosen key or overwrite of another release.
      try{
        if(Number(req.headers.get('content-length'))>1000000)return deny(413,'Paket je prevelik.');
        const text=await req.text(),data=JSON.parse(text),isLearning=data.schema==='omnicpq.learning.v1',isCurrent=currentRelease&&data.documentVersion===currentRelease.documentVersion;
        if(isLearning)verifyLearning(text,learningExpected);else if(isCurrent)verifyReleaseDocuments(text,currentRelease);else verifyDocuments(text,expected);
        const key=isLearning?LEARNING_KEY:isCurrent?'v18/'+currentRelease.bundleSha256+'.json':DOCUMENT_KEY;
        const store=await storeFactory();const old=await store.get(key,{type:'text',consistency:'strong'});
        if(old!==null&&old!==text)return deny(409,'Obstoječi zapis zahteva ločen pregled.');
        if(old===null)await store.set(key,text,{onlyIfNew:true});
        if(await store.get(key,{type:'text',consistency:'strong'})!==text)return deny(503,'Shranitve ni mogoče potrditi.');
        return new Response(JSON.stringify({status:'PRIVATE_STORAGE_SEEDED',version:isLearning?learningExpected.version:isCurrent?currentRelease.documentVersion:'v17',sha256:isLearning?learningExpected.sha256:isCurrent?currentRelease.bundleSha256:expected.bundleSha256}),{headers:{...headers,'Content-Type':'application/json'}});
      }catch{return deny(503,'Paket ni preverjen ali zasebna shramba ni dosegljiva.');}
    }
    const name=url.searchParams.get('file')||'b2b-pokritost-v17.html';
    const currentName=currentRelease&&resolveReleaseName(name,currentRelease);
    const baseName=VISUAL_GUIDE_NAMES.has(name)?'b2b-vodic-v17.html':name;
    if(name!==LEARNING_NAME&&!isVisualAsset(name)&&!currentName&&!Object.hasOwn(expected.files,baseName))return deny(404,'Dokument ne obstaja.');
    let item;try{
      if(currentName)item=protectedReleaseRendition(await readReleaseDocument(currentName,{reader:currentReader,expected:currentRelease}));
      else if(name===LEARNING_NAME)item=await readLearning({reader:learningReader,expected:learningExpected});
      else if(isVisualAsset(name))item=readVisualAsset(name);
      else{
        item=await readPrivateDocument(baseName,{reader,expected});
        if(VISUAL_GUIDE_NAMES.has(name)){
          item=visualRenderer(item);
          if(enrich){let learning=null;try{learning=(await readLearning({reader:learningReader,expected:learningExpected})).data;}catch{/* Explicit partial coverage is rendered, never invented. */}item=enrichGuide(item,learning);}
        }
      }
    }catch{return deny(503,'Dokument ali njegova zasebna vsebina trenutno nista dosegljiva.');}
    const h={...headers,'Content-Type':item.mime,'Content-Length':String(item.bytes.length),'X-Document-SHA256':item.sha256,
      'Content-Disposition':`${name.endsWith('.html')||item.mime==='image/webp'?'inline':'attachment'}; filename="${name.split('/').at(-1)}"`};
    if(item.version)h['X-Document-Version']=item.version;
    if(name.endsWith('.html')){
      const scripts=[...item.bytes.toString('utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>"'sha256-"+createHash('sha256').update(m[1]).digest('base64')+"'");
      if(!scripts.length)return deny(503,'Dokumenta ni mogoče preveriti.');
      h['Content-Security-Policy']=`default-src 'none'; script-src ${scripts.join(' ')}; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`;
    }
    return new Response(req.method==='HEAD'?null:item.bytes,{headers:h});
  };
}
export default makeDocumentHandler({enrich:true,currentRelease:RELEASE_DOCUMENT_MANIFEST});
