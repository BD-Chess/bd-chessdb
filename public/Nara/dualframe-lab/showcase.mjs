// Read-only reference assets. Never enter creation or controlled comparisons.
const ROOT = new URL('https://bd-chess.github.io/bd-chessdb/Nara/');
const PREFIX = 'assets/img/illuminara-visual-series/';
export function referenceURL(path) {
  if (typeof path !== 'string' || !path.startsWith(PREFIX) || !/^[A-Za-z0-9_./-]+\.webp$/.test(path) || path.includes('..')) throw Error('INVALID_REFERENCE_ASSET');
  const url = new URL(path, ROOT);
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname + PREFIX)) throw Error('INVALID_REFERENCE_ASSET');
  return url.href;
}
export async function loadReferenceGallery() {
  const response = await fetch(new URL(PREFIX + 'manifest.json', ROOT), {cache:'no-cache',credentials:'omit'});
  if (!response.ok) throw Error('REFERENCE_UNAVAILABLE');
  const manifest = await response.json();
  if (!Array.isArray(manifest.artworks) || manifest.artworks.length > 60) throw Error('INVALID_REFERENCE_ASSET');
  return manifest.artworks.filter(item=>item.variants?.hd?.landscape && item.variants?.hd?.portrait).map(item=>{
    const variants = {landscape:{},portrait:{}};
    for (const direction of ['landscape','portrait']) for (const quality of ['hd','fourK']) {
      const asset = item.variants[quality]?.[direction];
      if (!asset || !Number.isInteger(asset.width) || !Number.isInteger(asset.height) || asset.width*asset.height > 24000000) continue;
      variants[direction][quality] = {...asset,remote_url:referenceURL(asset.path),origin:'reference',reference_only:true,resolution_origin:'reference-provided',resolution_verified:false,verification_pending:true};
    }
    return {pair_id:'nara_reference_'+item.number,reference_only:true,number:item.number,title:item.title,caption:item.caption,captionSl:item.captionSl,original:{filename:item.title,source_orientation:item.orientation,visibility:'public-reference',...variants[item.orientation].hd},variants,jobs:[]};
  });
}
export async function verifyReferenceAsset(asset) {
  if (asset.blob) return asset;
  const response = await fetch(asset.remote_url,{credentials:'omit',cache:'force-cache',redirect:'error'});
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error('REFERENCE_UNAVAILABLE');
  const blob=await response.blob();
  if(blob.size>12*1024*1024)throw Error('REFERENCE_UNAVAILABLE');
  const decoded=await createImageBitmap(blob);
  try {if(decoded.width!==asset.width || decoded.height!==asset.height)throw Error('REFERENCE_DIMENSION_MISMATCH');}
  finally {decoded.close();}
  asset.blob=blob;asset.resolution_verified=true;asset.verification_pending=false;
  const bytes=await blob.arrayBuffer();asset.sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  return asset;
}
