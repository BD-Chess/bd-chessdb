import { PROMPTS, SECONDARY, PILOT, PROMPT_VERSION, PROMPTS_SHA256 } from './prompts.mjs';
import { APP_VERSION, uuid, digest, canonicalInput, sseEvents, structured, lifecycleIssues, canExportTests, hasValidLifecycle, csv, exportSession } from './core.mjs';

const $ = id => document.getElementById(id);
const API = '/.netlify/functions/omnicpq-assistant', AUTH = '/.netlify/functions/omnicpq-auth';
const STORAGE = 'omnicpq:workspace:v1', PREFS = 'omnicpq:preferences:v1';
const state = { mode: 'work', messages: [], comparisons: [], busy: false, ready: false, ownerVerified: false, snapshot: null,
  capture: null, frozen: null, profile: 'fast', promptId: null, persist: false, health: null, controller: null, otherTiming: null, role: null, accountId: null };
let installEvent, registration, accessEpoch = 0;
const element = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; };
function notice(text) { $('notice').textContent = text; $('notice').hidden = !text; }
const problems = {
  DEMO_INVITATION_REQUIRED: 'Za demo odpri prejeto povabilo ali vnesi njegovo kodo.', DEMO_IP_UNAVAILABLE: 'IP-ja ni mogoče varno potrditi. Demo dostop je zadržan.',
  DEMO_IP_CHANGED: 'Demo je vezan na IP ob prvi aktivaciji. Za drugo omrežje potrebuješ novo povabilo.', DEMO_EXPIRED: 'Veljavnost demo dostopa je potekla.', DEMO_REVOKED: 'Demo dostop je preklican.', DEMO_LIMIT: 'Dosežena je meja demo porabe; novega API klica ne izvedemo.',
  AUTH_REQUIRED: 'Prijavi se z obstoječim računom lastnika v nastavitvah.', OWNER_REQUIRED: 'Ta prijava nima dostopa do internega znanja OmniCPQ.',
  KNOWLEDGE_UNAVAILABLE: 'Zasebni vir znanja še ni dosegljiv na tem strežniku.', KNOWLEDGE_INTEGRITY: 'Znanje se ne ujema s preverjeno izdajo v15; zahteva je ustavljena.',
  AI_UNAVAILABLE: 'AI na tem strežniku še ni omogočen ali trenutno ni dosegljiv.', MODEL_NOT_ALLOWED: 'Strežniški profil modela ni na dovoljenem seznamu.',
  RATE_LIMITED: 'Dosežena je omejitev zahtev. Poskusi pozneje; ponovne zahteve ne pošljemo samodejno.', MONTHLY_LIMIT: 'Dosežena je omejitev porabe.',
  DUPLICATE_REQUEST: 'Ta zahteva je bila že sprejeta. Ne ponavljaj je brez preverjanja izida.', REQUEST_IN_PROGRESS: 'Prejšnja zahteva še poteka.',
  TIMEOUT: 'Čas za odgovor je potekel. Prejeti del je ohranjen; novega klica nismo sprožili.', CANCELLED: 'Odgovor je ustavljen.',
  SNAPSHOT_INTEGRITY: 'Celovitost slike ni potrjena. Dodaj sliko ponovno.', RETRIEVAL_LIMIT: 'Obseg virov je prevelik. Zoži vprašanje na eno zahtevo ali storitev.',
  OUTPUT_LIMIT: 'Odgovor je presegel dovoljeni obseg. Prejeti del ostane na voljo; novega klica ne pošljemo samodejno.',
  AUTH_UNAVAILABLE: 'Prijava trenutno ni dosegljiva.', STORAGE_UNAVAILABLE: 'Preverjanje prijave ali porabe trenutno ni dosegljivo.',
};
function issue(code) { return problems[code] || 'Odgovor ni bil dokončan. Preveri povezavo in stanje v nastavitvah.'; }
function showUsage(usage) {
  const node = $('demo-usage'); node.hidden = state.role !== 'demo';
  if (node.hidden || !usage?.expires_at) return;
  const until = new Date(usage.expires_at).toLocaleString('sl-SI');
  node.textContent = `Demo do ${until} · poraba do $${Number(usage.spent || 0).toFixed(4)} / $1 · rezervirano $${Number(usage.reserved || 0).toFixed(4)}. Poraba je konservativna zgornja ocena.`;
}
async function demoAction(action, data = {}) {
  const response = await fetch(AUTH, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }) });
  const result = await response.json(); if (!response.ok) throw Error(issue(result.error?.code)); return result;
}
async function listDemos() {
  if (state.role !== 'owner') return;
  try {
    const result = await demoAction('list_demos'); $('demo-list').replaceChildren();
    for (const grant of result.grants) {
      const row = element('div', 'demo-row');
      row.append(element('p', 'hint', `${grant.id.slice(0, 8)} · ${grant.active ? 'aktiven' : 'preklican'} · ${grant.expires_at ? new Date(grant.expires_at).toLocaleString('sl-SI') : 'čaka aktivacijo'} · $${Number(grant.spent).toFixed(4)} / $1`));
      if (grant.active) { const revoke = element('button', '', 'Prekliči'); revoke.onclick = async () => { try { await demoAction('revoke_demo', { id: grant.id }); await listDemos(); } catch (e) { notice(e.message); } }; row.append(revoke); }
      $('demo-list').append(row);
    }
  } catch (e) { notice(e.message); }
}
function ownerAccess(verified) {
  state.ownerVerified = verified;
  $('workspace').hidden = !verified; $('composer').hidden = !verified; $('composer-shell').hidden = !verified; $('access-gate').hidden = verified;
  $('demo-owner').hidden = !verified || state.role !== 'owner';
  if (!verified) $('demo-usage').hidden = true;
  for (const id of ['export-md', 'export-json', 'export-comparison', 'export-snapshot', 'copy-comparison', 'service']) $(id).disabled = !verified;
  $('new-chat').disabled = !verified || state.busy;
  if (!verified) {
    accessEpoch++;
    state.ready = false; state.health = null; state.controller?.abort(); disconnect(); setSnapshot(null);
    $('crop-dialog').close(); $('crop-canvas').width = $('crop-canvas').height = 0;
    $('technical-info').textContent = ''; $('knowledge-status').textContent = 'Znanje: potreben je lastniški dostop.';
    $('login-form').hidden = false; $('logout').hidden = true;
  }
  renderMessages(); updateComparisonGate();
}
function mayExport() {
  if (state.ownerVerified) return true;
  notice('Za prikaz ali izvoz internega pogovora potrdi lastniški dostop.'); return false;
}
function localWrite() {
  if (state.role === 'demo') return true;
  try {
    localStorage.setItem(PREFS, JSON.stringify({ theme: $('theme').value, profile: state.profile, persist: state.persist }));
    if (state.persist) localStorage.setItem(STORAGE, JSON.stringify({ ...exportSession(state), accountId: state.accountId, draft: $('message').value,
      context: getContext(), service: $('service').value, mode: state.mode }));
    else localStorage.removeItem(STORAGE);
    return true;
  } catch { notice('Lokalno shranjevanje ni uspelo. Izvozi pomemben pogovor, preden zapreš stran.'); return false; }
}
function getContext() { return { text: $('context-text').value, manualUrl: $('manual-url').value, environment: $('environment').value }; }
function conversationHistory() { return state.messages.filter(m => m.role === 'user' || (m.role === 'assistant' && m.status === 'complete')).slice(-16).map(({ role, content }) => ({ role, content })); }
function bodyForInput() { return { message: $('message').value.trim(), mode: state.mode, promptId: state.promptId, service: $('service').value || null,
  profile: state.profile, context: getContext(), snapshot: state.snapshot ? { ...state.snapshot } : null,
  history: state.frozen?.body.history || conversationHistory() }; }
