const root = new URL('../../', import.meta.url);
const endpoint = new URL('/.netlify/functions/mdlxdcc-guide', location.origin);
const $ = id => document.getElementById(id);
const panel = $('guide-panel'), log = $('guide-messages'), input = $('guide-input'), frame = $('guide-frame');
const storageKey = 'mdlxdcc-guide-conversation-v1';
const words = {
 sl: { title:'MDL×DCC Guide', subtitle:'Javni vodnik', close:'Skrij klepet', welcome:'Kaj te zanima?', intro:'Raziskuj projekte, vprašaj za razlago ali se odpravi na vodeni ogled.', glance:'Začni glance →', projects:'Kaj je MDL×DCC?', dgte:'DGTE: elektrika v €?', placeholder:'Vprašaj o projektu …', send:'Pošlji', fine:'Pogovor ostane v tem zavihku. Vprašanja obdeluje OpenAI. Odgovore preveri ob virih.', reading:'Berem javne vire …', thinking:'Razmišljam …', checking:'Preverjam podatke …', unavailable:'Pomočnik trenutno ni dosegljiv. Poskusi pozneje. Vodeni ogled je na voljo s komentarji iz scenarija.', rate:'Dosežena je omejitev vprašanj. Počakaj minuto in poskusi znova.', timeout:'Odgovor se je zavlekel. Poskusi znova ali skrajšaj vprašanje.', interrupted:'Odgovor je prekinjen.', sources:'Prebrani viri', scenario:'Komentar iz scenarija', next:'Naprej · n', pause:'Pavza', resume:'Nadaljuj', back:'Nazaj', stop:'Končaj', home:'Na začetno', loading:'Odpiram stran …', paused:'Pavza — vprašaj ali nadaljuj.', wait:'Naslednji prizor čez', seconds:'s', completed:'Ogled je končan. Vprašaj o čemerkoli prikazanem.', pageError:'Strani ni bilo mogoče preveriti. Uporabi Naprej ali odpri povezavo neposredno.', unknown:'Izberi: glance, glance it, glance devices, glance creative, glance ai8 ali glance theories.', ready:'GPT · javni viri', offline:'Javni vodnik · povezava ni na voljo', tour:'Ogled', external:'Odpri stran v zavihku', truncated:'Odgovor je skrajšan. Za nadaljevanje postavi dodatno vprašanje.' },
 en: { title:'MDL×DCC Guide', subtitle:'Public guide', close:'Hide chat', welcome:'What are you curious about?', intro:'Explore the projects, ask for an explanation, or take a guided tour.', glance:'Start glance →', projects:'What is MDL×DCC?', dgte:'DGTE: electricity in €?', placeholder:'Ask about a project …', send:'Send', fine:'This conversation stays in this tab. OpenAI processes questions. Check answers against their sources.', reading:'Reading public sources …', thinking:'Thinking …', checking:'Checking the details …', unavailable:'The assistant is currently unavailable. Try again later. The guided tour is available with comments from its script.', rate:'The question limit has been reached. Wait a minute and try again.', timeout:'The answer took too long. Try again or shorten the question.', interrupted:'The answer was interrupted.', sources:'Sources read', scenario:'Comment from the tour script', next:'Next · n', pause:'Pause', resume:'Resume', back:'Back', stop:'Finish', home:'Back to landing', loading:'Opening the page …', paused:'Paused — ask a question or resume.', wait:'Next scene in', seconds:'s', completed:'The tour is complete. Ask about anything you have seen.', pageError:'This page could not be verified. Choose Next or open the link directly.', unknown:'Choose: glance, glance it, glance devices, glance creative, glance ai8 or glance theories.', ready:'GPT · public sources', offline:'Public guide · connection unavailable', tour:'Tour', external:'Open page in a tab', truncated:'The answer was shortened. Ask a follow-up to continue.' }
};
const lang = () => document.documentElement.lang.toLowerCase().startsWith('sl') ? 'sl' : 'en';
const w = key => words[lang()][key] || key;
let messages = [], available = null, activeRequest = null, requestNumber = 0, tour = null, sceneNumber = 0, timer = null, manifestPromise, catalogPromise;
const allowed = new Set(['/', '/index.html', '/index-atlas.html', '/index-demo.html', '/BD/', '/Trip/demo.html']);
const publicScenes = new Set(allowed);
const denied = /(?:^\/(?:WL|WD)(?:\/|$)|^\/BD\/(?:O(?:\/|$)|BD_kardiolog)|dualframe-lab|(?:^|\/)(?:private|secret)(?:\/|$)|IM3_MentalArena_MALm|\/old\/|\/archive\/)/i;

