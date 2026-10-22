// Match redirects only against public paths that the guide has already registered.
// Netlify can lowercase HTML paths, remove .html and collapse /index.html to /.
export function createPublicRoutes(paths = []) {
 const known = new Set(), aliases = new Map();
 const key = path => path.toLowerCase().replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
 function add(path, { prefer = false } = {}) {
  known.add(path);
  const alias = key(path);
  if (prefer || !aliases.has(alias)) aliases.set(alias, path);
 }
 for (const path of paths) add(path);
 return { known, add, resolve: path => known.has(path) ? path : aliases.get(key(path)) || path };
}

// A query flag only chooses the isolated runtime; the owner path stays denied.
export function isPublicTripDemo(url) {
 const u = url instanceof URL ? url : new URL(url, 'https://www.mdlxdcc.org');
 return /^\/BD\/O\/izleti\/andaluzija-2027(?:\.html)?$/i.test(u.pathname)
  && u.searchParams.getAll('demo').length === 1 && u.searchParams.get('demo') === 'glance'
  && [...u.searchParams.keys()].every(k => ['demo','lang'].includes(k))
  && u.searchParams.getAll('lang').length <= 1
  && (!u.searchParams.has('lang') || ['sl','en'].includes(u.searchParams.get('lang')));
}

export function parseGlance(text) {
 if (typeof text !== 'string' || /[\x00-\x1f]/.test(text)) return null;
 const match = /^(help glance|glance(?: (it|devices|creative|ai8|theories|trip))?)(?: (silent|silence))?$/i.exec(text.trim());
 return match ? {help:match[1].toLowerCase()==='help glance',key:match[2]?.toLowerCase()||'main',silent:Boolean(match[3])} : null;
}
