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
