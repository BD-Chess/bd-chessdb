/* 8Z Shield 1.1.0-rc1 · BD × AI Lab · 2026-09-18.
   New explicit envelope v4; legacy XS/KDF reader is in legacy.js.
   Envelope/key separation follows the supplied BD HTML Protector v3.0 donor.
   Standard Web Crypto primitives; not a new cipher or a security certification. */
(function(root){
'use strict';
const C = {};
const te=new TextEncoder();
const MAX_PLAIN=64*1024*1024, MAX_INPUT=32*1024*1024;
C.limits=Object.freeze({plain:MAX_PLAIN,input:MAX_INPUT,files:256,slots:8});
C.utf8=s=>te.encode(s);
C.text=b=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);
C.cat=(...a)=>{const out=new Uint8Array(a.reduce((n,b)=>n+b.length,0));let p=0;for(const b of a){out.set(b,p);p+=b.length;}return out;};
C.equal=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
C.hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
C.sha=async b=>new Uint8Array(await crypto.subtle.digest('SHA-256',typeof b==='string'?C.utf8(b):b));
C.random=n=>crypto.getRandomValues(new Uint8Array(n));
C.b64=b=>{let out='';for(let i=0;i<b.length;i+=16384)out+=String.fromCharCode(...b.subarray(i,i+16384));return btoa(out);};
C.unb64=(s,max=MAX_PLAIN)=>{
 if(typeof s!=='string'||s.length>Math.ceil(max/3)*4+4||s.length%4!==0||/[^A-Za-z0-9+/=]/.test(s)||s.indexOf('=')!==-1&&!/^[^=]*={1,2}$/.test(s))throw Error('Invalid or oversized base64');
 const t=atob(s);if(t.length>max)throw Error('Decoded data exceeds limit');return Uint8Array.from(t,c=>c.charCodeAt(0));
};
C.yield=()=>new Promise(r=>setTimeout(r,0));
C.transform=async(b,format,decompress=false,max=MAX_PLAIN)=>{
 const Klass=decompress?globalThis.DecompressionStream:globalThis.CompressionStream;
 if(!Klass)throw Error('This browser does not support '+(decompress?'decompression':'compression')+'. Use a current browser.');
 let stream;try{stream=new Blob([b]).stream().pipeThrough(new Klass(format));}catch(_){throw Error('Unsupported compression format: '+format);}
 const rd=stream.getReader(),chunks=[];let n=0;
 try{for(;;){const r=await rd.read();if(r.done)break;n+=r.value.length;if(n>max){await rd.cancel();throw Error('Expanded data exceeds the size limit');}chunks.push(r.value);}}finally{rd.releaseLock();}
 return C.cat(...chunks);
};
C.gzip=b=>C.transform(b,'gzip');C.gunzip=b=>C.transform(b,'gzip',true);
C.canonicalDomain=s=>{
 s=String(s||'').trim();if(!s)return '';
 if(/[\s|?#@\\]/.test(s))throw Error('Use a hostname or an HTTPS URL without credentials, query or fragment.');
 const u=new URL(s.includes('://')?s:'https://'+s);
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname)throw Error('Domain must be an HTTPS hostname without a port or credentials.');
 return u.hostname.toLowerCase().replace(/\.+$/,'');
};
C.escape=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
C.safeJSON=x=>JSON.stringify(x).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
C.requireCrypto=()=>{if(!globalThis.crypto?.subtle)throw Error('Web Crypto is unavailable. Open the file in a supported browser using HTTPS, localhost or a trusted local-file context.');};
function headerOf(h){
 if(!h||h.format!=='8ZShield'||h.version!==4||h.kdf!=='PBKDF2-HMAC-SHA256'||h.cipher!=='AES-256-GCM')throw Error('Unsupported Shield envelope/profile');
 if(!Number.isInteger(h.iterations)||h.iterations<600000||h.iterations>5000000)throw Error('Unsupported key-derivation cost');
 if(!['none','gzip'].includes(h.compression)||!['page','sections','bundle'].includes(h.kind))throw Error('Unsupported content type');
 if(typeof h.domain!=='string'||h.domain.length>253||C.canonicalDomain(h.domain)!==h.domain)throw Error('Invalid domain context');
 if(typeof h.id!=='string'||C.unb64(h.id,16).length!==16)throw Error('Invalid package identifier');
 return {format:h.format,version:4,kdf:h.kdf,cipher:h.cipher,iterations:h.iterations,domain:h.domain,id:h.id,compression:h.compression,kind:h.kind};
}
C.headerOf=headerOf;
const aad=(h,purpose)=>C.utf8(JSON.stringify(headerOf(h))+'\u0000'+purpose);
async function derive(password,salt,n,domain){
 if(typeof password!=='string'||!password.length||C.utf8(password).length>4096)throw Error('Invalid passphrase length');
 // Preserve every code point and space. Domain context has an unambiguous encoding.
 const material=C.utf8(JSON.stringify(['8ZShield-v4',password,domain]));
 const base=await crypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveKey']);material.fill(0);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:n,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function aes(raw){return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
C.validateEnvelope=e=>{
 const h=headerOf(e?.header);
 if(!Array.isArray(e.keys)||!e.keys.length||e.keys.length>C.limits.slots)throw Error('Invalid key slots');
 for(const k of e.keys){if(C.unb64(k.salt,32).length!==32||C.unb64(k.iv,12).length!==12||C.unb64(k.data,48).length!==48)throw Error('Invalid key slot');}
 if(C.unb64(e.iv,12).length!==12||typeof e.data!=='string'||e.data.length<24||e.data.length>Math.ceil((MAX_PLAIN+16)/3)*4)throw Error('Invalid payload');
 return h;
};
C.openEnvelope=async(e,password,check=()=>{})=>{
 C.requireCrypto();const h=C.validateEnvelope(e);let rawKey=null;
 for(let i=0;i<e.keys.length;i++){
  check();const s=e.keys[i];const kek=await derive(password,C.unb64(s.salt,32),h.iterations,h.domain);check();
  try{rawKey=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:C.unb64(s.iv,12),additionalData:aad(h,'wrap:'+i),tagLength:128},kek,C.unb64(s.data,48)));break;}catch(_){}
 }
 if(!rawKey)throw Error('Incorrect passphrase, wrong domain context or damaged file.');
 try{
  check();const key=await aes(rawKey);
  let bytes=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:C.unb64(e.iv,12),additionalData:aad(h,'content'),tagLength:128},key,C.unb64(e.data,MAX_PLAIN+16)));
  check();if(h.compression==='gzip')bytes=await C.gunzip(bytes);check();
  if(bytes.length>MAX_PLAIN)throw Error('Payload too large');
  const value=JSON.parse(C.text(bytes));
  if(!value||value.kind!==h.kind)throw Error('Content kind does not match envelope');
  return value;
 }finally{rawKey.fill(0);}
};
C.seal=async(value,passwords,{domain='',iterations=600000,compress=true,check=()=>{}}={})=>{
 C.requireCrypto();domain=C.canonicalDomain(domain);
 if(!Array.isArray(passwords)||!passwords.length||passwords.length>8||new Set(passwords).size!==passwords.length)throw Error('Supply 1–8 different passphrases');
 const plain=C.utf8(JSON.stringify(value));if(plain.length>MAX_PLAIN)throw Error('Payload exceeds the size limit');
 let encoded=plain,compression='none';
 if(compress&&globalThis.CompressionStream){check();const gz=await C.gzip(plain);if(gz.length+24<plain.length){encoded=gz;compression='gzip';}}
 const header=headerOf({format:'8ZShield',version:4,kdf:'PBKDF2-HMAC-SHA256',cipher:'AES-256-GCM',iterations,domain,id:C.b64(C.random(16)),compression,kind:value.kind});
 const cek=C.random(32),keys=[];
 try{
  for(let i=0;i<passwords.length;i++){
   check();const salt=C.random(32),iv=C.random(12),kek=await derive(passwords[i],salt,iterations,domain);check();
   const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(header,'wrap:'+i),tagLength:128},kek,cek));
   const verify=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(header,'wrap:'+i),tagLength:128},kek,data));
   if(!C.equal(cek,verify))throw Error('Key-wrap verification failed');verify.fill(0);
   keys.push({salt:C.b64(salt),iv:C.b64(iv),data:C.b64(data)});
  }
  const iv=C.random(12),key=await aes(cek);check();
  const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(header,'content'),tagLength:128},key,encoded));
  const env={header,keys,iv:C.b64(iv),data:C.b64(data)};
  // Independent reader path is exercised before accepting any build.
  const restored=await C.openEnvelope(env,passwords[0],check);
  if(JSON.stringify(restored)!==JSON.stringify(value))throw Error('Round-trip verification failed');
  check();return env;
 }finally{cek.fill(0);}
};
C.packEnvelope=e=>{const b=C.utf8(JSON.stringify(e)),n=new Uint8Array(4);new DataView(n.buffer).setUint32(0,b.length,true);return C.cat(C.utf8('8ZV4'),n,b);};
C.unpackEnvelope=b=>{
 b=new Uint8Array(b);if(b.length<8||C.text(b.slice(0,4))!=='8ZV4')throw Error('Not an 8ZV4 bundle');
 const n=new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(4,true);
 if(n!==b.length-8||n>96*1024*1024)throw Error('Invalid bundle length');
 const e=JSON.parse(C.text(b.subarray(8)));C.validateEnvelope(e);return e;
};
root.ShieldCore=C;if(typeof module!=='undefined'&&module.exports)module.exports=C;
})(globalThis);
