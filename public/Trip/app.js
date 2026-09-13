(() => {
  'use strict';

  // --- 1. CONFIGURATION ---
  // Domain-restricted browser key is supplied at runtime by Netlify.
  const MAPS_CONFIG_URL = '/.netlify/functions/trip-maps-config';
  
  // Same-origin function: credentials and the Gemini model are configured server-side.
  const PROXY_URL = '/.netlify/functions/gemini';
  
  let worker = createWorker();
  const roadPlanner = new globalThis.TripRoadMatrix();
  let jobVersion = 0;
  let activeJob = null;
  let lastResolvedStops = null;
  const STORAGE_KEY = '8z_trip_backup_v2'; 

  // --- 2. GLOBAL STATE ---
  const $ = (id) => document.getElementById(id);
  const UI = window.TripUI;
  const t = text => UI.t(text);
  
  let map, geocoder, infoWindow;
  let mapMarkers = [], routePolylines = [], mapPolyline = null;
  let visualizationVersion = 0;
  let statusTimer;
  let optimizationPending = false;
  let lastSolvedPoints = null;
  let lastDirectKm = null;
  let lastPlanarCost = null;
  let currentTravelMode = 'DRIVING';
  let currentNavApp = 'apple'; // Default to Apple for the list
  let mapScriptLoadingPromise = null;
  let chatHistoryBuffer = [];
  let chatRequestPending = false;
  
  let presetLookup = {};
  let presetRequest = 0;
  let userRegion = null;
  let useMiles = false; // New flag for Unit Conversion

  // --- 3. HTML CONTENT ---
  const DARK_STYLE = [
    {elementType:"geometry",stylers:[{color:"#242f3e"}]},
    {elementType:"labels.text.stroke",stylers:[{color:"#242f3e"}]},
    {elementType:"labels.text.fill",stylers:[{color:"#746855"}]},
    {featureType:"administrative.locality",elementType:"labels.text.fill",stylers:[{color:"#d59563"}]},
    {featureType:"road",elementType:"geometry",stylers:[{color:"#38414e"}]},
    {featureType:"road",elementType:"geometry.stroke",stylers:[{color:"#212a37"}]},
    {featureType:"water",elementType:"geometry",stylers:[{color:"#17263c"}]}
  ];

  // --- 4. CORE UTILS ---
  function setStatus(msg, cls) {
    clearTimeout(statusTimer);
    const el = $('status'); 
    if(el) {
      UI.set(el, msg); 
      el.style.display = 'block';
      el.style.color = cls === 'bad' ? '#ef4444' : (cls === 'warn' ? '#f59e0b' : '#10b981');
      if (cls === 'ok') statusTimer = setTimeout(() => { el.style.display = 'none'; }, 4000);
    }
  }

  // --- 5. MARKDOWN PARSER ---
  function formatMarkdown(text) {
    if (!text) return '';
    const lines = text.split('\n');
    let inTable = false;
    let html = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|')) {
            if (!inTable) {
                inTable = true;
                html += '<div class="chat-table-wrapper"><table>';
                const cells = line.split('|').filter(c => c.trim() !== '').map(c => `<th>${c.trim()}</th>`).join('');
                html += `<thead><tr>${cells}</tr></thead><tbody>`;
            } else if (line.includes('---')) {
                continue;
            } else {
                const cells = line.split('|').filter(c => c.trim() !== '').map(c => `<td>${c.trim()}</td>`).join('');
                html += `<tr>${cells}</tr>`;
            }
        } else {
            if (inTable) { inTable = false; html += '</tbody></table></div>'; }
            let formatted = line;
            formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formatted = formatted.replace(/^\*\s/, '• ');
            html += formatted + '<br>';
        }
    }
    if (inTable) html += '</tbody></table></div>';
    return html;
  }

  // --- 5b. TRIP TEXT NORMALIZER ---
  // Canonical Trip Editor format used by Trip Library:
  // # Optional title/comment
  // Stop name | 45.1234, 14.5678 START
  // Stop name | 45.2345, 14.6789
  function compactCoord(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value).trim();
    return (Math.round(n * 1000000) / 1000000).toString();
  }

  function stopObjectToLine(obj) {
    if (!obj || typeof obj !== 'object') return String(obj || '');
    const name = obj.name || obj.title || obj.label || obj.place || obj.stop || 'Point';
    const lat = obj.lat ?? obj.latitude;
    const lon = obj.lon ?? obj.lng ?? obj.longitude;
    const start = obj.start ? ' START' : '';
    if (lat !== undefined && lon !== undefined) return `${name} | ${compactCoord(lat)}, ${compactCoord(lon)}${start}`;
    return String(name);
  }

  function tryJsonParseLoose(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (_) {}
    // Gemini sometimes returns two JSON strings without wrapping array brackets:
    // "# Title\nStop | lat, lon", "# Title\nStop | lat, lon"
    if (/^"[\s\S]*"\s*(,\s*"[\s\S]*"\s*)+$/.test(s)) {
      try { return JSON.parse('[' + s + ']'); } catch (_) {}
    }
    return null;
  }

  function commandPayloadToText(payload) {
    let text = String(payload || '').trim();
    text = text.replace(/```(?:json|text|txt)?\s*/gi, '').replace(/```/g, '').trim();

    const parsed = tryJsonParseLoose(text);
    if (parsed !== null) {
      if (Array.isArray(parsed)) {
        text = parsed.map(x => typeof x === 'string' ? x : stopObjectToLine(x)).join('\n');
      } else if (typeof parsed === 'string') {
        text = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.ADD !== undefined) text = Array.isArray(parsed.ADD) ? parsed.ADD.map(x => typeof x === 'string' ? x : stopObjectToLine(x)).join('\n') : String(parsed.ADD);
        else if (parsed.REPLACE !== undefined) text = Array.isArray(parsed.REPLACE) ? parsed.REPLACE.map(x => typeof x === 'string' ? x : stopObjectToLine(x)).join('\n') : String(parsed.REPLACE);
        else if (Array.isArray(parsed.stops)) text = parsed.stops.map(stopObjectToLine).join('\n');
        else text = Object.values(parsed).map(x => typeof x === 'string' ? x : stopObjectToLine(x)).join('\n');
      }
    }

    return text
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  function normalizeTripEditorText(rawText, opts = {}) {
    const ensureStart = !!opts.ensureStart;
    let text = commandPayloadToText(rawText);
    if (!text) return '';

    const coordRe = /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/;
    const out = [];
    const seen = new Set();

    function pushLine(line) {
      line = String(line || '')
        .replace(/^\s*[-*•]\s+/, '')
        .replace(/^\s*[,\[\]]+\s*/, '')
        .replace(/\s*[,\[\]]+\s*$/, '')
        .replace(/^['"]+|['"]+$/g, '')
        .trim();
      if (!line || line === '[' || line === ']') return;

      // If a quoted title accidentally lands mid-line after a comma, split it out.
      line = line.replace(/",\s*"#/g, '\n#');
      if (line.includes('\n')) {
        line.split(/\n+/).forEach(pushLine);
        return;
      }

      if (line.startsWith('#')) {
        const key = 'h:' + line.toLowerCase();
        if (!seen.has(key)) { seen.add(key); out.push(line); }
        return;
      }

      let isStart = /\bSTART\b/i.test(line);
      line = line.replace(/\bSTART\b/i, '').trim();

      let name = line;
      let lat = null, lon = null;
      if (line.includes('|')) {
        const parts = line.split('|');
        const left = (parts[0] || '').trim();
        const right = parts.slice(1).join('|').trim();
        const mRight = coordRe.exec(right);
        const mLeft = coordRe.exec(left);
        if (mRight) { name = left || 'Point'; lat = mRight[1]; lon = mRight[2]; }
        else if (mLeft) { name = right || 'Point'; lat = mLeft[1]; lon = mLeft[2]; }
      } else {
        const m = coordRe.exec(line);
        if (m) {
          lat = m[1]; lon = m[2];
          name = line.replace(m[0], '').replace(/[|,]+$/g, '').replace(/^,/, '').trim() || 'Point';
        }
      }

      if (lat !== null && lon !== null) {
        const latN = Number(lat), lonN = Number(lon);
        if (Number.isFinite(latN) && Number.isFinite(lonN) && Math.abs(latN) <= 90 && Math.abs(lonN) <= 180) {
          const format = /^[a-z]+\d+ #\d+$/.test(name) ? n => String(n) : compactCoord;
          line = `${name} | ${format(latN)}, ${format(lonN)}${isStart ? ' START' : ''}`;
        } else {
          line = `${name} | ${lat}, ${lon}${isStart ? ' START' : ''}`;
        }
      } else if (isStart) {
        line = `${line} START`;
      }

      const key = 's:' + line.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(line); }
    }

    text.split(/\n+/).forEach(pushLine);

    if (ensureStart && !out.some(l => /\bSTART\b/i.test(l))) {
      const idx = out.findIndex(l => l && !l.startsWith('#'));
      if (idx >= 0) out[idx] = out[idx] + ' START';
    }
    return out.join('\n').trim();
  }

  function appendTripEditorBlock(payload) {
    const current = $('input').value || '';
    const clean = normalizeTripEditorText(payload, { ensureStart: current.trim().length < 10 });
    if (!clean) return 0;
    const existingLines = new Set(current.split(/\r?\n/).map(x => x.trim().toLowerCase()).filter(Boolean));
    const lines = clean.split(/\n+/).filter(line => !existingLines.has(line.trim().toLowerCase()));
    if (!lines.length) return 0;
    $('input').value = current + (current.trim() && !current.endsWith('\n') ? '\n' : '') + lines.join('\n');
    return lines.filter(l => !l.trim().startsWith('#')).length || lines.length;
  }


  // --- 6. PERSISTENCE ---
  function saveState() { 
    refreshTspNotice();
    refreshBruteInfo();
    if (activeJob && !activeJob.current()) cancelWork();
    if (comparisonInput !== null && comparisonInput !== $('input').value) clearComparison();
    const state = {
        t: $('input').value,
        m: currentTravelMode,
        direct: $('chkDirect').checked,
        planar: $('chkPlanar').checked,
        roundTrip: $('chkRoundTrip').checked,
        chatBuf: chatHistoryBuffer,
        chatHTML: $('chatHistory').innerHTML,
        ts: Date.now()
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } 
    catch (e) { console.warn("Storage full", e); }
  }
  
  function restoreState() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('trip')) {
        try {
            const sharedTrip = decodeURIComponent(params.get('trip'));
            $('input').value = sharedTrip;
            if (/^# TSP source: /m.test(sharedTrip)) { $('chkDirect').checked = true; $('chkPlanar').checked = true; }
            window.history.replaceState({}, document.title, window.location.pathname);
            setStatus('Shared trip loaded!', 'ok');
            setPlanningMode(true); 
            return true;
        } catch(e) { console.error("Share load failed", e); }
    }

    const sStr = localStorage.getItem(STORAGE_KEY);
    if (!sStr) return false;

    try {
        const s = JSON.parse(sStr);
        $('input').value = s.t || ''; 
        currentTravelMode = s.m || 'DRIVING'; 
        $('chkDirect').checked = typeof s.direct === 'boolean' ? s.direct : /^# TSP source: /m.test($('input').value);
        $('chkPlanar').checked = $('chkDirect').checked && (typeof s.planar === 'boolean' ? s.planar : /^# TSP source: /m.test($('input').value));
        if (typeof s.roundTrip === 'boolean') $('chkRoundTrip').checked = s.roundTrip;
        updateModeButtons(); 

        if (s.chatBuf && s.chatHTML) {
            chatHistoryBuffer = s.chatBuf;
            const historyEl = $('chatHistory');
            historyEl.innerHTML = s.chatHTML;
            historyEl.querySelectorAll('.suggestions-box').forEach(el => el.remove());
            historyEl.querySelectorAll('.recovery-msg').forEach(el => el.remove());
            return true; 
        }
    } catch(e) { console.error("Restore failed", e); }
    return false;
  }

  window.shareTrip = function() {
      const tripData = $('input').value.trim();
      if (!tripData) { setStatus('List is empty!', 'bad'); return; }
      const url = window.location.origin + window.location.pathname + '?trip=' + encodeURIComponent(tripData);
      navigator.clipboard.writeText(url).then(() => {
          setStatus('Link copied!', 'ok');
          const btn = $('btnShareTrip');
          const originalText = btn.innerHTML;
          UI.set(btn, '✅ Copied!');
          setTimeout(() => {delete btn.dataset.uiText;btn.innerHTML = originalText;}, 2000);
      }).catch(() => prompt(t("Copy this link:"), url));
  };

  // --- GPX EXPORT LOGIC ---
  function generateGPX(points) {
    const head = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="8Z Trip Optimizer">
  <metadata>
    <name>8Z Optimized Route</name>
    <desc>Generated by 8Z Trip Optimizer</desc>
  </metadata>`;
    
    let wpts = '';
    points.forEach(p => {
      const name = p.name.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
      wpts += `\n  <wpt lat="${p.lat}" lon="${p.lon}">\n    <name>${name}</name>\n  </wpt>`;
    });

    let trk = '\n  <trk>\n    <name>Optimized Track</name>\n    <trkseg>';
    points.forEach(p => {
      trk += `\n      <trkpt lat="${p.lat}" lon="${p.lon}"></trkpt>`;
    });
    if($('chkRoundTrip').checked && points.length > 0) {
       trk += `\n      <trkpt lat="${points[0].lat}" lon="${points[0].lon}"></trkpt>`;
    }
    trk += '\n    </trkseg>\n  </trk>';

    return head + wpts + trk + '\n</gpx>';
  }

  window.downloadGPX = function() {
    if(!lastSolvedPoints || lastSolvedPoints.length === 0) {
      setStatus('No optimized route to export.', 'bad');
      return;
    }
    try {
      const gpxContent = generateGPX(lastSolvedPoints);
      const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '8z-route.gpx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('GPX Downloaded!', 'ok');
    } catch(e) {
      console.error(e);
      setStatus('Export failed.', 'bad');
    }
  };

  window.resetSession = function() { localStorage.removeItem(STORAGE_KEY); location.reload(); };
  window.continueSession = function(btn) {
      if(btn) btn.closest('.msg').remove();
      const historyId = $('bigChatContainer').style.display !== 'none' ? 'bigChatHistory' : 'chatHistory';
      renderSuggestions(historyId);
      setStatus('Session Resumed', 'ok');
  };

  function updateModeButtons() {
    const dr = $('btnDriving'), wk = $('btnWalking');
    if (currentTravelMode === 'DRIVING') { dr.classList.add('active'); wk.classList.remove('active'); }
    else { wk.classList.add('active'); dr.classList.remove('active'); }
  }

  // --- 7. INPUT & MAPS ---
  function parseStops(text) {
    const lines = text.split(/\r?\n/);
    const pts = [];
    let startIdx = 0;
    const coordRe = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/;

    for (let raw of lines) {
      raw = raw.trim();
      if (!raw || raw.startsWith('#')) continue;
      let isStart = false;
      if (/\bSTART\b/i.test(raw)) { isStart = true; raw = raw.replace(/\bSTART\b/i, '').trim(); }
      let name = raw; let lat = null, lon = null;
      if (raw.includes('|')) {
        const parts = raw.split('|');
        const p0 = parts[0].trim(); const p1 = parts[1].trim();
        const m0 = coordRe.exec(p0); const m1 = coordRe.exec(p1);
        if (m1) { name = p0 || "Point"; lat = parseFloat(m1[1]); lon = parseFloat(m1[2]); }
        else if (m0) { name = p1 || "Point"; lat = parseFloat(m0[1]); lon = parseFloat(m0[2]); }
      } else {
        const m = coordRe.exec(raw);
        if (m) {
          lat = parseFloat(m[1]); lon = parseFloat(m[2]);
          const potentialName = raw.replace(m[0], '').trim();
          name = (potentialName.length > 1) ? potentialName.replace(/^,/, '').trim() : `(${lat.toFixed(3)}, ${lon.toFixed(3)})`;
        }
      }
      pts.push({ name, lat, lon, raw: raw });
      if (isStart) startIdx = pts.length - 1;
    }
    return { pts, startIdx };
  }

  function validCoordinates(p) {
    return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
  }

  async function geocodeMissingPoints(pts) {
    for (const p of pts) {
      if (p.lat !== null && p.lon !== null && !validCoordinates(p)) {
        throw new Error('Invalid coordinates for "' + p.name + '". Latitude must be -90…90 and longitude -180…180.');
      }
    }
    const missing = pts.filter(p => p.lat === null || p.lon === null);
    if (!missing.length) return pts;
    setStatus('Looking up ' + missing.length + ' addresses...', 'warn');
    for (const p of missing) {
      if (!geocoder) geocoder = new google.maps.Geocoder();
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Address lookup timed out for "' + p.name + '". Please retry.')), 15000);
        const fail = status => {
          clearTimeout(timer);
          const explanations = {
            REQUEST_DENIED: 'Google denied address lookup. The site owner must enable Geocoding API and check its key restrictions and billing.',
            OVER_QUERY_LIMIT: 'Address lookup quota reached. Please retry later.',
            ZERO_RESULTS: 'Place not found. Add the country or a more precise address.',
            INVALID_REQUEST: 'Address could not be read. Check this stop.',
            UNKNOWN_ERROR: 'Google could not look up this address. Please retry.'
          };
          reject(new Error('"' + p.name + '": ' + (explanations[status] || explanations.UNKNOWN_ERROR) + ' No stops were removed.'));
        };
        try {
          const pending = geocoder.geocode({ address: p.name }, (results, status) => {
            if (status !== 'OK' || !results?.[0]?.geometry?.location) return fail(status);
            clearTimeout(timer);
            resolve(results[0]);
          });
          if (pending?.catch) pending.catch(error => fail(error?.code));
        } catch (error) { fail(error?.code); }
      });
      p.lat = result.geometry.location.lat(); p.lon = result.geometry.location.lng();
      if (!validCoordinates(p)) throw new Error('Google returned invalid coordinates for "' + p.name + '". Please retry.');
      await new Promise(r => setTimeout(r, 250));
    }
    return pts;
  }

  function ensureMapsLoaded() {
    if (window.google && window.google.maps) return Promise.resolve();
    if (mapScriptLoadingPromise) return mapScriptLoadingPromise;
    mapScriptLoadingPromise = new Promise((resolve, reject) => {
      let finished = false;
      let timeoutId = null;
      const btn = $('btnEnableMap');

      function fail(message, err) {
        if (finished) return;
        finished = true;
        if (timeoutId) clearTimeout(timeoutId);
        console.error('[8Z Trip] Google Maps load failed:', message, err || '');
        setStatus(message, 'bad');
        if (btn) { UI.set(btn, 'Retry Map'); btn.disabled = false; }
        mapScriptLoadingPromise = null;
        reject(err || new Error(message));
      }

      window.gm_authFailure = function() {
        fail('Google Maps authorization failed. Open JavaScript Console for the exact Maps API error.');
      };

      window.initMap = function() {
        if (finished) return;
        finished = true;
        if (timeoutId) clearTimeout(timeoutId);
        map = new google.maps.Map($('map'), { zoom:12, center:{lat:46.0569,lng:14.5058}, mapTypeId:'hybrid', styles:DARK_STYLE });
        geocoder = new google.maps.Geocoder();
        infoWindow = new google.maps.InfoWindow();
        const ph = $('mapPlaceholder'); if(ph) ph.style.display = 'none';
        if (btn) UI.set(btn, 'Map Loaded');
        resolve();
      };

      if (btn) { UI.set(btn, 'Loading API...'); btn.disabled = true; }
      fetch(MAPS_CONFIG_URL, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
        .then(async response => {
          if (!response.ok) throw new Error('Map configuration is unavailable.');
          const config = await response.json();
          if (typeof config.mapsBrowserKey !== 'string' || !config.mapsBrowserKey.trim()) {
            throw new Error('Map configuration is incomplete.');
          }
          if (finished) return;
          const s = document.createElement('script');
          const params = new URLSearchParams({
            key: config.mapsBrowserKey, callback: 'initMap', loading: 'async', v: 'weekly'
          });
          s.src = 'https://maps.googleapis.com/maps/api/js?' + params;
          s.async = true;
          s.onerror = () => fail('Google Maps script failed to load. Check network or API-key restrictions.');
          timeoutId = setTimeout(() => {
            fail('Google Maps did not finish loading. Please retry.');
          }, 12000);
          document.body.appendChild(s);
        })
        .catch(() => fail('Map configuration could not be loaded. Please retry or contact the site owner.'));
    });
    return mapScriptLoadingPromise;
  }

  function routeErrorInfo(error) {
    const code = String(error?.code || error?.name || 'UNKNOWN').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    // Browser SDK errors can embed the browser key in a URL; never copy it to logs.
    const detail = String(error?.message || '')
      .replace(/AIza[\w-]+/g, '[redacted]')
      .replace(/https?:\/\/[^\s]+/g, '[url]')
      .slice(0, 500);
    let message = 'Road route could not be drawn (' + code + ').';
    if (detail === 'NO_ROUTE') message = 'No road route was found for these stops and travel mode.';
    else if (detail === 'ROUTE_TIMEOUT') message = 'Road route request timed out.';
    else if (/REQUEST_DENIED|PERMISSION_DENIED|API_KEY|not authorized|not enabled|not activated/i.test(code + ' ' + detail))
      message = 'Google denied the road route. Check Routes API activation and the Maps key restrictions.';
    else if (/OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED|quota/i.test(code + ' ' + detail))
      message = 'Road route quota reached. Retry later.';
    else if (/TypeError|InvalidValueError/.test(code))
      message = 'The map software could not process the road route. This needs a code repair.';
    return { code, detail, message };
  }

  function formatKm(km) {
    if (!Number.isFinite(km) || km < 0) return '—';
    return (useMiles ? km * 0.621371 : km).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2}) + (useMiles ? ' mi' : ' km');
  }

  const planarSelected = () => !!$('chkPlanar')?.checked && $('chkDirect').checked;
  const routeValue = msg => msg.metric === 'tsp-euc2d' ? msg.totalCost : msg.totalKm;
  const baseValue = msg => msg.metric === 'tsp-euc2d' ? msg.baseCost : msg.baseKm;
  const formatValue = (value, planar=false) => planar ? (Number.isFinite(value) && value >= 0 ? value.toLocaleString('en-US') + ' EUC_2D' : '—') : formatKm(value);
  const metricName = job => job.planar ? 'Planar TSP (EUC_2D)' : job.direct ? 'Great-circle air distances' : 'Road distance table';

  function showDistance(km, label) {
    UI.set($('distanceLabel'), label + ':');
    UI.set($('distKm'), formatKm(km));
  }

  function showMapCaption(context, km, metric, fallback = false) {
    $('mapRouteCaption').hidden = !context;
    if (!context) return;
    UI.set($('mapRouteMethod'), context.method);
    UI.set($('mapRouteState'), fallback ? 'Stop order only · road route unavailable' : context.state);
    UI.set($('mapRouteMetric'), fallback ? '' : metric + ':');
    UI.set($('mapRouteDistance'), fallback ? '' : formatKm(km));
  }

  async function updateMapVisualization(points, {preview = false, routeContext = null} = {}) {
    if (!map) return;
    const version = ++visualizationVersion;
    const ph = $('mapPlaceholder'); if (ph) ph.style.display = 'none';
    const clearLines = () => {
      routePolylines.forEach(p => p.setMap(null)); routePolylines = [];
      if (mapPolyline) { mapPolyline.setMap(null); mapPolyline = null; }
    };
    if (!preview) { clearLines(); $('mapRouteCaption').hidden = true; }
    const bounds = new google.maps.LatLngBounds();
    points.forEach(pt => bounds.extend({lat:pt.lat,lng:pt.lon}));
    // Commit markers and the caption with their geometry, never with a pending response.
    const drawMarkers = () => {
    mapMarkers.forEach(m => m.setMap(null)); mapMarkers = [];
    points.forEach((pt, i) => {
      const loc = { lat: pt.lat, lng: pt.lon };
      const dense = points.length > 200;
      const marker = new google.maps.Marker({ position: loc, map,
        label: dense ? undefined : String(i + 1), title: '#' + (i + 1) + ' ' + pt.name,
        ...(dense ? {optimized:true, icon:{path:google.maps.SymbolPath.CIRCLE, scale:i === 0 ? 6 : 3,
          fillColor:i === 0 ? '#10b981' : '#ef4444', fillOpacity:1, strokeColor:'#0f172a', strokeWeight:1}} : {}) });
      marker.addListener('click', () => {
        const title = document.createElement('strong');
        title.textContent = '#' + (i + 1) + ' ' + pt.name;
        infoWindow.setContent(title); infoWindow.open(map, marker);
      });
      mapMarkers.push(marker);
    });
    };
    google.maps.event.trigger(map, 'resize');
    if (!preview) map.fitBounds(bounds);
    const path = points.map(p => ({ lat: p.lat, lng: p.lon }));
    if ($('chkRoundTrip').checked && path.length > 1) path.push(path[0]);
    if ($('chkDirect').checked) {
      clearLines();
      showDistance(lastDirectKm, 'Air distance (great circle)');
      mapPolyline = new google.maps.Polyline({ path, geodesic: !planarSelected(), strokeColor: '#3b82f6', strokeWeight: 4 });
      mapPolyline.setMap(map);
      drawMarkers();
      showMapCaption(routeContext, lastDirectKm, 'Air distance (great circle)');
      if (planarSelected()) {
        UI.set($('distanceLabel'), 'Planar TSP (EUC_2D)'); UI.set($('distKm'), formatValue(lastPlanarCost,true));
        UI.set($('mapRouteMetric'), 'Planar TSP (EUC_2D)'); UI.set($('mapRouteDistance'), formatValue(lastPlanarCost,true));
      }
      if (!preview) setStatus(planarSelected() ? 'Showing the TSP route on Maps; cost uses original EUC_2D units.' : 'Stop order ready. Showing great-circle air routes and distances.', 'ok');
      return;
    }
    if (!preview) setStatus('Stop order ready. Loading road route...', 'warn');
    const mode = currentTravelMode;
    const distanceLabel = mode === 'WALKING' ? 'Walking distance (map)' : 'Road distance (map)';
    if (!preview) { showDistance(null, distanceLabel); UI.set($('distKm'), 'Loading…'); }
    const pendingPolylines = [];
    let totalRoadMeters = 0;
    let completeDistance = true;
    try {
      // Keep the original DirectionsService path for projects that already allow
      // it; use Routes when the legacy service is unavailable or denied.
      const { Route, DirectionsService } = await google.maps.importLibrary('routes');
      let legacyAvailable = typeof DirectionsService === 'function';
      for (let i = 0; i < path.length - 1; i += 24) {
        if (version !== visualizationVersion) return;
        const seg = path.slice(i, i + 25);
        let roadPath, segmentMeters;
        if (legacyAvailable) {
          let legacyTimer;
          try {
            const result = await new Promise((resolve, reject) => {
              legacyTimer = setTimeout(() => reject(new Error('ROUTE_TIMEOUT')), 20000);
              const pending = new DirectionsService().route({
                origin: seg[0], destination: seg[seg.length - 1],
                waypoints: seg.slice(1, -1).map(location => ({ location, stopover: true })),
                travelMode: mode, optimizeWaypoints: false
              }, (response, status) => {
                if (status === 'OK') resolve(response);
                else reject(Object.assign(new Error('DirectionsService: ' + status), { code: status }));
              });
              if (pending && typeof pending.catch === 'function') pending.catch(reject);
            }).finally(() => clearTimeout(legacyTimer));
            roadPath = result?.routes?.[0]?.overview_path;
            if (!roadPath?.length) throw new Error('NO_ROUTE');
            const legs = result.routes[0].legs;
            if (legs?.length === seg.length - 1 && legs.every(leg =>
              Number.isFinite(leg.distance?.value) && leg.distance.value >= 0)) {
              segmentMeters = legs.reduce((sum, leg) => sum + leg.distance.value, 0);
            }
          } catch (error) {
            legacyAvailable = false;
            const info = routeErrorInfo(error);
            console.warn('[8Z Trip legacy route] ' + info.code + ': ' + info.detail);
          }
        }
        if (!roadPath) {
          let timer;
          const { routes } = await Promise.race([
          Route.computeRoutes({
            origin: seg[0], destination: seg[seg.length - 1],
            intermediates: seg.slice(1, -1).map(location => ({ location })),
            travelMode: mode, optimizeWaypointOrder: false,
            fields: ['path', 'distanceMeters']
          }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ROUTE_TIMEOUT')), 20000); })
          ]).finally(() => clearTimeout(timer));
          roadPath = routes?.[0]?.path;
          segmentMeters = routes?.[0]?.distanceMeters;
        }
        if (version !== visualizationVersion) return;
        if (!roadPath?.length) throw new Error('NO_ROUTE');
        if (Number.isFinite(segmentMeters) && segmentMeters >= 0) totalRoadMeters += segmentMeters;
        else completeDistance = false;
        pendingPolylines.push(new google.maps.Polyline({
          path: roadPath, strokeColor: '#3b82f6', strokeWeight: 5
        }));
      }
      if (version !== visualizationVersion) return;
      clearLines();
      routePolylines = pendingPolylines;
      routePolylines.forEach(polyline => polyline.setMap(map));
      drawMarkers();
      showDistance(completeDistance ? totalRoadMeters / 1000 : null, distanceLabel);
      showMapCaption(routeContext, completeDistance ? totalRoadMeters / 1000 : null, distanceLabel);
      if (!preview) setStatus(completeDistance ? 'Road route displayed. Distance follows the route shown on the map.' :
        'Road route displayed. Google did not return a complete distance.', completeDistance ? 'ok' : 'warn');
    } catch (error) {
      if (version !== visualizationVersion) return;
      clearLines();
      showDistance(null, distanceLabel);
      const info = routeErrorInfo(error);
      console.warn('[8Z Trip route] ' + info.code + ': ' + info.detail);
      // Show the stop order even when road geometry is unavailable; never present
      // these dashed connections as navigable roads.
      mapPolyline = new google.maps.Polyline({
        path, geodesic: true, strokeOpacity: 0,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeColor: '#f59e0b', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '16px' }]
      });
      mapPolyline.setMap(map);
      drawMarkers();
      showMapCaption(routeContext, null, distanceLabel, true);
      setStatus(info.message + ' Dashed lines show stop order, NOT roads. Navigation links remain available.', 'warn');
    }
  }

  // --- 8. SMART LINKS & TOGGLE ---
  function buildMapsLegLinks(routePts, roundTrip, mode) {
    const travelmode = (mode === 'DRIVING') ? 'driving' : 'walking';
    const encodeCoords = (p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
    const isTspNode = p => /^[a-z]+\d+ #\d+$/.test(p.name) && window.TripTspLibrary?.get(p.name.split(' ')[0]);
    const encodeName = (p) => { if (isTspNode(p) || p.name.match(/^-?\d+\./)) return encodeCoords(p); return encodeURIComponent(p.name); };
    const seq = routePts.slice();
    if (roundTrip && seq.length > 1) seq.push(seq[0]);
    const links = []; let i = 0;
    while (i < seq.length - 1) {
      const origin = seq[i];
      let j = Math.min(seq.length - 1, i + 1 + 9 + 1);
      if (j <= i + 1) j = i + 2;
      const segment = seq.slice(i, j + 1);
      const originPin = encodeCoords(segment[0]); const destPin = encodeCoords(segment[segment.length - 1]); const midsPin = segment.slice(1, -1).map(encodeCoords);
      let urlPins = `https://www.google.com/maps/dir/?api=1&origin=${originPin}&destination=${destPin}&travelmode=${travelmode}`;
      if (midsPin.length) urlPins += `&waypoints=${midsPin.join('%7C')}`;
      const originName = encodeName(segment[0]); const destName = encodeName(segment[segment.length - 1]); const midsName = segment.slice(1, -1).map(encodeName);
      let urlNames = `https://www.google.com/maps/dir/?api=1&origin=${originName}&destination=${destName}&travelmode=${travelmode}`;
      if (midsName.length) urlNames += `&waypoints=${midsName.join('%7C')}`;
      links.push({ label: `Leg ${links.length + 1} (${segment.length} stops)`, urlPins, urlNames: segment.every(isTspNode) ? null : urlNames });
      i = j;
    }
    return links;
  }

  function renderLinks(links) {
    const el = $('links'); 
    
    // UPDATED: Added Header "Open in Google Maps"
    el.innerHTML = '<h4><span data-ui-text="Open in Google Maps">Open in Google Maps</span></h4>';
    
    for (const L of links) {
      const row = document.createElement('div'); row.className = 'linkrow';
      row.style.display = 'flex'; row.style.flexWrap = 'wrap'; row.style.alignItems = 'center'; row.style.gap = '10px';
      
      // UPDATED: Changed label from 'Open in Google Map' to 'Pins'
      row.innerHTML = `<span class="badge" style="min-width:60px;">${L.label}</span><div style="display:flex; gap:8px; flex:1;"><a href="${L.urlPins}" target="_blank" style="flex:1; text-align:center; padding:6px; background:rgba(59,130,246,0.1); border-radius:4px; font-size:0.85rem; text-decoration:none; color:#bfdbfe;"><span data-ui-text="📍 Pins">📍 Pins</span></a>${L.urlNames ? `<a href="${L.urlNames}" target="_blank" style="flex:1; text-align:center; padding:6px; background:rgba(16,185,129,0.1); color:#6ee7b7; border-radius:4px; font-size:0.85rem; text-decoration:none;"><span data-ui-text="🏷️ Names">🏷️ Names</span></a>` : ''}</div>`;
      UI.set(row.querySelector('.badge'), L.label);
      el.appendChild(row);
    }
    const shareArea = document.createElement('div');
    shareArea.className = 'share-area';
    
    // UPDATED: Renamed 'Share Link' to 'Share trip'
    // UPDATED: Darkened GPX button background to #14532d (Dark Green)
    shareArea.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <button id="btnShareTrip" class="btn-share" onclick="window.shareTrip()"><span data-ui-text="🔗 Share trip">🔗 Share trip</span></button>
        <button id="btnGPX" class="btn-share" style="background:#14532d; color:white; border-color:#14532d;" onclick="window.downloadGPX()"><span data-ui-text="⛰️ Save GPX">⛰️ Save GPX</span></button>
      </div>
    `;
    el.appendChild(shareArea);
  }

  window.setNavApp = function(app) {
      currentNavApp = app;
      if (lastSolvedPoints) renderRouteList(lastSolvedPoints);
  };

  function renderRouteList(points) {
      const list = $('routeList'); list.innerHTML = '';
      const toggleRow = document.createElement('div');
      toggleRow.style.cssText = "display:flex; justify-content:center; gap:10px; padding:10px; border-bottom:1px solid var(--border); margin-bottom:5px;";
      const isGoogle = currentNavApp === 'google';
      const activeStyle = "background:var(--primary); color:white; border-color:var(--primary);";
      const inactiveStyle = "background:transparent; color:var(--text-dim); border:1px solid var(--border);";
      toggleRow.innerHTML = `<button onclick="window.setNavApp('google')" style="padding:6px 12px; font-size:0.8rem; border-radius:20px; cursor:pointer; ${isGoogle ? activeStyle : inactiveStyle}">Google Maps</button><button onclick="window.setNavApp('apple')" style="padding:6px 12px; font-size:0.8rem; border-radius:20px; cursor:pointer; ${!isGoogle ? activeStyle : inactiveStyle}">Apple Maps</button>`;
      list.appendChild(toggleRow);
      const modeChar = currentTravelMode === 'DRIVING' ? 'd' : 'w';
      const googleMode = currentTravelMode === 'DRIVING' ? 'driving' : 'walking';
      points.forEach((p, i) => { 
          const li = document.createElement('li');
          const destCoords = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
          let navUrl = "";
          if (currentNavApp === 'apple') {
              if (i === 0) navUrl = `http://maps.apple.com/?daddr=${destCoords}&dirflg=${modeChar}`;
              else { const prevCoords = `${points[i-1].lat.toFixed(6)},${points[i-1].lon.toFixed(6)}`; navUrl = `http://maps.apple.com/?saddr=${prevCoords}&daddr=${destCoords}&dirflg=${modeChar}`; }
          } else {
              if (i === 0) navUrl = `https://www.google.com/maps/dir/?api=1&destination=${destCoords}&travelmode=${googleMode}`;
              else { const prevCoords = `${points[i-1].lat.toFixed(6)},${points[i-1].lon.toFixed(6)}`; navUrl = `https://www.google.com/maps/dir/?api=1&origin=${prevCoords}&destination=${destCoords}&travelmode=${googleMode}`; }
          }
          li.innerHTML = `<a href="${navUrl}" target="_blank">${i + 1}. ${p.name}<small><span data-ui-text="Tap to navigate here ↗">Tap to navigate here ↗</span></small></a>`;
          list.appendChild(li); 
      });
  }

  // --- 9. LIBRARY (GEO-AWARE) ---
  async function detectUserLocation() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const code = data.country_code; 
        
        // UPDATED: Check for US/UK to set imperial units
        if (['US', 'GB'].includes(code)) useMiles = true;

        if (['US', 'CA', 'MX'].includes(code)) return 'Americas';
        if (['CN', 'JP', 'KR', 'TH', 'VN', 'IN'].includes(code)) return 'Asia';
        if (['DE', 'FR', 'IT', 'ES', 'UK', 'GB', 'SI'].includes(code)) return 'Europe';
        return 'Global';
    } catch(e) { return null; }
  }

  async function initTripTree() {
    if (!window.TRIP_LIBRARY) return;
    const region = await detectUserLocation();
    userRegion = region; 
    let sortedLib = window.TRIP_LIBRARY.slice();
    if (region) sortedLib.sort((a, b) => (b.region.includes(region) - a.region.includes(region)));
    const tree = $('presetTree'); tree.innerHTML = '';
    presetLookup = {};
    sortedLib.forEach((regionData, idx) => {
      const rNode = document.createElement('div');
      const isUserRegion = idx === 0 && region; 
      rNode.innerHTML = `<div class="tree-header"><span class="tree-arrow">${isUserRegion?'⌄':'›'}</span> <span class="tree-label"></span></div><div class="tree-group${isUserRegion?' open':''}"></div>`;
      UI.set(rNode.querySelector('.tree-label'), regionData.region);
      const rGroup = rNode.querySelector('.tree-group');
      regionData.categories.forEach(cat => {
        const cNode = document.createElement('div');
        cNode.innerHTML = `<div class="tree-header"><span class="tree-arrow">›</span> <span class="tree-label"></span></div><div class="tree-group"></div>`;
        UI.set(cNode.querySelector('.tree-label'), cat.name);
        const cGroup = cNode.querySelector('.tree-group');
        cat.items.forEach(trip => {
          presetLookup[trip.id] = trip.data;
          const item = document.createElement('span'); item.className = 'tree-item';
          if (trip.tspPreset) item.dataset.tspId = trip.tspPreset;
          else UI.set(item, trip.label);
          item.tabIndex = 0; item.setAttribute('role', 'button');
          item.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click(); } };
          item.onclick = () => { 
            if (trip.demoPreset) { window.TripDemo.load(trip.demoPreset, {focus:true}); return; }
            if (trip.tspPreset) { window.TripTsp.load(trip.tspPreset, {focus:true}); return; }
            ++presetRequest; cancelWork(); clearComparison();
            $('input').value = normalizeTripEditorText(trip.data, {ensureStart:true});
            $('chkPlanar').checked = false;
            if (trip.id.includes('GLOBAL')) { $('chkDirect').checked = true; setTravelMode('DRIVING', false); }
            else if ((trip.mode || cat.mode) === 'WALKING' || trip.id.includes('WALKING')) { $('chkDirect').checked = false; setTravelMode('WALKING', false); }
            else { $('chkDirect').checked = false; setTravelMode('DRIVING', false); }
            saveState(); $('mapRouteCaption').hidden = true;
            setStatus(`Loaded: ${trip.label}`, 'ok'); renderSuggestions('bigChatHistory');
          };
          cGroup.appendChild(item);
        });
        cNode.querySelector('.tree-header').onclick = function() { cGroup.classList.toggle('open'); this.querySelector('.tree-arrow').textContent = cGroup.classList.contains('open') ? '⌄' : '›'; };
        rGroup.appendChild(cNode);
      });
      rNode.querySelector('.tree-header').onclick = function() { rGroup.classList.toggle('open'); this.querySelector('.tree-arrow').textContent = rGroup.classList.contains('open') ? '⌄' : '›'; };
      tree.appendChild(rNode);
    });
    refreshTspLabels();
  }

  // --- 10. AI & SUGGESTIONS (FIXED) ---
  function renderSuggestions(containerId) {
    const el = $(containerId); if (!el) return;
    const old = el.querySelector('.suggestions-box'); if (old) old.remove();
    
    const inputVal = $('input').value.trim();
    const isNew = inputVal.length < 10; 
    
    const box = document.createElement('div'); 
    box.className = 'suggestions-box';
    
    // HELP HTML (Shared)
    const helpHtml = `<div class="suggestion-group"><div class="suggestion-label"><span data-ui-text="ℹ️ Help">ℹ️ Help</span></div><div class="chip-grid"><div class="chip" onclick="window.sendChat('How do I use the Trip Library?')"><span data-ui-text="How to use Library?">How to use Library?</span></div><div class="chip" onclick="window.sendChat('What does Optimize do?')"><span data-ui-text="Explain Optimization">Explain Optimization</span></div></div></div>`;

    if (isNew) {
        let regionChip = "";
        if (userRegion === 'Europe') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a classic Europe tour (Paris, Rome, Berlin)\')"><span data-ui-text="🇪🇺 Classic Europe Tour">🇪🇺 Classic Europe Tour</span></div>';
        if (userRegion === 'Americas') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a USA West Coast road trip\')"><span data-ui-text="🇺🇸 USA West Coast">🇺🇸 USA West Coast</span></div>';
        
        box.innerHTML = `<div class="suggestion-group"><div class="suggestion-label"><span data-ui-text="✨ Start a New Adventure">✨ Start a New Adventure</span></div><div class="chip-grid">${regionChip}<div class="chip logistics" onclick="window.sendChat('Create a 3-day itinerary for Rome, Italy')"><span data-ui-text="Create 3-Day Rome Itinerary">Create 3-Day Rome Itinerary</span></div><div class="chip logistics" onclick="window.sendChat('Suggest a romantic weekend in Paris')"><span data-ui-text="Paris Weekend">Paris Weekend</span></div></div></div>${helpHtml}`;
    } else {
        box.innerHTML = `<div class="suggestion-group"><div class="suggestion-label"><span data-ui-text="🛏️ Sleeping Strategy">🛏️ Sleeping Strategy</span></div><div class="chip-grid"><div class="chip sleep" onclick="window.sendChat('Where should I stay? Calculate the best base camp.')"><span data-ui-text="Find Best Base Camp">Find Best Base Camp</span></div></div></div><div class="suggestion-group"><div class="suggestion-label"><span data-ui-text="🍴 Eating">🍴 Eating</span></div><div class="chip-grid"><div class="chip eat" onclick="window.sendChat('Suggest lunch spots with high ratings but low price')"><span data-ui-text="Best Cheap Eats">Best Cheap Eats</span></div><div class="chip eat" onclick="window.sendChat('Where is a good romantic dinner spot nearby?')"><span data-ui-text="Romantic Dinner">Romantic Dinner</span></div></div></div><div class="suggestion-group"><div class="suggestion-label"><span data-ui-text="🚕 Logistics">🚕 Logistics</span></div><div class="chip-grid"><div class="chip logistics" onclick="window.sendChat('How much time do I need for each stop?')"><span data-ui-text="Time per Stop?">Time per Stop?</span></div><div class="chip logistics" onclick="window.sendChat('Is this route walkable or do I need a taxi?')"><span data-ui-text="Walk vs Taxi">Walk vs Taxi</span></div></div></div>${helpHtml}`;
    }
    el.insertBefore(box, el.firstChild);
  }

