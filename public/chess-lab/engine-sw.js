/* LAB-only optional runtime extension. sw.js remains generated normally.
 * Register this wrapper in LAB only; CURRENT continues using its original worker.
 * The generated shell owns atomic install/activation; optional packages stay separate.
 */
importScripts('sw.js','js/8zc-engine-assets-manifest.js','js/8zc-engine-assets-sw.js');

// Read-only DATA preflight: include older/uncontrolled LAB clients too.
self.addEventListener('message', event => {
  if (event.data?.type !== 'CHESS_DATA_STATE' || !event.ports?.[0]) return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    event.ports[0].postMessage({ release: RELEASE, clients: clients.filter(client => new URL(client.url).pathname.startsWith(ROOT.pathname)).map(client => client.id) });
  })());
});
