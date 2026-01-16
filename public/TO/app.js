(() => {
  'use strict';

  // --- 1. CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA'; 
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  const worker = new Worker('worker.js');
  const STORAGE_KEY = '8z_trip_backup_v2'; 

  // --- 2. GLOBAL STATE ---
  const $ = (id) => document.getElementById(id);
  
  let map, geocoder, directionsService, infoWindow;
  let mapMarkers = [], directionsRenderers = [], mapPolyline = null;
  let lastSolvedPoints = null;
  let currentGeminiModel = '';
  let currentTravelMode = 'DRIVING';
  let mapScriptLoadingPromise = null;
  let chatHistoryBuffer = [];
  
  let presetLookup = {};
  let userRegion = null;

  // --- 3. HTML CONTENT ---
  const HELP_HTML = `
    <div class="help-block">
      <h2>How to Use</h2>
      <ul>
        <li><strong>1. Trip Library:</strong> Click [+] to expand continents. Click a tour name to load it.</li>
        <li><strong>2. Edit:</strong> Add or remove stops in the text box.</li>
        <li><strong>3. Optimize:</strong> Use "Standard" for fast results or "Deep Search" for complex routes.</li>
        <li><strong>4. Share:</strong> Use the button at the bottom to send your trip to friends.</li>
        <li><strong>5. Navigate:</strong> Click any stop in the list to open point-to-point Apple Maps navigation.</li>
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
    const el = $('status'); 
    if(el) {
      el.textContent = msg; 
      el.style.display = 'block';
      el.style.color = cls === 'bad' ? '#ef4444' : (cls === 'warn' ? '#f59e0b' : '#10b981');
      if (cls === 'ok') setTimeout(() => { el.style.display = 'none'; }, 4000);
    }
  }

  // --- 5. MARKDOWN PARSER (Tables Included) ---
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
    if (lastSolvedPoints) {
      updateMapVisualization(lastSolvedPoints);
      const links = buildMapsLegLinks(lastSolvedPoints, $('chkRoundTrip').checked, currentTravelMode);
      renderLinks(links);
    }
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
        const m = coordRe.exec(parts[1]);
        if (m) { name = parts[0].trim(); lat = parseFloat(m[1]); lon = parseFloat(m[2]); }
      } else {
        const m = coordRe.exec(raw);
        if (m) { lat = parseFloat(m[1]); lon = parseFloat(m[2]); name = raw.replace(m[0], '').trim(); }
      }
      pts.push({ name, lat, lon, raw: raw });
      if (isStart) startIdx = pts.length - 1;
    }
    return { pts, startIdx };
  }

  async function geocodeMissingPoints(pts) {
    const missing = pts.filter(p => p.lat === null || p.lon === null);
    if (missing.length === 0) return pts;
    setStatus(`Looking up ${missing.length} addresses...`, 'warn');
    for (let i = 0; i < missing.length; i++) {
      const p = missing[i];
      if (!geocoder) geocoder = new google.maps.Geocoder();
      const result = await new Promise(r => geocoder.geocode({ address: p.name }, (res, status) => r(status==='OK'?res[0]:null)));
      if (result) { p.lat = result.geometry.location.lat(); p.lon = result.geometry.location.lng(); }
      await new Promise(r => setTimeout(r, 250)); 
    }
    return pts;
  }

  function ensureMapsLoaded() {
    if (window.google && window.google.maps) return Promise.resolve();
    if (mapScriptLoadingPromise) return mapScriptLoadingPromise;
    mapScriptLoadingPromise = new Promise((resolve) => {
      window.initMap = function() {
        map = new google.maps.Map($('map'), { zoom:12, center:{lat:46.0569,lng:14.5058}, mapTypeId:'hybrid', styles:DARK_STYLE });
        geocoder = new google.maps.Geocoder();
        directionsService = new google.maps.DirectionsService();
        infoWindow = new google.maps.InfoWindow();
        const ph = $('mapPlaceholder'); if(ph) ph.style.display = 'none';
        resolve();
      };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap&loading=async&v=weekly`;
      document.body.appendChild(s);
      const btn = $('btnEnableMap'); if(btn) btn.textContent = "Loading API...";
    });
    return mapScriptLoadingPromise;
  }

  function updateMapVisualization(points) {
    if (!map) return;
    const ph = $('mapPlaceholder'); if(ph) ph.style.display = 'none';
    mapMarkers.forEach(m => m.setMap(null)); mapMarkers=[];
    directionsRenderers.forEach(d => d.setMap(null)); directionsRenderers=[];
    if(mapPolyline) { mapPolyline.setMap(null); mapPolyline=null; }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((pt, i) => {
      const loc = { lat: pt.lat, lng: pt.lon };
      bounds.extend(loc);
      const m = new google.maps.Marker({ position: loc, map: map, label: (i+1).toString(), title: pt.name });
      m.addListener("click", () => { infoWindow.setContent(`<strong>#${i+1} ${pt.name}</strong>`); infoWindow.open(map, m); });
      mapMarkers.push(m);
    });
    if ($('chkDirect').checked) {
      mapPolyline = new google.maps.Polyline({ path: points.map(p=>({lat:p.lat,lng:p.lon})), geodesic: true, strokeColor: "#3b82f6", strokeWeight: 4 });
      mapPolyline.setMap(map);
    } else {
      const path = points.map(p=>({lat:p.lat,lng:p.lon}));
      if ($('chkRoundTrip').checked) path.push(path[0]);
      const gMode = currentTravelMode === 'DRIVING' ? google.maps.TravelMode.DRIVING : google.maps.TravelMode.WALKING;
      for(let i=0; i<path.length-1; i+=24) {
        const seg = path.slice(i, i+25);
        const r = new google.maps.DirectionsRenderer({ map:map, suppressMarkers:true, polylineOptions:{strokeColor:"#3b82f6", strokeWeight:5} });
        directionsRenderers.push(r);
        directionsService.route({ origin: seg[0], destination: seg[seg.length-1], waypoints: seg.slice(1,-1).map(l => ({location:l, stopover:true})), travelMode: gMode }, (res, st) => { if(st === "OK") r.setDirections(res); });
      }
    }
    google.maps.event.trigger(map, 'resize');
    map.fitBounds(bounds);
  }

  // --- 8. SMART LINKS ---
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
      const appleUrl = `http://maps.apple.com/?saddr=${originPin}&daddr=${destPin}&dirflg=${mode === 'DRIVING' ? 'd' : 'w'}`;
      links.push({ label: `Leg ${links.length + 1}`, urlPins, urlNames, appleUrl });
      i = j;
    }
    return links;
  }

  function renderLinks(links) {
    const el = $('links'); el.innerHTML = '';
    for (const L of links) {
      const row = document.createElement('div'); row.className = 'linkrow';
      row.style.display = 'flex'; row.style.flexWrap = 'wrap'; row.style.alignItems = 'center'; row.style.gap = '8px';
      row.innerHTML = `
        <span class="badge" style="min-width:50px;">${L.label}</span>
        <div style="display:flex; gap:6px; flex:1; flex-wrap:wrap;">
            <a href="${L.urlPins}" target="_blank" style="flex:1; min-width:80px; text-align:center; padding:6px; background:rgba(59,130,246,0.1); border-radius:4px; font-size:0.8rem; text-decoration:none; color:#bfdbfe;">📍 G-Pins</a>
            <a href="${L.urlNames}" target="_blank" style="flex:1; min-width:80px; text-align:center; padding:6px; background:rgba(16,185,129,0.1); color:#6ee7b7; border-radius:4px; font-size:0.8rem; text-decoration:none;">🏷️ G-Names</a>
            <a href="${L.appleUrl}" target="_blank" style="flex:1; min-width:80px; text-align:center; padding:6px; background:rgba(255,255,255,0.1); color:#e2e8f0; border-radius:4px; font-size:0.8rem; text-decoration:none;">🍎 Apple</a>
        </div>
      `;
      el.appendChild(row);
    }
    const shareArea = document.createElement('div');
    shareArea.className = 'share-area';
    shareArea.innerHTML = `<button id="btnShareTrip" class="btn-share" onclick="window.shareTrip()">🔗 Share This Trip</button>`;
    el.appendChild(shareArea);
  }

  // --- 9. LIBRARY & AI ---
  async function detectUserLocation() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const code = data.country_code; 
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
          const item = document.createElement('span'); item.className = 'tree-item'; item.textContent = trip.label;
          item.onclick = () => { 
            $('input').value = trip.data; saveState(); 
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

  async function initAI() {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const d = await r.json();
      if(d.models) currentGeminiModel = d.models.find(m => m.name.includes('gemini'))?.name || 'gemini-pro';
    } catch(e) {}
  }

  window.sendChat = function(text) {
      if(document.getElementById('bigChatInput').offsetParent) { $('bigChatInput').value = text; handleChatSend('bigChatInput', 'bigChatHistory'); } 
      else { $('chatInput').value = text; handleChatSend('chatInput', 'chatHistory'); }
  };

  async function handleChatSend(inputId, historyId) {
      const i = $(inputId), t = i.value.trim(), h = $(historyId); if (!t) return;
      i.value = ''; h.innerHTML += `<div class="msg user">${t}</div>`; h.scrollTop = h.scrollHeight;
      const otherHistory = historyId === 'chatHistory' ? $('bigChatHistory') : $('chatHistory');
      if (otherHistory) { otherHistory.innerHTML = h.innerHTML; otherHistory.scrollTop = otherHistory.scrollHeight; }
      saveState();
      const loadingId = 'loading-' + Date.now(); h.innerHTML += `<div id="${loadingId}" class="msg ai" style="opacity:0.6">...</div>`;
      const r = await callAI(t);
      const loader = document.getElementById(loadingId); if(loader) loader.remove();
      let processedText = r;
      if (r.match(/\{REPLACE:\s*[\s\S]*?\}/)) {
          const match = r.match(/\{REPLACE:\s*([\s\S]*?)\}/);
          if (match && match[1].trim()) { $('input').value = match[1].trim(); saveState(); setStatus('Trip updated.', 'ok'); setTimeout(() => renderSuggestions('bigChatHistory'), 500); }
          processedText = processedText.replace(/\{REPLACE:\s*[\s\S]*?\}/g, '<div class="action-badge">📋 <strong>Trip Editor Updated</strong></div>');
      }
      if (r.match(/\{ADD:\s*.*?\}/)) {
          const m = r.match(/\{ADD:\s*(.*?)\}/g); m.forEach(x => { const l = x.replace(/\{ADD:\s*|\}/g, '').trim(); if (!$('input').value.includes(l)) $('input').value += '\n' + l; });
          saveState(); setStatus('Stops added.', 'ok');
          processedText = processedText.replace(/\{ADD:.*?\}/g, '<div class="action-badge">➕ <strong>Stops Added</strong></div>');
      }
      h.innerHTML += `<div class="msg ai"><strong>Gemini:</strong> ${formatMarkdown(processedText)}</div>`;
      h.scrollTop = h.scrollHeight;
      if (otherHistory) { otherHistory.innerHTML = h.innerHTML; otherHistory.scrollTop = otherHistory.scrollHeight; }
      saveState();
  }

  async function callAI(txt) {
    chatHistoryBuffer.push({ role: "user", parts: [{ text: txt }] });
    const currentTripData = $('input').value.substring(0, 3000);
    const locationContext = userRegion ? `USER LOCATION: ${userRegion}` : "";
    let sysPrompt = currentTripData.length > 20 
        ? `You are the 8Z Logistics Co-Pilot. ${locationContext} CURRENT STOPS: ${currentTripData}. RULES: 1. Value for Money. 2. UI AWARENESS: Say "I updated the list above" if using commands. 3. Use Markdown tables for times/prices.`
        : `You are the 8Z Trip Architect. The user has an EMPTY itinerary. ${locationContext} Help them create a list.`;
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{role:"user", parts:[{text: sysPrompt}]}, ...chatHistoryBuffer], tools: [{ google_search: {} }] })
        });
        const d = await res.json();
        const t = d.candidates?.[0]?.content?.parts?.[0]?.text || "Error.";
        chatHistoryBuffer.push({ role: "model", parts: [{ text: t }] });
        return t;
    } catch(e) { return "AI Connection Error"; }
  }

  // --- 10. OPTIMIZER & APPLE MAPS LOGIC ---
  function showBusy(msg) {
    let overlay = $('busyOverlay');
    if (!overlay) {
        overlay = document.createElement('div'); overlay.id = 'busyOverlay';
        overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:white;font-family:sans-serif;";
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div style="font-size:2rem;margin-bottom:20px;">🧬</div><div style="font-size:1.2rem;font-weight:bold;">${msg}</div><div style="margin-top:10px;color:#6aa9ff;">Please wait...</div>`;
    overlay.style.display = 'flex';
  }
  function hideBusy() { const o = $('busyOverlay'); if (o) o.style.display = 'none'; }

  async function run(profile) {
    setPlanningMode(false);
    if (!window.google) { setStatus('Loading Map API...', 'ok'); await ensureMapsLoaded(); }
    const raw = $('input').value;
    let { pts, startIdx } = parseStops(raw);
    try { pts = await geocodeMissingPoints(pts); } catch (e) { setStatus('Geocode Error', 'bad'); return; }
    const valid = pts.filter(p => p.lat !== null && p.lon !== null);
    if (valid.length < 2) { setStatus('Need 2+ valid stops.', 'bad'); return; }
    setStatus(`Optimizing ${valid.length} stops...`, 'warn');
    if (profile === 'deep') showBusy("Deep Genetic Optimization...");
    worker.postMessage({ type: 'solve', profile: profile, points: valid, startIdx: (startIdx < valid.length) ? startIdx : 0, roundTrip: $('chkRoundTrip').checked });
  }

  worker.onmessage = (ev) => {
    const msg = ev.data || {};
    if (msg.type === 'progress') showBusy(msg.text); 
    else if (msg.type === 'result') {
      hideBusy();
      const { pointsSorted, totalKm, baseKm } = msg;
      lastSolvedPoints = pointsSorted;
      $('distKm').textContent = totalKm.toFixed(2) + ' km';
      const saved = baseKm - totalKm;
      $('savedKm').textContent = saved > 0 ? saved.toFixed(2) + ' km' : '—';
      
      const list = $('routeList'); list.innerHTML = '';
      const modeChar = currentTravelMode === 'DRIVING' ? 'd' : 'w';
      
      // --- HERE IS THE APPLE MAPS LOGIC ---
      pointsSorted.forEach((p, i) => { 
          const li = document.createElement('li');
          const destCoords = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
          
          let navUrl = "";
          if (i === 0) {
              // Start: Navigate from Current Location
              navUrl = `http://maps.apple.com/?daddr=${destCoords}&dirflg=${modeChar}`;
          } else {
              // Leg: Navigate from Prev Point -> Curr Point
              const prevCoords = `${pointsSorted[i-1].lat.toFixed(6)},${pointsSorted[i-1].lon.toFixed(6)}`;
              navUrl = `http://maps.apple.com/?saddr=${prevCoords}&daddr=${destCoords}&dirflg=${modeChar}`;
          }
          
          li.innerHTML = `<a href="${navUrl}" target="_blank">
                            ${i + 1}. ${p.name}
                            <small>Tap to navigate here ↗</small>
                          </a>`;
          list.appendChild(li); 
      });

      updateMapVisualization(pointsSorted);
      const links = buildMapsLegLinks(pointsSorted, $('chkRoundTrip').checked, currentTravelMode);
      renderLinks(links);
      setStatus('Done!', 'ok');
    }
  };

  // --- 11. UI & CHAT ---
  function renderSuggestions(containerId) {
    const el = $(containerId); if (!el) return;
    const old = el.querySelector('.suggestions-box'); if (old) old.remove();
    const inputVal = $('input').value.trim();
    const isNew = inputVal.length < 10; 
    const box = document.createElement('div'); box.className = 'suggestions-box';
    if (isNew) {
        let regionChip = "";
        if (userRegion === 'Europe') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a classic Europe tour (Paris, Rome, Berlin)\')">🇪🇺 Classic Europe Tour</div>';
        if (userRegion === 'Americas') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a USA West Coast road trip\')">🇺🇸 USA West Coast</div>';
        box.innerHTML = `<div class="suggestion-group"><div class="suggestion-label">✨ Start a New Adventure</div><div class="chip-grid">${regionChip}<div class="chip logistics" onclick="window.sendChat('Create a 3-day itinerary for Rome, Italy')">Create 3-Day Rome Itinerary</div><div class="chip logistics" onclick="window.sendChat('Suggest a romantic weekend in Paris')">Paris Weekend</div></div></div><div class="suggestion-group"><div class="suggestion-label">ℹ️ Help</div><div class="chip-grid"><div class="chip" onclick="window.sendChat('How do I use the Trip Library?')">How to use Library?</div><div class="chip" onclick="window.sendChat('What does Optimize do?')">Explain Optimization</div></div></div>`;
    } else {
        box.innerHTML = `<div class="suggestion-group"><div class="suggestion-label">🛏️ Sleeping Strategy</div><div class="chip-grid"><div class="chip sleep" onclick="window.sendChat('Where should I stay? Calculate the best base camp.')">Find Best Base Camp</div></div></div><div class="suggestion-group"><div class="suggestion-label">🍴 Eating</div><div class="chip-grid"><div class="chip eat" onclick="window.sendChat('Suggest lunch spots with high ratings but low price')">Best Cheap Eats</div><div class="chip eat" onclick="window.sendChat('Where is a good romantic dinner spot nearby?')">Romantic Dinner</div></div></div><div class="suggestion-group"><div class="suggestion-label">🚕 Logistics</div><div class="chip-grid"><div class="chip logistics" onclick="window.sendChat('How much time do I need for each stop?')">Time per Stop?</div><div class="chip logistics" onclick="window.sendChat('Is this route walkable or do I need a taxi?')">Walk vs Taxi</div></div></div>`;
    }
    el.insertBefore(box, el.firstChild);
  }

  function setPlanningMode(enabled) {
    const mapCont = $('mapContainer'), stats = document.querySelector('.stats'), list = $('routeList'), links = $('links');
    const btnPlan = $('btnPlanMode'), btnMap = $('btnMapMode');
    let bigChat = $('bigChatContainer');
    if (!bigChat) {
        bigChat = document.createElement('div'); bigChat.id = 'bigChatContainer'; bigChat.style.display = 'none';
        bigChat.innerHTML = `<div id="bigChatHistory" style="flex:1; overflow-y:auto; padding:20px; border-bottom:1px solid #1f2a3a;"></div><div class="chat-input" style="padding:15px; background:#0f1621;"><input type="text" id="bigChatInput" placeholder="Message Gemini (Internet Enabled)..."><button id="btnSendBigChat">➤</button></div>`;
        document.querySelector('.panel:nth-of-type(2)').appendChild(bigChat);
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

  document.addEventListener('DOMContentLoaded', () => {
    initTripTree(); initAI(); 
    const restored = restoreState();
    $('btnStandard').onclick = () => run('standard');
    $('btnDeep').onclick = () => run('deep');
    $('btnDriving').onclick = () => setTravelMode('DRIVING');
    $('btnWalking').onclick = () => setTravelMode('WALKING');
    $('btnEnableMap').onclick = () => ensureMapsLoaded();
    $('btnSave').onclick = () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([$('input').value],{type:'text/plain'})); a.download='trip.txt'; a.click(); };
    $('btnLoad').onclick = () => $('fileLoader').click();
    $('fileLoader').onchange = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=(v)=>{$('input').value=v.target.result;saveState();};r.readAsText(f);} };
    $('btnPlanMode').onclick = () => setPlanningMode(true);
    $('btnMapMode').onclick = () => setPlanningMode(false);
    $('tripSearch').oninput = (e) => { const q=e.target.value.toLowerCase(); document.querySelectorAll('.tree-item').forEach(i=>{i.style.display=i.textContent.toLowerCase().includes(q)?'block':'none';if(q&&i.style.display=='block')i.parentElement.classList.add('open')})};
    $('btnSendChat').onclick = () => handleChatSend('chatInput', 'chatHistory');
    $('chatInput').onkeypress = (e) => { if(e.key==='Enter') handleChatSend('chatInput', 'chatHistory'); };
    const h=$('helpOverlay'); $('btnHelp').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=HELP_HTML;}; $('btnAbout').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=window.ABOUT_CONTENT||"About missing.";}; $('btnCloseHelp').onclick=()=>h.style.display='none';
    if(restored) {
        const historyEl = $('chatHistory');
        if(!historyEl.querySelector('.recovery-msg')) {
             historyEl.innerHTML += `<div class="msg ai recovery-msg" style="border-left:3px solid var(--success)"><strong>System:</strong> Session restored.<div style="margin-top:10px; display:flex; gap:10px;"><button class="chip logistics" onclick="window.continueSession(this)">✅ Continue</button><button class="chip eat" style="border-color:var(--danger); color:var(--danger); background:rgba(239,68,68,0.1)" onclick="window.resetSession()">🗑️ Fresh Start</button></div></div>`;
        }
        setPlanningMode(true);
    } else { setPlanningMode(true); }
  });
  
  function setTravelMode(mode) { currentTravelMode = mode; updateModeButtons(); }
})();
