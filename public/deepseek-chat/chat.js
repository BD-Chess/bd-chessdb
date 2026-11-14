'use strict';

const sessionPath = '/deepseek-chat/api/session';
const messagePath = '/deepseek-chat/api/messages';
const jobKey = 'mdlxdcc.deepseek.active.v1';
const recentKey = 'mdlxdcc.deepseek.recent.v2';
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
  'work', 'operation', 'project-field', 'project', 'load-projects', 'recent', 'reopen', 'prompt-label',
  'review', 'diff', 'binding', 'check-diff', 'reject', 'approve', 'review-rhp',
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
let finishedId = null;
let workReady = false;
let proposal;
let rhpSource;
let activeOperation = 'chat';
const operations = {chat:'Klepet', projects:'Projekti', plan:'Plan', build:'Build',
  approve:'Potrditev', reject:'Zavrnitev', status:'Stanje',review:'RHP'};
const statuses = {
  planned:'Načrt je pripravljen.', reviewed:'Presoja RHP je pripravljena.', proposed:'Diff čaka na odločitev.', applied:'Popravek je zapisan.',
  rejected:'Predlog je zavrnjen.', failed:'Izvajalnik je sporočil napako.', cancelled:'Izvajanje je ustavljeno.',
  needs_review:'Izid ni potrjen. Preglej stanje na WORK.', running:'Izvajanje na WORK še teče.',
};
const statusFor = {
  queued:'Zahteva je v nabiralniku. Čakam na prevzem.', acknowledged:'Izvajalnik na WORK je prevzel zahtevo.',
  running:'Izvajanje na WORK teče.', stopping:'Zahteva za ustavitev je oddana.', complete:'Rezultat je prejet.',
};


function status(text, error = false) {
  ui.status.textContent = text;
  ui.status.dataset.error = String(error);
}

function delivery(text, error = false) {
  ui.delivery.textContent = text;
  ui.delivery.dataset.error = String(error);
}

function updateControls() {
  const idle = signedIn && ready && !activeId && !submitting && !stopping;
  const workOperation = workReady && ui.operation.value !== 'chat';
  const composerAvailable = idle && (!workOperation || Boolean(ui.project.value));
  ui.work.hidden = !signedIn || !workReady;
  ui.operation.disabled = !idle;
  ui['project-field'].hidden = !workOperation;
  ui['load-projects'].hidden = !workOperation;
  ui['load-projects'].disabled = !idle;
  ui.project.disabled = !idle;
  ui.recent.disabled = !idle;
  ui.reopen.disabled = !idle || !ui.recent.value;
  ui['review-rhp'].hidden = !rhpSource;
  ui['review-rhp'].disabled = !idle || !rhpSource;
  ui['prompt-label'].textContent = workOperation ? 'Naloga za izbrani projekt' : 'Sporočilo';
  ui.prompt.disabled = !composerAvailable;
  ui.reasoning.disabled = !composerAvailable || workOperation;
  ui.reasoning.closest('label').hidden = workOperation;
  ui.send.textContent = workOperation ? (ui.operation.value === 'plan' ? 'Pripravi načrt' : 'Pripravi diff') : 'Pošlji';
  ui.send.disabled = !composerAvailable;
  ui.review.hidden = !signedIn || !proposal;
  ui.reject.disabled = !idle;
  ui.approve.disabled = !idle || !ui['check-diff'].checked;
  ui.stop.hidden = !activeId || !canStop;
  ui.stop.disabled = !activeId || !canStop || stopping || submitting;
  ui.refresh.hidden = !canRefresh;
  ui.refresh.disabled = !canRefresh || stopping || submitting;
  ui.release.hidden = !activeId || !canRefresh || !ready;
  ui.release.disabled = !activeId || !canRefresh || !ready || stopping || submitting;
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

function recent() {
  try {
    const value = JSON.parse(sessionStorage.getItem(recentKey) || '[]');
    return Array.isArray(value) ? value.filter(row => jobIdPattern.test(row?.id ?? '') &&
      Object.hasOwn(operations,row.operation)).slice(0,12) : [];
  } catch { return []; }
}

function refreshRecent() {
  ui.recent.replaceChildren(new Option('Izberi zahtevo',''),
    ...recent().map(row => new Option(operations[row.operation] + ' · ' + row.id.slice(0,8),row.id)));
}

function rememberRecent(id, operation) {
  if (!Object.hasOwn(operations,operation)) return;
  try {
    sessionStorage.setItem(recentKey,JSON.stringify([{id,operation},...recent().filter(row => row.id !== id)].slice(0,12)));
  } catch { /* Existing active-id recovery remains available. */ }
  refreshRecent();
}

function clearReview() {
  proposal = undefined;
  rhpSource = undefined;
  ui['check-diff'].checked = false;
  ui.diff.textContent = '';
  ui.binding.textContent = '';
}

function showSession(session) {
  sessionRevision += 1;
  clearTimeout(pollTimer);
  signedIn = session.authenticated === true;
  activeId = signedIn ? readJobId() : null;
  ready = false;
  workReady = false;
  activeOperation = 'chat';
  finishedId = null;
  ui.operation.value = 'chat';
  ui.project.replaceChildren(new Option('Pridobi projekte z WORK',''));
  clearReview();
  refreshRecent();
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
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    return {status:response.status,data:result};
  }
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
    workReady = ready && data?.work === true;
  } catch {
    if (revision !== sessionRevision) return;
    ready = false;
    workReady = false;
  }
  ui.connection.textContent = ready ? 'Nabiralnik je pripravljen.' : 'Oddaljeni nabiralnik trenutno ni povezan.';
  canRefresh = !ready;
  updateControls();
  if (ready && activeId) {
    pollingUntil = Date.now() + maximumPollMs;
    void checkMessage(revision, activeId);
  }
}