function sitePath(url) {
 const u = new URL(url, typeof url === 'string' && url.startsWith('/') ? 'https://www.mdlxdcc.org' : root);
 const canonical = ['www.mdlxdcc.org', 'mdlxdcc.org'].includes(u.hostname);
 if (!canonical && (u.origin !== root.origin || !u.pathname.startsWith(root.pathname))) return null;
 const p = canonical ? u.pathname : '/' + u.pathname.slice(root.pathname.length);
 if (denied.test(decodeURIComponent(p)) || /[\\\x00-\x1f]/.test(p)) return null;
 return { path:p, suffix:u.search + u.hash };
}
function localURL(path) { return new URL(path.replace(/^\//, ''), root).href; }
function safeLink(href) { try { const u = new URL(href, typeof href === 'string' && href.startsWith('/') ? 'https://www.mdlxdcc.org' : root); return ['https:', 'http:'].includes(u.protocol) ? u : null; } catch { return null; } }

function scrollEnd() { log.scrollTop = log.scrollHeight; }

// Small DOM-only Markdown renderer: raw HTML and provider text never become executable markup.
function inline(node, text) {
 const re = /\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`/g; let at = 0;
 for (const m of text.matchAll(re)) {
  node.append(document.createTextNode(text.slice(at, m.index)));
  if (m[1]) { const url = safeLink(m[2]); if (url) { const a = document.createElement('a'); a.textContent = m[1]; a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; node.append(a); } else node.append(document.createTextNode(m[1])); }
  else { const el = document.createElement(m[3] ? 'strong' : 'code'); el.textContent = m[3] || m[4]; node.append(el); }
  at = m.index + m[0].length;
 }
 node.append(document.createTextNode(text.slice(at)));
}
function markdown(node, text) {
 node.replaceChildren(); let list = null, pre = null;
 for (const line of text.split('\n')) {
  if (line.startsWith('```')) { if (pre) pre = null; else { pre = document.createElement('pre'); node.append(pre); } list = null; continue; }
  if (pre) { pre.append(document.createTextNode(line + '\n')); continue; }
  if (!line.trim()) { list = null; continue; }
  const item = /^(?:[-*] |\d+\. )(.+)/.exec(line);
  if (item) { if (!list) { list = document.createElement('ul'); node.append(list); } const li = document.createElement('li'); inline(li, item[1]); list.append(li); }
  else { list = null; const p = document.createElement('p'); inline(p, line.replace(/^#{1,6} /, '')); node.append(p); }
 }
}
function renderMessage(m) {
 const article = document.createElement('article'); article.className = 'guide-message'; article.dataset.role = m.role;
 if (m.role !== 'user') { const label = document.createElement('div'); label.className = 'guide-message-label'; label.textContent = m.role === 'scenario' ? w('scenario') : m.role === 'notice' ? w('subtitle') : w('title'); article.append(label); }
 const body = document.createElement('div'); body.className = 'guide-message-body'; if (m.role === 'user') body.textContent = m.content; else markdown(body, m.content);
 if (m.role === 'notice') body.classList.add('guide-error'); article.append(body);
 if (m.sources?.length) {
  const details = document.createElement('details'); details.className = 'guide-source-list'; const summary = document.createElement('summary'); summary.textContent = w('sources') + ' · ' + m.sources.length; details.append(summary);
  const ul = document.createElement('ul'); for (const s of m.sources.slice(0, 8)) { const u = safeLink(s.url); if (!u) continue; const li = document.createElement('li'), a = document.createElement('a'); a.textContent = s.title; a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a); ul.append(li); } details.append(ul); article.append(details);
 }
 m.element = article; m.body = body; return article;
}
function addMessage(role, content, extra = {}) { const m = { role, content, complete:true, ...extra }; messages.push(m); log.append(renderMessage(m)); save(); scrollEnd(); return m; }
function save() {
 try { sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-40).map(({ role,content,complete,sources }) => ({ role,content,complete,sources })))); } catch {}
}

function translate() {
 document.querySelectorAll('[data-guide-text]').forEach(el => { el.textContent = w(el.dataset.guideText); });
 input.placeholder = w('placeholder'); input.setAttribute('aria-label', w('placeholder'));
 $('guide-send').setAttribute('aria-label', w('send')); $('guide-close').setAttribute('aria-label', w('close'));
 $('guide-page-external').setAttribute('aria-label', w('external'));
 $('guide-toggle').setAttribute('aria-label', lang() === 'sl' ? 'AI — odpri ali skrij vodnika' : 'AI — show or hide the guide');
 $('guide-subtitle').textContent = available === true ? w('ready') : available === false ? w('offline') : w('subtitle');
 updateTourStatus();
}
function topSize() { document.documentElement.style.setProperty('--guide-top', document.querySelector('.topbar').getBoundingClientRect().bottom + 'px'); }
new ResizeObserver(topSize).observe(document.querySelector('.topbar'));
window.addEventListener('resize', topSize); window.addEventListener('scroll', topSize, { passive:true });

async function catalog() {
 if (!catalogPromise) catalogPromise = fetch(new URL('site-search-index.json', root)).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(d => { for (const i of d.items || []) { const p = sitePath(i.url); if (p && !/private|protected|password|zasebn|zaščiten/i.test(i.title + ' ' + i.description)) allowed.add(p.path); } }).catch(() => { catalogPromise = null; });
 await catalogPromise;
}
async function manifest() {
 if (!manifestPromise) manifestPromise = fetch(new URL('assets/mdlxdcc-guide/tour.json', root)).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(d => { for (const s of Object.values(d.scenes)) { const p = sitePath(s.path); if (p) { allowed.add(p.path); publicScenes.add(p.path); } } return d; }).catch(e => { manifestPromise = null; throw e; });
 return manifestPromise;
}
async function probe() {
 try { const r = await fetch(endpoint, { cache:'no-store', signal:AbortSignal.timeout(8000) }); const d = r.ok ? await r.json() : {}; available = d.available === true; }
 catch { available = false; } translate();
}
function setOpen(open) {
 if (!open && tour) pauseTour(); panel.hidden = !open; document.body.classList.toggle('guide-open', open); $('guide-toggle').setAttribute('aria-expanded', String(open)); topSize();
 if (open) { catalog(); probe(); requestAnimationFrame(() => { input.focus({ preventScroll:true }); scrollEnd(); }); } else $('guide-toggle').focus({ preventScroll:true });
}
function snapshot() {
 try {
  const p = sitePath(frame.contentWindow.location.href);
  if ($('guide-stage').hidden || !p || !allowed.has(p.path)) return { path:'/', title:document.title, excerpt:$('main').innerText.slice(0, 6000), verified:true };
  const d = frame.contentDocument, title = d.title;
  if ((!publicScenes.has(p.path) && /noindex/i.test(d.querySelector('meta[name=robots]')?.content || '')) || d.querySelector('[data-private],[data-protected]')) return { path:p.path, title:'', excerpt:'', verified:false };
  const text = (d.querySelector('main') || d.body).innerText;
  const missing = /page not found|404[^\n]{0,30}not found/i.test(title + ' ' + (d.querySelector('h1')?.innerText || ''));
  return { path:p.path, title, excerpt:text.slice(0, 6000), verified:d.readyState === 'complete' && text.trim().length > 80 && !missing && d.visibilityState === 'visible' };
 } catch { return { path:'/', title:document.title, excerpt:'', verified:false }; }
}

async function showPage(path, { fromTour = false } = {}) {
 await Promise.all([catalog(), manifest().catch(() => null)]); const p = sitePath(path); if (!p || !allowed.has(p.path)) throw Error('PAGE_UNAVAILABLE');
 if (!fromTour && tour) pauseTour();
 $('guide-stage').hidden = false; document.body.classList.add('guide-viewing'); topSize(); $('guide-page-title').textContent = w('loading');
 const target = localURL(p.path + p.suffix); $('guide-page-external').href = target;
 const loaded = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { frame.removeEventListener('load', done); reject(Error('PAGE_TIMEOUT')); }, 16000);
  function done() {
   let current; try { current = sitePath(frame.contentWindow.location.href); } catch {}
   if (!current || !allowed.has(current.path)) { clearTimeout(timeout); frame.removeEventListener('load', done); reject(Error('PAGE_UNAVAILABLE')); return; }
   clearTimeout(timeout); frame.removeEventListener('load', done); resolve();
  }
  frame.addEventListener('load', done);
 });
 frame.src = target; await loaded;
 await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
 const page = snapshot(); if (!page.verified) throw Error('PAGE_UNAVAILABLE');
 $('guide-page-title').textContent = page.title;
 try { frame.contentDocument.addEventListener('click', event => {
  const a = event.target.closest?.('a[href]'); if (!a || a.getAttribute('href').startsWith('#')) return;
  const next = sitePath(a.href); if (next && allowed.has(next.path)) { event.preventDefault(); showPage(next.path + next.suffix).catch(() => addMessage('notice', w('pageError'))); }
 }, true); } catch {}
 return page;
}
function home() { if (tour) pauseTour(); $('guide-stage').hidden = true; document.body.classList.remove('guide-viewing'); frame.src = 'about:blank'; topSize(); }

