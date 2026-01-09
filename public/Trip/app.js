(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const inputEl = $('input');
  const statusEl = $('status');
  const btnFast = $('btnFast');
  const btnBalanced = $('btnBalanced');
  const btnUpdateMap = $('btnUpdateMap');
  const btnCopyLinks = $('btnCopyLinks');
  const routeList = $('routeList');
  const distKmEl = $('distKm');
  const savedKmEl = $('savedKm');
  const linksEl = $('links');
  const chkRoundTrip = $('chkRoundTrip');
  const chkDriving = $('chkDriving');

  // NEW: References to right panel elements
  const mapPlaceholder = $('mapPlaceholder');
  const mapResult = $('mapResult');
  const bigMapBtn = $('bigMapBtn');

  // Worker
  const worker = new Worker('worker.js');

  // State
  let lastLinks = [];
  let lastBest = null;

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (cls ? (' ' + cls) : '');
  }

  function defaultExample() {
    return [
      'START: Ljubljana Center | 46.05108, 14.50513',
      'Ljubljana Castle | 46.04886, 14.50828',
      'Tivoli Park | 46.05702, 14.49509',
      'Dragon Bridge | 46.05162, 14.51132',
      'Metelkova | 46.05764, 14.51674',
      'BTC City | 46.06473, 14.54986',
      'Špica | 46.04131, 14.50419',
      'Koseze Pond | 46.07852, 14.47456',
    ].join('\n');
  }

  function parseStops(text) {
    const lines = text.split(/\r?\n/);
    const pts = [];
    let startIdx = 0;
    const coordRe = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/;

    for (let raw of lines) {
      raw = raw.trim();
      if (!raw) continue;
      if (raw.startsWith('#')) continue;

      let isStart = false;
      if (/^START\s*:/i.test(raw)) {
        isStart = true;
        raw = raw.replace(/^START\s*:/i, '').trim();
      }

      let name = raw;
      let lat = null, lon = null;

      if (raw.includes('|')) {
        const parts = raw.split('|');
        name = parts[0].trim() || raw.trim();
        const m = coordRe.exec(parts.slice(1).join('|'));
        if (m) {
          lat = parseFloat(m[1]);
          lon = parseFloat(m[2]);
        }
      } else {
        const m = coordRe.exec(raw);
        if (m) {
          lat = parseFloat(m[1]);
          lon = parseFloat(m[2]);
          name = raw;
        }
      }

      const p = { name, lat, lon, raw: raw };
      if (isStart) startIdx = pts.length;
      pts.push(p);
    }
    return { pts, startIdx };
  }

  function fmtKm(x) {
    if (!isFinite(x)) return '—';
    if (x < 1) return `${(x * 1000).toFixed(0)} m`;
    return `${x.toFixed(2)} km`;
  }

  function buildMapsLegLinks(routePts, roundTrip, driving) {
    const travelmode = driving ? 'driving' : 'walking';
    const encodeLoc = (p) => {
      if (typeof p.lat === 'number' && typeof p.lon === 'number' && isFinite(p.lat) && isFinite(p.lon)) {
        return `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
      }
      return p.name;
    };

    const seq = routePts.slice();
    if (roundTrip && seq.length > 1) seq.push(seq[0]);

    const MAX_MID = 20; 
    const links = [];
    let i = 0;
    while (i < seq.length - 1) {
      const origin = seq[i];
      let j = Math.min(seq.length - 1, i + 1 + MAX_MID + 1);
      if (j <= i + 1) j = i + 2;

      const segment = seq.slice(i, j + 1);
      const originLoc = encodeLoc(segment[0]);
      const destLoc = encodeLoc(segment[segment.length - 1]);
      const mids = segment.slice(1, -1).map(encodeLoc);

      const params = new URLSearchParams();
      params.set('api', '1');
      params.set('origin', originLoc);
      params.set('destination', destLoc);
      params.set('travelmode', travelmode);
      if (mids.length) params.set('waypoints', mids.join('|'));

      const url = `https://www.google.com/maps/dir/?${params.toString()}`;
      links.push({ url, label: `Leg ${links.length + 1} (${segment.length} stops)` });
      i = j;
    }
    return links;
  }

  function renderRoute(routePts, totalKm, baseKm) {
    routeList.innerHTML = '';
    for (const p of routePts) {
      const li = document.createElement('li');
      li.textContent = p.name || p.raw || '(unnamed)';
      routeList.appendChild(li);
    }
    distKmEl.textContent = fmtKm(totalKm);
    const saved = (isFinite(baseKm) && isFinite(totalKm)) ? (baseKm - totalKm) : NaN;
    savedKmEl.textContent = isFinite(saved) ? fmtKm(saved) : '—';
  }

  function renderLinks(links) {
    linksEl.innerHTML = '';
    for (const L of links) {
      const row = document.createElement('div');
      row.className = 'linkrow';

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = L.label;

      const a = document.createElement('a');
      a.href = L.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = L.url;

      const btn = document.createElement('button');
      btn.className = 'secondary';
      btn.style.flex = '0 0 auto';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(L.url);
          setStatus(`Copied: ${L.label}`, 'ok');
        } catch {
          setStatus('Clipboard copy failed.', 'warn');
        }
      });

      row.appendChild(badge);
      row.appendChild(a);
      row.appendChild(btn);
      linksEl.appendChild(row);
    }
  }

  async function copyAllLinks() {
    if (!lastLinks.length) return;
    const text = lastLinks.map(l => `${l.label}: ${l.url}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied all links.', 'ok');
    } catch {
      setStatus('Clipboard copy failed.', 'warn');
    }
  }

  // --- UPDATED MAP PANE LOGIC ---
  function updateMapPane() {
    if (!lastLinks.length) return;
    
    // Get the first leg URL
    const firstUrl = lastLinks[0].url;
    
    // Update the big button and switch visibility
    bigMapBtn.href = firstUrl;
    mapPlaceholder.style.display = 'none';
    mapResult.style.display = 'block';
    
    setStatus('Route ready. Click the big button on the right.', 'ok');
  }

  function disableWhileRunning(disabled) {
    btnFast.disabled = disabled;
    btnBalanced.disabled = disabled;
  }

  function validateInput(pts) {
    if (pts.length < 2) return { ok: false, msg: 'Need at least 2 stops.' };
    const withCoords = pts.filter(p => typeof p.lat === 'number' && typeof p.lon === 'number' && isFinite(p.lat) && isFinite(p.lon)).length;
    if (withCoords < 2) return { ok: false, msg: 'Need coordinates for at least 2 stops.' };
    if (withCoords !== pts.length) return { ok: true, msg: `Warning: ${pts.length - withCoords} stops lack coordinates.`, warn: true };
    return { ok: true, msg: 'Ready.' };
  }

  function run(profile) {
    const { pts, startIdx } = parseStops(inputEl.value);
    const v = validateInput(pts);
    if (!v.ok) { setStatus(v.msg, 'bad'); return; }
    
    setStatus(v.msg + '\nRunning…', v.warn ? 'warn' : '');
    disableWhileRunning(true);
    btnUpdateMap.disabled = true;
    btnCopyLinks.disabled = true;
    linksEl.innerHTML = '';
    routeList.innerHTML = '';
    distKmEl.textContent = '—';
    savedKmEl.textContent = '—';
    lastLinks = [];
    lastBest = null;
    
    // Reset right panel to placeholder
    mapPlaceholder.style.display = 'block';
    mapResult.style.display = 'none';

    worker.postMessage({
      type: 'solve',
      profile,
      points: pts,
      startIdx,
      roundTrip: chkRoundTrip.checked,
    });
  }

  worker.onmessage = (ev) => {
    const msg = ev.data || {};
    if (msg.type === 'progress') {
      setStatus(msg.text || 'Working…', 'warn');
      return;
    }
    if (msg.type === 'error') {
      setStatus(msg.error || 'Error.', 'bad');
      disableWhileRunning(false);
      return;
    }
    if (msg.type === 'result') {
      disableWhileRunning(false);

      const { order, totalKm, baseKm, pointsSorted } = msg;
      lastBest = { order, totalKm, baseKm, pointsSorted };

      renderRoute(pointsSorted, totalKm, baseKm);

      const links = buildMapsLegLinks(pointsSorted, chkRoundTrip.checked, chkDriving.checked);
      lastLinks = links;
      renderLinks(links);

      btnUpdateMap.disabled = !links.length;
      btnCopyLinks.disabled = !links.length;

      // Auto-update right panel if we have links
      if (links.length) {
        updateMapPane();
      }

      const info = [
        `Done.`,
        `Stops: ${pointsSorted.length}`,
        `Distance: ${fmtKm(totalKm)}`,
        isFinite(baseKm) ? `Saved: ${fmtKm(baseKm - totalKm)}` : '',
      ].filter(Boolean).join(' | ');

      setStatus(info, 'ok');
    }
  };

  btnFast.addEventListener('click', () => run('fast'));
  btnBalanced.addEventListener('click', () => run('balanced'));
  btnUpdateMap.addEventListener('click', updateMapPane);
  btnCopyLinks.addEventListener('click', copyAllLinks);

  // Init
  inputEl.value = defaultExample();
  const { pts } = parseStops(inputEl.value);
  const v = validateInput(pts);
  setStatus(v.msg, v.warn ? 'warn' : '');

})();(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const inputEl = $('input');
  const statusEl = $('status');
  const btnFast = $('btnFast');
  const btnBalanced = $('btnBalanced');
  const btnUpdateMap = $('btnUpdateMap');
  const btnCopyLinks = $('btnCopyLinks');
  const routeList = $('routeList');
  const distKmEl = $('distKm');
  const savedKmEl = $('savedKm');
  const linksEl = $('links');
  const chkRoundTrip = $('chkRoundTrip');
  const chkDriving = $('chkDriving');

  // NEW: References to right panel elements
  const mapPlaceholder = $('mapPlaceholder');
  const mapResult = $('mapResult');
  const bigMapBtn = $('bigMapBtn');

  // Worker
  const worker = new Worker('worker.js');

  // State
  let lastLinks = [];
  let lastBest = null;

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (cls ? (' ' + cls) : '');
  }

  function defaultExample() {
    return [
      'START: Ljubljana Center | 46.05108, 14.50513',
      'Ljubljana Castle | 46.04886, 14.50828',
      'Tivoli Park | 46.05702, 14.49509',
      'Dragon Bridge | 46.05162, 14.51132',
      'Metelkova | 46.05764, 14.51674',
      'BTC City | 46.06473, 14.54986',
      'Špica | 46.04131, 14.50419',
      'Koseze Pond | 46.07852, 14.47456',
    ].join('\n');
  }

  function parseStops(text) {
    const lines = text.split(/\r?\n/);
    const pts = [];
    let startIdx = 0;
    const coordRe = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/;

    for (let raw of lines) {
      raw = raw.trim();
      if (!raw) continue;
      if (raw.startsWith('#')) continue;

      let isStart = false;
      if (/^START\s*:/i.test(raw)) {
        isStart = true;
        raw = raw.replace(/^START\s*:/i, '').trim();
      }

      let name = raw;
      let lat = null, lon = null;

      if (raw.includes('|')) {
        const parts = raw.split('|');
        name = parts[0].trim() || raw.trim();
        const m = coordRe.exec(parts.slice(1).join('|'));
        if (m) {
          lat = parseFloat(m[1]);
          lon = parseFloat(m[2]);
        }
      } else {
        const m = coordRe.exec(raw);
        if (m) {
          lat = parseFloat(m[1]);
          lon = parseFloat(m[2]);
          name = raw;
        }
      }

      const p = { name, lat, lon, raw: raw };
      if (isStart) startIdx = pts.length;
      pts.push(p);
    }
    return { pts, startIdx };
  }

  function fmtKm(x) {
    if (!isFinite(x)) return '—';
    if (x < 1) return `${(x * 1000).toFixed(0)} m`;
    return `${x.toFixed(2)} km`;
  }

  function buildMapsLegLinks(routePts, roundTrip, driving) {
    const travelmode = driving ? 'driving' : 'walking';
    const encodeLoc = (p) => {
      if (typeof p.lat === 'number' && typeof p.lon === 'number' && isFinite(p.lat) && isFinite(p.lon)) {
        return `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
      }
      return p.name;
    };

    const seq = routePts.slice();
    if (roundTrip && seq.length > 1) seq.push(seq[0]);

    const MAX_MID = 20; 
    const links = [];
    let i = 0;
    while (i < seq.length - 1) {
      const origin = seq[i];
      let j = Math.min(seq.length - 1, i + 1 + MAX_MID + 1);
      if (j <= i + 1) j = i + 2;

      const segment = seq.slice(i, j + 1);
      const originLoc = encodeLoc(segment[0]);
      const destLoc = encodeLoc(segment[segment.length - 1]);
      const mids = segment.slice(1, -1).map(encodeLoc);

      const params = new URLSearchParams();
      params.set('api', '1');
      params.set('origin', originLoc);
      params.set('destination', destLoc);
      params.set('travelmode', travelmode);
      if (mids.length) params.set('waypoints', mids.join('|'));

      const url = `https://www.google.com/maps/dir/?${params.toString()}`;
      links.push({ url, label: `Leg ${links.length + 1} (${segment.length} stops)` });
      i = j;
    }
    return links;
  }

  function renderRoute(routePts, totalKm, baseKm) {
    routeList.innerHTML = '';
    for (const p of routePts) {
      const li = document.createElement('li');
      li.textContent = p.name || p.raw || '(unnamed)';
      routeList.appendChild(li);
    }
    distKmEl.textContent = fmtKm(totalKm);
    const saved = (isFinite(baseKm) && isFinite(totalKm)) ? (baseKm - totalKm) : NaN;
    savedKmEl.textContent = isFinite(saved) ? fmtKm(saved) : '—';
  }

  function renderLinks(links) {
    linksEl.innerHTML = '';
    for (const L of links) {
      const row = document.createElement('div');
      row.className = 'linkrow';

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = L.label;

      const a = document.createElement('a');
      a.href = L.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = L.url;

      const btn = document.createElement('button');
      btn.className = 'secondary';
      btn.style.flex = '0 0 auto';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(L.url);
          setStatus(`Copied: ${L.label}`, 'ok');
        } catch {
          setStatus('Clipboard copy failed.', 'warn');
        }
      });

      row.appendChild(badge);
      row.appendChild(a);
      row.appendChild(btn);
      linksEl.appendChild(row);
    }
  }

  async function copyAllLinks() {
    if (!lastLinks.length) return;
    const text = lastLinks.map(l => `${l.label}: ${l.url}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied all links.', 'ok');
    } catch {
      setStatus('Clipboard copy failed.', 'warn');
    }
  }

  // --- UPDATED MAP PANE LOGIC ---
  function updateMapPane() {
    if (!lastLinks.length) return;
    
    // Get the first leg URL
    const firstUrl = lastLinks[0].url;
    
    // Update the big button and switch visibility
    bigMapBtn.href = firstUrl;
    mapPlaceholder.style.display = 'none';
    mapResult.style.display = 'block';
    
    setStatus('Route ready. Click the big button on the right.', 'ok');
  }

  function disableWhileRunning(disabled) {
    btnFast.disabled = disabled;
    btnBalanced.disabled = disabled;
  }

  function validateInput(pts) {
    if (pts.length < 2) return { ok: false, msg: 'Need at least 2 stops.' };
    const withCoords = pts.filter(p => typeof p.lat === 'number' && typeof p.lon === 'number' && isFinite(p.lat) && isFinite(p.lon)).length;
    if (withCoords < 2) return { ok: false, msg: 'Need coordinates for at least 2 stops.' };
    if (withCoords !== pts.length) return { ok: true, msg: `Warning: ${pts.length - withCoords} stops lack coordinates.`, warn: true };
    return { ok: true, msg: 'Ready.' };
  }

  function run(profile) {
    const { pts, startIdx } = parseStops(inputEl.value);
    const v = validateInput(pts);
    if (!v.ok) { setStatus(v.msg, 'bad'); return; }
    
    setStatus(v.msg + '\nRunning…', v.warn ? 'warn' : '');
    disableWhileRunning(true);
    btnUpdateMap.disabled = true;
    btnCopyLinks.disabled = true;
    linksEl.innerHTML = '';
    routeList.innerHTML = '';
    distKmEl.textContent = '—';
    savedKmEl.textContent = '—';
    lastLinks = [];
    lastBest = null;
    
    // Reset right panel to placeholder
    mapPlaceholder.style.display = 'block';
    mapResult.style.display = 'none';

    worker.postMessage({
      type: 'solve',
      profile,
      points: pts,
      startIdx,
      roundTrip: chkRoundTrip.checked,
    });
  }

  worker.onmessage = (ev) => {
    const msg = ev.data || {};
    if (msg.type === 'progress') {
      setStatus(msg.text || 'Working…', 'warn');
      return;
    }
    if (msg.type === 'error') {
      setStatus(msg.error || 'Error.', 'bad');
      disableWhileRunning(false);
      return;
    }
    if (msg.type === 'result') {
      disableWhileRunning(false);

      const { order, totalKm, baseKm, pointsSorted } = msg;
      lastBest = { order, totalKm, baseKm, pointsSorted };

      renderRoute(pointsSorted, totalKm, baseKm);

      const links = buildMapsLegLinks(pointsSorted, chkRoundTrip.checked, chkDriving.checked);
      lastLinks = links;
      renderLinks(links);

      btnUpdateMap.disabled = !links.length;
      btnCopyLinks.disabled = !links.length;

      // Auto-update right panel if we have links
      if (links.length) {
        updateMapPane();
      }

      const info = [
        `Done.`,
        `Stops: ${pointsSorted.length}`,
        `Distance: ${fmtKm(totalKm)}`,
        isFinite(baseKm) ? `Saved: ${fmtKm(baseKm - totalKm)}` : '',
      ].filter(Boolean).join(' | ');

      setStatus(info, 'ok');
    }
  };

  btnFast.addEventListener('click', () => run('fast'));
  btnBalanced.addEventListener('click', () => run('balanced'));
  btnUpdateMap.addEventListener('click', updateMapPane);
  btnCopyLinks.addEventListener('click', copyAllLinks);

  // Init
  inputEl.value = defaultExample();
  const { pts } = parseStops(inputEl.value);
  const v = validateInput(pts);
  setStatus(v.msg, v.warn ? 'warn' : '');

})();