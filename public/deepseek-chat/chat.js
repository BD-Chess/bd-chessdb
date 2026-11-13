'use strict';

const sessionPath = '/deepseek-chat/api/session';
const messagePath = '/deepseek-chat/api/messages';
const jobKey = 'mdlxdcc.deepseek.active.v1';
const pollInterval = 6000;
const maximumPollMs = 3 * 60 * 1000;
const jobIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const stateLabels = {
  queued: 'Vprašanje je v nabiralniku. Čakam na prevzem.',
  acknowledged: 'Izvajalnik je prevzel vprašanje.',
  running: 'Čakam na odgovor DeepSeeka …',
  stopping: 'Zahteva za STOP je poslana. Čakam na potrditev.',
  complete: 'Odgovor je prejet.',
  stopped: 'Izvajalnik je potrdil ustavitev.',
  failed: 'Izvajalnik je sporočil napako.',
  uncertain: 'Izid klica je neznan. Klic se ne bo samodejno ponovil.',
};
const terminalStates = new Set(['complete', 'stopped', 'failed', 'uncertain']);
const ui = Object.fromEntries([
  'page', 'login', 'email', 'password', 'submit', 'logout', 'account', 'status', 'chat',
  'connection', 'transcript', 'composer', 'prompt', 'reasoning', 'stop', 'refresh', 'release', 'send', 'delivery',
].map(id => [id, document.getElementById(id)]));

let ready = false;
let activeId = null;
let submitting = false;
let stopping = false;
let canStop = false;
let canRefresh = false;
let pollingUntil = 0;
let pollTimer;
let signedIn = false;
let sessionRevision = 0;
let pollRevision = 0;
let displayedId = null;

function status(text, error = false) {
  ui.status.textContent = text;
  ui.status.dataset.error = String(error);
}

function delivery(text, error = false) {
  ui.delivery.textContent = text;
  ui.delivery.dataset.error = String(error);
}

function updateControls() {
  const composerAvailable = signedIn && ready && !activeId && !submitting && !stopping;
  ui.prompt.disabled = !composerAvailable;
  ui.reasoning.disabled = !composerAvailable;
  ui.send.disabled = !composerAvailable;
  ui.stop.hidden = !activeId || !canStop;
  ui.stop.disabled = !activeId || !canStop || stopping || submitting;
  ui.refresh.hidden = !canRefresh;
  ui.release.hidden = !activeId || !canRefresh || !ready;
}

function readJobId() {
  try {
    const id = sessionStorage.getItem(jobKey);
    return jobIdPattern.test(id ?? '') ? id : null;
  } catch { return null; }
}

function rememberJob(id) {
  try {
    if (id) sessionStorage.setItem(jobKey, id);
    else sessionStorage.removeItem(jobKey);
  } catch { /* The active message remains available for this page visit. */ }
}

function showSession(session) {
  sessionRevision += 1;
  clearTimeout(pollTimer);
  signedIn = session.authenticated === true;
  activeId = signedIn ? readJobId() : null;
  ready = false;
  displayedId = null;
  submitting = false;
  stopping = false;
  canStop = false;
  canRefresh = false;
  ui.page.dataset.signedIn = String(signedIn);
  ui.login.hidden = signedIn;
  ui.logout.hidden = !signedIn;
  ui.account.hidden = !signedIn;
  ui.account.textContent = signedIn ? session.email : '';
  ui.chat.hidden = !signedIn;
  ui.transcript.replaceChildren();
  ui.transcript.hidden = true;
  ui.composer.reset();
  delivery('');
  updateControls();
  status('');
  if (signedIn) {
    ui.connection.textContent = 'Preverjam povezavo z nabiralnikom …';
    void checkConnection(sessionRevision);
  }
}

async function sessionRequest(body) {
  const response = await fetch(sessionPath, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...(body ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : {}),
  });
  if (response.status === 429) throw Error('Preveč poskusov. Počakaj minuto.');
  let result;
  try { result = await response.json(); } catch { throw Error('Prijava trenutno ni na voljo.'); }
  if (!response.ok) {
    throw Error(result?.error === 'INVALID_LOGIN' ? 'Uporabniško ime ali geslo je napačno.' :
      'Prijava trenutno ni na voljo.');
  }
  return result;
}

async function messageRequest({ id, method = 'GET', body } = {}) {
  const url = id ? `${messagePath}/${id}` : messagePath;
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(12000),
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) return { status: response.status, data: null };
  return { status: response.status, data: await response.json() };
}

function sessionExpired() {
  showSession({ authenticated: false });
  status('Za nadaljevanje se prijavi znova.');
}

async function checkConnection(revision) {
  try {
    const { status: code, data } = await messageRequest();
    if (revision !== sessionRevision) return;
    if (code === 401) return sessionExpired();
    ready = code === 200 && data?.available === true;
  } catch {
    if (revision !== sessionRevision) return;
    ready = false;
  }
  ui.connection.textContent = ready ? 'Nabiralnik je pripravljen.' : 'Oddaljeni nabiralnik trenutno ni povezan.';
  canRefresh = !ready;
  updateControls();
  if (ready && activeId) {
    pollingUntil = Date.now() + maximumPollMs;
    void checkMessage(revision, activeId);
  }
}

function addMessage(source, label, value) {
  const entry = document.createElement('article');
  entry.className = 'message';
  entry.dataset.source = source;
  const heading = document.createElement('h2');
  heading.textContent = label;
  const content = document.createElement('p');
  content.textContent = value;
  entry.append(heading, content);
  ui.transcript.hidden = false;
  ui.transcript.append(entry);
  ui.transcript.scrollTop = ui.transcript.scrollHeight;
}

