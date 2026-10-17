export function fromBase64(value){
 if(typeof value!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error('CMARVEL_BASE64_INVALID');
 const binary=atob(value);return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
export function validComicPath(value){
 return typeof value==='string'&&value.length>0&&/^[A-Za-z0-9_./-]+$/.test(value)&&!value.startsWith('/')&&!value.split('/').some(part=>!part||part==='.'||part==='..');
}
export function validateComicManifest(value){
 if(value?.schema!=='bd.dfc.protected-comic.v1'||value.story_id!=='CMARVEL_01'||value.version!==1||value.protection!=='PBKDF2-SHA-256 + AES-256-GCM'||value.iterations<600000||value.pages?.length!==11)throw Error('CMARVEL_MANIFEST_INVALID');
 fromBase64(value.salt);
 for(let i=0;i<value.pages.length;i++){
  const p=value.pages[i],id=`CM_${String(i+1).padStart(2,'0')}`;
  if(p.page_id!==id||p.file!==`assets/${id}.webp.enc`||!validComicPath(p.file)||p.mime!=='image/webp'||p.width_px!==3840||p.height_px!==2160||!Number.isInteger(p.cipher_bytes)||p.cipher_bytes<16||!/^[a-f0-9]{64}$/.test(p.cipher_sha256)||p.aad!==`DFC-CMARVEL-01:v1:${id}.webp`)throw Error('CMARVEL_PAGE_INVALID');
  if(fromBase64(p.iv).length!==12)throw Error('CMARVEL_IV_INVALID');
 }
 return value;
}
export async function deriveComicKey(passphrase,salt,iterations=600000,subtle=globalThis.crypto?.subtle){
 if(!subtle||typeof passphrase!=='string'||!passphrase||!Number.isInteger(iterations)||iterations<1)throw Error('CMARVEL_KEY_INPUT_INVALID');
 const material=await subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
 return subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:typeof salt==='string'?fromBase64(salt):salt,iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
}
export async function decryptComicBytes(ciphertext,key,page,subtle=globalThis.crypto?.subtle){
 return new Uint8Array(await subtle.decrypt({name:'AES-GCM',iv:fromBase64(page.iv),additionalData:new TextEncoder().encode(page.aad)},key,ciphertext));
}