async function initAI() {
    const s = $('modelSelector'); 
    if(s) {
      s.innerHTML='<option>8Z Trip Architect</option>';
      s.disabled = true;
    }
  }

  window.sendChat = function(text) {
      if(document.getElementById('bigChatInput').offsetParent) {
          document.getElementById('bigChatInput').value = t(text);
          handleChatSend('bigChatInput', 'bigChatHistory');
      } else {
          document.getElementById('chatInput').value = t(text);
          handleChatSend('chatInput', 'chatHistory');
      }
  };

  async function handleChatSend(inputId, historyId) {
      const i = $(inputId), t = i.value.trim(), h = $(historyId); if (!t || chatRequestPending) return;
      if (t.length > 12000) { setStatus('Please shorten your message to 12,000 characters.', 'bad'); return; }
      chatRequestPending = true;
      const sendButtons = [$('btnSendChat'), $('btnSendBigChat')].filter(Boolean);
      sendButtons.forEach(button => { button.disabled = true; });
      i.value = '';
      const userMessage = document.createElement('div');
      userMessage.className = 'msg user'; userMessage.textContent = t; h.appendChild(userMessage);
      h.scrollTop = h.scrollHeight;
      const otherHistory = historyId === 'chatHistory' ? $('bigChatHistory') : $('chatHistory');
      if (otherHistory) { otherHistory.innerHTML = h.innerHTML; otherHistory.scrollTop = otherHistory.scrollHeight; }
      saveState(); 

      const loadingId = 'loading-' + Date.now();
      h.innerHTML += `<div id="${loadingId}" class="msg ai" style="opacity:0.6">...</div>`;
      
      let response;
      try {
        response = await callAI(t);
      } catch (error) {
        const failedMessage = document.createElement('div');
        failedMessage.className = 'msg ai';
        UI.set(failedMessage, error.message);
        h.appendChild(failedMessage);
        return;
      } finally {
        document.getElementById(loadingId)?.remove();
        chatRequestPending = false;
        sendButtons.forEach(button => { button.disabled = false; });
        if (otherHistory) otherHistory.innerHTML = h.innerHTML;
        h.scrollTop = h.scrollHeight;
        saveState();
      }
      const r = response.text;
      
      // Escape provider HTML before adding the app's own trusted action badges.
      let processedText = r.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const replaceMatch = r.match(/\{REPLACE:\s*([\s\S]*?)\}/);
      if (replaceMatch && replaceMatch[1].trim()) {
          const cleanTrip = normalizeTripEditorText(replaceMatch[1], { ensureStart: true });
          if (cleanTrip) {
            cancelWork(); clearComparison();
            $('input').value = cleanTrip;
            saveState();
            setStatus('Trip Editor updated in Trip Library format.', 'ok');
            setTimeout(() => { renderSuggestions('bigChatHistory'); if (historyId === 'chatHistory') renderSuggestions('chatHistory'); }, 500);
          }
          processedText = processedText.replace(/\{REPLACE:\s*[\s\S]*?\}/g, '<div class="action-badge">📋 <strong><span data-ui-text="Trip Editor Updated">Trip Editor Updated</span></strong><small><span data-ui-text="Trip Library format applied.">Trip Library format applied.</span></small></div>');
      }
      const addMatches = [...r.matchAll(/\{ADD:\s*([\s\S]*?)\}/g)];
      if(addMatches.length) {
        let addedCount = 0;
        addMatches.forEach(match => { addedCount += appendTripEditorBlock(match[1]); });
        if(addedCount > 0) { saveState(); setStatus(`AI added ${addedCount} Trip Editor line(s).`, 'ok'); renderSuggestions('bigChatHistory'); }
        processedText = processedText
          .replace(/```(?:json|text|txt)?\s*\{ADD:\s*[\s\S]*?\}\s*```/g, '<div class="action-badge">➕ <strong><span data-ui-text="Stops Added">Stops Added</span></strong><small><span data-ui-text="Trip Library format applied.">Trip Library format applied.</span></small></div>')
          .replace(/\{ADD:\s*[\s\S]*?\}/g, '<div class="action-badge">➕ <strong><span data-ui-text="Stops Added">Stops Added</span></strong><small><span data-ui-text="Trip Library format applied.">Trip Library format applied.</span></small></div>');
      }

      const modelLabel = /^gemini-[a-z0-9.-]{1,72}$/.test(response.model || '')
        ? response.model.replace(/^gemini-/, 'Gemini ') : 'Gemini';
      h.innerHTML += `<div class="msg ai"><strong>${modelLabel}${response.fallbackUsed ? UI.t(' (backup model)') : ''}:</strong> ${formatMarkdown(processedText)}</div>`;
      if (response.mapsEnabled === false && window.MDLxDCCLocale.current() === 'en') {
        const note = document.createElement('small'); UI.set(note, 'Web search mode'); h.appendChild(note);
      }
      if (response.sources?.length) {
        const sources = document.createElement('div'); sources.className = 'msg ai';
        sources.append(window.MDLxDCCLocale.current() === 'sl' ? 'Viri: ' : 'Sources: ');
        response.sources.forEach((source, index) => {
          try {
            const url = new URL(source.url);
            if (!['https:', 'http:'].includes(url.protocol)) return;
            const link = document.createElement('a');
            link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.textContent = (source.provider === 'Google Maps' ? 'Google Maps · ' : '') + (source.title || `Source ${index + 1}`);
            if (source.provider === 'Google Maps') { link.translate = false; link.className = 'maps-citation'; }
            if (sources.childNodes.length > 1) sources.append(' · ');
            sources.appendChild(link);
          } catch (_) { /* Ignore malformed source links. */ }
        });
        h.appendChild(sources);
      }
      if (response.searchSuggestionsHtml) {
        const suggestions = document.createElement('iframe');
        suggestions.title = 'Google Search suggestions';
        suggestions.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
        suggestions.referrerPolicy = 'no-referrer';
        suggestions.style.cssText = 'width:100%;height:120px;border:0;background:white;border-radius:8px;';
        suggestions.srcdoc = response.searchSuggestionsHtml;
        h.appendChild(suggestions);
      }
      h.scrollTop = h.scrollHeight;
      if (otherHistory) { otherHistory.innerHTML = h.innerHTML; otherHistory.scrollTop = otherHistory.scrollHeight; }
      saveState(); 
  }