function addMessage(source, label, value, preformatted = false) {
  const entry = document.createElement('article');
  entry.className = 'message';
  entry.dataset.source = source;
  const heading = document.createElement('h2');
  heading.textContent = label;
  const content = document.createElement(preformatted ? 'pre' : 'p');
  content.textContent = value;
  entry.append(heading, content);
  ui.transcript.hidden = false;
  ui.transcript.append(entry);
  ui.transcript.scrollTop = ui.transcript.scrollHeight;
  return entry;
}

function showWorkflow(data) {
  const result = data.result;
  if (data.operation === 'projects' && Array.isArray(result?.projects)) {
    const selected = ui.project.value;
    ui.project.replaceChildren(new Option('Izberi projekt',''),...result.projects.map(({id,label}) => new Option(label,id)));
    if (result.projects.some(row => row.id === selected)) ui.project.value = selected;
  }
  let article;
  if (result?.plan) article = addMessage('model','Načrt',result.plan,true);
  if (result?.review) article = addMessage('model','Presoja RHP',result.review,true);
  if (data.state === 'complete' && (data.operation === 'build' && result?.status === 'proposed' ||
      data.operation === 'plan' && result?.status === 'planned')) {
    rhpSource = {project:result.project,jobId:data.id,reasoning:true};
  }
  if (result?.testReport || result?.readbackSha256) {
    let report = result.testReport ?? '';
    if (result.readbackSha256) report += (report ? '\n\n' : '') + 'SHA-256 ponovnega odčitka ' + result.readbackSha256;
    article = addMessage('model','Rezultat testa',report,true);
  }
  if (result?.reply) article = addMessage('model','DeepSeek',result.reply);
  if (data.operation === 'build' && result?.status === 'proposed' && result.diff && result.proposalId && result.baseSha256 && result.diffSha256) {
    proposal = {buildId:data.id,project:result.project,proposalId:result.proposalId,baseSha256:result.baseSha256,diffSha256:result.diffSha256};
    ui['check-diff'].checked = false;
    ui.diff.textContent = result.diff;
    ui.binding.textContent = proposal.project + '\n' + proposal.proposalId + '\nOsnova ' + proposal.baseSha256 +
      '\nSHA-256 diffa ' + proposal.diffSha256;
  }
  if (data.zip) {
    article ??= addMessage('model',operations[data.operation],statuses[result?.status] ?? 'Poročilo je pripravljeno.');
    const link = document.createElement('a');
    link.textContent = 'Prenesi Markdown ZIP';
    link.href = messagePath + '/' + data.id + '?download=zip';
    article.append(link);
  }
}

