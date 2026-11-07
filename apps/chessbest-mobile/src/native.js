import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';

const native = Capacitor.isNativePlatform();
const PREFIX = 'ChessBest:APP:v1:';
const status = text => { const el=document.getElementById('nativeStatus'); if(el) el.textContent=text; };
let fileQueue = Promise.resolve();
export function safeName(name) { return String(name || 'ChessBest-export.txt').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120); }
async function shareBlob(blob, name) {
  if (!native) throw Error('Native Files/Share is available in the iPhone app.');
  if (blob.size > 32*1024*1024) throw Error('Export exceeds the 32 MB native transfer limit. Export a smaller selection.');
  const path='ChessBest-exports/'+Date.now()+'-'+safeName(name);
  const textual=/^(text\/|application\/(json|x-chess-pgn))/.test(blob.type);
  let data,encoding;
  if(textual) { data=await blob.text();encoding=Encoding.UTF8; }
  else {
    const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
    for(let at=0;at<bytes.length;at+=8192) binary+=String.fromCharCode(...bytes.subarray(at,at+8192));
    data=btoa(binary);
  }
  await Filesystem.writeFile({path,directory:Directory.Cache,data,encoding,recursive:true});
  try {
    const file=await Filesystem.getUri({path,directory:Directory.Cache});
    await Share.share({title:'ChessBest export',files:[file.uri],dialogTitle:'Save to Files or share'});
    status('Share sheet closed. Your original data remains in ChessBest; check Files for the saved copy.');
  } finally { await Filesystem.deleteFile({path,directory:Directory.Cache}).catch(()=>{}); }
}
function download(blob,name) {
  status('Preparing iOS share sheet…');
  const next=fileQueue.then(()=>shareBlob(blob,name)); fileQueue=next.catch(()=>{});
  next.catch(()=>status('Export was cancelled or could not be saved. Your original data remains.'));
  return next;
}
window.ChessNativeFiles={download};
// All donor export entrypoints create a Blob then call anchor.click(). Capture only
// those explicit downloads. No navigation, token, storage, or implicit upload hook.
const blobs=new Map(), createURL=URL.createObjectURL.bind(URL), revokeURL=URL.revokeObjectURL.bind(URL);
URL.createObjectURL = blob => { const url=createURL(blob); blobs.set(url,blob); return url; };
URL.revokeObjectURL = url => { blobs.delete(url); revokeURL(url); };
const click=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function () {
  if (this.download && blobs.has(this.href)) { void download(blobs.get(this.href),this.download); return; }
  return click.call(this);
};

// Preserve provider identity: only ChessDB is available for this private candidate.
// Relative web proxies and paid/credential providers are never redirected silently.
const originalFetch=window.fetch.bind(window);
window.fetch = function(input, options) {
  const url=new URL(typeof input==='string' || input instanceof URL ? String(input) : input.url,document.baseURI);
  if (url.pathname.startsWith('/.netlify/') || /(^|\.)lichess\.org$|(^|\.)anthropic\.com$|(^|\.)googleapis\.com$/.test(url.hostname))
    return Promise.reject(Error('Provider unavailable in this ChessBest native candidate'));
  if (window.__CHESSBEST_SMOKE__ && /^https?:$/.test(url.protocol) && url.origin!==location.origin)
    return Promise.reject(Error('Offline simulator probe'));
  return originalFetch(input,options);
};
let background=false;
async function pause() {
  background=true;
  try { await window.ChessNativeHost?.pause(); status('Analysis paused in the background. Resume explicitly when ready.'); }
  catch { status('A background checkpoint could not be confirmed. Check saved Studies and games before continuing.'); }
}
if (native) {
  App.addListener('appStateChange', ({isActive}) => { if(!isActive) void pause(); else { background=false; window.__CHESSBEST_BACKGROUND__=false; } });
  App.addListener('backButton', () => { document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); });
}
document.addEventListener('visibilitychange',()=> { if(document.hidden) void pause(); else window.__CHESSBEST_BACKGROUND__=false; });
window.addEventListener('pagehide',()=> { void pause(); });

async function deleteData() {
  if (!confirm('Delete all ChessBest APP studies, games, evidence and settings on this device? Export anything you want to retain first.')) return;
  await window.ChessNativeHost?.pause();
  // Reload rather than letting stores with cached handles write after deletion.
  // Deletion is completed before core boot on the next launch.
  localStorage.setItem(PREFIX+'delete-request','yes');
  location.reload();
}
window.addEventListener('DOMContentLoaded',()=> {
  const dialog=document.getElementById('nativePrivacy');
  document.getElementById('nativeInfo').onclick=()=>dialog.showModal();
  document.getElementById('nativeInfoClose').onclick=()=>dialog.close();
  document.getElementById('nativeDelete').onclick=()=>deleteData().catch(()=>status('Deletion could not be started. Data was retained.'));
  document.getElementById('nativeBack').onclick=()=> { document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); };
  document.addEventListener('click',e=> {
    const a=e.target.closest?.('a[href]'); if(!a || a.download) return;
    const url=new URL(a.href,document.baseURI);
    if(url.origin===location.origin && url.pathname===location.pathname) return;
    if(url.origin===location.origin && /(?:8zc-|facts|games-info).*\.html$/.test(url.pathname)) {
      e.preventDefault();
      originalFetch(url.href).then(r=>r.text()).then(html=> {
        const doc=new DOMParser().parseFromString(html,'text/html');
        const body=doc.querySelector('main')||doc.body;
        const content=document.getElementById('nativeHelpContent');
        content.replaceChildren();
        // Imported static donor help is rendered without scripts, navigation or forms.
        body.querySelectorAll('script,header,nav,form,iframe').forEach(n=>n.remove());
        for(const el of body.querySelectorAll('*')) for(const attr of [...el.attributes]) if(/^on/i.test(attr.name)) el.removeAttribute(attr.name);
        content.append(...body.childNodes); const help=document.getElementById('nativeHelp');
        if(!help.open) help.showModal();
        if(url.hash) content.querySelector('#'+CSS.escape(decodeURIComponent(url.hash.slice(1))))?.scrollIntoView();
      }).catch(()=>status('Bundled help could not be opened.'));
    } else if(url.origin===location.origin && (url.pathname.includes('/vendor/stockfish/') || url.pathname.endsWith('.LICENSE.md'))) {
      e.preventDefault();
      originalFetch(url.href).then(async response=> {
        if(!response.ok) throw Error('Missing bundled source');
        if(/\.(zip|nnue)$/.test(url.pathname)) return download(await response.blob(),url.pathname.split('/').pop());
        const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.textContent=await response.text();
        document.getElementById('nativeHelpContent').replaceChildren(pre);
        const help=document.getElementById('nativeHelp');if(!help.open)help.showModal();
      }).catch(()=>status('Bundled notice or source could not be opened.'));
    } else if(/^https:$/.test(url.protocol)) { e.preventDefault(); if(native) void Browser.open({url:url.href}); else status('External website: '+url.hostname); }
    else if(url.protocol!=='mailto:') e.preventDefault();
  });
  document.getElementById('nativeHelpClose').onclick=()=>document.getElementById('nativeHelp').close();
});