function setMode(mode) {
  state.mode = mode; $('mode-badge').textContent = PROMPTS.find(p => p.mode === mode).short;
  for (const button of $('mode-nav').children) { button.classList.toggle('active', button.dataset.mode === mode); button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); }
}
function clearFrozen() {
  state.frozen = null; $('frozen-badge').hidden = true; $('unfreeze-input').hidden = true;
  $('frozen-status').textContent = 'Ni zamrznjenega vhoda. Primerjava brez dejanske izvedbe je NOT_RUN.';
}
function setDraft(message, mode, promptId = null) {
  if (state.busy) return;
  clearFrozen(); state.promptId = promptId; setMode(mode || 'work'); $('message').value = message; fitComposer(); localWrite(); $('message').focus();
}
function fitComposer() { $('message').rows = Math.min(5, Math.max(2, $('message').value.split('\n').length)); }
function setBusy(value) {
  state.busy = value; $('send').disabled = value; $('cancel').hidden = !value; $('new-chat').disabled = value || !state.ownerVerified;
  for (const b of document.querySelectorAll('#mode-nav button,#start-cards button,#quick-actions button,#freeze-input,#load-pilot')) b.disabled = value;
  $('message').setAttribute('aria-busy', String(value));
}
function download(name, value, type = 'application/json') {
  if (!mayExport()) return;
  const url = URL.createObjectURL(new Blob([value], { type })), a = element('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copy(text) {
  if (!mayExport()) return;
  try { await navigator.clipboard.writeText(text); notice('Kopirano.'); }
  catch { notice('Kopiranje ni na voljo. Uporabi izvoz Markdown ali JSON.'); }
}
function inline(text, parent) {
  for (const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
    if (part.startsWith('**') && part.endsWith('**')) parent.append(element('strong', '', part.slice(2, -2)));
    else if (part.startsWith('`') && part.endsWith('`')) parent.append(element('code', '', part.slice(1, -1)));
    else parent.append(document.createTextNode(part));
  }
}
// Deliberately small, DOM-only Markdown renderer: no HTML/eval or remote assets.
function richText(node, text) {
  node.replaceChildren(); node.classList.add('rich'); const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) { const pre = element('pre'), block = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) block.push(lines[i]);
      pre.textContent = block.join('\n'); node.append(pre); continue;
    }
    if (/^\|/.test(line) && /^\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const wrap = element('div', 'table-scroll'), table = element('table');
      const row = (str, head) => { const tr = element('tr'); for (const cell of str.replace(/^\||\|$/g, '').split('|')) { const td = element(head ? 'th' : 'td'); inline(cell.trim(), td); tr.append(td); } return tr; };
      table.append(row(line, true)); i += 2;
      while (i < lines.length && /^\|/.test(lines[i])) { table.append(row(lines[i], false)); i++; } i--;
      wrap.append(table); node.append(wrap); continue;
    }
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,6})\s+(.+)$/), list = line.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    const e = element(heading ? (heading[1].length < 3 ? 'h3' : 'h4') : list ? 'p' : 'p');
    inline(heading ? heading[2] : list ? '• ' + list[1] : line, e); node.append(e);
  }
}
function stamp(ms) { return Number.isFinite(ms) ? (ms / 1000).toFixed(2) + ' s' : 'UNKNOWN'; }
function messageNode(message) {
  const node = element('article', 'message ' + message.role), header = element('div', 'message-header');
  header.append(element('span', 'avatar', message.role === 'user' ? 'TI' : 'AI'), element('strong', '', message.role === 'user' ? 'Tvoje vprašanje' : 'OmniCPQ pomočnik'));
  const content = element('div', 'message-text', message.content), status = element('div', 'message-status');
  node.append(header, content, status); message.node = node; message.contentNode = content; message.statusNode = status;
  if (message.role === 'assistant' && message.status !== 'streaming') finishMessage(message);
  return node;
}
function finishMessage(message) {
  if (!state.ownerVerified) return;
  const node = message.node; if (!node) return;
  message.statusNode.classList.toggle('partial', message.status !== 'complete');
  message.statusNode.textContent = `${message.meta?.simulation ? 'SIMULACIJA · ' : ''}${message.status === 'complete' ? 'Zaključeno' : message.status === 'cancelled' ? 'Ustavljeno · delni odgovor' : 'Delni / neuspešen odgovor'} · prvi tekst ${stamp(message.ttftMs)} · skupaj ${stamp(message.totalMs)}`;
  const actions = element('div', 'message-footer');
  const btn = (title, callback) => { const b = element('button', '', title); b.type = 'button'; b.onclick = callback; actions.append(b); };
  btn('Kopiraj', () => copy(message.content)); btn('Markdown', () => download('OmniCPQ_odgovor.md', message.content, 'text/markdown'));
  btn('JSON', () => download('OmniCPQ_odgovor.json', JSON.stringify({ content: message.content, structured: structured(message.content, message.meta?.sources), meta: message.meta, status: message.status, input: message.input, ttftMs: message.ttftMs, totalMs: message.totalMs }, null, 2)));
  // Raw actions exist before inspecting any generated object. Bad model data
  // must never make the original answer or its diagnostic export inaccessible.
  node.append(actions);
  try { richText(message.contentNode, message.content || 'Brez prejetega besedila.'); }
  catch { message.contentNode.textContent = message.content || 'Brez prejetega besedila.'; }
  const data = structured(message.content, message.meta?.sources);
  const validation = message.meta?.lifecycleValidation;
  if (data || (validation && validation.state !== 'ABSENT')) {
    const verified = hasValidLifecycle(message), panel = element('div', 'validation ' + (verified ? 'valid' : 'invalid'));
    panel.append(element('strong', '', verified ? 'Oblika in notranje povezave so preverjene.' : 'Strukturiran izvoz je zadržan.'));
    if (!verified) {
      const reasons = Array.isArray(validation?.issues) ? validation.issues.slice(0,6).map(i => `${i.path || '$'}: ${i.message || 'Neveljaven zapis.'}`).join(' ') : '';
      panel.append(element('p', '', reasons || (message.status !== 'complete' ? 'Odgovor ni dokončan. Surovi izvoz ostane na voljo.' : 'Za ta točen odgovor ni veljavnega strežniškega pregleda. Surovi izvoz ostane na voljo.')));
    }
    panel.append(element('p', 'hint', 'Pregled uporablja skupno v15 shemo in povezave ID-jev. Ne potrjuje poslovnih pravil, odobritve zahtev ali izvedbe testov.'));
    node.append(panel);
    if (canExportTests(message)) btn('Testi CSV', () => download('OmniCPQ_PLM_testi.csv', csv(data.tests.map(test => ({ service: data.service, model_version: data.context?.model_version, environment: data.context?.environment, ...test }))), 'text/csv;charset=utf-8'));
  }
  const sources = Array.isArray(message.meta?.sources) ? message.meta.sources : [];
  const details = element('details'), summary = element('summary', '', `Viri in podatki odgovora · ${sources.length} virov`);
  details.append(summary);
  for (const source of sources.filter(s => s && typeof s === 'object')) {
    const div = element('div', 'source'); div.append(element('strong', '', `[${source.id}] ${source.path}`), element('div', '', source.kind), element('div', '', 'SHA-256 ' + source.sha256));
    div.append(element('div', '', (Array.isArray(source.sections) ? source.sections : []).filter(Boolean).map(s => `${s.heading} (vrstice ${s.startLine}–${s.endLine})`).join(' · '))); details.append(div);
  }
  details.append(element('pre', '', JSON.stringify({ ...message.meta, sources: undefined, timing: { ttftMs: message.ttftMs, totalMs: message.totalMs } }, null, 2)));
  node.append(details);
}
function renderMessages() { $('messages').replaceChildren(...(state.ownerVerified ? state.messages.map(messageNode) : [])); $('welcome').hidden = state.messages.length > 0; }
function saveSession(kind) {
  const data = exportSession(state);
  if (kind === 'md') download('OmniCPQ_pogovor.md', data.messages.map(m => `## ${m.role === 'user' ? 'Uporabnik' : 'Pomočnik'}\n\n${m.content}\n\n${m.status || ''}`).join('\n\n'), 'text/markdown');
  else download('OmniCPQ_pogovor.json', JSON.stringify(data, null, 2));
}

