// The official Identity client runs on its own Netlify origin. The existing app
// receives only a verified DualFrame bearer session through this bounded bridge.
export const ACCOUNT_ORIGIN='https://www.mdlxdcc.org';
export const ACCOUNT_SESSION_TYPE='dualframe-account-session';
const OPENERS=new Set([ACCOUNT_ORIGIN,'https://mdlxdcc.org','https://bd-chess.github.io']);
const NONCE=/^[a-zA-Z0-9_-]{32,128}$/,OWNER=/^[a-zA-Z0-9_-]{8,100}$/;
const fail=code=>{throw Error(code);};

export function parseAccountBridge(href){
 let url;try{url=new URL(href);}catch{fail('ACCOUNT_BRIDGE_INVALID');}
 if(url.origin!==ACCOUNT_ORIGIN||url.username||url.password||url.pathname!=='/Nara/dualframe-lab/account-login.html'||url.hash)fail('ACCOUNT_BRIDGE_ORIGIN_INVALID');
 const allowed=new Set(['opener_origin','nonce','lang']);
 if([...url.searchParams.keys()].some(key=>!allowed.has(key))||url.searchParams.getAll('opener_origin').length!==1||url.searchParams.getAll('nonce').length!==1||url.searchParams.getAll('lang').length>1)fail('ACCOUNT_BRIDGE_INVALID');
 const openerOrigin=url.searchParams.get('opener_origin'),nonce=url.searchParams.get('nonce');
 if(!OPENERS.has(openerOrigin)||!NONCE.test(nonce||''))fail('ACCOUNT_BRIDGE_INVALID');
 return Object.freeze({openerOrigin,nonce,language:url.searchParams.get('lang')==='sl'?'sl':'en'});
}
export function validateAccountSession(value,now=Date.now()){
 if(!value||typeof value.token!=='string'||!/^[a-zA-Z0-9_.-]{32,2500}$/.test(value.token)||!OWNER.test(value.owner||'')||value.auth_method!=='verified-account'||value.admin!==false||value.paid_entitlement!==0||!['restricted','public'].includes(value.account_access))fail('ACCOUNT_SESSION_INVALID');
 const expiry=Date.parse(value.expires_at);if(!Number.isFinite(expiry)||expiry<=now||expiry>now+31*86400000)fail('ACCOUNT_SESSION_INVALID');
 return {token:value.token,expires_at:value.expires_at,owner:value.owner,auth_method:value.auth_method,admin:false,paid_entitlement:0,account_access:value.account_access};
}
export async function exchangeAccountSession({fetcher=fetch,now=Date.now()}={}){
 const response=await fetcher(ACCOUNT_ORIGIN+'/api/df/auth/account',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:'{}',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
 let value;try{value=await response.json();}catch{fail('ACCOUNT_EXCHANGE_FAILED');}
 if(!response.ok)fail(/^[A-Z0-9_]{1,80}$/.test(value?.error||'')?value.error:'ACCOUNT_EXCHANGE_FAILED');
 return validateAccountSession(value,now);
}
export function sendAccountSession(opener,bridge,session){
 if(!opener||opener.closed||typeof opener.postMessage!=='function')fail('ACCOUNT_OPENER_CLOSED');
 if(!OPENERS.has(bridge?.openerOrigin)||!NONCE.test(bridge?.nonce||''))fail('ACCOUNT_BRIDGE_INVALID');
 opener.postMessage({type:ACCOUNT_SESSION_TYPE,nonce:bridge.nonce,session:validateAccountSession(session)},bridge.openerOrigin);
}
export async function authenticateAccount({email,password,sdk,fetcher=fetch}={}){
 if(typeof email!=='string'||email.length>254||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(email.trim())||typeof password!=='string'||!password||password.length>1000)fail('ACCOUNT_CREDENTIALS_REQUIRED');
 if(typeof sdk?.login!=='function')fail('IDENTITY_NOT_CONFIGURED');
 try{if(!await sdk.login(email.trim(),password))fail('ACCOUNT_SIGN_IN_FAILED');}catch{fail('ACCOUNT_SIGN_IN_FAILED');}
 // User-editable email, metadata and roles never establish DualFrame ownership.
 return exchangeAccountSession({fetcher});
}

const COPY={
 en:{title:'Account sign-in',intro:"Sign in to connect this account's private image library.",email:'Email',password:'Password',signIn:'Sign in',existing:'Use the account already signed in here',registration:'Registration is currently unavailable.',close:'Close',checking:'Checking account sign-in availability…',ready:'Use your existing account. Your private library remains separate from other accounts.',busy:'Signing in…',done:'Account connected. You can close this window.',blocked:'Account sign-in is not available yet. Close this window to use the existing private access.',invalid:'Open account sign-in from DualFrame AI.',opener:'The original DualFrame window is closed. Start sign-in from that window again.',failed:'Sign-in failed. Check your email and password, then try again.',unverified:'Confirm your email before signing in.',network:'Could not connect. Close this window and try again later.'},
 sl:{title:'Prijava z računom',intro:'Prijavi se za dostop do zasebne zbirke slik tega računa.',email:'E-pošta',password:'Geslo',signIn:'Prijavi se',existing:'Uporabi račun, ki je tukaj že prijavljen',registration:'Registracija trenutno ni na voljo.',close:'Zapri',checking:'Preverjam možnost prijave…',ready:'Uporabi obstoječi račun. Tvoja zasebna zbirka ostane ločena od drugih računov.',busy:'Prijavljam…',done:'Račun je povezan. To okno lahko zapreš.',blocked:'Prijava z računom še ni omogočena. Zapri to okno za obstoječi zasebni dostop.',invalid:'Prijavo odpri iz aplikacije DualFrame AI.',opener:'Izvorno okno DualFrame je zaprto. Ponovno začni prijavo v njem.',failed:'Prijava ni uspela. Preveri e-pošto in geslo ter poskusi znova.',unverified:'Pred prijavo potrdi svoj e-poštni naslov.',network:'Povezava ni uspela. Zapri to okno in poskusi pozneje.'}
};
async function boot(){
 const $=id=>document.getElementById(id);let bridge,sdk,language='en',busy=false,status='checking';
 const paint=()=>{document.documentElement.lang=language;document.querySelectorAll('[data-copy]').forEach(node=>node.textContent=COPY[language][node.dataset.copy]);$('account-language').textContent=language==='en'?'SL':'EN';$('account-status').textContent=COPY[language][status];};
 const show=key=>{status=key;paint();};
 const errorStatus=error=>{const code=error?.message||'';if(code==='ACCOUNT_OPENER_CLOSED')return 'opener';if(code.startsWith('ACCOUNT_BRIDGE'))return 'invalid';if(['ACCOUNT_EMAIL_UNVERIFIED','ACCOUNT_EMAIL_CONFIRMATION_REQUIRED'].includes(code))return 'unverified';if(['PUBLIC_ENABLEMENT_HELD','IDENTITY_NOT_CONFIGURED','IDENTITY_CONFIGURATION_UNVERIFIED','IDENTITY_ISSUER_MISMATCH','ACCOUNT_IDENTITY_UNVERIFIED'].includes(code))return 'blocked';return code==='ACCOUNT_SIGN_IN_FAILED'||code==='ACCOUNT_CREDENTIALS_REQUIRED'?'failed':'network';};
 const opener=()=>{if(!window.opener||window.opener.closed)fail('ACCOUNT_OPENER_CLOSED');return window.opener;};
 const finish=session=>{sendAccountSession(opener(),bridge,session);$('account-form').hidden=true;$('account-existing').hidden=true;show('done');};
 const perform=async action=>{if(busy)return;busy=true;$('account-submit').disabled=true;$('account-existing').disabled=true;show('busy');try{opener();finish(await action());}catch(error){show(errorStatus(error));}finally{busy=false;$('account-password').value='';$('account-submit').disabled=false;$('account-existing').disabled=false;}};
 $('account-language').addEventListener('click',()=>{language=language==='en'?'sl':'en';paint();});$('account-close').addEventListener('click',()=>window.close());
 $('account-form').addEventListener('submit',event=>{event.preventDefault();perform(()=>authenticateAccount({email:$('account-email').value,password:$('account-password').value,sdk}));});
 $('account-existing').addEventListener('click',()=>perform(()=>exchangeAccountSession()));
 try{
  bridge=parseAccountBridge(location.href);language=bridge.language;opener();paint();
  const response=await fetch(ACCOUNT_ORIGIN+'/api/df/capabilities',{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  const capabilities=await response.json();if(!response.ok||capabilities.account_identity?.configured!==true)fail('PUBLIC_ENABLEMENT_HELD');
  sdk=await import('./vendor/netlify-identity-2.0.0.mjs');
  // No callback token is accepted by this bridge URL; the official callback
  // handler is still initialized so client SDK behavior remains explicit.
  await sdk.handleAuthCallback();const settings=await sdk.getSettings();
  if(settings.autoconfirm!==false)fail('ACCOUNT_EMAIL_CONFIRMATION_REQUIRED');
  if(settings.providers?.email!==true)fail('IDENTITY_NOT_CONFIGURED');
  $('account-form').hidden=false;$('account-submit').disabled=false;
  try{if(await sdk.getUser())$('account-existing').hidden=false;}catch{}
  show('ready');$('account-email').focus();
 }catch(error){show(errorStatus(error));$('account-form').hidden=true;$('account-existing').hidden=true;}
}
if(typeof window!=='undefined'&&typeof document!=='undefined')boot();
