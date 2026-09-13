// LAB-only grounded chat. Existing CURRENT/PREVIOUS request contracts stay unchanged.
export const LAB_VERSION = 'road-matrix-brute16-lab';
export function labOptions(body) {
  const lab = body.guiVersion === LAB_VERSION;
  const language = body.language === 'sl' ? 'sl' : 'en';
  const query = typeof body.query === 'string' ? body.query.slice(0,12000) : '';
  const guiHelp = /\b(brute force|direct line|button|GUI|trip editor|calculation comparison|how.*(?:optimizer|library))\b/i.test(query);
  const geographic = /\b(where|near|nearby|hotel|hotels|stay|restaurant|restaurants|cafe|cafes|dinner|lunch|eat|food|museum|museums|itinerary|itineraries|visit|sightseeing|destination|destinations|tour|tours|base camp|walkable|taxi|day trip|road trip)\b/i.test(query);
  return {lab, language, maps:lab && language === 'en' && !guiHelp && geographic};
}
export function supportsCombinedMaps(model) {
  // Combined Search + Maps is documented for Flash 3.5 and later; an older
  // fallback still supplies Search through the existing generateContent path.
  return /^gemini-3\.(?:[5-9]|\d{2,})-flash(?:-lite)?$/.test(model);
}
export function interactionBody(model, prompt, instructions) {
  return {model, input:prompt, system_instruction:instructions, store:false,
    generation_config:{max_output_tokens:8192}, tools:[{type:'google_maps'},{type:'google_search'}]};
}
export function interactionResult(data) {
  if (data.status !== 'completed') return {error:data.status === 'incomplete' || data.status === 'budget_exceeded' ? 'RESPONSE_TRUNCATED' : 'INVALID_RESPONSE'};
  const blocks = (data.steps || []).filter(s=>s.type === 'model_output').flatMap(s=>s.content || []).filter(c=>c.type === 'text' && typeof c.text === 'string');
  const sources = blocks.flatMap(b=>(b.annotations || []).flatMap(a=>{
    const raw = a.type === 'place_citation' ? a.url : a.uri;
    try {
      const url = new URL(raw);
      if (!['http:','https:'].includes(url.protocol)) return [];
      return [{title:String(a.name || a.title || 'Source'),url:url.href,provider:a.type === 'place_citation' ? 'Google Maps' : 'Google Search'}];
    } catch { return []; }
  }));
  const suggestions = (data.steps || []).filter(s=>s.type === 'google_search_result').flatMap(s=>s.result || []).map(r=>r.search_suggestions).filter(s=>typeof s === 'string').join('\n');
  return {text:blocks.map(b=>b.text).join('\n').trim(),sources,searchSuggestionsHtml:suggestions};
}