function cancelAnswer() { requestNumber++; activeRequest?.abort(); activeRequest = null; $('guide-busy').hidden = true; $('guide-send').disabled = false; log.setAttribute('aria-busy','false'); }
async function ask(message, { recordUser = true, tourComment = false } = {}) {
 const history = messages.filter(m => ['user','assistant'].includes(m.role) && m.complete).slice(-16).map(m => ({ role:m.role, content:m.content }));
 if (recordUser) addMessage('user', message);
 cancelAnswer(); const number = requestNumber, controller = new AbortController(); activeRequest = controller;
 const answer = addMessage('assistant', '', { complete:false }); let done = false; const actions = [];
 $('guide-busy').hidden = false; $('guide-busy').textContent = w('thinking'); $('guide-send').disabled = true; log.setAttribute('aria-busy','true');
 const deadline = setTimeout(() => controller.abort(), 56000);
 try {
  const r = await fetch(endpoint, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ message, history, page:snapshot(), language:lang(), mode:tourComment ? 'tour_comment' : 'chat' }), signal:controller.signal });
  if (!r.ok || !r.headers.get('content-type')?.includes('text/event-stream')) { const error = Error(r.status === 429 ? 'RATE_LIMITED' : 'AI_UNAVAILABLE'); throw error; }
  const reader = r.body.getReader(), decoder = new TextDecoder(); let buffer = '';
  for (;;) {
   const { value, done:ended } = await reader.read(); if (ended) break; if (number !== requestNumber) { await reader.cancel(); throw Error('INTERRUPTED'); }
   buffer += decoder.decode(value, { stream:true });
   let end; while ((end = buffer.indexOf('\n\n')) >= 0) {
    const part = buffer.slice(0, end); buffer = buffer.slice(end + 2); if (!part.startsWith('data: ')) continue;
    const e = JSON.parse(part.slice(6));
    if (e.type === 'delta') { answer.content += e.text; markdown(answer.body, answer.content); scrollEnd(); }
    if (e.type === 'status') $('guide-busy').textContent = w(e.stage);
    if (e.type === 'action') actions.push(e);
    if (e.type === 'error') throw Error(e.code);
    if (e.type === 'notice') addMessage('notice', w('truncated'));
    if (e.type === 'done') { done = true; answer.complete = true; answer.sources = e.sources; available = true; }
   }
  }
  if (!done) throw Error('ANSWER_UNAVAILABLE');
  const old = answer.element, fresh = renderMessage(answer); old.replaceWith(fresh); save(); translate();
  for (const a of actions) if (a.type === 'show_page') await showPage(a.path).catch(() => addMessage('notice', w('pageError')));
  return true;
 } catch (error) {
  if (error.message === 'AI_UNAVAILABLE') { available = false; translate(); }
  if (!answer.content) { answer.element.remove(); messages = messages.filter(m => m !== answer); }
  else { answer.complete = false; const note = document.createElement('p'); note.className = 'guide-error'; note.textContent = w('interrupted'); answer.body.append(note); }
  if (number === requestNumber && !tourComment) addMessage('notice', error.message === 'RATE_LIMITED' ? w('rate') : error.name === 'AbortError' || error.message === 'TIMEOUT' ? w('timeout') : w('unavailable'));
  save(); return false;
 } finally {
  clearTimeout(deadline);
  if (number === requestNumber) { activeRequest = null; $('guide-busy').hidden = true; $('guide-send').disabled = false; log.setAttribute('aria-busy','false'); }
  scrollEnd();
 }
}

