(() => {
  'use strict';

  // --- 1. CONFIGURATION ---
  // Domain-restricted browser key is supplied at runtime by Netlify.
  const MAPS_CONFIG_URL = '/.netlify/functions/trip-maps-config';
  
  // Same-origin function: credentials and the Gemini model are configured server-side.
  const PROXY_URL = '/.netlify/functions/gemini';
  
  const worker = new Worker('worker.js?v=20260913-road-matrix8');
  const roadPlanner = new globalThis.TripRoadMatrix();
  let jobVersion = 0;
  let activeJob = null;
  let lastResolvedStops = null;
  const STORAGE_KEY = '8z_trip_backup_v2'; 

  // --- 2. GLOBAL STATE ---
  const $ = (id) => document.getElementById(id);
  
  let map, geocoder, infoWindow;
  let mapMarkers = [], routePolylines = [], mapPolyline = null;
  let visualizationVersion = 0;
  let statusTimer;
  let optimizationPending = false;
  let lastSolvedPoints = null;
  let lastDirectKm = null;
  let currentTravelMode = 'DRIVING';
  let currentNavApp = 'apple'; // Default to Apple for the list
  let mapScriptLoadingPromise = null;
  let chatHistoryBuffer = [];
  let chatRequestPending = false;
  
  let presetLookup = {};
  let userRegion = null;
  let useMiles = false; // New flag for Unit Conversion

  // --- 3. HTML CONTENT ---
  const HELP_HTML = `
    <div class="help-block">
      <h2>How to Use</h2>
      <ul>
        <li><strong>1. Trip Library:</strong> Click [+] to expand continents. Click a tour name to load it.</li>
        <li><strong>2. Edit:</strong> Add or remove stops in the text box.</li>
        <li><strong>3. Optimize:</strong> Use "Standard" for fast results or "Deep Search" for complex routes.</li>
        <li><strong>4. Navigation:</strong> Use the toggle above the list to switch between Google/Apple Maps for turn-by-turn guidance.</li>
        <li><strong>5. Share:</strong> Click the button at the bottom to create a shareable link.</li>
      </ul>
    </div>
  `;

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
      el.textContent = msg; 
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
          line = `${name} | ${compactCoord(latN)}, ${compactCoord(lonN)}${isStart ? ' START' : ''}`;
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
    const state = {
        t: $('input').value,
        m: currentTravelMode,
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
          btn.innerHTML = '✅ Copied!';
          setTimeout(() => btn.innerHTML = originalText, 2000);
      }).catch(() => prompt("Copy this link:", url));
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
        if (btn) { btn.textContent = 'Retry Map'; btn.disabled = false; }
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
        if (btn) btn.textContent = 'Map Loaded';
        resolve();
      };

      if (btn) { btn.textContent = 'Loading API...'; btn.disabled = true; }
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
    return (useMiles ? km * 0.621371 : km).toFixed(2) + (useMiles ? ' mi' : ' km');
  }

  function showDistance(km, label) {
    $('distanceLabel').textContent = label + ':';
    $('distKm').textContent = formatKm(km);
  }

  async function updateMapVisualization(points) {
    if (!map) return;
    const version = ++visualizationVersion;
    const ph = $('mapPlaceholder'); if (ph) ph.style.display = 'none';
    mapMarkers.forEach(m => m.setMap(null)); mapMarkers = [];
    routePolylines.forEach(p => p.setMap(null)); routePolylines = [];
    if (mapPolyline) { mapPolyline.setMap(null); mapPolyline = null; }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((pt, i) => {
      const loc = { lat: pt.lat, lng: pt.lon };
      bounds.extend(loc);
      const marker = new google.maps.Marker({ position: loc, map, label: String(i + 1), title: pt.name });
      marker.addListener('click', () => {
        const title = document.createElement('strong');
        title.textContent = '#' + (i + 1) + ' ' + pt.name;
        infoWindow.setContent(title); infoWindow.open(map, marker);
      });
      mapMarkers.push(marker);
    });
    google.maps.event.trigger(map, 'resize');
    map.fitBounds(bounds);
    const path = points.map(p => ({ lat: p.lat, lng: p.lon }));
    if ($('chkRoundTrip').checked && path.length > 1) path.push(path[0]);
    if ($('chkDirect').checked) {
      showDistance(lastDirectKm, 'Direct distance (est.)');
      mapPolyline = new google.maps.Polyline({ path, geodesic: true, strokeColor: '#3b82f6', strokeWeight: 4 });
      mapPolyline.setMap(map);
      setStatus('Stop order ready. Showing direct lines; distances are straight-line estimates.', 'ok');
      return;
    }
    setStatus('Stop order ready. Loading road route...', 'warn');
    const mode = currentTravelMode;
    const distanceLabel = mode === 'WALKING' ? 'Walking distance' : 'Road distance';
    showDistance(null, distanceLabel);
    $('distKm').textContent = 'Loading…';
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
      routePolylines = pendingPolylines;
      routePolylines.forEach(polyline => polyline.setMap(map));
      showDistance(completeDistance ? totalRoadMeters / 1000 : null, distanceLabel);
      setStatus(completeDistance ? 'Road route displayed. Distance follows the route shown on the map.' :
        'Road route displayed. Google did not return a complete distance.', completeDistance ? 'ok' : 'warn');
    } catch (error) {
      if (version !== visualizationVersion) return;
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
      setStatus(info.message + ' Dashed lines show stop order, NOT roads. Navigation links remain available.', 'warn');
    }
  }

  // --- 8. SMART LINKS & TOGGLE ---
  function buildMapsLegLinks(routePts, roundTrip, mode) {
    const travelmode = (mode === 'DRIVING') ? 'driving' : 'walking';
    const encodeCoords = (p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
    const encodeName = (p) => { if (p.name.match(/^-?\d+\./)) return encodeCoords(p); return encodeURIComponent(p.name); };
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
      links.push({ label: `Leg ${links.length + 1} (${segment.length} stops)`, urlPins, urlNames });
      i = j;
    }
    return links;
  }

  function renderLinks(links) {
    const el = $('links'); 
    
    // UPDATED: Added Header "Open in Google Maps"
    el.innerHTML = '<h4>Open in Google Maps</h4>';
    
    for (const L of links) {
      const row = document.createElement('div'); row.className = 'linkrow';
      row.style.display = 'flex'; row.style.flexWrap = 'wrap'; row.style.alignItems = 'center'; row.style.gap = '10px';
      
      // UPDATED: Changed label from 'Open in Google Map' to 'Pins'
      row.innerHTML = `<span class="badge" style="min-width:60px;">${L.label}</span><div style="display:flex; gap:8px; flex:1;"><a href="${L.urlPins}" target="_blank" style="flex:1; text-align:center; padding:6px; background:rgba(59,130,246,0.1); border-radius:4px; font-size:0.85rem; text-decoration:none; color:#bfdbfe;">📍 Pins</a><a href="${L.urlNames}" target="_blank" style="flex:1; text-align:center; padding:6px; background:rgba(16,185,129,0.1); color:#6ee7b7; border-radius:4px; font-size:0.85rem; text-decoration:none;">🏷️ Names</a></div>`;
      el.appendChild(row);
    }
    const shareArea = document.createElement('div');
    shareArea.className = 'share-area';
    
    // UPDATED: Renamed 'Share Link' to 'Share trip'
    // UPDATED: Darkened GPX button background to #14532d (Dark Green)
    shareArea.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <button id="btnShareTrip" class="btn-share" onclick="window.shareTrip()">🔗 Share trip</button>
        <button id="btnGPX" class="btn-share" style="background:#14532d; color:white; border-color:#14532d;" onclick="window.downloadGPX()">⛰️ Save GPX</button>
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
          li.innerHTML = `<a href="${navUrl}" target="_blank">${i + 1}. ${p.name}<small>Tap to navigate here ↗</small></a>`;
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
      rNode.innerHTML = `<div class="tree-header">${isUserRegion?'⌄':'›'} ${regionData.region}</div><div class="tree-group${isUserRegion?' open':''}"></div>`;
      const rGroup = rNode.querySelector('.tree-group');
      regionData.categories.forEach(cat => {
        const cNode = document.createElement('div');
        cNode.innerHTML = `<div class="tree-header">› ${cat.name}</div><div class="tree-group"></div>`;
        const cGroup = cNode.querySelector('.tree-group');
        cat.items.forEach(trip => {
          presetLookup[trip.id] = trip.data;
          const item = document.createElement('span'); item.className = 'tree-item'; item.textContent = trip.label;
          item.onclick = () => { 
            $('input').value = trip.data; saveState(); 
            if (trip.id.includes('GLOBAL')) { $('chkDirect').checked = true; setTravelMode('DRIVING', false); }
            else if (trip.id.includes('WALKING')) { $('chkDirect').checked = false; setTravelMode('WALKING', false); }
            else { $('chkDirect').checked = false; setTravelMode('DRIVING', false); }
            setStatus(`Loaded: ${trip.label}`, 'ok'); renderSuggestions('bigChatHistory');
          };
          cGroup.appendChild(item);
        });
        cNode.querySelector('.tree-header').onclick = function() { cGroup.classList.toggle('open'); this.textContent = (cGroup.classList.contains('open') ? '⌄ ' : '› ') + cat.name; };
        rGroup.appendChild(cNode);
      });
      rNode.querySelector('.tree-header').onclick = function() { rGroup.classList.toggle('open'); this.textContent = (rGroup.classList.contains('open') ? '⌄ ' : '› ') + regionData.region; };
      tree.appendChild(rNode);
    });
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
    const helpHtml = `<div class="suggestion-group"><div class="suggestion-label">ℹ️ Help</div><div class="chip-grid"><div class="chip" onclick="window.sendChat('How do I use the Trip Library?')">How to use Library?</div><div class="chip" onclick="window.sendChat('What does Optimize do?')">Explain Optimization</div></div></div>`;

    if (isNew) {
        let regionChip = "";
        if (userRegion === 'Europe') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a classic Europe tour (Paris, Rome, Berlin)\')">🇪🇺 Classic Europe Tour</div>';
        if (userRegion === 'Americas') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a USA West Coast road trip\')">🇺🇸 USA West Coast</div>';
        
        box.innerHTML = `<div class="suggestion-group"><div class="suggestion-label">✨ Start a New Adventure</div><div class="chip-grid">${regionChip}<div class="chip logistics" onclick="window.sendChat('Create a 3-day itinerary for Rome, Italy')">Create 3-Day Rome Itinerary</div><div class="chip logistics" onclick="window.sendChat('Suggest a romantic weekend in Paris')">Paris Weekend</div></div></div>${helpHtml}`;
    } else {
        box.innerHTML = `<div class="suggestion-group"><div class="suggestion-label">🛏️ Sleeping Strategy</div><div class="chip-grid"><div class="chip sleep" onclick="window.sendChat('Where should I stay? Calculate the best base camp.')">Find Best Base Camp</div></div></div><div class="suggestion-group"><div class="suggestion-label">🍴 Eating</div><div class="chip-grid"><div class="chip eat" onclick="window.sendChat('Suggest lunch spots with high ratings but low price')">Best Cheap Eats</div><div class="chip eat" onclick="window.sendChat('Where is a good romantic dinner spot nearby?')">Romantic Dinner</div></div></div><div class="suggestion-group"><div class="suggestion-label">🚕 Logistics</div><div class="chip-grid"><div class="chip logistics" onclick="window.sendChat('How much time do I need for each stop?')">Time per Stop?</div><div class="chip logistics" onclick="window.sendChat('Is this route walkable or do I need a taxi?')">Walk vs Taxi</div></div></div>${helpHtml}`;
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
          document.getElementById('bigChatInput').value = text;
          handleChatSend('bigChatInput', 'bigChatHistory');
      } else {
          document.getElementById('chatInput').value = text;
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
        failedMessage.className = 'msg ai'; failedMessage.textContent = error.message;
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
            $('input').value = cleanTrip;
            saveState();
            setStatus('Trip Editor updated in Trip Library format.', 'ok');
            setTimeout(() => { renderSuggestions('bigChatHistory'); if (historyId === 'chatHistory') renderSuggestions('chatHistory'); }, 500);
          }
          processedText = processedText.replace(/\{REPLACE:\s*[\s\S]*?\}/g, '<div class="action-badge">📋 <strong>Trip Editor Updated</strong><small>Trip Library format applied.</small></div>');
      }
      const addMatches = [...r.matchAll(/\{ADD:\s*([\s\S]*?)\}/g)];
      if(addMatches.length) {
        let addedCount = 0;
        addMatches.forEach(match => { addedCount += appendTripEditorBlock(match[1]); });
        if(addedCount > 0) { saveState(); setStatus(`AI added ${addedCount} Trip Editor line(s).`, 'ok'); renderSuggestions('bigChatHistory'); }
        processedText = processedText
          .replace(/```(?:json|text|txt)?\s*\{ADD:\s*[\s\S]*?\}\s*```/g, '<div class="action-badge">➕ <strong>Stops Added</strong><small>Trip Library format applied.</small></div>')
          .replace(/\{ADD:\s*[\s\S]*?\}/g, '<div class="action-badge">➕ <strong>Stops Added</strong><small>Trip Library format applied.</small></div>');
      }

      h.innerHTML += `<div class="msg ai"><strong>Gemini:</strong> ${formatMarkdown(processedText)}</div>`;
      if (response.sources?.length) {
        const sources = document.createElement('div'); sources.className = 'msg ai';
        sources.append('Sources: ');
        response.sources.forEach((source, index) => {
          try {
            const url = new URL(source.url);
            if (!['https:', 'http:'].includes(url.protocol)) return;
            const link = document.createElement('a');
            link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.textContent = source.title || `Source ${index + 1}`;
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
    const guiContext = `\nGUI state: mode=${currentTravelMode}; Round Trip=${$('chkRoundTrip').checked}; Direct Line=${$('chkDirect').checked}.\nOnly include editor commands when the user asks to create or change the trip. For help or discussion, explain without editing.\n`;
    const fullPrompt = sysPrompt + guiContext + "\n\nHistory:\n" + 
      history.map(m => `${m.role.toUpperCase()}: ${m.parts[0].text}`).join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const res = await fetch(PROXY_URL, { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ prompt: fullPrompt }),
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
  function showBusy(msg) {
    let overlay = $('busyOverlay');
    if (!overlay) {
        overlay = document.createElement('div'); overlay.id = 'busyOverlay';
        overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:white;font-family:sans-serif;";
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div style="font-size:2rem;margin-bottom:20px;">🧬</div><div style="font-size:1.2rem;font-weight:bold;">${msg}</div><div style="margin-top:10px;color:#6aa9ff;">Please wait...</div><button id="busyCancel" style="width:auto;margin-top:20px;">Cancel calculation</button>`;
    $('busyCancel').onclick = () => { cancelWork(); setStatus('Calculation cancelled.', 'warn'); };
    overlay.style.display = 'flex';
  }
  function hideBusy() { const o = $('busyOverlay'); if (o) o.style.display = 'none'; }

  function setPlanningMode(enabled) {
    const rightPanel = document.querySelector('.panel:nth-of-type(2)');
    const mapCont = $('mapContainer'), stats = document.querySelector('.stats'), list = $('routeList'), links = $('links');
    const btnPlan = $('btnPlanMode'), btnMap = $('btnMapMode');
    let bigChat = $('bigChatContainer');
    if (!bigChat) {
        bigChat = document.createElement('div'); bigChat.id = 'bigChatContainer'; bigChat.style.display = 'none';
        bigChat.innerHTML = `<div id="bigChatHistory" style="flex:1; overflow-y:auto; padding:20px; border-bottom:1px solid #1f2a3a;"></div><div class="chat-input" style="padding:15px; background:#0f1621;"><input type="text" id="bigChatInput" placeholder="Message Gemini..."><button id="btnSendBigChat">➤</button></div>`;
        rightPanel.appendChild(bigChat);
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
    hideBusy();
  }

  function cancelWork() {
    ++jobVersion;
    ++visualizationVersion;
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
      values.forEach(value => {
        const cell = document.createElement(header ? 'th' : 'td');
        cell.textContent = value;
        cell.style.cssText = 'padding:5px 10px;border:1px solid #334155;text-align:right;';
        row.appendChild(cell);
      });
      table.appendChild(row);
    };
    addRow(['From → To', ...points.map(p => p.name)], true);
    points.forEach((p, i) => addRow([p.name, ...data.distanceMatrix[i].map(m => formatKm(m/1000))]));
    panel.appendChild(table);
    $('roadTableInfo').textContent = `Google Maps · ${data.mode === 'WALKING' ? 'Walk' : 'Drive'} · ${new Date(data.measuredAt).toLocaleTimeString()} · Kept only for the current open trip.`;
    $('roadTablePanel').style.display = 'block';
    $('matrixStatus').textContent = `${data.reused ? 'Reusing' : 'Ready:'} ${points.length * (points.length-1)} directed road distances. Optimization runs locally.`;
  }

  async function run(profile, forceMatrix = false) {
    if (optimizationPending) return;
    optimizationPending = true;
    activeJob = null;
    const jobId = ++jobVersion;
    $('btnCancelWork').disabled = false;
    // An earlier route response must not overwrite this new calculation.
    ++visualizationVersion;
    lastDirectKm = null;
    showDistance(null, 'Distance');
    $('savedKm').textContent = '—';
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
    const mode = currentTravelMode, direct = $('chkDirect').checked, roundTrip = $('chkRoundTrip').checked;
    const current = () => jobId === jobVersion && $('input').value === raw && currentTravelMode === mode &&
      $('chkDirect').checked === direct && $('chkRoundTrip').checked === roundTrip;
    let { pts, startIdx } = parseStops(raw);
    if (pts.length < 2) { setStatus('Enter at least 2 stops, one per line.', 'bad'); return; }
    const stopKey = JSON.stringify(pts);
    try {
      pts = lastResolvedStops?.key === stopKey ? lastResolvedStops.points.map(p => ({...p})) : await geocodeMissingPoints(pts);
    } catch (e) { if (current()) setStatus(e.message, 'bad'); return; }
    if (!current()) return;
    lastResolvedStops = {key:stopKey, points:pts.map(p => ({...p}))};
    // Never silently drop an unresolved stop or move START to another city.
    const valid = pts;
    let roadData = null;
    if (!direct) {
      $('matrixStatus').textContent = 'Preparing road distances…';
      try {
        roadData = await roadPlanner.prepare(valid, mode, {
          loadRoutes: () => google.maps.importLibrary('routes'), current, force:forceMatrix,
          progress: text => { if (current()) { $('matrixStatus').textContent = text; setStatus(text, 'warn'); } }
        });
        if (!current()) return;
        showRoadTable(valid, roadData);
      } catch (error) {
        if (!current()) return;
        $('matrixStatus').textContent = 'Road distances not ready.';
        const info = routeErrorInfo(error);
        const message = /PERMISSION|DENIED|QUOTA|RESOURCE_EXHAUSTED|429/.test(info.code + ' ' + info.detail) ? info.message : info.detail;
        setStatus(message + ' Road optimization has not run.', 'bad');
        return;
      }
    } else {
      $('matrixStatus').textContent = 'Direct Line: optimization uses approximate straight-line distances.';
      $('roadTablePanel').style.display = 'none';
    }
    if (profile === 'prepare') {
      setStatus(direct ? 'Select Drive or Walk and turn off Direct Line to prepare road distances.' : 'Road distances ready. Choose Optimize (Fast) or Optimize (Deep).', 'ok');
      return;
    }
    setStatus(`Optimizing ${valid.length} stops...`, 'warn');
    if (profile === 'deep') showBusy("Optimizing stop order...");
    activeJob = {jobId, current, mode, direct};
    worker.postMessage({ type: 'solve', jobId, profile, points: valid, startIdx: (startIdx < valid.length) ? startIdx : 0,
      roundTrip, distanceMatrix:roadData?.distanceMatrix });
    posted = true;
    } finally { if (!posted && jobId === jobVersion) finishWork(); }
  }

  worker.onmessage = (ev) => {
    const msg = ev.data || {};
    if (!activeJob || msg.jobId !== activeJob.jobId) return;
    if (!activeJob.current()) { activeJob = null; finishWork(); return; }
    if (msg.type === 'progress') showBusy(msg.text); 
    else if (msg.type === 'error') { finishWork(); setStatus('Optimization failed: ' + msg.error, 'bad'); }
    else if (msg.type === 'result') {
      finishWork();
      const { pointsSorted, totalKm, baseKm } = msg;
      lastSolvedPoints = pointsSorted;
      
      lastDirectKm = msg.directKm;
      $('savingLabel').textContent = msg.metric === 'road' ? 'Road saving (table):' : 'Direct saving (est.):';
      $('savingBox').title = msg.metric === 'road' ? 'Reduction versus entered order with START first, measured using the same directed road distance table.' : 'Estimated reduction in direct-line distance.';
      showDistance(lastDirectKm, 'Direct distance (est.)');
      $('savedKm').textContent = baseKm > totalKm ? formatKm(baseKm - totalKm) : '—';

      renderRouteList(pointsSorted);
      updateMapVisualization(pointsSorted);
      const links = buildMapsLegLinks(pointsSorted, $('chkRoundTrip').checked, currentTravelMode);
      renderLinks(links);
    }
  };

  // --- 12. INIT ---
  document.addEventListener('DOMContentLoaded', () => {
    initTripTree(); initAI(); 
    const restored = restoreState();
    $('btnStandard').onclick = () => run('standard');
    $('btnDeep').onclick = () => run('deep');
    $('btnPrepare').onclick = () => run('prepare', true);
    $('btnCancelWork').onclick = () => { cancelWork(); setStatus('Calculation cancelled.', 'warn'); };
    $('input').addEventListener('input', () => {
      cancelWork(); $('matrixStatus').textContent = 'Stops changed. Road distances will be checked on the next optimization.';
      $('roadTablePanel').style.display = 'none'; showDistance(null, 'Distance'); $('savedKm').textContent = '—';
    });
    $('btnDriving').onclick = () => setTravelMode('DRIVING');
    $('btnWalking').onclick = () => setTravelMode('WALKING');
    $('chkDirect').onchange = () => { cancelWork(); if (lastSolvedPoints) run('standard'); };
    $('chkRoundTrip').onchange = () => { cancelWork(); if (lastSolvedPoints) run('standard'); };
    $('btnEnableMap').onclick = () => ensureMapsLoaded().catch(e => console.error('[8Z Trip] Map load button failed:', e));
    $('btnSave').onclick = () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([$('input').value],{type:'text/plain'})); a.download='trip.txt'; a.click(); };
    $('btnLoad').onclick = () => $('fileLoader').click();
    $('fileLoader').onchange = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=(v)=>{$('input').value=v.target.result;saveState();};r.readAsText(f);} };
    $('btnPlanMode').onclick = () => setPlanningMode(true);
    $('btnMapMode').onclick = () => setPlanningMode(false);
    $('tripSearch').oninput = (e) => { 
        const q=e.target.value.toLowerCase(); 
        document.querySelectorAll('.tree-item').forEach(i => { 
          const match = i.textContent.toLowerCase().includes(q); i.style.display = match ? 'block' : 'none';
          if(q && match){ let p=i.parentElement; while(p.id!=='presetTree'){ if(p.classList.contains('tree-group')) { p.classList.add('open'); const h = p.previousElementSibling; if(h) h.textContent = h.textContent.replace('›', '⌄'); } p=p.parentElement; } }
        }); 
    };
    $('btnSendChat').onclick = () => handleChatSend('chatInput', 'chatHistory');
    $('chatInput').onkeypress = (e) => { if(e.key==='Enter') handleChatSend('chatInput', 'chatHistory'); };
    const h=$('helpOverlay'); $('btnHelp').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=HELP_HTML;}; $('btnAbout').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=window.ABOUT_CONTENT || "About content missing.";}; $('btnCloseHelp').onclick=()=>h.style.display='none';
    if(restored) {
        const historyEl = $('chatHistory');
        if(!historyEl.querySelector('.recovery-msg')) {
             historyEl.innerHTML += `<div class="msg ai recovery-msg" style="border-left:3px solid var(--success)"><strong>System:</strong> Session restored.<div style="margin-top:10px; display:flex; gap:10px;"><button class="chip logistics" onclick="window.continueSession(this)">✅ Continue</button><button class="chip eat" style="border-color:var(--danger); color:var(--danger); background:rgba(239,68,68,0.1)" onclick="window.resetSession()">🗑️ Fresh Start</button></div></div>`;
        }
        setPlanningMode(true);
    } else { setPlanningMode(true); }
  });
  
  function setTravelMode(mode, optimize = true) {
    if (mode === currentTravelMode) return;
    cancelWork(); currentTravelMode = mode; updateModeButtons();
    $('roadTablePanel').style.display = 'none';
    $('matrixStatus').textContent = 'Travel mode changed. Road distances will be checked on the next optimization.';
    if (optimize && lastSolvedPoints) run('standard');
  }
})();
