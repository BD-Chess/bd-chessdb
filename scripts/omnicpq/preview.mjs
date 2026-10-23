// Local-only preview. --demo injects a clearly labelled deterministic transport.
// It NEVER reads a key or makes a provider request. Shell-only is the safe default.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeHandler } from '../../functions/omnicpq-assistant.mjs';
import { loadKnowledge, verifyPack } from '../../functions/lib/omnicpq/knowledge.mjs';
const demo = process.argv.includes('--demo');
if (process.env.NETLIFY) throw Error('Local preview must not run as a deployed function.');
const port = Number(process.env.PORT || 4173), root = resolve('public/OmniCPQ');
const prefix = process.env.OMNICPQ_PREVIEW_PREFIX || '/OmniCPQ/';
if (!prefix.startsWith('/') || !prefix.endsWith('/') || prefix.includes('..')) throw Error('Invalid preview prefix');
const allow = new Set(['index.html','app.css','app.mjs','core.mjs','lifecycle-validation.mjs','prompts.mjs','manifest.webmanifest','sw.js','shell-integrity.json',
  'version.mjs','starters.mjs','browser-bridge.mjs','browser-help.html','OmniCPQ_Browser_Bridge_R6.zip','browser-extension-integrity.json','OMNICPQ_ZACETNI_POZIVI_12_R6.txt',
  'icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/favicon-32.png','icons/original.png']);