function stopClock() { if (timer) { clearInterval(timer); timer = null; } }
function pauseTour() { if (!tour) return; if (tour.deadline) tour.remaining = Math.max(0, tour.deadline - performance.now()); tour.deadline = null; tour.paused = true; stopClock(); updateTourStatus(); }
function updateTourStatus() {
 $('guide-tour').hidden = !tour;
 if (!tour) return;
 const position = `${Math.min(tour.cursor + 1, tour.ids.length)} / ${tour.ids.length}`;
 $('guide-tour-status').textContent = tour.finished ? w('completed') : `${position} · ${tour.loading ? w('loading') : tour.paused ? w('paused') : `${w('wait')} ${Math.ceil(tour.remaining / 1000)} ${w('seconds')}`}`;
 $('guide-pause').textContent = w(tour.paused ? 'resume' : 'pause'); $('guide-next').disabled = Boolean(tour.finished);
}
function armClock() {
 stopClock(); if (!tour || tour.paused || tour.finished || tour.loading) return;
 tour.deadline = performance.now() + tour.remaining;
 timer = setInterval(() => {
  if (!tour) return stopClock();
  if (document.hidden || panel.hidden) return pauseTour();
  tour.remaining = Math.max(0, tour.deadline - performance.now()); updateTourStatus();
  if (tour.remaining === 0) advance();
 }, 250); updateTourStatus();
}
function observeAdapter(scene) {
 const d = frame.contentDocument;
 if (scene.adapter === 'curves-eight') {
  const slider = [...d.querySelectorAll('input[type=range]')].find(x => /curves|krivulj/i.test(x.getAttribute('aria-label') || x.closest('label')?.innerText || ''));
  if (!slider) return 'The requested curves control was not found. Describe only the visible default scene.';
  slider.value = slider.min; slider.dispatchEvent(new Event('input', { bubbles:true }));
  const output = slider.closest('label')?.querySelector('output')?.value;
  return slider.value === '8' && output === '8' ? 'Verified: the Curves control and its visible output both show 8.' : 'The curves change could not be verified.';
 }
 if (scene.adapter === 'trip-growth') {
  const slider = [...d.querySelectorAll('input[type=range]')].find(x => /stops|postank/i.test(x.getAttribute('aria-label') || x.closest('label')?.innerText || ''));
  if (!slider) return 'The Stops control was not found; show the recorded comparison without claiming an interaction.';
  slider.value = slider.max; slider.dispatchEvent(new Event('input', { bubbles:true }));
  return slider.value === slider.max ? `The Stops slider is at its maximum, ${slider.value}. This changes an illustrative estimate, not a solver run.` : 'The slider change could not be verified.';
 }
 return 'This scene is show-only. No game, saved state, account, file or audio control was changed.';
}
async function showScene() {
 if (!tour) return; stopClock(); cancelAnswer(); const number = ++sceneNumber, active = tour; active.loading = true; active.remaining = 60000; active.deadline = null; updateTourStatus();
 try {
  const data = await manifest(), scene = data.scenes[active.ids[active.cursor]];
  await showPage(scene.path, { fromTour:true }); if (number !== sceneNumber || tour !== active) return;
  const observation = observeAdapter(scene), page = snapshot();
  addMessage('notice', `${active.cursor + 1} / ${active.ids.length} · ${scene.title}`);
  let narrated = false;
  if (available === true) narrated = await ask(`Scene: ${scene.title}\nObserved interaction: ${observation}\nPrepared script (reference, not proof of current page): ${scene.narration[lang()] || scene.narration.en}\nComment on the verified page in 2–4 sentences.`, { recordUser:false, tourComment:true });
  if (number !== sceneNumber || tour !== active) return;
  if (!narrated) {
   const text = scene.narration[lang()] || scene.narration.en;
   addMessage('scenario', text + (page.verified ? '' : '\n' + w('pageError')));
  }
  // The dwell begins after navigation, bounded action verification AND the full comment.
  active.loading = false; active.remaining = 60000; armClock(); updateTourStatus();
 } catch {
  if (number !== sceneNumber || tour !== active) return;
  active.loading = false; active.paused = true; addMessage('notice', w('pageError')); updateTourStatus();
 }
}
async function startTour(key) {
 const data = await manifest(); const chosen = data.tours[key]; if (!chosen) { addMessage('notice', w('unknown')); return; }
 sceneNumber++; stopClock(); tour = { key, ids:chosen.scenes, cursor:0, paused:false, remaining:60000, loading:true, finished:false };
 setOpen(true); await showScene();
}
function advance() {
 if (!tour || tour.finished) return; stopClock();
 if (tour.cursor + 1 >= tour.ids.length) { tour.finished = true; tour.paused = true; updateTourStatus(); addMessage('notice', w('completed')); return; }
 tour.cursor++; tour.paused = false; showScene();
}
function resumeTour() { if (!tour || tour.finished) return; tour.paused = false; armClock(); updateTourStatus(); }
function stopTour() { sceneNumber++; stopClock(); cancelAnswer(); tour = null; updateTourStatus(); }
async function submit(text) {
 const clean = text.trim(); if (!clean) return;
 const command = clean.toLowerCase();
 if (/^glance(?:\s|$)/.test(command)) {
  const match = /^glance(?: (main|it|devices|creative|ai8|theories))?$/.exec(command); addMessage('user', clean);
  if (!match) return addMessage('notice', w('unknown'));
  try { await startTour(match[1] || 'main'); } catch { addMessage('notice', w('pageError')); } return;
 }
 if (tour && ['n','next','naprej'].includes(command)) return advance();
 if (tour && ['pause','pavza'].includes(command)) return pauseTour();
 if (tour && ['resume','nadaljuj'].includes(command)) return resumeTour();
 if (tour && ['stop','končaj'].includes(command)) return stopTour();
 if (tour && ['back','nazaj','repeat','ponovi'].includes(command)) { if (['back','nazaj'].includes(command)) tour.cursor = Math.max(0, tour.cursor - 1); tour.paused = false; return showScene(); }
 if (tour) { pauseTour(); sceneNumber++; tour.loading = false; tour.remaining = 60000; updateTourStatus(); }
 await ask(clean);
}