async function callAI(txt) {
    // Only successful exchanges enter model history. Bound persisted conversations.
    const history = chatHistoryBuffer.filter(m => ['user', 'model'].includes(m?.role) && typeof m.parts?.[0]?.text === 'string').slice(-20);
    history.push({ role: 'user', parts: [{ text: txt }] });
    while (history.length > 1 && history.reduce((n, m) => n + m.parts[0].text.length, 0) > 35000) history.shift();
    const currentTripData = $('input').value.substring(0, 3000); 
    const locationContext = userRegion ? `USER LOCATION: ${userRegion}` : "";
    let sysPrompt = "";
    
    const tripFormatRules = `
TRIP EDITOR FORMAT - REQUIRED:
Use the same format as Trip Library. The Trip Editor is plain text, not JSON.
One line per stop. Comments/titles start with # and are ignored by the map.
Stop line format: Specific place name, city, country OR Stop Name | latitude, longitude
Use coordinates only when confident; otherwise Google will resolve the place name. Never fabricate precise coordinates.
The first real stop may end with START.
For a real route, provide at least 2 stops; for a day trip, prefer 5-10 useful stops.
Never output JSON arrays, quoted strings, commas between stop strings, escaped \\n, or Markdown code fences inside command blocks.
Good example:
{REPLACE:
# 🇭🇷 Croatia: Rijeka One-Day Walking Trip
Korzo, Rijeka | 45.3275, 14.4422 START
City Tower, Rijeka | 45.3274, 14.4429
St. Vitus Cathedral, Rijeka | 45.3268, 14.4438
Trsat Castle, Rijeka | 45.3326, 14.4559
Molo Longo, Rijeka | 45.3247, 14.4336
}
Bad example:
["# Trip\\nRijeka | 45.3271, 14.4422"]
Bad example:
"# Trip\\nRijeka | 45.3271, 14.4422", "# Trip\\nRijeka | 45.3271, 14.4422"`;

    if (currentTripData.length < 20) {
        sysPrompt = `You are the 8Z Trip Architect. User has EMPTY itinerary. ${locationContext}\n${tripFormatRules}\nWhen creating a new trip, use exactly one {REPLACE:\n...\n} command block with a title and multiple real stops. Do not say the editor was updated unless you include the command block.`;
    } else {
        sysPrompt = `You are the 8Z Logistics Co-Pilot. ${locationContext}\nCURRENT STOPS:\n${currentTripData}\n${tripFormatRules}\nRULES: 1. Value for money. 2. Use Markdown tables for explanation only, never inside Trip Editor command blocks. 3. To append stops, use {ADD:\nStop | lat, lon\n}. To overwrite the whole itinerary, use {REPLACE:\nfull trip text\n}. 4. Do not claim the Trip Editor was updated unless you include a valid command block.`;
    }

    // Merge history and system prompt for the proxy
    const guiContext = `\nBrute Force can pause and resume in this open tab for the same stops, START, mode and distance table; reload or problem changes reset it. One compute worker runs on phones and desktops. Fast, Deep and Brute Force show live statistics below the map. Map refresh interval is selectable: 1, 5, 15, 30 or 60 seconds, default 5; only improved routes are redrawn. Deep uses a shared local-time budget: 10s up to50 stops,30s up to100,60s up to500,180s up to1000,300s above1000. Deep stops on independently verified TSP optimum, timeout or cancellation. Continue calculating adds another size-based budget to the same search and best route; paused time is excluded. Reload, problem changes or a new solve clear continuation. A verified optimum cannot be continued. Progress measures time-budget consumption, not optimality probability. Fast and the informational air row keep their prior bounded work. Savings compare to the entered order with START first. Help and Demo open short popups; More opens detailed articles in a separate tab. About is the second Help paragraph. Library is below results on phones. Current, Lab and Previous select versions. Save downloads editor text. GPX connects stop coordinates; it is not a detailed road track. Share encodes the current editor text in a URL.\nGUI state: mode=${currentTravelMode}; Round Trip=${$('chkRoundTrip').checked}; Direct Line=${$('chkDirect').checked}; Brute Force=${$('chkBrute').checked}; Planar TSP=${planarSelected()}. Planar TSP uses original rounded EUC_2D coordinates and units, not km. Known optimum comparison requires the full original round trip.\nOnly include editor commands when the user asks to create or change the trip. For help or discussion, explain without editing.\n`;
    const fullPrompt = sysPrompt + guiContext + "\n\nHistory:\n" + 
      history.map(m => `${m.role.toUpperCase()}: ${m.parts[0].text}`).join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const res = await fetch(PROXY_URL, { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ prompt: fullPrompt, guiVersion: 'road-matrix-brute20-lab', language: window.MDLxDCCLocale.current(), query: txt }),
        signal: controller.signal
      });

      let d;
      try { d = await res.json(); } catch (_) {
        throw new Error(`The chatbot connection returned HTTP ${res.status}. Please try again shortly.`);
      }
      if (!res.ok || d.ok !== true) {
        throw new Error(d.error?.message || `The chatbot request failed (HTTP ${res.status}). Please try again shortly.`);
      }
      if (typeof d.text !== 'string' || !d.text.trim()) throw new Error('Gemini returned no answer. Please try again.');
      chatHistoryBuffer = history.concat({ role: 'model', parts: [{ text: d.text }] }).slice(-20);
      return d;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Gemini took too long to answer. Please try again.');
      if (err instanceof TypeError) throw new Error('The chatbot connection failed. Check your connection and try again.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // --- 11. OPTIMIZER ---
  // Manual exhaustive mode. Counts use BigInt; an enabled run never exceeds 19!.
  const BF = globalThis.TripBruteForce;
  let measuredBruteRate = null;
  let comparisonKey = null;
  let comparisonInput = null;
  let provenExactKm = null;
  const comparisons = new Map();
  let referenceVersion = 0;
  let airWorker = null;
  let airCache = null;
  let comparisonJob = null;
  // Only the current page owns this checkpoint; no persisted road data or background run.
  let pausedBrute = null;
  let pausedDeep = null;
  function discardDeep() {
    if(pausedDeep)worker.postMessage({type:'discard-deep'});
    pausedDeep=null;
    if($('continueDeep'))$('continueDeep').hidden=true;
  }
  function refreshDeepContinue() {
    if(pausedDeep && pausedDeep.signature!==problemSignature())discardDeep();
    const button=$('continueDeep');
    if(!button)return;
    button.hidden=!pausedDeep||optimizationPending;
    button.disabled=!pausedDeep||optimizationPending;
    if(pausedDeep) {
      const seconds=pausedDeep.result.additionalBudgetMs/1000;
      UI.set(button,`Continue calculating (+${seconds>=60?seconds/60+' min':seconds+' s'})`);
    }
  }
  function continueDeep() {
    refreshDeepContinue();
    if(optimizationPending||!pausedDeep)return;
    const saved=pausedDeep, jobId=++jobVersion;
    pausedDeep=null;optimizationPending=true;++visualizationVersion;
    if(airWorker){airWorker.terminate();airWorker=null;}
    const current=()=>jobId===jobVersion&&problemSignature()===saved.signature;
    activeJob={...saved.job,jobId,current,cancelling:false,cancelTimer:null,
      latest:saved.result,lastMapRefresh:performance.now(),mapPending:false};
    setPlanningMode(false);
    const progress={...saved.result,type:'progress',reason:null,cancelled:false,phase:'searching',
      budgetMs:saved.result.budgetMs+saved.result.additionalBudgetMs};
    displaySearchProgress(progress,activeJob);displayComparison(progress,activeJob);
    refreshBruteInfo();$('btnCancelWork').disabled=false;
    setStatus('Continuing Deep with additional time. Best route and search state kept; paused time is excluded.','ok');
    worker.postMessage({type:'continue-deep',previousJobId:saved.job.jobId,jobId});
  }
  function problemSignature() {
    return JSON.stringify([$('input').value, currentTravelMode, $('chkDirect').checked, $('chkRoundTrip').checked, planarSelected()]);
  }
  function resumeAvailable() {
    if (pausedBrute && pausedBrute.signature !== problemSignature()) pausedBrute = null;
    return !!pausedBrute;
  }
  const AIR_NAME = 'Our Optimize (Deep · Air)';

  function createWorker() {
    const w = new Worker('worker.js?v=20260913-continue1');
    w.onmessage = handleWorkerMessage;
    w.onerror = () => {
      activeJob = null; discardDeep(); finishWork();
      setStatus('Calculation worker failed. Reload the page and try again.', 'bad');
    };
    return w;
  }

  function powerOfTen(exponent) {
    return '10' + String(exponent).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('');
  }
  function formatOrderCount(total) {
    const digits = total.toString();
    return digits.length <= 40 ? total.toLocaleString('en-US')
      : `${(Number(digits.slice(0, 4)) / 1000).toFixed(3)} × ${powerOfTen(digits.length - 1)}`;
  }
  function estimateBruteDuration(total, rate) {
    const seconds = Number(total) / rate;
    if (Number.isFinite(seconds)) return BF.duration(seconds);
    const digits = total.toString();
    const logYears = Math.log10(Number(digits.slice(0, 15))) + digits.length - 15 - Math.log10(rate * 31557600);
    return `${Math.pow(10, logYears % 1).toFixed(2)} × ${powerOfTen(Math.floor(logYears))} years`;
  }

  function refreshBruteInfo() {
    const input = normalizeTripEditorText($('input').value, {ensureStart:true});
    const {pts} = parseStops(input);
    const n = pts.length, total = BF.orders(n);
    const invalid = pts.some(p => p.lat !== null && p.lon !== null && !validCoordinates(p));
    const allowed = n >= 2 && n <= BF.MAX_STOPS && !invalid;
    $('chkBrute').disabled = !allowed;
    if (!allowed) $('chkBrute').checked = false;
    const busyLabel = activeJob?.cancelling ? (activeJob.profile==='brute' ? 'Stopping Brute Force…' : 'Stopping calculation…') : activeJob?.profile === 'brute'
      ? 'Brute Force running…' : activeJob ? 'Calculating…' : 'Preparing route…';
    UI.set($('btnStandard'), optimizationPending ? busyLabel : $('chkBrute').checked ? (resumeAvailable() ? 'Resume Brute Force' : 'Run Brute Force') : 'Optimize (Fast)');
    for (const id of ['btnStandard','btnDeep','btnPrepare']) $(id).disabled = optimizationPending;
    $('btnDeep').hidden = $('chkBrute').checked;
    $('bruteMini').hidden = !$('chkBrute').checked;
    if ($('chkBrute').checked && !$('bruteMini').textContent) UI.set($('bruteMini'), 'Ready · progress appears here');
    $('bruteOption').classList.toggle('unavailable', !allowed);
    const rate = measuredBruteRate?.rate || 1000000;
    const rateNote = measuredBruteRate
      ? `extrapolated at ${Math.round(rate).toLocaleString('en-US')} orders/s measured with ${measuredBruteRate.n} stops`
      : 'illustration at 1,000,000 orders/s; actual speed depends on this device';
    UI.set($('bruteInfo'), !total
      ? (n > 1000 ? 'Brute Force unavailable above 20 stops.' : 'Brute Force: enter 2–20 stops including START.')
      : `${n} stops · (${n}−1)! = ${formatOrderCount(total)} possible orders. ` +
        `Estimated full search: ${estimateBruteDuration(total, rate)} (${rateNote}). ` +
        (invalid ? 'Correct invalid coordinates first.' : n > BF.MAX_STOPS ? 'Brute Force unavailable above 20 stops.' : 'START stays fixed; each direction is counted separately.'));
    refreshDeepContinue();
    return {n, allowed};
  }

  function clearComparison() {
    discardDeep();
    pausedBrute = null;
    comparisonKey = null; comparisonInput = null; provenExactKm = null; comparisons.clear();
    if (airWorker) { airWorker.terminate(); airWorker = null; }
    airCache = null; comparisonJob = null;
    UI.set($('bruteMini'), '');
    $('comparisonPanel').hidden = true;
    $('bruteProgress').hidden = true;
    $('searchProgress').hidden = true;
  }

  function displayComparison(msg, job) {
    const name = msg.algorithm === 'brute' ? 'Brute Force' : job.profile === 'deep' ? 'Our Optimize (Deep)' : 'Our Optimize (Fast)';
    const state = msg.algorithm === 'brute'
      ? (msg.exact ? 'Exact optimum for this table' : msg.cancelled ? 'Cancelled · best found' : 'Running · best found')
      : job.profile==='deep' && msg.type==='progress' ? 'Running · best found'
      : job.profile==='deep' && msg.reason ? deepFinishLabel(msg) : 'Best found · optimum not proven';
    if (msg.algorithm === 'brute' && msg.exact) provenExactKm = routeValue(msg);
    const assessment = job.planar ? TripTspMetric.assess(msg.pointsSorted,job.points,job.reference,job.roundTrip,msg.totalCost) : null;
    comparisons.set(name, {time:BF.duration((msg.elapsedMs || 0)/1000), km:routeValue(msg), planar:job.planar, assessment, state});
    comparisonJob = job;
    renderComparison();
  }

  function renderComparison() {
    const job = comparisonJob;
    if (!job) return;
    const body = $('comparisonRows'); body.replaceChildren();
    for (const [method, result] of [...comparisons].sort((a,b)=>['Our Optimize (Fast)','Our Optimize (Deep)','Brute Force',AIR_NAME].indexOf(a[0])-['Our Optimize (Fast)','Our Optimize (Deep)','Brute Force',AIR_NAME].indexOf(b[0]))) {
      const row = document.createElement('tr');
      if (method === AIR_NAME) row.className = 'air-comparison';
      else if (method === 'Our Optimize (Deep)') row.className = 'deep-comparison';
      let description = result.state;
      if (method !== 'Brute Force' && method !== AIR_NAME && provenExactKm !== null) {
        description = Math.abs(result.km-provenExactKm) <= 1e-9 ? 'Matches exact optimum' : `${formatValue(result.km-provenExactKm,result.planar)} above exact optimum`;
      }
      if (result.assessment) {
        const a=result.assessment;
        description=a.reached ? 'Known optimum reached · gap 0%' : `${result.state} · Above known optimum: ${formatValue(a.gap,true)} (${a.gapPercent.toFixed(2)}%)`;
      }
      for (const value of [method, result.time, formatValue(result.km,result.planar), description]) {
        const cell = document.createElement('td'); UI.set(cell, value); row.appendChild(cell);
      }
      body.appendChild(row);
    }
    $('comparisonPanel').hidden = false;
    UI.set($('comparisonNote'), `${metricName(job)} · ${job.roundTrip ? 'Round trip' : 'Open trip'} · START`);
    UI.set($('comparisonDetails'), 'Same stops and START. Each row states its distance units. Fast and Deep report the best route found. Completed Brute Force proves the table optimum. A matching known TSP optimum applies only to the complete original EUC_2D round trip. Deep time includes local preparation. Google lookup/table download and map drawing are separate.');
  }

  function ensureAirComparison(points, startIdx, job) {
    // Large direct datasets already use air distances; do not start a second,
    // expensive Deep job silently after the user's explicit Fast calculation.
    if (job.planar || (job.direct && points.length > 100)) return;
    const key = JSON.stringify([points.map(p => [p.lat,p.lon]),startIdx,job.roundTrip]);
    if (airCache?.key === key) {
      comparisons.set(AIR_NAME, airCache.result); renderComparison(); return;
    }
    if (airWorker) return;
    const expectedComparison = comparisonKey;
    const w = new Worker('worker.js?v=20260913-continue1'); airWorker = w;
    w.onmessage = ({data:m}) => {
      if (m.type !== 'result' && m.type !== 'error') return;
      w.terminate(); if (airWorker === w) airWorker = null;
      if (comparisonKey !== expectedComparison) return;
      if (m.type === 'result') {
        const result = {time:BF.duration(m.elapsedMs/1000), km:m.totalKm, state:'Informational · great-circle air · best found, not proven'};
        airCache = {key,result}; comparisons.set(AIR_NAME,result); renderComparison();
      } else setStatus('Air comparison could not complete: ' + m.error, 'warn');
    };
    w.onerror = () => { w.terminate(); if (airWorker === w) airWorker = null; };
    w.postMessage({type:'solve',profile:'air-comparison',jobId:job.jobId,points,startIdx,roundTrip:job.roundTrip});
  }

  function displayBruteProgress(msg, job) {
    $('bruteProgress').hidden = false;
    const rate = msg.elapsedMs > 0 ? Number(msg.checked) / (msg.elapsedMs/1000) : 0;
    if (msg.elapsedMs >= 200 && rate > 0) {
      measuredBruteRate = {rate, n:job.n};
      refreshBruteInfo();
    }
    const state = msg.exact ? 'Complete' : msg.cancelled ? 'Cancelled' : 'Running';
    const remaining = msg.exact ? '0 s' : rate > 0 ? BF.duration(Number(msg.total-msg.checked)/rate) : 'measuring…';
    UI.set($('bruteProgressText'), `${state} · ${BF.percent(msg.checked,msg.total)} done · ${msg.checked.toLocaleString('en-US')} / ${msg.total.toLocaleString('en-US')} orders checked`);
    UI.set($('bruteMini'), `${BF.percent(msg.checked,msg.total)} · ${state} · ${remaining} remaining`);
    $('bruteProgressBar').value = Number(msg.checked) / Number(msg.total);
    UI.set($('bruteTiming'), `Compute time: ${BF.duration(msg.elapsedMs/1000)} · 1 compute thread · Speed: ${rate > 0 ? Math.round(rate).toLocaleString('en-US') + ' orders/s' : 'measuring…'} · ${msg.cancelled ? 'Full-search time remaining at this rate' : 'Estimated remaining'}: ${remaining}`);
    UI.set($('bruteBest'), `Best ${job.planar ? 'TSP' : job.direct ? 'direct' : 'road-table'} distance: ${formatValue(routeValue(msg),job.planar)} · ${msg.exact ? 'All orders checked; optimum proven for this table.' : 'Optimum not yet proven.'}`);
    displayComparison(msg, job);
  }

  function showSavings(msg) {
    const planar = msg.metric === 'tsp-euc2d';
    const base=baseValue(msg), value=routeValue(msg);
    const saving = Math.max(0, base - value);
    const percent = base > 0 ? 100 * saving / base : 0;
    UI.set($('savingLabel'), 'Saving vs entered order:');
    UI.set($('savedKm'), `${formatValue(saving,planar)} (${percent.toFixed(2)}%)`);
    UI.set($('savingDetails'), `Entered order: ${formatValue(base,planar)} · Optimized order: ${formatValue(value,planar)} · ${planar ? 'Planar TSP (EUC_2D)' : msg.metric === 'road' ? 'Road distance table' : 'Great-circle air distances'} · START`);
    $('savingBox').dataset.uiTitle = planar ? 'Reduction versus the entered order, using original rounded EUC_2D costs.' : msg.metric === 'road' ? 'Reduction versus entered order with START first, measured using the same directed road distance table.' : 'Reduction versus entered order with START first, measured using the same great-circle distances.';
    UI.render();
  }

  function showSolvedRoute(msg, job, preview = false) {
    lastSolvedPoints = msg.pointsSorted;
    lastDirectKm = msg.directKm;
    lastPlanarCost = job.planar ? msg.totalCost : null;
    showSavings(msg);
    renderRouteList(msg.pointsSorted);
    renderLinks(buildMapsLegLinks(msg.pointsSorted, job.roundTrip, job.mode));
    const brute = job.profile === 'brute';
    const assessment = job.planar ? TripTspMetric.assess(msg.pointsSorted,job.points,job.reference,job.roundTrip,msg.totalCost) : null;
    const routeContext = {
      method: brute ? 'Brute Force' : job.profile === 'deep' ? 'Our Optimize (Deep)' : 'Our Optimize (Fast)',
      state: assessment?.reached ? 'Known optimum reached · gap 0%' : brute ? (msg.exact ? 'Exact optimum for this table' : msg.cancelled ? 'Cancelled · best found' : 'Running · best found') : 'Best found · optimum not proven'
    };
    return updateMapVisualization(msg.pointsSorted, {preview, routeContext});
  }

  function mapRefreshInterval() {
    const selected = Number($('mapRefreshInterval')?.value);
    return [1000,5000,15000,30000,60000].includes(selected) ? selected : 5000;
  }

  function refreshBruteMap(msg, job) {
    if (!(msg.checked || msg.completed || msg.candidates) || !msg.pointsSorted || job.mapPending || document.hidden || routeValue(msg) >= job.mapBestKm) return;
    if (performance.now() - job.lastMapRefresh < mapRefreshInterval()) return;
    job.lastMapRefresh = performance.now(); job.mapBestKm = routeValue(msg); job.mapPending = true;
    showSolvedRoute(msg, job, true).catch(error => console.warn('[8Z Trip] Route preview:', error)).finally(() => { job.mapPending = false; });
  }

  function deepFinishLabel(msg) {
    if(msg.reason==='optimum')return 'Known optimum reached · gap 0%';
    if(msg.reason==='budget')return 'Time budget used · best found';
    if(msg.reason==='cancelled')return 'Cancelled · best found';
    if(msg.reason==='unresponsive')return 'Worker did not respond · last reported route kept';
    return msg.error || 'Best found · optimum not proven';
  }

  function displaySearchProgress(msg, job, finished = false) {
    const timed=job.profile==='deep';
    $('searchBudgetBox').hidden=!timed;
    UI.set($('searchStartsLabel'),timed?'Candidates started / completed':'Completed search starts');
    UI.set($('searchEtaLabel'),timed?'Time budget remaining':'Estimated remaining');
    UI.set($('searchProgressHint'),timed?'Progress shows time budget used, not the probability of optimality. Local preparation is included; Google data fetching and map drawing are separate.':'Progress counts search starts, not all possible orders. ETA estimates the remaining planned search.');
    if(timed) {
      const used=msg.elapsedMs||0, budget=msg.budgetMs||0;
      const state=finished?deepFinishLabel(msg):msg.phase==='preparing'?'Preparing local distances':'Running';
      $('searchProgress').hidden=false;
      UI.set($('searchProgressText'),`Our Optimize (Deep) · ${state} · ${budget?(100*Math.min(1,used/budget)).toFixed(2)+'% time budget used':'…'}`);
      $('searchProgressBar').value=budget?Math.min(1,used/budget):0;
      UI.set($('searchStarts'),`${(msg.candidates||0).toLocaleString('en-US')} / ${(msg.completed||0).toLocaleString('en-US')}`);
      UI.set($('searchElapsed'),BF.duration(used/1000));
      UI.set($('searchBudget'),budget?BF.duration(budget/1000):'…');
      UI.set($('searchEta'),budget?(used>=budget?'0 s':BF.duration((budget-used)/1000)):'…');
      UI.set($('searchMetric'),metricName(job));
      UI.set($('searchBest'),msg.pointsSorted?formatValue(routeValue(msg),job.planar):'—');
      $('searchCancel').disabled=finished||job.cancelling;
      return;
    }
    const completed = msg.completed || 0, starts = msg.starts || 0;
    const fraction = starts ? Math.min(1, completed / starts) : 0;
    const elapsed = (msg.elapsedMs || 0) / 1000;
    const state = msg.cancelled ? 'Cancelled' : finished ? 'Complete' : 'Running';
    $('searchProgress').hidden = false;
    UI.set($('searchProgressText'), `${job.profile === 'deep' ? 'Our Optimize (Deep)' : 'Our Optimize (Fast)'} · ${state} · ${BF.percent(completed, starts || 1)}`);
    $('searchProgressBar').value = fraction;
    UI.set($('searchStarts'), `${completed.toLocaleString('en-US')} / ${starts.toLocaleString('en-US')}`);
    UI.set($('searchElapsed'), BF.duration(elapsed));
    UI.set($('searchEta'), finished ? (msg.cancelled ? '—' : '0 s') : completed > 0 ? BF.duration(elapsed * (starts-completed) / completed) : 'measuring…');
    UI.set($('searchMetric'), metricName(job));
    UI.set($('searchBest'), formatValue(routeValue(msg),job.planar));
    $('searchCancel').disabled = finished;
  }

  function requestCancel() {
    if (activeJob?.profile === 'brute' || activeJob?.profile === 'deep') {
      if (activeJob.cancelling) return;
      activeJob.cancelling = true;
      refreshBruteInfo();
      $('btnCancelWork').disabled = true;
      setStatus('Stopping calculation and keeping the best route…', 'warn');
      worker.postMessage({type:'cancel', jobId:activeJob.jobId});
      if(activeJob.profile==='deep') {
        const job=activeJob;
        job.cancelTimer=setTimeout(()=>{
          if(activeJob!==job||!job.current())return;
          const latest=job.latest;
          worker.terminate();worker=createWorker();activeJob=null;finishWork();
          if(latest?.pointsSorted) {
            const result={...latest,cancelled:true,exact:false,reason:'unresponsive'};
            displaySearchProgress(result,job,true);displayComparison(result,job);showSolvedRoute(result,job);
            setStatus('Worker did not respond · last reported route kept','warn');
          } else {
            const error='Calculation stopped before a route was reported.';
            displaySearchProgress({reason:'error',error},job,true);setStatus(error,'warn');
          }
        },1000);
      }
    } else {
      const job = activeJob, latest = job?.latest, stillCurrent = job?.current();
      cancelWork(); setStatus('Calculation cancelled.', 'warn');
      if (latest?.pointsSorted && stillCurrent) { displayComparison(latest,job); showSolvedRoute({...latest,cancelled:true}, job); }
    }
  }

  function setPlanningMode(enabled) {
    document.body.classList.toggle('planning-mode', enabled);
    document.body.classList.remove('demo-open');
    $('demoPanel').hidden = true; $('btnDemo').classList.remove('active');
    const rightPanel = $('resultsPanel');
    const mapCont = $('mapContainer'), stats = document.querySelector('.stats'), list = $('routeList'), links = $('links');
    const btnPlan = $('btnPlanMode'), btnMap = $('btnMapMode');
    let bigChat = $('bigChatContainer');
    if (!bigChat) {
        bigChat = document.createElement('div'); bigChat.id = 'bigChatContainer'; bigChat.style.display = 'none';
        bigChat.innerHTML = `<div id="bigChatHistory" style="flex:1; overflow-y:auto; padding:20px; border-bottom:1px solid #1f2a3a;"></div><div class="chat-input" style="padding:15px; background:#0f1621;"><input type="text" id="bigChatInput" placeholder="${window.MDLxDCCLocale.current() === 'sl' ? 'Vprašaj pomočnika …' : 'Ask the trip assistant …'}"><button id="btnSendBigChat">➤</button></div>`;
        rightPanel.appendChild(bigChat);
        $('bigChatHistory').innerHTML = $('chatHistory').innerHTML;
        $('btnSendBigChat').onclick = () => handleChatSend('bigChatInput', 'bigChatHistory');
        $('bigChatInput').onkeypress = (e) => { if(e.key==='Enter') handleChatSend('bigChatInput', 'bigChatHistory'); };
    }
    if (enabled) {
        btnPlan.classList.add('active'); btnMap.classList.remove('active');
        mapCont.style.display = 'none'; stats.style.display = 'none'; list.style.display = 'none'; links.style.display = 'none';
        bigChat.style.display = 'flex'; bigChat.style.flexDirection = 'column'; bigChat.style.height = '100%'; $('chatPanel').style.display = 'none';
        $('bigChatHistory').innerHTML = $('chatHistory').innerHTML; renderSuggestions('bigChatHistory');
        setTimeout(() => $('bigChatInput') && $('bigChatInput').focus(), 100);
    } else {
        btnMap.classList.add('active'); btnPlan.classList.remove('active');
        mapCont.style.display = 'block'; stats.style.display = 'flex'; list.style.display = 'block'; links.style.display = 'flex';
        bigChat.style.display = 'none'; $('chatPanel').style.display = 'flex';
        $('chatHistory').innerHTML = $('bigChatHistory').innerHTML;
    }
  }

  function finishWork() {
    optimizationPending = false;
    $('btnCancelWork').disabled = true;
    $('searchCancel').disabled = true;
    refreshBruteInfo();
  }

  function cancelWork() {
    discardDeep();
    if (airWorker) { airWorker.terminate(); airWorker = null; }
    ++jobVersion;
    ++visualizationVersion;
    if (activeJob) {
      clearTimeout(activeJob.cancelTimer);
      worker.terminate(); worker = createWorker();
      if (activeJob.latest) {
        if (activeJob.profile === 'brute') displayBruteProgress({...activeJob.latest,cancelled:true},activeJob);
        else displaySearchProgress({...activeJob.latest,cancelled:true},activeJob,true);
      }
    }
    activeJob = null;
    finishWork();
  }

  function showRoadTable(points, data) {
    const panel = $('roadTable');
    panel.replaceChildren();
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;white-space:nowrap;font-size:12px;';
    const addRow = (values, header = false) => {
      const row = document.createElement('tr');
      values.forEach((value, index) => {
        const cell = document.createElement(header ? 'th' : 'td');
        if ((!header && index > 0) || (header && index === 0)) UI.set(cell, value);
        else cell.textContent = value;
        cell.style.cssText = 'padding:5px 10px;border:1px solid #334155;text-align:right;';
        row.appendChild(cell);
      });
      table.appendChild(row);
    };
    addRow(['From → To', ...points.map(p => p.name)], true);
    points.forEach((p, i) => addRow([p.name, ...data.distanceMatrix[i].map(m => formatKm(m/1000))]));
    panel.appendChild(table);
    UI.set($('roadTableInfo'), `Google Maps · ${data.mode === 'WALKING' ? 'Walk' : 'Drive'} · ${new Date(data.measuredAt).toLocaleTimeString()} · Kept only for the current open trip.`);
    $('roadTablePanel').style.display = 'block';
    UI.set($('matrixStatus'), `${data.reused ? 'Reusing' : 'Ready:'} ${points.length * (points.length-1)} directed road distances. Optimization runs locally.`);
  }

  async function run(profile, forceMatrix = false) {
    if (optimizationPending) return;
    discardDeep();
    const requestedBrute = profile === 'brute' || (profile !== 'prepare' && $('chkBrute').checked);
    const eligibility = refreshBruteInfo();
    if (requestedBrute && !eligibility.allowed) { setStatus('Brute Force supports 2–20 valid stops including START.', 'warn'); return; }
    if (requestedBrute) profile = 'brute';
    if (forceMatrix) pausedBrute = null;
    const resume = requestedBrute && resumeAvailable() ? pausedBrute : null;
    if (airWorker) { airWorker.terminate(); airWorker = null; }
    optimizationPending = true;
    activeJob = null;
    refreshBruteInfo();
    const jobId = ++jobVersion;
    $('btnCancelWork').disabled = false;
    // An earlier route response must not overwrite this new calculation.
    ++visualizationVersion;
    if (resume) {
      setPlanningMode(false);
      const current = () => jobId === jobVersion && problemSignature() === resume.signature && $('chkBrute').checked;
      activeJob = {...resume.job, jobId, current, cancelling:false, lastMapRefresh:performance.now(), mapPending:false};
      pausedBrute = null;
      setStatus('Resuming from the first unchecked order. Paused time is excluded.', 'ok');
      refreshBruteInfo();
      worker.postMessage({type:'solve',jobId,profile:'brute',points:activeJob.points,startIdx:activeJob.startIdx,
        roundTrip:activeJob.roundTrip,distanceMatrix:activeJob.distanceMatrix,metric:activeJob.planar ? 'tsp-euc2d' : undefined,resumeState:resume.state});
      return;
    }
    lastDirectKm = null;
    showDistance(null, 'Distance');
    UI.set($('savedKm'), '—');
    UI.set($('savingDetails'), '');
    let posted = false;
    try {
    setPlanningMode(false);
    if (!(window.google && window.google.maps)) {
      setStatus('Loading Map API...', 'ok');
      try { await ensureMapsLoaded(); }
      catch (e) { console.error('[8Z Trip] Cannot optimize with map/geocoder unavailable:', e); return; }
    }
    const repaired = normalizeTripEditorText($('input').value, { ensureStart: true });
    if (repaired && repaired !== $('input').value.trim()) {
      $('input').value = repaired;
      saveState();
      setStatus('Trip Editor text repaired to Trip Library format.', 'warn');
    }
    const raw = $('input').value;
    const mode = currentTravelMode, direct = $('chkDirect').checked, roundTrip = $('chkRoundTrip').checked, planar = planarSelected();
    const current = () => jobId === jobVersion && $('input').value === raw && currentTravelMode === mode &&
      $('chkDirect').checked === direct && $('chkRoundTrip').checked === roundTrip && planarSelected() === planar &&
      (profile === 'prepare' || $('chkBrute').checked === requestedBrute);
    let { pts, startIdx } = parseStops(raw);
    if (pts.length < 2) { setStatus('Enter at least 2 stops, one per line.', 'bad'); return; }
    const stopKey = JSON.stringify(pts);
    try {
      pts = lastResolvedStops?.key === stopKey ? lastResolvedStops.points.map(p => ({...p})) : await geocodeMissingPoints(pts);
    } catch (e) { if (current()) setStatus(e.message, 'bad'); return; }
    if (!current()) return;
    lastResolvedStops = {key:stopKey, points:pts.map(p => ({...p}))};
    // Never silently drop an unresolved stop or move START to another city.
    let valid = pts, tspData = null;
    if (planar) {
      try {
        tspData = await window.TripTspLibrary.prepare(/^# TSP source: ([a-z]+\d+)$/m.exec(raw)?.[1], pts);
        valid = tspData.points;
      } catch(error) { if(current()) setStatus(error.message,'bad'); return; }
      if (!current()) return;
    }
    let roadData = null;
    if (!direct) {
      UI.set($('matrixStatus'), 'Preparing road distances…');
      try {
        roadData = await roadPlanner.prepare(valid, mode, {
          loadRoutes: () => google.maps.importLibrary('routes'), current, force:forceMatrix,
          progress: text => { if (current()) { UI.set($('matrixStatus'), text); setStatus(text, 'warn'); } }
        });
        if (!current()) return;
        showRoadTable(valid, roadData);
      } catch (error) {
        if (!current()) return;
        UI.set($('matrixStatus'), 'Road distances not ready.');
        const info = routeErrorInfo(error);
        const message = /PERMISSION|DENIED|QUOTA|RESOURCE_EXHAUSTED|429/.test(info.code + ' ' + info.detail) ? info.message : info.detail;
        setStatus(message + ' Road optimization has not run.', 'bad');
        return;
      }
    } else {
      UI.set($('matrixStatus'), planar ? 'Planar TSP: optimization uses original EUC_2D costs, not kilometres.' : 'Direct Line: optimization uses great-circle air distances.');
      $('roadTablePanel').style.display = 'none';
    }
    if (profile === 'prepare') {
      setStatus(direct ? 'Select Drive or Walk and turn off Direct Line to prepare road distances.' : 'Road distances ready. Choose Optimize (Fast) or Optimize (Deep).', 'ok');
      return;
    }
    setStatus(`Optimizing ${valid.length} stops...`, 'warn');
    const key = JSON.stringify([valid.map(p=>[p.lat,p.lon]),startIdx,mode,direct,roundTrip,planar,roadData?.distanceMatrix]);
    if (comparisonKey !== key) clearComparison();
    comparisonKey = key; comparisonInput = raw;
    if (profile === 'brute') { $('bruteProgress').hidden = false; UI.set($('bruteProgressText'), 'Starting exhaustive search…'); }
    activeJob = {jobId, current, mode, direct, roundTrip, planar, reference:tspData?.reference, profile, n:valid.length, points:valid, startIdx,
      distanceMatrix:roadData?.distanceMatrix, lastMapRefresh:performance.now(), mapBestKm:Infinity, mapPending:false};
    if (profile !== 'brute') displaySearchProgress({},activeJob);
    refreshBruteInfo();
    worker.postMessage({ type: 'solve', jobId, profile, points: valid, startIdx: (startIdx < valid.length) ? startIdx : 0,
      roundTrip, metric:planar ? 'tsp-euc2d' : undefined, distanceMatrix:roadData?.distanceMatrix,
      tspProof:profile==='deep' && tspData ? {entry:tspData.entry,reference:tspData.reference,originalText:tspData.originalText} : undefined });
    posted = true;
    } finally { if (!posted && jobId === jobVersion) finishWork(); }
  }

  function handleWorkerMessage(ev) {
    const msg = ev.data || {};
    if (!activeJob || msg.jobId !== activeJob.jobId) return;
    if (!activeJob.current()) { cancelWork(); return; }
    const job = activeJob;
    if (msg.type === 'brute-progress') { job.latest = msg; displayBruteProgress(msg, job); refreshBruteMap(msg, job); return; }
    if (msg.type === 'progress') {
      job.latest = msg; displaySearchProgress(msg, job); refreshBruteMap(msg, job);
    }
    else if (msg.type === 'error') { clearTimeout(job.cancelTimer); activeJob = null; finishWork(); setStatus('Optimization failed: ' + msg.error, 'bad'); }
    else if (msg.type === 'result') {
      clearTimeout(job.cancelTimer);
      if(job.profile==='deep')pausedDeep=msg.canContinue&&!msg.exact&&!msg.error&&msg.pointsSorted
        ? {signature:problemSignature(),job,result:msg}:null;
      if (msg.algorithm === 'brute') pausedBrute = msg.cancelled && msg.resumeState
        ? {signature:problemSignature(), state:msg.resumeState, job} : null;
      if (msg.algorithm === 'brute') displayBruteProgress(msg, job);
      else { displaySearchProgress({...job.latest,...msg}, job, true); displayComparison(msg, job); }
      activeJob = null;
      finishWork();
      if(!msg.cancelled && !msg.error) ensureAirComparison(job.points, job.startIdx, job);
      if (msg.algorithm === 'brute') setStatus(msg.exact ? 'All orders checked. Exact optimum for this distance table.' : 'Calculation paused. Resume is available for this unchanged trip.', msg.exact ? 'ok' : 'warn');
      showSolvedRoute(msg, job).finally(()=>{ if(job.profile==='deep' && job.current()) setStatus(deepFinishLabel(msg),msg.error?'bad':msg.reason==='optimum'?'ok':'warn'); });
    }
  };

  function refreshTspLabels() {
    document.querySelectorAll('[data-tsp-id]').forEach(item => {
      const entry = window.TripTspLibrary?.get(item.dataset.tspId);
      if (entry) item.textContent = window.TripTspLibrary.label(entry);
    });
    refreshTspNotice();
  }

  function refreshTspNotice() {
    const code = /^# TSP source: ([a-z]+\d+)$/m.exec($('input').value)?.[1];
    const entry = window.TripTspLibrary?.get(code);
    $('chkPlanar').disabled = !entry;
    if (!entry) $('chkPlanar').checked = false;
    updateTspReference(entry);
    if (!$('tspNotice')) return;
    $('tspNotice').hidden = !entry;
    if (entry) {
      $('tspDatasetName').textContent = window.TripTspLibrary.label(entry);
      $('tspOriginal').href = `tsp/${entry.id}.tsp`;
      $('tspOriginal').download = `${entry.id}.tsp`;
    }
  }

  async function updateTspReference(entry) {
    const version=++referenceVersion, el=$('tspReference');
    if (!el) return;
    el.hidden=!entry;
    if (!entry) return;
    UI.set($('tspReferenceText'),'Checking the original TSP reference…');
    try {
      const data=await window.TripTspLibrary.original(entry.id);
      if (version!==referenceVersion) return;
      let complete=false;
      try { complete=TripTspMetric.authenticate(parseStops($('input').value).pts,data.original,entry).length===entry.count; } catch {}
      const applicable=complete && planarSelected() && $('chkRoundTrip').checked;
      UI.set($('tspReferenceText'), `Known optimum: ${formatValue(data.reference.optimum,true)} · ${entry.id} · ` + (applicable ? 'Complete original round trip · reference applies.' : 'Reference only: requires the complete original dataset, Planar TSP and Round Trip.'));
    } catch(error) { if(version===referenceVersion) UI.set($('tspReferenceText'),error.message); }
  }

  function loadEditorPreset(text, {direct=false, planar=false, focus=false, status, matrixStatus} = {}) {
    ++presetRequest;
    cancelWork(); clearComparison();
    $('input').value = text;
    currentTravelMode = 'DRIVING';
    $('chkRoundTrip').checked = true; $('chkDirect').checked = direct; $('chkBrute').checked = false; $('chkPlanar').checked = planar;
    updateModeButtons();
    lastResolvedStops = null; lastSolvedPoints = null; lastDirectKm = null; lastPlanarCost = null;
    mapMarkers.forEach(marker => marker.setMap(null)); mapMarkers = [];
    routePolylines.forEach(line => line.setMap(null)); routePolylines = [];
    if (mapPolyline) { mapPolyline.setMap(null); mapPolyline = null; }
    $('mapRouteCaption').hidden = true; $('roadTablePanel').style.display = 'none';
    $('routeList').replaceChildren(); $('links').replaceChildren();
    showDistance(null, 'Distance'); UI.set($('savedKm'), '—'); UI.set($('savingDetails'), '');
    UI.set($('matrixStatus'), matrixStatus);
    saveState(); setPlanningMode(false);
    setStatus(status, 'ok');
    if (focus) {
      const panel = $('editorPanel'); panel.tabIndex = -1;
      panel.focus({preventScroll:true}); panel.scrollIntoView({block:'start'});
    }
    return true;
  }

  // Shared by short Demo, its article and Library; loading never starts a solver.
  window.TripDemo = {load(preset, {focus = false} = {}) {
    if (['capitals14','capitals15'].includes(preset)) {
      // Selected EU capitals, distinct from the historically measured EU14/EU15 city sets.
      const capitals = [
        ['Amsterdam, Netherlands','Amsterdam, Nizozemska'],['Berlin, Germany','Berlin, Nemčija'],
        ['Bratislava, Slovakia','Bratislava, Slovaška'],['Brussels, Belgium','Bruselj, Belgija'],
        ['Bucharest, Romania','Bukarešta, Romunija'],['Budapest, Hungary','Budimpešta, Madžarska'],
        ['Madrid, Spain','Madrid, Španija'],['Paris, France','Pariz, Francija'],
        ['Prague, Czechia','Praga, Češka'],['Rome, Italy','Rim, Italija'],
        ['Sofia, Bulgaria','Sofija, Bolgarija'],['Vienna, Austria','Dunaj, Avstrija'],
        ['Warsaw, Poland','Varšava, Poljska'],['Zagreb, Croatia','Zagreb, Hrvaška']
      ];
      const withLj = preset === 'capitals15', lang = window.MDLxDCCLocale?.current() || 'en';
      if (withLj) capitals.push(['Ljubljana, Slovenia','Ljubljana, Slovenija']);
      const cities = capitals.map(pair => pair[lang === 'sl' ? 1 : 0]).sort((a,b) => a.localeCompare(b,lang));
      const start = withLj ? 'Ljubljana,' : 'Amsterdam,';
      return loadEditorPreset(cities.map(city => city + (city.startsWith(start) ? ' START' : '')).join('\n'), {focus,
        matrixStatus:'Demo loaded. Choose Fast, Deep or Brute Force to calculate.',
        status:withLj ? '15 EU capitals loaded · alphabetical order · Ljubljana START · Drive · Round Trip.'
          : '14 EU capitals loaded · alphabetical order · Amsterdam START · Drive · Round Trip.'});
    }
    if (!['eu14','eu15'].includes(preset)) return false;
    const cities = ['Berlin, Germany','Madrid, Spain','Rome, Italy','Paris, France','Vienna, Austria','Hamburg, Germany','Warsaw, Poland','Bucharest, Romania','Barcelona, Spain','Budapest, Hungary','Munich, Germany','Prague, Czechia','Milan, Italy','Sofia, Bulgaria'];
    if (preset === 'eu15') cities.unshift('Ljubljana, Slovenia');
    return loadEditorPreset(cities.map((city,i) => city + (i ? '' : ' START')).join('\n'), {focus,
      matrixStatus:'Demo loaded. Choose Fast, Deep or Brute Force to calculate.',
      status:preset === 'eu15' ? 'LJ + EU14 loaded · 15 stops · Ljubljana START · Drive · Round Trip.' : 'EU14 loaded · 14 stops · Berlin START · Drive · Round Trip.'});
  }};

  window.TripTsp = {async load(id, {focus=false} = {}) {
    const request = ++presetRequest, version = jobVersion, input = $('input').value;
    const current = () => request === presetRequest && version === jobVersion && input === $('input').value;
    setStatus('Loading TSP points…', 'warn');
    try {
      const {entry, text} = await window.TripTspLibrary.read(id);
      if (!current()) return false;
      return loadEditorPreset(text, {direct:true, planar:true, focus,
        matrixStatus:'TSP loaded with Planar distances. Choose Fast or Deep to calculate locally.',
        status:'Loaded: ' + window.TripTspLibrary.label(entry)});
    } catch (error) {
      if (current()) setStatus(error.message, 'bad');
      return false;
    }
  }};

  // --- 12. INIT ---
  document.addEventListener('DOMContentLoaded', () => {
    initTripTree(); initAI(); 
    const restored = restoreState();
    refreshTspNotice();
    $('btnStandard').onclick = () => run('standard');
    $('btnDeep').onclick = () => run('deep');
    $('btnPrepare').onclick = () => run('prepare', true);
    $('btnCancelWork').onclick = requestCancel;
    $('searchCancel').onclick = requestCancel;
    $('continueDeep').onclick = continueDeep;
    $('mapRefreshInterval').onchange = () => { if (activeJob?.latest) refreshBruteMap(activeJob.latest,activeJob); };
    $('chkBrute').onchange = () => { cancelWork(); refreshBruteInfo(); };
    refreshBruteInfo();
    window.MDLxDCCLocale.subscribe(refreshBruteInfo);
    window.MDLxDCCLocale.subscribe(refreshTspLabels);
    $('input').addEventListener('input', () => {
      ++presetRequest; refreshTspNotice();
      $('mapRouteCaption').hidden = true;
      cancelWork(); clearComparison(); refreshBruteInfo(); UI.set($('matrixStatus'), 'Stops changed. Road distances will be checked on the next optimization.');
      $('roadTablePanel').style.display = 'none'; showDistance(null, 'Distance'); UI.set($('savedKm'), '—'); UI.set($('savingDetails'), '');
    });
    $('btnDriving').onclick = () => setTravelMode('DRIVING');
    $('btnWalking').onclick = () => setTravelMode('WALKING');
    $('chkPlanar').onchange = () => { if ($('chkPlanar').checked) $('chkDirect').checked = true; cancelWork(); clearComparison(); saveState(); if (lastSolvedPoints && !$('chkBrute').checked) run('standard'); };
    $('chkDirect').onchange = () => { if (!$('chkDirect').checked) $('chkPlanar').checked = false; cancelWork(); clearComparison(); saveState(); refreshBruteInfo(); if (lastSolvedPoints && !$('chkBrute').checked) run('standard'); };
    $('chkRoundTrip').onchange = () => { cancelWork(); clearComparison(); saveState(); refreshBruteInfo(); if (lastSolvedPoints && !$('chkBrute').checked) run('standard'); };
    $('btnEnableMap').onclick = () => ensureMapsLoaded().catch(e => console.error('[8Z Trip] Map load button failed:', e));
    $('btnSave').onclick = () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([$('input').value],{type:'text/plain'})); a.download='trip.txt'; a.click(); };
    $('btnLoad').onclick = () => $('fileLoader').click();
    $('fileLoader').onchange = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=(v)=>{$('input').value=v.target.result;saveState();};r.readAsText(f);} };
    $('btnPlanMode').onclick = () => setPlanningMode(true);
    $('btnMapMode').onclick = () => setPlanningMode(false);
    $('tripSearch').oninput = (e) => { 
        const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const q=fold(e.target.value);
        document.querySelectorAll('.tree-item').forEach(i => { 
          const entry = window.TripTspLibrary?.get(i.dataset.tspId);
          const searchable = [i.textContent, i.dataset.uiText || '', entry?.name || '', entry?.sl || ''].join(' ');
          const match = fold(searchable).includes(q); i.style.display = match ? 'block' : 'none';
          if(q && match){ let p=i.parentElement; while(p.id!=='presetTree'){ if(p.classList.contains('tree-group')) { p.classList.add('open'); const arrow = p.previousElementSibling?.querySelector('.tree-arrow'); if(arrow) arrow.textContent = '⌄'; } p=p.parentElement; } }
        }); 
    };
    $('btnSendChat').onclick = () => handleChatSend('chatInput', 'chatHistory');
    $('chatInput').onkeypress = (e) => { if(e.key==='Enter') handleChatSend('chatInput', 'chatHistory'); };
    if(restored) {
        const historyEl = $('chatHistory');
        if(!historyEl.querySelector('.recovery-msg')) {
             historyEl.innerHTML += `<div class="msg ai recovery-msg" style="border-left:3px solid var(--success)"><strong><span data-ui-text="System:">System:</span></strong> <span data-ui-text="Session restored.">Session restored.</span><div style="margin-top:10px; display:flex; gap:10px;"><button class="chip logistics" onclick="window.continueSession(this)"><span data-ui-text="✅ Continue">✅ Continue</span></button><button class="chip eat" style="border-color:var(--danger); color:var(--danger); background:rgba(239,68,68,0.1)" onclick="window.resetSession()"><span data-ui-text="🗑️ Fresh Start">🗑️ Fresh Start</span></button></div></div>`;
        }
        setPlanningMode(false);
    } else { setPlanningMode(false); }
  });
  
  function setTravelMode(mode, optimize = true) {
    if (mode === currentTravelMode) return;
    cancelWork(); clearComparison(); currentTravelMode = mode; updateModeButtons(); refreshBruteInfo();
    $('roadTablePanel').style.display = 'none';
    UI.set($('matrixStatus'), 'Travel mode changed. Road distances will be checked on the next optimization.');
    if (optimize && lastSolvedPoints && !$('chkBrute').checked) run('standard');
  }
})();
