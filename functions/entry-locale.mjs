/** MDLxDCC · first-visit language.
 * Uses the SAME Netlify Functions directory already used by this repository.
 * No dependencies, secrets, IP storage or logging.
 * Unknown/non-Slovenian country deliberately defaults to EN.
 */
export default async function entryLocale(request, context) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, {
      status: 405,
      headers: { 'Allow': 'GET, HEAD', 'Cache-Control': 'no-store' }
    });
  }

  const code = String(context?.geo?.country?.code || '').toUpperCase();
  const body = JSON.stringify({ language: code === 'SI' ? 'sl' : 'en' });

  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Netlify-CDN-Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
