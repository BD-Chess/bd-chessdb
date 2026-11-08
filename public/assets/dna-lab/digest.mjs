// Public editorial digest. Add only updates already published and verified.
// Verification receipt: compact-zoom LIVE_VERIFIED, source 03bb8d50 (2026-11-08).
export const LAB_UPDATE = Object.freeze({
 id:'dna-compact-2026-11-08', date:'2026-11-08', projectId:'ai8-dna',
 title:'A compact, searchable AI8 DNA',
 summary:'The published AI8 DNA v4 keeps the compact helix and broad cap, groups public projects into nine sections with page counts, and keeps the exact BD Top 8. Search and native pinch zoom remain available. The frozen v3 view is still linked separately.',
 sources:[
  {title:'Published AI8 DNA v4',url:'https://www.mdlxdcc.org/ai8-dna-v4.html'},
  {title:'Compact DNA release · PR 349',url:'https://github.com/BD-Chess/bd-chessdb/pull/349'}
 ]
});
export function welcomeHost(now = new Date()) {
 const day = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Ljubljana',day:'numeric'}).format(now));
 return day % 2 ? 'gpt' : 'claude';
}
export const otherProvider = p => p === 'gpt' ? 'claude' : 'gpt';
export const providerName = p => p === 'gpt' ? 'ChatGPT' : 'Claude';
