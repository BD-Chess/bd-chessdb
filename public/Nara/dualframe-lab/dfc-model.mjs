// Adapted from the reviewed H2 scaffold geometry/state model. No Photos storage.
export const STORY_ID='ILLUMINARA_TEZA_SVETLOBE_01';
export const SOURCE={h1:'b2f2bf9972f53561849cd7394eda1e3e81026059c3f806c9caca0209b78b9a4d',catalog:'199d871797376f3e1be5e6d32c19742048bdb0c2626d8c1e60308af8ec6b7d50',dialogue:'23182c58147c65078b7860a695e2fa0d1ed233d8f02226d734c3e28163eed28c',contract:'461cd7cbfb7f8cee9db3c1734414e07a36664aef14c075a43f54cb187af7b06d'};
export const PANEL_IDS=[6,5,5,5,4,5,5,4].flatMap((n,p)=>Array.from({length:n},(_,k)=>`P${String(p+1).padStart(2,'0')}-K${String(k+1).padStart(2,'0')}`));
export const storageKey=`bd.dfc.reader.v1:${STORY_ID}`;
export function safePath(value){
 if(typeof value!=='string'||!value||value.length>240||!/^[-A-Za-z0-9_./]+$/.test(value)||value.startsWith('/')||value.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('DFC_UNSAFE_PATH');
 return value;
}
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
export async function digest(data){const bytes=typeof data==='string'?new TextEncoder().encode(data):data instanceof Blob?await data.arrayBuffer():data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function assert(condition,reason){if(!condition)throw Error('DFC_'+reason);}
export function rectValid(r){return Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>=0&&r[2]>0&&r[3]>0&&r[0]+r[2]<=1.000002&&r[1]+r[3]<=1.000002;}
export function pointInPolygon({x,y},polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/((b[1]-a[1])||Number.EPSILON)+a[0])inside=!inside;}return inside;}
export function imageContentRect(box,width,height){const scale=Math.min(box.width/width,box.height/height),w=width*scale,h=height*scale;return {left:box.left+(box.width-w)/2,top:box.top+(box.height-h)/2,width:w,height:h};}
export function pointerToNorm(rect,x,y){if(!rect.width||!rect.height||x<rect.left||x>rect.left+rect.width||y<rect.top||y>rect.top+rect.height)return null;return {x:(x-rect.left)/rect.width,y:(y-rect.top)/rect.height};}
export function hitTest(edition,pageId,x,y,language){return edition.panels.filter(p=>p.page_id===pageId&&pointInPolygon({x,y},p.hotspots[language].polygon_norm)).sort((a,b)=>b.hotspots[language].z_order-a.hotspots[language].z_order)[0]||null;}
export function normalizeDialogue(catalog,dialogue){
 const owners=new Map();for(const p of catalog.panels)for(const id of p.text_ids){assert(id.startsWith(p.panel_id+'-T')&&!owners.has(id),'DIALOGUE_OWNERSHIP');owners.set(id,p.panel_id);}
 assert(Array.isArray(dialogue.records)&&owners.size===dialogue.records.length,'DIALOGUE_COUNT');
 const ids=new Set();const records=dialogue.records.map(r=>{const id=owners.get(r.text_id);assert(id&&!ids.has(r.text_id)&&(!r.panel_id||r.panel_id===id),'DIALOGUE_ID');ids.add(r.text_id);assert(typeof r.SL==='string'&&typeof r.EN==='string'&&typeof r.speaker==='string'&&Number.isInteger(r.order),'DIALOGUE_RECORD');return {...r,panel_id:id};});
 for(const p of catalog.panels){const ordered=records.filter(r=>r.panel_id===p.panel_id).sort((a,b)=>a.order-b.order);assert(canonical(ordered.map(r=>r.text_id))===canonical(p.text_ids),'DIALOGUE_ORDER');}
 return records;
}
export function storyState(panel,records){return {panel_id:panel.panel_id,page_id:panel.page_id,reading_order:panel.reading_order,story_beat:panel.story_beat,protected_story_facts:panel.protected_story_facts,dialogue:records.filter(r=>r.panel_id===panel.panel_id).sort((a,b)=>a.order-b.order)};}
export function validateEdition(e){
 assert(e?.schema==='bd.dfc.web-edition.v1'&&e.story_id===STORY_ID,'EDITION');
 for(const [k,v]of Object.entries(SOURCE))assert(e.source?.[k]===v,'SOURCE_'+k.toUpperCase());
 assert(e.pages?.length===8&&e.panels?.length===39,'COUNTS');
 const paths=new Map();const asset=a=>{assert(a&&/^[a-f0-9]{64}$/.test(a.sha256)&&Number.isInteger(a.width_px)&&a.width_px>0&&Number.isInteger(a.height_px)&&a.height_px>0,'ASSET');safePath(a.file);if(paths.has(a.file))assert(paths.get(a.file)===a.sha256,'PATH_COLLISION');paths.set(a.file,a.sha256);};
 for(const [i,p]of e.pages.entries()){assert(p.page_id===`P${String(i+1).padStart(2,'0')}`&&p.reading_order===i+1,'PAGE_ORDER');for(const l of ['SL','EN']){asset(p.overview_assets[l]);assert(p.overview_assets[l].width_px===1024&&p.overview_assets[l].height_px===1660,'OVERVIEW_DIMENSIONS');}}
 let paired=0;for(const [i,p]of e.panels.entries()){
  assert(p.panel_id===PANEL_IDS[i]&&p.reading_order===i+1&&p.page_id===p.panel_id.slice(0,3),'PANEL_ORDER');asset(p.source_zoom);assert(p.readiness?.overview_ready&&p.readiness?.source_zoom_ready,'SOURCE_READINESS');
  assert(Array.isArray(p.dialogue)&&canonical(p.dialogue.map(r=>r.text_id))===canonical(p.text_ids),'TEXT_BINDING');
  for(const l of ['SL','EN']){const h=p.hotspots[l];assert(h&&Number.isFinite(h.z_order)&&h.polygon_norm?.length>=3&&h.polygon_norm.every(v=>v.length===2&&v.every(n=>Number.isFinite(n)&&n>=0&&n<=1)),'HOTSPOT');}
  if(p.readiness.pair_ready){paired++;assert(p.P&&p.L&&p.qa_status==='PASS','PAIR_READINESS');for(const o of ['P','L']){asset(p[o]);assert(o==='P'?p[o].height_px>p[o].width_px:p[o].width_px>p[o].height_px,'PAIR_ORIENTATION');for(const l of ['SL','EN']){asset(p.overlays?.[o]?.[l]);assert(p.overlays[o][l].width_px===p[o].width_px&&p.overlays[o][l].height_px===p[o].height_px&&canonical(p.overlays[o][l].text_ids)===canonical(p.text_ids),'OVERLAY_BINDING');}}}
 }
 for(const p of e.pages)assert(canonical(p.panel_ids)===canonical(e.panels.filter(x=>x.page_id===p.page_id).map(x=>x.panel_id)),'PAGE_PANEL_IDS');
 assert(paired===e.pair_count,'PAIR_COUNT');return e;
}
export function restoreState(saved={},edition){const ids=new Set(edition.panels.map(p=>p.panel_id)),pages=new Set(edition.pages.map(p=>p.page_id));return {mode:saved.mode==='panel'&&ids.has(saved.panelId)?'panel':'overview',panelId:ids.has(saved.panelId)?saved.panelId:null,pageId:pages.has(saved.pageId)?saved.pageId:'P01',originPage:pages.has(saved.originPage)?saved.originPage:'P01',originPanelId:ids.has(saved.originPanelId)?saved.originPanelId:null,language:['SL','EN'].includes(saved.language)?saved.language:'SL',readIds:[...new Set(Array.isArray(saved.readIds)?saved.readIds.filter(id=>ids.has(id)):[])]};}
export function neighborAssets(edition,panelId){const at=edition.panels.findIndex(p=>p.panel_id===panelId);if(at<0)return [];return edition.panels.slice(Math.max(0,at-1),Math.min(edition.panels.length,at+2)).flatMap(p=>p.readiness.pair_ready?[p.P,p.L]:[p.source_zoom]);}
// At most 3 logical panels / 6 artwork bitmaps. Hash before decode; abort and
// revoke on release. A late completion cannot resurrect an evicted entry.
export class AssetWindow{
 constructor(base,{fetcher=fetch,ImageClass=globalThis.Image,createURL=b=>URL.createObjectURL(b),revokeURL=u=>URL.revokeObjectURL(u)}={}){Object.assign(this,{base,fetcher,ImageClass,createURL,revokeURL});this.entries=new Map();}
 reconcile(assets){const keep=new Set(assets.map(a=>a.file));assert(keep.size<=6,'CACHE_BOUND');for(const [key,e]of this.entries)if(!keep.has(key)){e.controller.abort();if(e.url)this.revokeURL(e.url);if(e.image)e.image.removeAttribute('src');this.entries.delete(key);}for(const a of assets)this.get(a).catch(()=>{});}
 get(asset){const key=safePath(asset.file);if(this.entries.has(key))return this.entries.get(key).promise;assert(this.entries.size<6,'CACHE_BOUND');const e={controller:new AbortController(),url:null,image:null};this.entries.set(key,e);e.promise=(async()=>{const response=await this.fetcher(new URL(key,this.base),{signal:e.controller.signal,credentials:'omit'});assert(response.ok,'ASSET_HTTP');const blob=await response.blob();assert(blob.size<=64*1024*1024&&await digest(blob)===asset.sha256,'ASSET_HASH');assert(this.entries.get(key)===e&&!e.controller.signal.aborted,'STALE_ASSET');e.url=this.createURL(blob);e.image=new this.ImageClass();e.image.src=e.url;await e.image.decode();assert(e.image.naturalWidth===asset.width_px&&e.image.naturalHeight===asset.height_px,'ASSET_DIMENSIONS');assert(this.entries.get(key)===e&&!e.controller.signal.aborted,'STALE_ASSET');return {url:e.url,asset};})().catch(error=>{if(this.entries.get(key)===e){if(e.url)this.revokeURL(e.url);this.entries.delete(key);}throw error;});return e.promise;}
 clear(){this.reconcile([]);}
}