async function health() {
  state.ready = false; $('connection').classList.remove('ready');
  const epoch = accessEpoch;
  const label = $('connection').querySelector('span');
  if (!navigator.onLine) { label.textContent = 'Brez povezave'; return; }
  if (location.hostname.endsWith('.github.io')) { label.textContent = 'Statični prikaz'; $('auth-status').textContent = 'GitHub Pages nima strežniškega AI. Uporabi primarno gostovanje z zasebnim strežniškim virom.'; return; }
  try {
    const response = await fetch(API, { credentials: 'same-origin', cache: 'no-store' });
    if (epoch !== accessEpoch) return;
    if ([401, 403].includes(response.status)) ownerAccess(false);
    const data = await response.json();
    if (!response.ok) { label.textContent = response.status === 401 ? 'Potrebna prijava' : 'AI ni dosegljiv'; $('auth-status').textContent = issue(data.error?.code); return; }
    if (epoch !== accessEpoch) return;
    if (!['owner','demo'].includes(data.account?.role) && !data.simulation) throw Error('AUTH_REQUIRED');
    const nextId = data.account?.id || 'preview';
    if (state.accountId !== nextId && (state.messages.length || state.comparisons.length || $('message').value.trim() || $('context-text').value.trim())) {
      state.messages = []; state.comparisons = []; $('message').value = ''; $('context-text').value = ''; $('manual-url').value = ''; clearFrozen(); setSnapshot(null);
    }
    state.accountId = nextId; state.role = data.account?.role || 'owner';
    $('persist').disabled = state.role === 'demo';
    if (state.role === 'demo') { state.persist = false; $('persist').checked = false; }
    state.health = data; state.ready = data.available && data.skill?.promptsSha256 === PROMPTS_SHA256; $('simulation').hidden = !data.simulation;
    ownerAccess(true); showUsage(data.usage);
    if (data.skill?.promptsSha256 !== PROMPTS_SHA256) notice('Začetni pozivi in strežniški v15 se ne ujemajo. Pošiljanje je zadržano do uskladitve.');
    label.textContent = data.simulation ? 'Testni predogled' : data.available ? 'Pomočnik pripravljen' : 'AI ni omogočen';
    $('connection').classList.toggle('ready', state.ready);
    $('auth-status').textContent = data.simulation ? 'Testni lokalni lastnik · brez prave prijave ali AI.' : (state.role === 'demo' ? 'Demo dostop je potrjen.' : 'Strežnik je potrdil lastniški dostop.');
    $('account-status').textContent = state.role === 'demo' ? 'Demo · dostop samo do lastnega pogovora.' : 'Lastniški dostop · obstoječa prijava MDL×DCC.';
    $('login-form').hidden = true; $('logout').hidden = data.simulation;
    const selectedService = $('service').value;
    $('service').replaceChildren(new Option('Samodejna izbira iz vprašanja', ''), ...data.services.map(s => new Option(s.title, s.id)));
    $('service').value = selectedService;
    $('technical-info').textContent = JSON.stringify(data, null, 2);
    $('knowledge-status').textContent = `Dejansko naloženo ${data.skill.release} / ${data.skill.version} · ${data.skill.files} datotek · ZIP SHA-256 ${data.skill.zipSha256}. Vseh 16 pozivov se preverja po skupnem hashu.`;
    updateComparisonGate();
    if (data.simulation) $('privacy-line').textContent = 'Testni predogled. Odgovore pripravi lokalni simuliran transport. Nobeno vprašanje ali slika ne gre ponudniku AI.';
  } catch { label.textContent = 'AI ni dosegljiv'; $('auth-status').textContent = 'Strežniški del ni dosegljiv. Osnutek in lokalni izvozi ostanejo uporabni.'; }
}