$('guide-toggle').addEventListener('click', () => setOpen(panel.hidden));
$('guide-close').addEventListener('click', () => setOpen(false));
$('guide-lab').addEventListener('click', () => $('ai8-vision-open').click());
$('guide-home').addEventListener('click', home);
$('guide-form').addEventListener('submit', e => { e.preventDefault(); const text = input.value; input.value = ''; input.style.height = ''; submit(text); });
input.addEventListener('input', () => { if (tour && !tour.paused) pauseTour(); input.style.height = ''; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; });
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('guide-form').requestSubmit(); } });
panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } });
$('guide-start-tour').addEventListener('click', () => submit('glance'));
$('guide-projects').addEventListener('click', () => submit(w('projects')));
$('guide-dgte').addEventListener('click', () => submit(lang() === 'sl' ? 'Koliko elektrike v evrih bi ena DGTE naredila na mesec? Pojasni potrebne podatke in predpostavke.' : 'How much electricity in euros would one DGTE produce each month? Explain the required inputs and assumptions.'));
$('guide-next').addEventListener('click', advance);
$('guide-pause').addEventListener('click', () => tour?.paused ? resumeTour() : pauseTour());
$('guide-back').addEventListener('click', () => { if (tour) { tour.cursor = Math.max(0, tour.cursor - 1); tour.paused = false; showScene(); } });
$('guide-stop').addEventListener('click', stopTour);
log.addEventListener('click', e => { const a = e.target.closest('a[href]'); if (!a) return; const p = sitePath(a.href); if (p && allowed.has(p.path)) { e.preventDefault(); showPage(p.path + p.suffix).catch(() => addMessage('notice', w('pageError'))); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && tour) pauseTour(); });
window.addEventListener('mdlxdcc:language', translate);
try {
 const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
 if (Array.isArray(saved)) for (const m of saved.slice(-40)) if (['user','assistant','notice','scenario'].includes(m.role) && typeof m.content === 'string' && m.content.length < 30000) { messages.push(m); log.append(renderMessage(m)); }
} catch {}
translate(); topSize();
