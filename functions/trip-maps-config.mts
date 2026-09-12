// This endpoint intentionally publishes ONLY the domain-restricted Maps browser key.
// Google Maps JavaScript needs it in the browser; Gemini credentials never leave the server.
export default async (request) => {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (request.method !== 'GET') {
    return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
  }
  const key = Netlify.env.get('TRIP_GOOGLE_MAPS_API_KEY')?.trim();
  if (!key) {
    return Response.json({ error: 'MAPS_NOT_CONFIGURED' }, { status: 503, headers });
  }
  return Response.json({ mapsBrowserKey: key }, { headers });
};