async function snapshotFromURL(dataUrl, method, previous = {}) {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
  if (bytes.length > 3_100_000) throw Error('Slika je prevelika. Uporabi manjši izsek (do 3 MB).');
  return { id: uuid(), capturedAt: previous.capturedAt || new Date().toISOString(), method, sha256: await digest(bytes), dataUrl,
    ...(previous.sha256 ? { parentSha256: previous.sha256 } : {}) };
}
function setSnapshot(snapshot) {
  clearFrozen(); state.snapshot = snapshot; $('snapshot-preview').hidden = !snapshot;
  if (snapshot) {
    $('snapshot-image').src = snapshot.dataUrl;
    $('snapshot-info').textContent = `${snapshot.method} · ${new Date(snapshot.capturedAt).toLocaleString('sl-SI')} · ID ${snapshot.id} · SHA-256 ${snapshot.sha256}`;
    $('context-status').textContent = 'Priložena 1 slika'; $('attachment-count').textContent = '(1)';
  } else { $('snapshot-image').removeAttribute('src'); $('context-status').textContent = 'Brez slike · po želji'; $('attachment-count').textContent = ''; }
}
async function addImage(file, method = 'file') {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3_100_000) { notice('Dodaj PNG, JPEG ali WebP do 3 MB.'); return; }
  const reader = new FileReader();
  reader.onload = async () => { try { setSnapshot(await snapshotFromURL(reader.result, method)); $('context-panel').open = true; } catch (e) { notice(e.message); } };
  reader.readAsDataURL(file);
}
function disconnect() {
  if (state.capture) for (const track of state.capture.getTracks()) track.stop();
  state.capture = null; $('screen-video').srcObject = null; $('screen-video').hidden = true;
  $('capture-frame').disabled = true; $('disconnect-screen').hidden = true; $('capture-on-send').checked = false;
  $('capture-status').textContent = 'Deljenje je ustavljeno. Prej zajeta slika, če je še priložena, je datiran posnetek.';
}
async function connectScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) { notice('Zajem zaslona tu ni podprt. Dodaj sliko, prilepi sliko ali besedilo.'); return; }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    disconnect(); state.capture = stream; const video = $('screen-video'); video.srcObject = stream; video.hidden = false; await video.play();
    const track = stream.getVideoTracks()[0]; if (!track) throw Error('NO_TRACK');
    track.addEventListener('ended', () => { if (state.capture === stream) disconnect(); }, { once: true });
    $('capture-frame').disabled = false; $('disconnect-screen').hidden = false;
    $('capture-status').textContent = 'Izbrani zaslon je povezan za lokalni predogled. Pred pošiljanjem preveri, da prikazuje CPQ. URL ni preverjen.';
  } catch (e) { disconnect(); notice(e.name === 'NotAllowedError' ? 'Deljenje ni bilo dovoljeno. Uporabi sliko ali besedilni izsek.' : 'Zaslona ni bilo mogoče povezati. Dodaj sliko ali izsek.'); }
}
async function captureFrame() {
  const video = $('screen-video'), track = state.capture?.getVideoTracks()[0];
  if (!track || track.readyState !== 'live' || !video.videoWidth) throw Error('Svežega zaslona ni. Poveži ga ponovno ali dodaj sliko.');
  const canvas = document.createElement('canvas'), factor = Math.min(1, 2200 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * factor); canvas.height = Math.round(video.videoHeight * factor);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const snapshot = await snapshotFromURL(canvas.toDataURL('image/jpeg', .93), 'display_capture'); setSnapshot(snapshot); return snapshot;
}
async function drawCrop() {
  if (!state.snapshot) return;
  const image = new Image(); image.src = state.snapshot.dataUrl; await image.decode();
  const x = Math.min(99, Math.max(0, Number($('crop-x').value) || 0)), y = Math.min(99, Math.max(0, Number($('crop-y').value) || 0));
  const w = Math.min(100 - x, Math.max(1, Number($('crop-width').value) || 1)), h = Math.min(100 - y, Math.max(1, Number($('crop-height').value) || 1));
  const canvas = $('crop-canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * w / 100)); canvas.height = Math.max(1, Math.round(image.naturalHeight * h / 100));
  canvas.getContext('2d').drawImage(image, image.naturalWidth * x / 100, image.naturalHeight * y / 100, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
}

async function send(event) {
  event?.preventDefault(); if (state.busy) return;
  if (!navigator.onLine) { notice('Brez povezave. Vprašanje ostane osnutek; pozneje ga pošlji sam.'); return; }
  if (!state.ready) { notice('Pomočnik še ni dosegljiv. Preveri dostop v nastavitvah.'); return; }
  if (!$('message').value.trim()) { $('message').focus(); return; }
  setBusy(true); notice(''); const controller = new AbortController(); state.controller = controller;
  let answer, start;
  try {
    if ($('capture-on-send').checked) {
      if (state.frozen) throw Error('Pri zamrznjenem vhodu svež zajem ni dovoljen. Odstrani zamrznitev.');
      await captureFrame();
    }
    const request = bodyForInput();
    if (state.frozen && await digest(canonicalInput(request)) !== state.frozen.hash) throw Error('Vhod se je spremenil. Zamrzni ga ponovno.');
    const canonical = canonicalInput(request), promptHash = await digest(request.message), inputHash = await digest(canonical);
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const history = request.history;
    const inputRecord = { prompt: request.message, promptId: state.promptId, promptHash, inputHash, canonical: JSON.parse(canonical), taskId: $('pilot-task').value,
      comparisonMode: $('comparison-mode').value, promptVersion: PROMPT_VERSION, historyHash: await digest(JSON.stringify(history)), historyCount: history.length };
    request.history = history; request.clientRequestId = uuid();
    state.messages.push({ role: 'user', content: request.message, input: inputRecord });
    answer = { role: 'assistant', content: '', status: 'streaming', input: inputRecord, meta: {}, startedAt: new Date().toISOString(), ttftMs: null, totalMs: null };
    state.messages.push(answer); renderMessages(); $('message').value = ''; state.promptId = null; fitComposer();
    start = performance.now();
    const response = await fetch(API, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal });
    if (!response.ok) { if ([401, 403].includes(response.status)) ownerAccess(false); const body = await response.json().catch(() => ({})); throw Object.assign(Error(issue(body.error?.code)), { code: body.error?.code }); }
    if (!response.headers.get('content-type')?.includes('text/event-stream')) throw Error('Strežnik ni vrnil pretočnega odgovora.');
    let terminal = false;
    for await (const frame of sseEvents(response.body, controller.signal)) {
      if (controller.signal.aborted) break;
      if (frame.clientRequestId !== request.clientRequestId) throw Error('Odgovor se ne ujema z zahtevo.');
      if (frame.type === 'meta') {
        answer.meta = frame;
        if (request.snapshot && frame.snapshot?.sha256 !== request.snapshot.sha256) throw Error('Strežnik ni potrdil iste slike.');
        answer.statusNode.textContent = 'Pomočnik pripravlja odgovor …';
      }
      if (frame.type === 'identity') Object.assign(answer.meta, { observedModel: frame.model, observedReasoning: frame.reasoning, providerRequestId: frame.providerRequestId, responseId: frame.responseId });
      if (frame.type === 'delta' && !terminal) {
        if (answer.ttftMs === null) answer.ttftMs = performance.now() - start;
        answer.content += frame.text; answer.contentNode.textContent = answer.content;
      }
      if (frame.type === 'done') { answer.status = frame.status === 'complete' ? 'complete' : 'partial'; Object.assign(answer.meta, frame); if (frame.budget) showUsage(frame.budget); terminal = true; }
      if (frame.type === 'error') { answer.status = frame.code === 'CANCELLED' ? 'cancelled' : 'partial'; answer.meta.error = frame.code; notice(issue(frame.code)); terminal = true; }
    }
    if (!terminal) answer.status = 'partial';
    // This is a one-question attachment. A connected screen can supply a NEW frame.
    if (!state.frozen) setSnapshot(null);
  } catch (e) {
    if (answer) { answer.status = controller.signal.aborted ? 'cancelled' : 'partial'; answer.meta.error = controller.signal.aborted ? 'CANCELLED' : e.code || 'NETWORK_OR_PROTOCOL_ERROR'; }
    notice(controller.signal.aborted ? 'Odgovor ustavljen. Prejeti del ostane v pogovoru.' : e.message);
  } finally {
    try {
      if (answer) { answer.totalMs = performance.now() - start; if (answer.status === 'streaming') answer.status = 'partial'; finishMessage(answer); }
    } catch {
      if (answer?.contentNode) answer.contentNode.textContent = answer.content;
      notice('Prikaz izhoda ni bil dokončan. Izvirno besedilo ostane v pogovoru in izvozu.');
    } finally { state.controller = null; setBusy(false); localWrite(); }
  }
}

async function freeze() {
  if (state.busy) return;
  if (!$('message').value.trim()) { notice('Najprej napiši skupno vprašanje.'); return; }
  if ($('capture-on-send').checked) { notice('Za zamrznjen vhod najprej zajemi sliko, nato izključi zajem ob pošiljanju.'); return; }
  const body = { ...bodyForInput(), history: conversationHistory() }, canonical = canonicalInput(body);
  state.frozen = { body, hash: await digest(canonical), frozenAt: new Date().toISOString(), historyHash: await digest(JSON.stringify(body.history)) };
  $('frozen-status').textContent = `Zamrznjeno ${state.frozen.frozenAt} · SHA-256 ${state.frozen.hash} · slika ${body.snapshot?.id || 'BREZ SLIKE'}. Prvemu pomočniku ne podaj odgovora drugega.`;
  $('unfreeze-input').hidden = false; $('frozen-badge').hidden = false;
}
function comparisonText() {
  const b = state.frozen?.body || bodyForInput();
  return `NAČIN IN STORITEV (točna polja zamrznjenega vhoda):\n${JSON.stringify({ mode: b.mode, service: b.service || null })}\n\nPREDHODNI POGOVOR (zamrznjen pred odgovorom):\n${JSON.stringify(b.history || [], null, 2)}\n\nVPRAŠANJE:\n${b.message}\n\nKONTEKST (uporabniški podatki):\n${b.context.text || '(brez izseka)'}\nOkolje: ${b.context.environment}; ročni URL: ${b.context.manualUrl || 'UNKNOWN'}\nSlika: ${b.snapshot ? `${b.snapshot.id}; ${b.snapshot.sha256}; ${b.snapshot.capturedAt}; ${b.snapshot.method}. Priloži isto sliko.` : 'BREZ SLIKE'}\nIzvirna osnova: ai-pomocnik-omnicpq v15/v0.1.5; ZIP SHA-256 ${state.health?.skill?.zipSha256 || 'UNKNOWN'}.\nPoziv ID: ${b.promptId || 'CUSTOM'}; pozivi SHA-256 ${PROMPTS_SHA256}.\nPWA host delta: ${state.health?.adapterDelta || 'UNKNOWN'}. Native ChatGPT mora imeti paket posebej naložen; ta tekst ga ne namesti.`;
}
function comparisonReady() {
  return state.ownerVerified && state.health?.skill?.version === 'v0.1.5' && state.health?.skill?.promptsSha256 === PROMPTS_SHA256 &&
    $('copilot-v15-confirmed').checked && $('copilot-import-evidence').value.trim().length > 15;
}
function updateComparisonGate() {
  const ready = comparisonReady(); $('other-start').disabled = !ready; $('save-comparison').disabled = !ready;
  $('comparison-gate').textContent = ready ? 'v15 osnova PWA je preverjena; Copilotov uvoz je naveden kot USER_REPORTED z dodanim dokazom. Primerjavo še vedno preveri po skupnem protokolu.' : 'Primerjava zadržana. PWA potrebuje preverjen v15, Copilot pa dokaz dejanskega uvoza iste izdaje.';
}
async function saveComparison() {
  if (!comparisonReady()) { notice('Primerjava počaka, dokler oba pomočnika ne uporabljata istega v15.'); return; }
  if (!$('other-answer').value.trim()) { notice('Za zapis primerjave dodaj dejanski odgovor drugega pomočnika.'); return; }
  const timing = state.otherTiming;
  const input = state.frozen?.body || bodyForInput();
  const hash = state.frozen?.hash || await digest(canonicalInput(input));
  const own = [...state.messages].reverse().find(m => m.role === 'assistant' && m.input?.inputHash === hash);
  const contextNotes = $('other-context').value.trim();
  state.comparisons.push({ id: uuid(), recordedAt: new Date().toISOString(), taskId: $('pilot-task').value, mode: $('comparison-mode').value,
    input: JSON.parse(canonicalInput(input)), inputHash: hash, promptHash: await digest(input.message), frozenAt: state.frozen?.frozenAt || null,
    skill: state.health?.skill || 'UNKNOWN', adapterDelta: state.health?.adapterDelta || 'UNKNOWN',
    pwa: own ? { input: own.input, response: own.content, status: own.status, ttftMs: own.ttftMs, totalMs: own.totalMs, meta: own.meta } : { status: 'NOT_RUN' },
    other: { platform: $('other-platform').value, observedModelReasoning: $('other-model').value || 'UNKNOWN', response: $('other-answer').value,
      skillImport: { version: 'v15/v0.1.5', evidence: $('copilot-import-evidence').value, status: 'USER_REPORTED_NOT_INDEPENDENTLY_VERIFIED' },
      timing: timing ? { startedAt: timing.startedAt, ttftMs: timing.first === null ? 'UNKNOWN' : timing.first - timing.start, totalMs: timing.end === null ? 'UNKNOWN' : timing.end - timing.start, method: 'manual_observation' } : 'UNKNOWN',
      contextAndSkillEvidence: contextNotes || 'UNKNOWN', usage: 'UNKNOWN', cost: 'UNKNOWN' },
    equivalence: own?.input?.inputHash === hash && contextNotes ? 'USER_RECORDED_REQUIRES_REVIEW' : 'CONTEXT_NOT_PROVEN_EQUAL',
    evaluation: $('comparison-review').value || 'NOT_EVALUATED', status: state.health?.simulation ? 'SIMULATION_NOT_LIVE_AB' : 'RECORDED_NOT_AUTOMATICALLY_VALIDATED' });
  $('comparison-count').textContent = `Zapisanih primerjav: ${state.comparisons.length}. Model in kontekst sta potrjena le v navedenem dokaznem obsegu.`; localWrite(); notice('Zapis primerjave dodan.');
}

function initCards() {
  for (const prompt of PROMPTS) {
    const nav = element('button'); nav.type = 'button'; nav.dataset.mode = prompt.mode; nav.append(element('span', '', prompt.symbol), document.createTextNode(prompt.short)); nav.onclick = () => { clearFrozen(); setMode(prompt.mode); localWrite(); }; $('mode-nav').append(nav);
    const button = element('button', 'card'); button.type = 'button'; button.dataset.prompt = prompt.id;
    button.append(element('span', 'number', prompt.symbol), element('strong', '', prompt.title), element('p', '', prompt.description), element('span', 'arrow', '↗'));
    button.onclick = () => setDraft(prompt.message, prompt.mode, prompt.id); $('start-cards').append(button);
  }
  for (const prompt of SECONDARY) { const b = element('button', '', prompt.title); b.dataset.prompt = prompt.id; b.onclick = () => { setDraft(prompt.message, prompt.mode, prompt.id); if (prompt.capture) $('context-panel').open = true; }; $('quick-actions').append(b); }
  for (const p of PILOT) $('pilot-task').add(new Option(`${p.id} · ${p.title}`, p.id));
}

async function installWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) { $('install-status').textContent += ' To okolje ne omogoča preverjanja service workerja.'; return; }
  try {
    registration = await navigator.serviceWorker.register(new URL('./sw.js', location.href), { scope: new URL('./', location.href).pathname });
    const waiting = () => { if (registration.waiting) $('update-bar').hidden = false; };
    waiting(); registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', waiting));
    $('apply-update').onclick = () => {
      if (state.busy || state.snapshot) { notice('Posodobitev počaka: najprej dokončaj odgovor in uporabi ali odstrani priloženo sliko.'); return; }
      if ($('other-answer').value.trim() || $('comparison-review').value.trim() || $('other-context').value.trim()) { notice('Pred posodobitvijo shrani in izvozi razdelano primerjavo ter počisti njena vnosna polja.'); return; }
      if (!state.persist && (state.messages.length || state.comparisons.length || $('message').value.trim() || $('context-text').value.trim() || $('manual-url').value.trim())) { notice('Za ohranitev pogovora med posodobitvijo vklopi lokalno shranjevanje v nastavitvah ali najprej izvozi in odpri nov pogovor.'); return; }
      if (!localWrite()) return;
      if (registration.waiting) { registration.waiting.postMessage({ type: 'APPLY_UPDATE' });
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); }
    };
  } catch { $('install-status').textContent += ' Service worker v tem okolju ni bil potrjen.'; }
}

