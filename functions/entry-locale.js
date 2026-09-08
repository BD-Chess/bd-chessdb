/** MDLxDCC · first-visit language. No dependencies, secrets, IP storage or logging.
 * Deploy at repository-root/netlify/edge-functions/entry-locale.js (not public/).
 * Netlify supplies geo.country.code. Unknown country deliberately defaults to EN.
 */
export default function entryLocale(request, context) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, {status:405, headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});
  }
  const code = String(context?.geo?.country?.code || '').toUpperCase();
  const body = JSON.stringify({language:code === 'SI' ? 'sl' : 'en'});
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'private, no-store, max-age=0',
      'Netlify-CDN-Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      'X-Robots-Tag':'noindex, nofollow',
      'Vary':'*'
    }
  });
}
export const config = {path:'/api/entry-locale'};
