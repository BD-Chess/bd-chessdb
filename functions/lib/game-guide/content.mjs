// Read only fixed, repository-owned page snapshots; never accept client HTML.
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', times: '×', deg: '°' };
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, key) => {
  if (!key.startsWith('#')) return entities[key.toLowerCase()] ?? all;
  const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
  return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : ' ';
});
export function stepTexts(html, game) {
  if (typeof html !== 'string' || html.length > 300000) throw Error('INVALID_GAME');
  const found = new Map(), ids = new Set(game.steps.map(s => s.id));
  let depth = 0, rootDepth = 0, current = null, skip = null, text = '';
  for (const token of html.match(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|[^<]+/g) || []) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('<')) {
      const tag = token.match(/^<(\/)?([\w-]+)/); if (!tag) continue;
      const closing = Boolean(tag[1]), name = tag[2].toLowerCase();
      if (skip) { if (closing && name === skip) skip = null; continue; }
      if (!closing && ['script', 'style', 'svg'].includes(name)) { skip = name; continue; }
      if (name === 'section') {
        if (!closing) {
          depth++;
          const id = token.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
          if (ids.has(id)) { if (current || found.has(id)) throw Error('INVALID_GAME'); current = id; rootDepth = depth; text = ''; }
        } else {
          if (current && depth === rootDepth) { found.set(current, decode(text).replace(/\s+/g, ' ').trim()); current = null; }
          depth--;
        }
      }
      if (current) text += ' ';
    } else if (current && !skip) text += token;
  }
  for (const step of game.steps) {
    const text = found.get(step.id);
    if (!text || text.length > 16000) throw Error('GAME_CONTENT_UNAVAILABLE');
    step.text = text;
  }
  return game;
}