initCards(); ownerAccess(false);
try {
  const prefs = JSON.parse(localStorage.getItem(PREFS) || '{}');
  $('theme').value = prefs.theme === 'light' ? 'light' : 'dark'; document.documentElement.dataset.theme = $('theme').value;
  state.profile = prefs.profile === 'careful' ? 'careful' : 'fast'; $('profile').value = state.profile;
  state.persist = prefs.persist === true; $('persist').checked = state.persist;
  if (state.persist) {
    const data = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (data?.schema === 'omnicpq.session.v1' && Array.isArray(data.messages)) {
      state.accountId = data.accountId || null;
      state.messages = data.messages.filter(m => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-100).map(m => ({ ...m, status: m.status === 'streaming' ? 'partial' : m.status }));
      state.comparisons = Array.isArray(data.comparisons) ? data.comparisons : [];
      state.mode = ['work', 'plm', 'jira'].includes(data.mode) ? data.mode : 'work'; $('message').value = String(data.draft || '').slice(0, 16000);
      $('context-text').value = String(data.context?.text || '').slice(0, 16000); $('manual-url').value = String(data.context?.manualUrl || '').slice(0, 1200);
      $('environment').value = ['STAGE', 'PROD'].includes(data.context?.environment) ? data.context.environment : 'UNKNOWN';
    }
  }
} catch { notice('Lokalnega osnutka ni bilo mogoče obnoviti.'); }
setMode(state.mode); renderMessages(); fitComposer();
$('composer').addEventListener('submit', send);
$('message').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
for (const id of ['message', 'context-text', 'manual-url', 'environment', 'service']) $(id).addEventListener('input', () => { if (id === 'message') state.promptId = null; clearFrozen(); fitComposer(); localWrite(); });
$('cancel').onclick = () => state.controller?.abort();
$('settings-open').onclick = () => $('settings-dialog').showModal(); $('settings-close').onclick = () => $('settings-dialog').close();
$('context-toggle').onclick = $('welcome-context').onclick = () => { $('context-panel').open = true; $('context-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
$('profile').onchange = () => { state.profile = $('profile').value; localWrite(); };
$('theme').onchange = () => { document.documentElement.dataset.theme = $('theme').value; localWrite(); };
$('persist').onchange = () => { state.persist = $('persist').checked; localWrite(); notice(state.persist ? 'Lokalno shranjevanje je vključeno. Slike in prijavni podatki so izvzeti.' : 'Lokalna kopija pogovora je odstranjena; pogovor ostane v pomnilniku tega zavihka.'); };
$('clear-data').onclick = () => { if (!confirm('Počistim lokalno shranjeni pogovor in nastavitve te aplikacije? Pogovor v odprtem zavihku ostane.')) return;
  localStorage.removeItem(STORAGE); localStorage.removeItem(PREFS); state.persist = false; $('persist').checked = false; notice('Lokalno shranjeni podatki te aplikacije so počiščeni.'); };
$('new-chat').onclick = () => {
  if (state.messages.length && !confirm('Začnem nov pogovor? Pred tem izvozi podatke, ki jih želiš ohraniti.')) return;
  state.messages = []; clearFrozen(); setSnapshot(null); $('message').value = ''; $('context-text').value = ''; renderMessages(); localWrite(); $('message').focus();
};
$('export-md').onclick = () => saveSession('md'); $('export-json').onclick = () => saveSession('json');
$('connect-screen').onclick = connectScreen; $('disconnect-screen').onclick = disconnect;
$('capture-frame').onclick = () => captureFrame().catch(e => notice(e.message));
$('image-file').onchange = event => { if (event.target.files[0]) addImage(event.target.files[0]); event.target.value = ''; };
document.addEventListener('paste', event => { const image = [...(event.clipboardData?.items || [])].find(item => item.type.startsWith('image/')); if (image) { event.preventDefault(); addImage(image.getAsFile(), 'clipboard'); } });
$('remove-snapshot').onclick = () => setSnapshot(null);
$('crop-open').onclick = async () => { if (!state.snapshot) return; for (const [id, value] of [['crop-x',0],['crop-y',0],['crop-width',100],['crop-height',100]]) $(id).value = value; await drawCrop(); $('crop-dialog').showModal(); };
for (const id of ['crop-x','crop-y','crop-width','crop-height']) $(id).oninput = drawCrop;
$('crop-close').onclick = () => $('crop-dialog').close();
$('crop-apply').onclick = async () => { if (!state.snapshot) return; try { setSnapshot(await snapshotFromURL($('crop-canvas').toDataURL('image/png'), 'crop', state.snapshot)); $('crop-dialog').close(); } catch (e) { notice(e.message); } };
$('load-pilot').onclick = () => { const p = PILOT.find(p => p.id === $('pilot-task').value); setDraft(p.message, p.mode); };
$('freeze-input').onclick = freeze; $('unfreeze-input').onclick = clearFrozen;
$('copy-comparison').onclick = () => copy(comparisonText());
$('export-snapshot').onclick = () => { if (!mayExport()) return; const snapshot = state.frozen?.body?.snapshot || state.snapshot; if (!snapshot) { notice('Ni slike za izvoz.'); return; } const a = element('a'); a.href = snapshot.dataUrl; a.download = `CPQ_${snapshot.id}.${snapshot.dataUrl.includes('image/jpeg') ? 'jpg' : 'png'}`; a.click(); };
$('save-comparison').onclick = saveComparison;
for (const id of ['copilot-v15-confirmed','copilot-import-evidence']) $(id).addEventListener('input', updateComparisonGate);
updateComparisonGate();
$('export-comparison').onclick = () => download('OmniCPQ_primerjava.json', JSON.stringify({ schema: 'omnicpq.comparison.v1', exportedAt: new Date().toISOString(), records: state.comparisons, unrunPilot: PILOT.filter(p => !state.comparisons.some(c => c.taskId === p.id)).map(p => ({ ...p, status: 'NOT_RUN' })) }, null, 2));
$('other-start').onclick = () => { state.otherTiming = { start: performance.now(), startedAt: new Date().toISOString(), first: null, end: null }; $('other-first').disabled = false; $('other-end').disabled = false; $('other-timing').textContent = 'Začetek označen ročno. Opazuj prvi vidni tekst.'; };
$('other-first').onclick = () => { if (!state.otherTiming) return; state.otherTiming.first = performance.now(); $('other-first').disabled = true; $('other-timing').textContent = `Ročno opažen prvi tekst: ${stamp(state.otherTiming.first - state.otherTiming.start)}.`; };
$('other-end').onclick = () => { if (!state.otherTiming) return; state.otherTiming.end = performance.now(); $('other-end').disabled = true; $('other-first').disabled = true; $('other-timing').textContent = `Ročno: TTFT ${state.otherTiming.first === null ? 'UNKNOWN' : stamp(state.otherTiming.first - state.otherTiming.start)} · skupaj ${stamp(state.otherTiming.end - state.otherTiming.start)}.`; };
$('login-form').onsubmit = async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const response = await fetch(AUTH, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', email: $('login-email').value, password: $('login-password').value, token: $('demo-code').value.trim() }) });
    const data = await response.json(); if (!response.ok) throw Error(issue(data.error?.code)); await health(); $('settings-dialog').close();
  } catch (e) { $('auth-status').textContent = e.message; }
  finally { $('login-password').value = ''; button.disabled = false; }
};
$('logout').onclick = async () => {
  try {
    const response = await fetch(AUTH, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    if ([401, 403].includes(response.status)) ownerAccess(false);
    const data = await response.json();
    if (!response.ok || data.authenticated !== false) throw Error();
    ownerAccess(false); $('connection').classList.remove('ready'); $('connection').querySelector('span').textContent = 'Potrebna prijava';
    $('auth-status').textContent = 'Odjava je potrjena. Interni pogovor je zaklenjen do nove lastniške prijave.';
  } catch { notice('Odjave ni mogoče potrditi. Pogovor je ohranjen; poskusi ponovno.'); }
};
window.addEventListener('offline', () => { state.controller?.abort(); notice('Brez povezave. Osnutek ostane; vprašanj ne pošiljamo samodejno.'); health(); });
window.addEventListener('online', () => { notice('Povezava je obnovljena. Vprašanje pošlji, ko želiš.'); health(); });
window.addEventListener('beforeunload', event => { if (state.busy || (!state.persist && (state.messages.length || $('message').value.trim() || $('context-text').value.trim() || state.snapshot))) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', disconnect);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event; $('install').hidden = false; });
$('install').onclick = async () => { if (!installEvent) return; await installEvent.prompt(); await installEvent.userChoice; installEvent = null; $('install').hidden = true; };
window.addEventListener('appinstalled', () => { $('install').hidden = true; $('install-status').textContent = 'Brskalnik je potrdil namestitev aplikacije.'; });
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) $('install-status').textContent = 'Ta zagon je v samostojnem prikazu aplikacije.';
$('demo-create').onclick = async () => {
  const button = $('demo-create'); button.disabled = true;
  try { const grant = await demoAction('create_demo'); $('demo-link').value = new URL('./', location.href).href + '#demo=' + grant.token; $('demo-invitation').hidden = false; await listDemos(); }
  catch (e) { notice(e.message); } finally { button.disabled = false; }
};
$('demo-refresh').onclick = listDemos; $('demo-copy').onclick = () => copy($('demo-link').value);
const invitation = new URLSearchParams(location.hash.slice(1)).get('demo');
if (/^[a-f0-9]{64}$/.test(invitation || '')) { $('demo-code').value = invitation; $('demo-code-details').open = true; history.replaceState(null, '', location.pathname + location.search); }
setInterval(() => { if (state.role === 'demo' && !state.busy && navigator.onLine) health(); }, 30000);
health(); installWorker();