function applyMessage(data, id) {
  if (data?.id !== id || !Object.hasOwn(stateLabels, data.state) ||
      typeof data.prompt !== 'string' || !data.prompt.trim() || data.prompt.length > 8000) return false;
  if (data.state === 'complete' && (typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > 64000)) return false;
  if (displayedId !== id) {
    addMessage('owner', 'Ti', data.prompt);
    displayedId = id;
  }
  if (data.state === 'complete') addMessage('model', 'DeepSeek', data.reply);
  delivery(stateLabels[data.state], data.state === 'failed' || data.state === 'uncertain');
  if (terminalStates.has(data.state)) {
    activeId = null;
    canRefresh = false;
    canStop = false;
  } else {
    canStop = data.state !== 'stopping';
  }
  updateControls();
  return true;
}

function schedulePoll(revision, id) {
  if (Date.now() >= pollingUntil) {
    canRefresh = true;
    delivery('Odgovor še ni potrjen. Stanje lahko preveriš znova.');
    updateControls();
    return;
  }
  clearTimeout(pollTimer);
  pollTimer = setTimeout(() => void checkMessage(revision, id), pollInterval);
}

async function checkMessage(revision, id) {
  const check = ++pollRevision;
  clearTimeout(pollTimer);
  let result;
  try { result = await messageRequest({ id }); } catch { result = { status: 0 }; }
  if (revision !== sessionRevision || check !== pollRevision || id !== activeId) return;
  if (result.status === 401) return sessionExpired();
  if (result.status === 200 && applyMessage(result.data, id)) {
    if (ui.prompt.value.trim() === result.data.prompt) ui.prompt.value = '';
    if (activeId) schedulePoll(revision, id);
    return;
  }
  canRefresh = true;
  updateControls();
  delivery('Stanje vprašanja trenutno ni potrjeno. Preveri stanje pred naslednjim pošiljanjem.', true);
}

ui.composer.addEventListener('submit', async event => {
  event.preventDefault();
  const prompt = ui.prompt.value.trim();
  if (!ready || activeId || submitting || !prompt || prompt.length > 8000) return;
  const revision = sessionRevision;
  const previousId = readJobId();
  const id = crypto.randomUUID();
  activeId = id;
  submitting = true;
  updateControls();
  rememberJob(id);
  delivery('Oddajam vprašanje v nabiralnik …');
  let result;
  try {
    result = await messageRequest({ method: 'POST', body: { id, prompt, reasoning: ui.reasoning.checked } });
  } catch { result = { status: 0 }; }
  if (revision !== sessionRevision) return;
  submitting = false;
  if (result.status === 401) return sessionExpired();
  if (result.status === 202 && applyMessage(result.data, id)) {
    ui.prompt.value = '';
    if (activeId) {
      pollingUntil = Date.now() + maximumPollMs;
      schedulePoll(revision, id);
    }
  } else if ([400, 403, 413, 422, 429].includes(result.status)) {
    activeId = null;
    rememberJob(previousId);
    delivery('Vprašanje je bilo zavrnjeno. Besedilo je ostalo v vnosu.', true);
  } else {
    canRefresh = true;
    delivery('Oddaja ni potrjena. Preveri stanje istega vprašanja.', true);
  }
  updateControls();
});

ui.refresh.addEventListener('click', () => {
  canRefresh = false;
  updateControls();
  if (!ready || !activeId) {
    void checkConnection(sessionRevision);
    return;
  }
  pollingUntil = Date.now() + maximumPollMs;
  void checkMessage(sessionRevision, activeId);
});

ui.release.addEventListener('click', () => {
  if (!activeId || !canRefresh || !ready) return;
  if (!window.confirm('Oddani klic lahko še teče. Opustim čakanje in omogočim nov poziv?')) return;
  clearTimeout(pollTimer);
  pollRevision += 1;
  activeId = null;
  rememberJob(null);
  canRefresh = false;
  canStop = false;
  delivery('Čakanje je opuščeno. Izid prejšnjega klica je neznan.', true);
  updateControls();
});

ui.stop.addEventListener('click', async () => {
  if (ui.stop.disabled || !activeId) return;
  const id = activeId;
  const revision = sessionRevision;
  pollRevision += 1;
  clearTimeout(pollTimer);
  stopping = true;
  updateControls();
  let result;
  try { result = await messageRequest({ id, method: 'POST', body: { action: 'stop' } }); } catch { result = { status: 0 }; }
  if (revision !== sessionRevision) return;
  stopping = false;
  updateControls();
  if (id !== activeId) return;
  if (result.status === 401) return sessionExpired();
  if (result.status !== 202 || !applyMessage(result.data, id)) {
    canRefresh = true;
    updateControls();
    delivery('Oddaja STOP ni potrjena. Preveri trenutno stanje.', true);
  } else if (activeId) {
    pollingUntil = Date.now() + maximumPollMs;
    schedulePoll(revision, id);
  }
});

ui.login.addEventListener('submit', async event => {
  event.preventDefault();
  if (ui.submit.disabled) return;
  ui.submit.disabled = true;
  status('Preverjam prijavo …');
  const credentials = { action: 'login', email: ui.email.value, password: ui.password.value };
  ui.password.value = '';
  try {
    showSession(await sessionRequest(credentials));
  } catch (error) {
    status(error.message, true);
    ui.password.focus();
  } finally {
    credentials.password = '';
    ui.submit.disabled = false;
  }
});

ui.logout.addEventListener('click', async () => {
  if (ui.logout.disabled) return;
  ui.logout.disabled = true;
  try {
    showSession(await sessionRequest({ action: 'logout' }));
    ui.email.focus();
  } catch (error) {
    status(error.message, true);
  } finally {
    ui.logout.disabled = false;
  }
});

sessionRequest().then(showSession, () => status('Prijava trenutno ni na voljo.', true));
