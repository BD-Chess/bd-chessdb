/** R10 presentation only. Source strings, schemas and content hashes stay intact. */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const italicLine=s=>/^\*([^*\r\n]+)\*$/.exec(s);
const actLine=s=>/^ACT [IVX]+ · [^\r\n]+$/.test(s);

export function dialogueScene(scene){
  const subtitle=italicLine(scene.paragraphs[0]);
  return Boolean(subtitle&&subtitle[1].includes(' · '));
}

/** Only the specified italic syntax; arbitrary HTML/Markdown is escaped. */
export function renderThoughts(s){
  let html='',start=0;
  const tokens=/(?<!\*)\*([^*\r\n]+)\*(?!\*)/g;
  for(const m of s.matchAll(tokens)){
    html+=esc(s.slice(start,m.index))+'<em>'+esc(m[1])+'</em>';
    start=m.index+m[0].length;
  }
  return html+esc(s.slice(start));
}

export function sceneActIndices(scene){
  return dialogueScene(scene)&&actLine(scene.paragraphs[1]||'')&&italicLine(scene.paragraphs[2]||'')?[1,2]:[];
}

export function renderDialogueParagraph(scene,index,heading=2){
  const p=scene.paragraphs[index];
  if(!dialogueScene(scene))return '<p>'+esc(p)+'</p>';
  if(index===0)return '<p class="subtitle"><em>'+esc(italicLine(p)[1])+'</em></p>';
  const acts=sceneActIndices(scene);
  if(acts.includes(index))return index===1
    ?'<h'+heading+' class="act">'+esc(p)+'</h'+heading+'>'
    :'<p class="subtitle act-line"><em>'+esc(italicLine(p)[1])+'</em></p>';
  const turn=/^\*\*([^*\r\n]+)\*\* {2,}\r?\n([\s\S]+)$/.exec(p);
  if(turn)return '<p class="dialogue"><strong class="speaker">'+esc(turn[1])+'</strong>'+renderThoughts(turn[2]).replace(/\r?\n/g,'<br>')+'</p>';
  return '<p>'+renderThoughts(p)+'</p>';
}
