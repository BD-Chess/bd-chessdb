/* 8Z Shield Sections wire format; executable Worker adaptation. No credentials. */
(() => {
  'use strict';
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const join=(...a)=>{const b=new Uint8Array(a.reduce((n,v)=>n+v.length,0));let p=0;for(const v of a){b.set(v,p);p+=v.length;}return b;};
  const sha=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',v));
  async function derive(passHash,salt){
    const seed=await sha(join(passHash,salt,new TextEncoder().encode('8Z_AUTH_V1'))),mask=(1n<<64n)-1n;
    let x=0n;for(const b of seed.slice(0,8))x=(x<<8n)|BigInt(b);x||=0x9E3779B97F4A7C15n;
    for(let i=0;i<1024;i++){x=(x^(x>>12n))&mask;x=(x^(x<<25n))&mask;x=(x^(x>>27n))&mask;}
    const state=new Uint8Array(8);for(let i=7;i>=0;i--){state[i]=Number(x&255n);x>>=8n;}
    const material=await crypto.subtle.importKey('raw',join(passHash,await sha(state)),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:500000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  }
  async function decrypt(payload,credential){
    if(payload?.schema!=='TripShieldWorkerV1'||payload.engine!=='bd-trip-browser-r1.2.0'||typeof payload.blob!=='string'||payload.blob.length>4000000)throw Error('Invalid encrypted Worker');
    const raw=bytes(payload.blob);if(raw.length<60)throw Error('Invalid encrypted Worker');
    const hash=Array.from(await sha(raw),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==payload.sha256)throw Error('Damaged encrypted Worker');
    const key=await derive(credential,raw.slice(0,32));
    const compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(32,44),tagLength:128},key,raw.slice(44));
    const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),chunks=[];let length=0;
    while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>8000000){await reader.cancel();throw Error('Worker size limit');}chunks.push(value);}
    return new Blob(chunks,{type:'text/javascript'});
  }
  window.TripShield=Object.freeze({decrypt,bytes});
})();
