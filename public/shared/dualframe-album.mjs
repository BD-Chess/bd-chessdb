// DualFrame's embeddable, read-only album. No accounts, provider calls or storage.
export function orientation(mode, width, height) {
  return mode === 'L' || mode === 'P' ? mode : width >= height ? 'L' : 'P';
}

export function validateAlbum(album) {
  if (album?.schema !== 'dualframe-album/v1' || !Array.isArray(album.items) || !album.items.length) throw Error('Invalid album');
  const ids = new Set();
  for (const item of album.items) {
    if (!item.id || ids.has(item.id) || typeof item.title !== 'string' || !item.original || !item.thumbnail) throw Error('Invalid album item');
    ids.add(item.id);
    for (const frame of ['L', 'P']) {
      const v = item.variants?.[frame];
      if (!v?.src || !(v.width > 0 && v.height > 0) || (v.width > v.height) !== (frame === 'L')) throw Error('Missing composition');
    }
  }
  return album;
}

export function mountAlbum(root, album, baseURL) {
  validateAlbum(album);
  const doc = root.ownerDocument, win = doc.defaultView;
  const asset = name => {
    const u = new URL(name, baseURL);
    if (u.origin !== win.location.origin || !/^https?:$/.test(u.protocol)) throw Error('External album asset');
    return u.href;
  };
  for (const item of album.items) {
    [item.original, item.thumbnail, item.variants.L.src, item.variants.P.src].forEach(asset);
  }
  let mode = 'AUTO', index = 0, playing = false, timer = null, trigger = null, loadSerial = 0, touch = null, lastTap = 0;
  let captionTimer = null, loaded = false, touchDoubleAt = -Infinity;
  const region = root.closest('section') || root;
  const toolbar = doc.createElement('div');
  toolbar.className = 'df-album-toolbar';
  toolbar.innerHTML = '<div role="group" aria-label="Orientacija galerije"><button type="button" data-df-mode="AUTO" aria-pressed="true">AUTO</button><button type="button" data-df-mode="L" aria-pressed="false">L · ležeče</button><button type="button" data-df-mode="P" aria-pressed="false">P · pokončno</button></div><button type="button" data-df-open="0">Odpri album ↗</button>';
  root.before(toolbar);
  root.classList.add('df-album-grid');
  const cards = album.items.map((item, n) => {
    const button = doc.createElement('button');
    button.type = 'button'; button.dataset.dfIndex = String(n);
    button.setAttribute('aria-label', 'Odpri: ' + item.title);
    const picture = doc.createElement('picture');
    const image = doc.createElement('img');
    image.src = asset(item.thumbnail); image.alt = item.title;
    image.width = 480; image.height = 270; image.setAttribute('loading', 'lazy'); image.decoding = 'async';
    picture.append(image);
    const label = doc.createElement('span'); label.textContent = item.title;
    const badge = doc.createElement('small'); badge.className = 'df-pair-badge'; badge.textContent = 'L / P';
    button.append(picture, label, badge);
    return button;
  });
  root.replaceChildren(...cards);
  root.dataset.dualframeReady = 'true';
  const dialog = doc.createElement('dialog');
  dialog.id = 'df-album-dialog'; dialog.className = 'df-album-dialog';
  dialog.setAttribute('aria-label', 'DualFrame · ' + album.title);
  dialog.innerHTML = '<div class="df-album-viewer"><header class="df-viewer-top"><div><b>DualFrame Photos</b><span data-df-count aria-live="polite"></span></div><button type="button" data-df-close aria-label="Zapri album">Zapri ×</button></header><div class="df-viewer-controls"><div role="group" aria-label="Orientacija fotografije"><button type="button" data-df-mode="AUTO" aria-pressed="true">AUTO</button><button type="button" data-df-mode="L" aria-pressed="false">L · ležeče</button><button type="button" data-df-mode="P" aria-pressed="false">P · pokončno</button></div><button type="button" data-df-full aria-pressed="false">Cel zaslon ⛶</button><button type="button" data-df-play aria-pressed="false">Predvajaj ▶</button><label>Interval <select data-df-interval aria-label="Interval diaprojekcije"><option value="3">3 s</option><option value="5" selected>5 s</option><option value="8">8 s</option><option value="12">12 s</option></select></label></div><div class="df-viewer-stage" tabindex="0" aria-label="Fotografija; puščici za listanje, dvojni dotik za cel zaslon"><img data-df-image alt=""><button class="df-prev" type="button" data-df-step="-1" aria-label="Prejšnja fotografija">‹</button><button class="df-next" type="button" data-df-step="1" aria-label="Naslednja fotografija">›</button><span class="df-image-status" data-df-status role="status"></span></div><footer class="df-viewer-footer"><div><h3 data-df-title></h3><p data-df-note></p></div><div class="df-viewer-links"><a data-df-original target="_blank" rel="noopener">Izvirnik ↗</a><a data-df-download download>Prenesi izbrano ↓</a></div></footer></div>';
  doc.body.append(dialog);
  const find = s => dialog.querySelector(s);
  const viewer = find('.df-album-viewer'), stage = find('.df-viewer-stage'), image = find('[data-df-image]');
  const status = find('[data-df-status]');
  const caption = doc.createElement('span');
  caption.className = 'df-photo-caption'; caption.hidden = true;
  caption.setAttribute('data-df-photo-caption', ''); stage.append(caption);
  const immersive = () => viewer.classList.contains('is-immersive');
  function hideCaption() { if (captionTimer !== null) win.clearTimeout(captionTimer); captionTimer = null; caption.hidden = true; }
  function positionCaption() {
    // img.width/height describe the CSS box, not the contained photograph.
    const width = image.naturalWidth || Number(image.getAttribute('width'));
    const height = image.naturalHeight || Number(image.getAttribute('height'));
    const scale = Math.min(stage.clientWidth / width, stage.clientHeight / height);
    caption.style.bottom = Math.max(20, (stage.clientHeight - height * scale) / 2 + 20) + 'px';
    caption.style.maxWidth = Math.max(40, width * scale - 40) + 'px';
  }
  function scheduleCaption() {
    hideCaption();
    if (!dialog.open || !immersive() || !loaded || doc.hidden) return;
    const serial = loadSerial;
    captionTimer = win.setTimeout(() => {
      if (dialog.open && immersive() && loaded && serial === loadSerial && !doc.hidden) {
        positionCaption(); caption.hidden = false;
      }
    }, 2000);
  }
  function syncFull() {
    const active = immersive();
    dialog.classList.toggle('is-photo-full', active);
    find('[data-df-full]').setAttribute('aria-pressed', String(active));
    find('[data-df-full]').textContent = active ? 'Povrni pogled ⛶' : 'Cel zaslon ⛶';
    for (const chrome of dialog.querySelectorAll('.df-viewer-top, .df-viewer-controls, .df-viewer-footer, [data-df-step], [data-df-status]')) chrome.inert = active;
    scheduleCaption();
  }
  const frame = () => orientation(mode, win.innerWidth, win.innerHeight);
  const modeButtons = [...toolbar.querySelectorAll('[data-df-mode]'), ...dialog.querySelectorAll('[data-df-mode]')];
  function syncMode() {
    modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dfMode === mode)));
    root.dataset.orientation = frame();
    // AUTO follows the viewport with native picture selection; small L thumbnails keep the overview light.
    cards.forEach((card, n) => {
      const picture = card.querySelector('picture'), img = card.querySelector('img'), item = album.items[n];
      let source = picture.querySelector('source');
      if (!source) { source = doc.createElement('source'); picture.prepend(source); }
      source.media = mode === 'L' ? 'not all' : mode === 'P' ? 'all' : '(orientation: portrait)';
      source.srcset = asset(item.thumbnailP || item.variants.P.src);
      img.src = asset(item.thumbnail);
      img.width = frame() === 'L' ? 480 : 270; img.height = frame() === 'L' ? 270 : 480;
    });
  }
  function schedule() {
    win.clearTimeout(timer);
    if (playing && dialog.open && !doc.hidden) timer = win.setTimeout(() => show(index + 1), Number(find('[data-df-interval]').value) * 1000);
  }
  function setPlaying(value) {
    playing = value; const b = find('[data-df-play]');
    b.textContent = value ? 'Pavza Ⅱ' : 'Predvajaj ▶'; b.setAttribute('aria-pressed', String(value));
    schedule();
  }
  async function show(next) {
    win.clearTimeout(timer);
    hideCaption(); loaded = false;
    index = (next + album.items.length) % album.items.length;
    const item = album.items[index], selected = frame(), v = item.variants[selected], serial = ++loadSerial;
    find('[data-df-count]').textContent = `${index + 1} / ${album.items.length} · ${selected}`;
    find('[data-df-title]').textContent = item.title;
    caption.textContent = item.title;
    find('[data-df-note]').textContent = item.note || '';
    find('[data-df-original]').href = asset(item.original);
    find('[data-df-download]').href = asset(v.src);
    find('[data-df-download]').download = item.id + '-' + selected + '.webp';
    image.alt = item.title + ' · AI kompozicija ' + selected;
    dialog.dataset.orientation = selected;
    status.textContent = 'Nalagam …';
    const ready = () => { if (serial === loadSerial && !loaded) { loaded = true; status.textContent = ''; schedule(); scheduleCaption(); } };
    image.onload = ready;
    image.onerror = () => { if (serial === loadSerial) { loaded = false; hideCaption(); status.textContent = 'Slike ni mogoče naložiti. Odpri izvirnik ali izberi drugo fotografijo.'; setPlaying(false); } };
    image.width = v.width; image.height = v.height; image.src = asset(v.src);
    if (image.complete && image.naturalWidth) ready();
  }
  function setMode(value) {
    if (!['AUTO', 'L', 'P'].includes(value)) return;
    mode = value; syncMode(); if (dialog.open) show(index);
  }
  function open(next, button) {
    trigger = button; dialog.showModal(); doc.body.classList.add('df-album-open');
    show(next); find('[data-df-close]').focus();
  }
  async function full() {
    const active = doc.fullscreenElement === viewer || viewer.classList.contains('is-immersive');
    if (active) {
      if (doc.fullscreenElement === viewer) await doc.exitFullscreen?.().catch(() => {});
      viewer.classList.remove('is-immersive');
      syncFull(); find('[data-df-full]').focus({preventScroll:true});
    } else {
      viewer.classList.add('is-immersive');
      syncFull(); stage.focus({preventScroll:true});
      try { await viewer.requestFullscreen?.(); } catch { /* iOS uses the viewport-sized viewer. */ }
    }
  }
  function close() { if (dialog.open) dialog.close(); }
  function clicked(e) {
    const button = e.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-df-mode')) setMode(button.dataset.dfMode);
    if (button.hasAttribute('data-df-index')) open(Number(button.dataset.dfIndex), button);
    if (button.hasAttribute('data-df-open')) open(0, button);
    if (button.hasAttribute('data-df-close')) close();
    if (button.hasAttribute('data-df-step')) show(index + Number(button.dataset.dfStep));
    if (button.hasAttribute('data-df-play')) setPlaying(!playing);
    if (button.hasAttribute('data-df-full')) full();
  }
  region.addEventListener('click', clicked); dialog.addEventListener('click', clicked);
  dialog.addEventListener('close', () => {
    setPlaying(false); ++loadSerial;
    loaded = false; hideCaption(); lastTap = 0;
    if (doc.fullscreenElement === viewer) doc.exitFullscreen?.().catch(() => {});
    viewer.classList.remove('is-immersive'); syncFull();
    doc.body.classList.remove('df-album-open');
    image.removeAttribute('src'); trigger?.focus({preventScroll:true});
  });
  dialog.addEventListener('cancel', e => { if (immersive()) { e.preventDefault(); full(); } });
  dialog.addEventListener('keydown', e => {
    if (e.target.matches('select, input, textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(index + (e.key === 'ArrowRight' ? 1 : -1)); }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); show(e.key === 'Home' ? 0 : album.items.length - 1); }
    if (e.key === ' ' && (e.target === stage || e.target === image)) { e.preventDefault(); setPlaying(!playing); }
  });
  stage.addEventListener('dblclick', e => { if (e.target === image || e.target === stage) { e.preventDefault(); if (Date.now() - touchDoubleAt > 700) full(); } });
  stage.addEventListener('touchstart', e => {
    touch = e.touches.length === 1 && !e.target.closest('button') ? {x:e.touches[0].clientX, y:e.touches[0].clientY, at:Date.now()} : null;
  }, {passive:true});
  stage.addEventListener('touchend', e => {
    if (!touch || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y, now = Date.now();
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) { show(index + (dx < 0 ? 1 : -1)); lastTap = 0; }
    else if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && now - touch.at < 350) {
      if (lastTap && now - lastTap < 320) { e.preventDefault(); touchDoubleAt = now; full(); lastTap = 0; } else lastTap = now;
    }
    touch = null;
  }, {passive:false});
  stage.addEventListener('touchcancel', () => { touch = null; });
  find('[data-df-interval]').addEventListener('change', schedule);
  doc.addEventListener('visibilitychange', () => { schedule(); scheduleCaption(); });
  doc.addEventListener('fullscreenchange', () => {
    if (!doc.fullscreenElement) { viewer.classList.remove('is-immersive'); syncFull(); stage.focus({preventScroll:true}); }
  });
  let previousFrame = frame();
  win.addEventListener('resize', () => {
    if (!caption.hidden) positionCaption();
    const next = frame(); if (next === previousFrame) return;
    previousFrame = next; syncMode(); if (dialog.open) show(index);
  });
  syncMode();
  return {open, close, setMode};
}

if (typeof document !== 'undefined') {
  for (const root of document.querySelectorAll('[data-dualframe-album]')) {
    const url = new URL(root.dataset.dualframeAlbum, document.baseURI);
    if (url.origin !== location.origin) continue;
    fetch(url).then(r => { if (!r.ok) throw Error('Album unavailable'); return r.json(); })
      .then(album => mountAlbum(root, album, url))
      .catch(() => { const note = document.createElement('p'); note.textContent = 'DualFrame se trenutno ne more naložiti. Izvirne fotografije ostajajo na voljo.'; root.before(note); });
  }
}