if (demo) {
  process.env.OMNICPQ_KNOWLEDGE_MODE = 'file';
  process.env.OMNICPQ_KNOWLEDGE_FILE ||= resolve('.private/omnicpq/knowledge.json');
}
const localReader = async () => readFile(process.env.OMNICPQ_KNOWLEDGE_FILE, 'utf8');
const demoPack = demo ? await verifyPack(await localReader()) : null;
const transport = async ({ payload, signal, onText, onIdentity }) => {
  const all = JSON.stringify(payload.input), mode = payload.instructions.includes('Izbrana začetna naloga je PLM_TESTS') ? 'plm' : payload.instructions.includes('Izbrana začetna naloga je JIRA_REQUIREMENT') ? 'jira' : 'work';
  const requirementSource = payload.instructions.match(/<source id="(S\d+)" path="references\/POSLOVNA_ZAHTEVA_IT_PLM\.md"/)?.[1];
  const image = payload.input.at(-1).content.find(c => c.type === 'input_image');
  let text;
  if (mode === 'plm') {
    const example = JSON.parse(demoPack.files['references/PLM_TEST_EXAMPLE.json']);
    const invalidFixture = all.includes('[QA_NULL_TEST]');
    if (invalidFixture) example.tests = [null]; // Disposable QA clone; never edits the shared source.
    text = '### Sintetični načrt · v16\n\n' + (invalidFixture ? 'Poškodovana testna kopija za preverjanje zavrnitve izvoza. Izvirni skill je nespremenjen.' : 'To je nespremenjen skupni PLM_TEST_EXAMPLE iz v16. Pravila so izmišljena samo za ta primer; noben test ni izveden.') + '\n\n```json\n' + JSON.stringify(example, null, 2) + '\n```';
  }
  else if (mode === 'jira') text = '### Osnutek poslovne zahteve · proposal\n\n**Cilj:** nova cloud storitev z osnovnim paketom in doplačljivimi izbirami.\n\n1. AsIs: MANJKA; ToBe: ponudba in naročilo storitve.\n2. Hierarhija, števnosti, odvisnosti, atributi: MANJKA.\n3. Cena, BILLING_QTY, RC/OTC: MANJKA. Prazna cena ni ničelna.\n4. Lifecycle in integracije: PREDLOG, potrditi objekte, dogodke in verzije.\n5. Prevzemna merila: PREDLOG; testi NOT_RUN.\n6. Odprte odločitve: odgovorne vloge, potrjena zahteva in okolje.\n\nStanje: proposal; approved / implemented / tested: UNKNOWN. Osnutek ni oddan.' + (requirementSource ? ` [${requirementSource}, references/POSLOVNA_ZAHTEVA_IT_PLM.md]` : '');
  else if (image) text = 'Prejeta je dejanska slika v testnem multimodalnem requestu. Ta simuliran transport ne izvaja vision analize. Za pravi pregled CPQ je potreben živ, pooblaščen modelni klic.\n\n**Izid CPQ:** NOT_RUN.';
  else if (/podpis|realizacij/i.test(all)) text = 'Za realizacijo po podpisu uporabi **Naročila**. Nadaljuj na pravem dokumentu in postavki; pred shranjevanjem preveri aktualni CPQ kontekst. [S1, Dokument in aktualni kontekst]\n\nTo je simuliran testni odgovor, ne izvedeno dejanje v CPQ.';
  else text = 'Za naslednji korak dodaj **sliko trenutnega CPQ zaslona ali kratek besedilni izsek**. Sam URL ne kaže, kateri dokument ali modal je odprt. [S1, Dokument in aktualni kontekst]\n\nTestni transport ne bere CPQ in ne izvaja živega AI.';
  const identity = { model: 'SIMULATED_TRANSPORT', reasoning: 'NOT_APPLICABLE', providerRequestId: 'SIMULATION', responseId: 'SIMULATION' };
  onIdentity(identity);
  for (const chunk of text.match(/.{1,32}|\n/g)) {
    if (signal.aborted) throw Error('CANCELLED');
    await new Promise(resolve => setTimeout(resolve, 20));
    if (signal.aborted) throw Error('CANCELLED');
    onText(chunk);
  }
  return { ...identity, usage: null, status: 'complete', incompleteReason: null };
};
const handler = makeHandler(demo ? {
  enabled: true, simulation: true, accessFactory: async () => ({ id: 'local-preview-owner', role: 'owner' }),
  knowledgeFactory: () => loadKnowledge({ reader: localReader }), transport, budgetFactory: () => ({ reserve: async () => null, settle: async () => {} }),
} : { enabled: false });
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json' };
const server = createServer(async (incoming, outgoing) => {
  try {
    const origin = `http://${incoming.headers.host || 'localhost:' + port}`, url = new URL(incoming.url, origin);
    if (demo && process.env.OMNICPQ_LAYOUT_QA === '1' && url.pathname === '/') {
      outgoing.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
      // This QA browser has 15 px scrollbars; verify document.clientWidth,
      // rather than assuming iframe's outer width is the layout width.
      outgoing.end(`<!doctype html><html lang="sl"><meta name="viewport" content="width=device-width"><title>OmniCPQ · responsive QA</title><style>body{margin:0;padding:12px;background:#34434d;color:white;font:14px system-ui}.samples{display:flex;flex-wrap:wrap;gap:18px;justify-content:center}section{margin:0}h2{font-size:13px;margin:6px 0}iframe{border:1px solid #6c7f8a;height:890px;display:block;max-width:100%}</style><h1>OmniCPQ · šírine preveri z document.clientWidth</h1><div class="samples">${[360,402,600].map(w=>`<section><h2>${w} px</h2><iframe title="OmniCPQ ${w} px" width="${w+15}" src="${prefix}"></iframe></section>`).join('')}</div></html>`); return;
    }
    if (demo && url.pathname === '/__qa-layout') {
      const width = [360,402,600,1280].includes(Number(url.searchParams.get('w'))) ? Number(url.searchParams.get('w')) : 402;
      outgoing.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
      outgoing.end(`<!doctype html><html lang="sl"><meta name="viewport" content="width=device-width"><title>OmniCPQ · preizkus širine ${width}</title><style>body{margin:0;background:#36434b;color:white;font:14px system-ui}nav{padding:10px}a{color:#b3eef0;margin-right:15px}iframe{display:block;border:1px solid #61747c;width:${width}px;height:890px;margin:0 auto;max-width:100%}</style><nav>QA prikaz ${width} px · <a href="?w=360">360</a><a href="?w=402">402</a><a href="?w=600">600</a><a href="?w=1280">1280</a></nav><iframe title="OmniCPQ ${width} px" src="${prefix}"></iframe></html>`); return;
    }
    if (url.pathname === '/' && prefix !== '/') { outgoing.writeHead(302, { Location: prefix }); outgoing.end(); return; }
    if (url.pathname === '/.netlify/functions/omnicpq-assistant') {
      const controller = new AbortController(); outgoing.on('close', () => { if (!outgoing.writableEnded) controller.abort(); });
      const request = new Request(url, { method: incoming.method, headers: incoming.headers, ...(incoming.method !== 'GET' && incoming.method !== 'HEAD' ? { body: incoming, duplex: 'half' } : {}), signal: controller.signal });
      const response = await handler(request); outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const chunk of response.body) { if (outgoing.destroyed) break; outgoing.write(chunk); }
      outgoing.end(); return;
    }
    if (url.pathname === '/.netlify/functions/mdlxdcc-guide-auth' && demo) {
      outgoing.writeHead(200, { 'Content-Type':'application/json','Cache-Control':'no-store' }); outgoing.end(JSON.stringify({ authenticated: true, simulation: true, account: { role: 'owner' } })); return;
    }
    let filename = url.pathname.startsWith(prefix) ? decodeURIComponent(url.pathname.slice(prefix.length)) : null;
    if (filename === '') filename = 'index.html';
    if (!filename || !allow.has(filename) || !resolve(root, filename).startsWith(root + sep)) { outgoing.writeHead(404); outgoing.end('Not found'); return; }
    const bytes = await readFile(resolve(root, filename));
    outgoing.writeHead(200, { 'Content-Type':mime[extname(filename)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff' }); outgoing.end(bytes);
  } catch { if (!outgoing.headersSent) outgoing.writeHead(503, { 'Content-Type':'application/json','Cache-Control':'no-store' }); outgoing.end(JSON.stringify({ error: { code: 'PREVIEW_UNAVAILABLE' } })); }
});
server.listen(port, process.env.OMNICPQ_PREVIEW_HOST || '127.0.0.1', () => console.log(`OmniCPQ ${demo ? 'SIMULATED' : 'shell only'} preview: http://localhost:${port}${prefix}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));