function applyMessage(data, id) {
  if (data?.id !== id || !Object.hasOwn(stateLabels, data.state)) return false;
  const workflow = Object.hasOwn(operations,data.operation);
  if (!workflow && (typeof data.prompt !== 'string' || !data.prompt.trim() || data.prompt.length > 8000 ||
      (data.state === 'complete' && (typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > 64000)))) return false;
  activeOperation = workflow ? data.operation : 'chat';
  if (displayedId !== id) {
    if (workflow) rememberRecent(id,data.operation);
    addMessage('owner',workflow ? operations[data.operation] : 'Ti', data.prompt ?? data.project ?? 'WORK');
    displayedId = id;
  }
  if (terminalStates.has(data.state) && finishedId !== id) {
    finishedId = id;
    if (workflow) showWorkflow(data);
    else if (data.state === 'complete') addMessage('model','DeepSeek',data.reply);
  }
  const outcome = workflow ? statuses[data.result?.status] ?? statusFor[data.state] ?? stateLabels[data.state] : stateLabels[data.state];
  delivery(outcome + (data.error ? ' (' + data.error + ')' : ''), data.state === 'failed' || data.state === 'uncertain');
  canRefresh = false;
  if (terminalStates.has(data.state)) {
    activeId = null;
    canStop = false;
  } else {
    canStop = ['chat','plan','build'].includes(activeOperation) && data.state !== 'stopping';
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
  delivery('Stanje vprašanja še ni potrjeno. Preverjanje se nadaljuje.', true);
  updateControls();
  schedulePoll(revision, id);
}

async function submitMessage(operation, data) {
  if (!ready || activeId || submitting) return;
  const revision = sessionRevision;
  const previousId = readJobId();
  const id = crypto.randomUUID();
  activeId = id;
  activeOperation = operation;
  submitting = true;
  updateControls();
  rememberJob(id);
  delivery('Oddajam zahtevo v nabiralnik …');
  let result;
  try {
    const body = workReady ? {id,operation,...data} : {id,...data};
    result = await messageRequest({method:'POST',body});
  } catch { result = {status:0}; }
  if (revision !== sessionRevision) return;
  submitting = false;
  if (result.status === 401) return sessionExpired();
  if ([400,403,409,413,422,429].includes(result.status)) {
    activeId = null;
    rememberJob(previousId);
    delivery('Zahteva je zavrnjena. Vnos je ohranjen.',true);
  } else {
    clearReview();
    if (workReady) rememberRecent(id,operation);
    if (result.status === 202 && applyMessage(result.data,id)) {
      if (data.prompt) ui.prompt.value = '';
      if (activeId) {
        pollingUntil = Date.now() + maximumPollMs;
        schedulePoll(revision,id);
      }
    } else {
      delivery('Oddaja ni potrjena. Preverjam stanje iste zahteve.',true);
      pollingUntil = Date.now() + maximumPollMs;
      void checkMessage(revision,id);
    }
  }
  updateControls();
}

ui.composer.addEventListener('submit', event => {
  event.preventDefault();
  const prompt = ui.prompt.value.trim();
  if (!prompt || prompt.length > 8000) return;
  const operation = workReady ? ui.operation.value : 'chat';
  if (operation === 'chat') void submitMessage(operation,{prompt,reasoning:ui.reasoning.checked});
  else if (ui.project.value) void submitMessage(operation,{prompt,project:ui.project.value});
});
ui.operation.addEventListener('change',updateControls);
ui.project.addEventListener('change',updateControls);
ui.recent.addEventListener('change',updateControls);
ui['load-projects'].addEventListener('click',() => void submitMessage('projects',{}));
ui['check-diff'].addEventListener('change',updateControls);
ui.approve.addEventListener('click',() => {
  if (proposal && ui['check-diff'].checked) void submitMessage('approve',proposal);
});
ui['review-rhp'].addEventListener('click',() => {
  if (rhpSource) void submitMessage('review',rhpSource);
});
ui.reject.addEventListener('click',() => {
  if (proposal) void submitMessage('reject',proposal);
});
ui.reopen.addEventListener('click',() => {
  const id = ui.recent.value;
  if (!jobIdPattern.test(id) || activeId || submitting) return;
  clearReview();
  activeId = id;
  finishedId = null;
  displayedId = null;
  rememberJob(id);
  pollingUntil = Date.now() + maximumPollMs;
  void checkMessage(sessionRevision,id);
  updateControls();
});

ui.refresh.addEventListener('click', () => {
  if (ui.refresh.disabled) return;
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
  if (ui.release.disabled || !activeId) return;
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
  canStop = false;
  updateControls();
  let result;
  try { result = await messageRequest({ id, method: 'POST', body: { action: 'stop' } }); } catch { result = { status: 0 }; }
  if (revision !== sessionRevision) return;
  stopping = false;
  updateControls();
  if (id !== activeId) return;
  if (result.status === 401) return sessionExpired();
  if (result.status !== 202 || !applyMessage(result.data, id)) {
    delivery('Oddaja STOP ni potrjena. Preverjam stanje istega vprašanja.', true);
    pollingUntil = Date.now() + maximumPollMs;
    void checkMessage(revision, id);
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
