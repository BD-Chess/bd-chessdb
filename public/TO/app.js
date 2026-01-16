(() => {
  'use strict';

  // --- 1. CONFIGURATION ---
  // API Keys (Obfuscated slightly to prevent simple scraping)
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
  let userRegion = null; // Stores 'Europe', 'Americas', etc.

  // --- 3. HTML CONTENT (Help & Visuals) ---
  const HELP_HTML = `
    <div class="help-block">
      <h2>How to Use</h2>
      <ul>
        <li><strong>1. Trip Library:</strong> Click [+] to expand continents. Click a tour name to load it.</li>
        <li><strong>2. Edit:</strong> Add or remove stops in the text box.</li>
        <li><strong>3. Optimize:</strong> Use "Standard" for fast results or "Deep Search" for complex routes.</li>
        <li><strong>4. Export:</strong> Click the links below the map to open in Google Maps.</li>
      </ul>
    </div>
    <div class="help-block">
      <h2>Philosophy</h2>
      <p>We optimize for <strong>Logistics</strong> (ordering 20+ stops), not just navigation. Google Maps handles the traffic; we handle the strategy.</p>
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

  function formatMarkdown(text) {
    if (!text) return '';
    let html = text;
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    // Bullets
    html = html.replace(/^\*\s/gm, '• ');
    // Newlines
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // --- 5. PERSISTENCE ENGINE (Save/Restore) ---
  function saveState() { 
    const state = {
        t: $('input').value,
        m: currentTravelMode,
        chatBuf: chatHistoryBuffer,
        chatHTML: $('chatHistory').innerHTML,
        ts: Date.now()
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { console.warn("Storage full", e); }
  }
  
  function restoreState() {
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
            
            // Clean up UI artifacts to avoid duplicates
            const oldChips = historyEl.querySelectorAll('.suggestions-box');
            oldChips.forEach(el => el.remove());
            const oldRecovery = historyEl.querySelectorAll('.recovery-msg');
            oldRecovery.forEach(el => el.remove());

            return true; 
        }
    } catch(e) { console.error("Restore failed", e); }
    return false;
  }

  // Exposed globals for button clicks
  window.resetSession = function() {
      localStorage.removeItem(STORAGE_KEY);
      location.reload(); 
  };

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

  // --- 6. INPUT PARSING ---
  function parseStops(text) {
    const lines = text.split(/\r?\n/);
    const pts = [];
    let startIdx = 0;
    const coordRe = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/;

    for (let raw of lines) {
      raw = raw.trim();
      if (!raw || raw.startsWith('#')) continue;

      let isStart = false;
      if (/\bSTART\b/i.test(raw)) {
        isStart = true;
        raw = raw.replace(/\bSTART\b/i, '').trim();
      }

      let name = raw;
      let lat = null, lon = null;

      if (raw.includes('|')) {
        const parts = raw.split('|');
        const p0 = parts[0].trim();
        const p1 = parts[1].trim();
        const m0 = coordRe.exec(p0);
        const m1 = coordRe.exec(p1);
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
      const p = { name, lat, lon, raw: raw };
      if (isStart) startIdx = pts.length;
      pts.push(p);
    }
    return { pts, startIdx };
  }

  // --- 7. GOOGLE MAPS & GEOCODING ---
  async function resolveLocation(rawName) {
    if (!geocoder) return null;
    try {
      const response = await new Promise((resolve) => {
        geocoder.geocode({ address: rawName }, (results, status) => {
          if (status === 'OK') resolve(results); else resolve(null);
        });
      });
      if (response && response.length > 0) {
        const loc = response[0].geometry.location;
        return { lat: loc.lat(), lon: loc.lng() };
      }
    } catch (e) { console.warn("Geocode error:", e); }
    return null;
  }

  async function geocodeMissingPoints(pts) {
    const missing = pts.filter(p => p.lat === null || p.lon === null);
    if (missing.length === 0) return pts;
    
    setStatus(`Looking up ${missing.length} addresses...`, 'warn');
    for (let i = 0; i < missing.length; i++) {
      const p = missing[i];
      const result = await resolveLocation(p.name);
      if (result) { p.lat = result.lat; p.lon = result.lon; }
      else { p.error = true; }
      await new Promise(r => setTimeout(r, 250)); 
    }
    return pts;
  }

  function ensureMapsLoaded() {
    if (window.google && window.google.maps) return Promise.resolve();
    if (mapScriptLoadingPromise) return mapScriptLoadingPromise;
    
    mapScriptLoadingPromise = new Promise((resolve, reject) => {
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
        directionsService.route({
          origin: seg[0], destination: seg[seg.length-1],
          waypoints: seg.slice(1,-1).map(l => ({location:l, stopover:true})),
          travelMode: gMode
        }, (res, st) => { if(st === "OK") r.setDirections(res); });
      }
    }
    
    google.maps.event.trigger(map, 'resize');
    map.fitBounds(bounds);
  }

  // --- 8. SMART LINKS (Dual Mode: Pins & Names) ---
  function buildMapsLegLinks(routePts, roundTrip, mode) {
    const travelmode = (mode === 'DRIVING') ? 'driving' : 'walking';
    
    // Helper 1: Force Coordinates (The "Pins" version)
    const encodeCoords = (p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
    
    // Helper 2: Force Names (The "Readable" version)
    const encodeName = (p) => {
        // If name is just coords (starts with digit or minus), fallback to coords
        if (p.name.match(/^-?\d+\./)) return encodeCoords(p);
        return encodeURIComponent(p.name);
    };

    const seq = routePts.slice();
    if (roundTrip && seq.length > 1) seq.push(seq[0]);

    const MAX_MID = 9; 
    const links = [];
    let i = 0;
    
    while (i < seq.length - 1) {
      const origin = seq[i];
      let j = Math.min(seq.length - 1, i + 1 + MAX_MID + 1);
      if (j <= i + 1) j = i + 2;

      const segment = seq.slice(i, j + 1);
      
      // --- BUILD URL 1: PINS (Exact GPS) ---
      const originPin = encodeCoords(segment[0]);
      const destPin = encodeCoords(segment[segment.length - 1]);
      const midsPin = segment.slice(1, -1).map(encodeCoords);
      
      let urlPins = `https://www.google.com/maps/dir/?api=1&origin=${originPin}&destination=${destPin}&travelmode=${travelmode}`;
      if (midsPin.length) urlPins += `&waypoints=${midsPin.join('%7C')}`;

      // --- BUILD URL 2: NAMES (Readable) ---
      const originName = encodeName(segment[0]);
      const destName = encodeName(segment[segment.length - 1]);
      const midsName = segment.slice(1, -1).map(encodeName);
      
      let urlNames = `https://www.google.com/maps/dir/?api=1&origin=${originName}&destination=${destName}&travelmode=${travelmode}`;
      if (midsName.length) urlNames += `&waypoints=${midsName.join('%7C')}`;

      links.push({ 
        label: `Leg ${links.length + 1} (${segment.length} stops)`, 
        urlPins: urlPins,
        urlNames: urlNames
      });
      
      i = j;
    }
    return links;
  }

  function renderLinks(links) {
    const el = $('links'); 
    el.innerHTML = '';
    
    for (const L of links) {
      const row = document.createElement('div'); 
      row.className = 'linkrow';
      // Flex container for the dual buttons
      row.style.display = 'flex';
      row.style.flexWrap = 'wrap';
      row.style.alignItems = 'center';
      row.style.gap = '10px';
      
      row.innerHTML = `
        <span class="badge" style="min-width:60px;">${L.label}</span>
        <div style="display:flex; gap:8px; flex:1;">
            <a href="${L.urlPins}" target="_blank" style="flex:1; text-align:center; padding:6px; background:rgba(59,130,246,0.1); border-radius:4px; font-size:0.85rem; text-decoration:none; color:#bfdbfe;">
               📍 Exact Pins
            </a>
            <a href="${L.urlNames}" target="_blank" style="flex:1; text-align:center; padding:6px; background:rgba(16,185,129,0.1); color:#6ee7b7; border-radius:4px; font-size:0.85rem; text-decoration:none;">
               🏷️ Names
            </a>
        </div>
      `;
      el.appendChild(row);
    }
  }

  // --- 9. LIBRARY (GEO-AWARE) ---
  async function detectUserLocation() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const code = data.country_code; 
        
        if (['US', 'CA', 'MX'].includes(code)) return 'Americas';
        if (['CN', 'JP', 'KR', 'TH', 'VN', 'IN'].includes(code)) return 'Asia';
        if (['DE', 'FR', 'IT', 'ES', 'UK', 'GB', 'SI', 'AT', 'CH', 'NL', 'BE', 'SK', 'CZ', 'PL', 'HU'].includes(code)) return 'Europe';
        if (['BR', 'AR', 'CL', 'PE', 'CO'].includes(code)) return 'South America';
        return 'Global';
    } catch(e) {
        console.warn("Geo-IP failed, using default order.", e);
        return null;
    }
  }

  async function initTripTree() {
    if (!window.TRIP_LIBRARY) return;
    
    // 1. Detect & Store Region
    const region = await detectUserLocation();
    userRegion = region; 
    
    // 2. Sort Library
    let sortedLib = window.TRIP_LIBRARY.slice();
    if (region) {
        sortedLib.sort((a, b) => {
            const aMatch = a.region.includes(region);
            const bMatch = b.region.includes(region);
            return bMatch - aMatch;
        });
        if(region !== 'Global') setStatus(`Prioritizing trips for ${region}...`, 'ok');
    }

    const tree = $('presetTree'); tree.innerHTML = '';
    presetLookup = {};

    sortedLib.forEach((regionData, idx) => {
      const rNode = document.createElement('div');
      
      const isUserRegion = idx === 0 && region; 
      const arrow = isUserRegion ? '⌄ ' : '› ';
      const openClass = isUserRegion ? ' open' : '';
      
      rNode.innerHTML = `<div class="tree-header">${arrow} ${regionData.region}</div><div class="tree-group${openClass}"></div>`;
      const rGroup = rNode.querySelector('.tree-group');

      regionData.categories.forEach(cat => {
        const cNode = document.createElement('div');
        cNode.innerHTML = `<div class="tree-header">› ${cat.name}</div><div class="tree-group"></div>`;
        const cGroup = cNode.querySelector('.tree-group');

        cat.items.forEach(trip => {
          presetLookup[trip.id] = trip.data;
          const item = document.createElement('span');
          item.className = 'tree-item';
          item.textContent = trip.label;
          item.onclick = () => { 
            $('input').value = trip.data; 
            saveState(); 
            if (trip.id.includes('GLOBAL')) {
                $('chkDirect').checked = true;
                setTravelMode('DRIVING');
            } else if (trip.id.includes('WALKING')) {
                $('chkDirect').checked = false;
                setTravelMode('WALKING');
            } else {
                $('chkDirect').checked = false;
                setTravelMode('DRIVING');
            }
            setStatus(`Loaded: ${trip.label}`, 'ok');
            renderSuggestions('bigChatHistory');
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

  // --- 10. OPTIMIZER LOGIC ---
  function showBusy(msg) {
    let overlay = $('busyOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'busyOverlay';
        overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:white;font-family:sans-serif;";
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div style="font-size:2rem;margin-bottom:20px;">🧬</div><div style="font-size:1.2rem;font-weight:bold;">${msg}</div><div style="margin-top:10px;color:#6aa9ff;">Please wait...</div>`;
    overlay.style.display = 'flex';
  }
  
  function hideBusy() {
    const overlay = $('busyOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  async function run(profile) {
    setPlanningMode(false); // Switch to map view to see results

    if (!window.google) { setStatus('Loading Map API...', 'ok'); await ensureMapsLoaded(); }

    const raw = $('input').value;
    let { pts, startIdx } = parseStops(raw);
    
    try { pts = await geocodeMissingPoints(pts); }
    catch (e) { setStatus('Geocode Error', 'bad'); return; }

    const valid = pts.filter(p => p.lat !== null && p.lon !== null);
    if (valid.length < 2) { setStatus('Need 2+ valid stops.', 'bad'); return; }

    setStatus(`Optimizing ${valid.length} stops...`, 'warn');
    if (profile === 'deep') showBusy("Deep Genetic Optimization...");
    
    worker.postMessage({
      type: 'solve',
      profile: profile,
      points: valid,
      startIdx: (startIdx < valid.length) ? startIdx : 0,
      roundTrip: $('chkRoundTrip').checked
    });
  }

  worker.onmessage = (ev) => {
    const msg = ev.data || {};
    
    if (msg.type === 'progress') {
        showBusy(msg.text); 
    }
    else if (msg.type === 'result') {
      hideBusy();
      const { pointsSorted, totalKm, baseKm } = msg;
      lastSolvedPoints = pointsSorted;
      
      $('distKm').textContent = totalKm.toFixed(2) + ' km';
      const saved = baseKm - totalKm;
      $('savedKm').textContent = saved > 0 ? saved.toFixed(2) + ' km' : '—';
      
      const list = $('routeList'); list.innerHTML = '';
      pointsSorted.forEach(p => { const li = document.createElement('li'); li.textContent = p.name; list.appendChild(li); });

      updateMapVisualization(pointsSorted);
      const links = buildMapsLegLinks(pointsSorted, $('chkRoundTrip').checked, currentTravelMode);
      renderLinks(links);
      setStatus('Done!', 'ok');
    }
  };

  // --- 11. UI CONTROL (Plan vs Map) & CHIPS ---
  function renderSuggestions(containerId) {
    const el = $(containerId);
    if (!el) return;
    
    const old = el.querySelector('.suggestions-box');
    if (old) old.remove();

    const inputVal = $('input').value.trim();
    const isNew = inputVal.length < 10; 

    const box = document.createElement('div');
    box.className = 'suggestions-box';

    if (isNew) {
        let regionChip = "";
        if (userRegion === 'Europe') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a classic Europe tour (Paris, Rome, Berlin)\')">🇪🇺 Classic Europe Tour</div>';
        if (userRegion === 'Americas') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a USA West Coast road trip\')">🇺🇸 USA West Coast</div>';
        if (userRegion === 'Asia') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a tour of Japan and South Korea\')">🇯🇵 Japan & Korea</div>';
        
        box.innerHTML = `
          <div class="suggestion-group">
            <div class="suggestion-label">✨ Start a New Adventure</div>
            <div class="chip-grid">
              ${regionChip}
              <div class="chip logistics" onclick="window.sendChat('Create a 3-day itinerary for Rome, Italy')">Create 3-Day Rome Itinerary</div>
              <div class="chip logistics" onclick="window.sendChat('Suggest a romantic weekend in Paris')">Paris Weekend</div>
            </div>
          </div>
          <div class="suggestion-group">
            <div class="suggestion-label">ℹ️ Help</div>
            <div class="chip-grid">
              <div class="chip" onclick="window.sendChat('How do I use the Trip Library?')">How to use Library?</div>
              <div class="chip" onclick="window.sendChat('What does Optimize do?')">Explain Optimization</div>
            </div>
          </div>
        `;
    } else {
        box.innerHTML = `
          <div class="suggestion-group">
            <div class="suggestion-label">🛏️ Sleeping Strategy (Center of Gravity)</div>
            <div class="chip-grid">
              <div class="chip sleep" onclick="window.sendChat('Where should I stay? Calculate the best base camp.')">Find Best Base Camp</div>
              <div class="chip sleep" onclick="window.sendChat('Find best value hotels (4+ stars) near the center of my route')">Best Value Hotels</div>
            </div>
          </div>
          <div class="suggestion-group">
            <div class="suggestion-label">🍴 Eating (Quality/Price)</div>
            <div class="chip-grid">
              <div class="chip eat" onclick="window.sendChat('Suggest lunch spots with high ratings but low price')">Best Cheap Eats</div>
              <div class="chip eat" onclick="window.sendChat('Where is a good romantic dinner spot nearby?')">Romantic Dinner</div>
            </div>
          </div>
          <div class="suggestion-group">
            <div class="suggestion-label">🚕 Logistics</div>
            <div class="chip-grid">
              <div class="chip logistics" onclick="window.sendChat('How much time do I need for each stop?')">Time per Stop?</div>
              <div class="chip logistics" onclick="window.sendChat('Is this route walkable or do I need a taxi?')">Walk vs Taxi</div>
            </div>
          </div>
        `;
    }
    el.insertBefore(box, el.firstChild);
  }

  function setPlanningMode(enabled) {
    const rightPanel = document.querySelector('.panel:nth-of-type(2)');
    const mapCont = $('mapContainer');
    const stats = document.querySelector('.stats');
    const list = $('routeList');
    const links = $('links');
    
    const btnPlan = $('btnPlanMode');
    const btnMap = $('btnMapMode');
    
    let bigChat = $('bigChatContainer');
    if (!bigChat) {
        bigChat = document.createElement('div');
        bigChat.id = 'bigChatContainer';
        bigChat.style.display = 'none';
        bigChat.innerHTML = `
          <div id="bigChatHistory" style="flex:1; overflow-y:auto; padding:20px; border-bottom:1px solid #1f2a3a;"></div>
          <div class="chat-input" style="padding:15px; background:#0f1621;">
            <input type="text" id="bigChatInput" placeholder="Message Gemini (Internet Enabled)...">
            <button id="btnSendBigChat">➤</button>
          </div>
        `;
        rightPanel.appendChild(bigChat);
        
        $('btnSendBigChat').onclick = () => handleChatSend('bigChatInput', 'bigChatHistory');
        $('bigChatInput').onkeypress = (e) => { if(e.key==='Enter') handleChatSend('bigChatInput', 'bigChatHistory'); };
    }

    if (enabled) {
        // --- PLAN MODE ---
        btnPlan.classList.add('active');
        btnMap.classList.remove('active');
        mapCont.style.display = 'none';
        stats.style.display = 'none';
        list.style.display = 'none';
        links.style.display = 'none';
        
        bigChat.style.display = 'flex';
        bigChat.style.flexDirection = 'column';
        bigChat.style.height = '100%';
        $('chatPanel').style.display = 'none'; // Hide small chat
        
        // Sync & Render
        $('bigChatHistory').innerHTML = $('chatHistory').innerHTML;
        renderSuggestions('bigChatHistory');

        setTimeout(() => $('bigChatInput') && $('bigChatInput').focus(), 100);
    } else {
        // --- MAP MODE ---
        btnMap.classList.add('active');
        btnPlan.classList.remove('active');
        mapCont.style.display = 'block';
        stats.style.display = 'flex';
        list.style.display = 'block';
        links.style.display = 'flex';
        bigChat.style.display = 'none';
        $('chatPanel').style.display = 'flex'; // Show small chat
        
        // Sync Back
        $('chatHistory').innerHTML = $('bigChatHistory').innerHTML;
    }
  }

  // --- 12. AI CHAT LOGIC ---
  async function initAI() {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const d = await r.json();
      
      let v = d.models.filter(m => 
          m.name.includes('gemini') && 
          !m.name.includes('vision') && 
          !m.name.includes('embedding') &&
          !m.name.includes('nano')
      );
      
      v.sort((a, b) => {
          if (a.name.includes('latest') && !b.name.includes('latest')) return -1;
          if (!a.name.includes('latest') && b.name.includes('latest')) return 1;
          const va = parseFloat(a.version) || 0;
          const vb = parseFloat(b.version) || 0;
          if (va !== vb) return vb - va;
          return 0;
      });

      const s = $('modelSelector'); s.innerHTML='';
      v.forEach(m => { const o=document.createElement('option'); o.value=m.name; o.textContent=m.displayName; s.appendChild(o); });
      
      if (v.length > 0) {
          currentGeminiModel = v[0].name;
          s.value = currentGeminiModel;
      }
      s.onchange = () => currentGeminiModel = s.value;
      
    } catch(e){ console.error("AI Init Error", e); }
  }

  // Expose chat sender for chips
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
      const i = $(inputId), t = i.value.trim(), h = $(historyId);
      if (!t) return;
      
      i.value = '';
      h.innerHTML += `<div class="msg user">${t}</div>`;
      h.scrollTop = h.scrollHeight;
      
      const otherHistory = historyId === 'chatHistory' ? $('bigChatHistory') : $('chatHistory');
      if (otherHistory) {
          otherHistory.innerHTML = h.innerHTML;
          otherHistory.scrollTop = otherHistory.scrollHeight;
      }
      
      saveState(); 

      const loadingId = 'loading-' + Date.now();
      h.innerHTML += `<div id="${loadingId}" class="msg ai" style="opacity:0.6">...</div>`;
      
      const r = await callAI(t);
      
      const loader = document.getElementById(loadingId);
      if(loader) loader.remove();
      
      let processedText = r;
      // Handle REPLACE command
      const replaceMatch = r.match(/\{REPLACE:\s*([\s\S]*?)\}/);
      if (replaceMatch) {
          const newContent = replaceMatch[1].trim();
          if (newContent) {
              $('input').value = newContent;
              saveState();
              setStatus('Trip list updated by AI.', 'ok');
              
              setTimeout(() => {
                  renderSuggestions('bigChatHistory');
                  if (historyId === 'chatHistory') renderSuggestions('chatHistory');
              }, 500);
          }
          // SHOW VISUAL ACTION CARD (Ghost Action Fix)
          processedText = processedText.replace(/\{REPLACE:\s*[\s\S]*?\}/g, 
            '<div class="action-badge">📋 <strong>Trip Editor Updated</strong><small>Check the list above to edit.</small></div>'
          );
      }

      // Handle ADD command
      const m = processedText.match(/\{ADD:\s*(.*?)\}/g); 
      if(m) {
        let addedCount = 0;
        m.forEach(x=>{ 
            const l=x.replace(/\{ADD:\s*|\}/g,'').trim(); 
            if(!$('input').value.includes(l)) {
                $('input').value += ($('input').value.endsWith('\n') ? '' : '\n') + l;
                addedCount++;
            }
        });
        if(addedCount > 0) {
            saveState();
            setStatus(`AI added ${addedCount} stops.`, 'ok');
            renderSuggestions('bigChatHistory'); 
        }
        processedText = processedText.replace(/\{ADD:.*?\}/g, 
            '<div class="action-badge">➕ <strong>Stops Added</strong><small>Check the list above.</small></div>'
        );
      }

      // Render Markdown & Final Output
      const cleanResponse = `<div class="msg ai"><strong>Gemini:</strong> ${formatMarkdown(processedText)}</div>`;
      h.innerHTML += cleanResponse;
      h.scrollTop = h.scrollHeight;
      
      if (otherHistory) {
          otherHistory.innerHTML = h.innerHTML;
          otherHistory.scrollTop = otherHistory.scrollHeight;
      }
      
      saveState(); 
  }

  async function callAI(txt) {
    chatHistoryBuffer.push({ role: "user", parts: [{ text: txt }] });
    
    const currentTripData = $('input').value.substring(0, 3000); 
    const hasData = currentTripData.length > 20; 
    
    const locationContext = userRegion ? `USER LOCATION: ${userRegion}` : "";
    
    let sysPrompt = "";
    
    if (!hasData) {
        // --- GUIDE MODE (Empty) ---
        sysPrompt = `
          You are the 8Z Trip Architect. The user has an EMPTY itinerary. ${locationContext}
          YOUR GOAL: Help them create a list of stops.
          COMMANDS:
          - Use {REPLACE: \nStop 1\nStop 2...} to fill their list.
          - CRITICAL: Do NOT list the stops in the chat text. Say "I have loaded these stops into your Trip Editor above ☝️."
          - AMBIGUITY CHECK: Always specify Country (e.g. "Rome, Italy" NOT just "Rome"). Use "Place | lat, lon" for specific spots.
        `;
    } else {
        // --- ANALYST MODE (Active) ---
        sysPrompt = `
          You are the 8Z Logistics Co-Pilot. ${locationContext}
          CURRENT STOPS: ${currentTripData}
          CRITICAL RULES:
          1. Value for Money (4.5+ stars).
          2. Geometric Center for hotels.
          3. UI AWARENESS: When using {REPLACE} or {ADD}, do NOT paste the list in chat. Say "I have updated your Trip Editor above."
          4. AMBIGUITY CHECK: Always specify Country (e.g. "Rome, Italy").
          COMMANDS:
          - {ADD: ...} to append.
          - {REPLACE: ...} to overwrite.
        `;
    }

    const body = {
        contents: [{role:"user", parts:[{text: sysPrompt}]}, ...chatHistoryBuffer],
        tools: [{ google_search: {} }] 
    };

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
    });
    
    const d = await res.json();
    
    if (d.error) {
        console.error("Gemini API Error:", d.error);
        return "Error: " + d.error.message;
    }

    const t = d.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
    chatHistoryBuffer.push({ role: "model", parts: [{ text: t }] });
    return t;
  }

  // --- 13. INIT ---
  document.addEventListener('DOMContentLoaded', () => {
    initTripTree(); initAI(); 
    
    // Attempt Restore
    const restored = restoreState();
    
    // Bind Controls
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

    $('tripSearch').oninput = (e) => { 
        const q=e.target.value.toLowerCase(); 
        document.querySelectorAll('.tree-item').forEach(i => { 
          const match = i.textContent.toLowerCase().includes(q);
          i.style.display = match ? 'block' : 'none';
          if(q && match){
            let p=i.parentElement;
            while(p.id!=='presetTree'){
              if(p.classList.contains('tree-group')) {
                p.classList.add('open');
                const h = p.previousElementSibling; 
                if(h) h.textContent = h.textContent.replace('›', '⌄');
              }
              p=p.parentElement;
            }
          }
        }); 
    };

    $('btnSendChat').onclick = () => handleChatSend('chatInput', 'chatHistory');
    $('chatInput').onkeypress = (e) => { if(e.key==='Enter') handleChatSend('chatInput', 'chatHistory'); };
    
    const h=$('helpOverlay'); 
    $('btnHelp').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=HELP_HTML;}; 
    $('btnAbout').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=window.ABOUT_CONTENT || "About content missing.";}; 
    $('btnCloseHelp').onclick=()=>h.style.display='none';
    
    // Recovery Logic
    if(restored) {
        const historyEl = $('chatHistory');
        const restoreMsg = document.createElement('div');
        restoreMsg.className = 'msg ai recovery-msg';
        restoreMsg.style.borderLeft = "3px solid var(--success)";
        restoreMsg.innerHTML = `
          <strong>System:</strong> I found an unsaved session from before.
          <div style="margin-top:10px; display:flex; gap:10px;">
            <button class="chip logistics" onclick="window.continueSession(this)">✅ Continue</button>
            <button class="chip eat" style="border-color:var(--danger); color:var(--danger); background:rgba(239,68,68,0.1)" onclick="window.resetSession()">🗑️ Start Fresh</button>
          </div>
        `;
        historyEl.appendChild(restoreMsg);
        
        setPlanningMode(true); // Always return to Plan Mode on restore
    } else {
        setPlanningMode(true); // Default to Plan Mode
    }
  });
  
  function setTravelMode(mode) {
    currentTravelMode = mode;
    updateModeButtons();
  }
})();
