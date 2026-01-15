(() => {
  'use strict';

  // --- 1. CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA'; 
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  const worker = new Worker('worker.js');
  const STORAGE_KEY = '8z_trip_backup_v1';

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

  // --- 3. HTML CONTENT ---
  const HELP_HTML = `
    <div class="help-block">
      <h2>How to Use</h2>
      <ul>
        <li><strong>1. Trip Library:</strong> Click [+] to expand continents. Click a tour name to load it.</li>
        <li><strong>2. Edit:</strong> Add or remove stops in the text box.</li>
        <li><strong>3. Optimize:</strong> Use "Standard" for fast results or "Deep Search" for complex routes.</li>
        <li><strong>4. Export:</strong> Click the "Open in Maps" links to send the route to your phone.</li>
      </ul>
    </div>
    <div class="help-block">
      <h2>Input Formats</h2>
      <p>You can mix and match these formats:</p>
      <ul>
        <li><code>46.0569, 14.5058</code> (GPS)</li>
        <li><code>Tivoli Park, Ljubljana</code> (Address)</li>
        <li><code>Home | 46.0428, 14.4500</code> (Name | GPS)</li>
      </ul>
    </div>
    <div class="help-block">
      <h2>Special Commands</h2>
      <p>Add <code>START</code> anywhere on a line to lock it as the starting point.</p>
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

  function saveState() { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ t: $('input').value, m: currentTravelMode })); 
  }
  
  function restoreState() {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s) { 
      $('input').value = s.t || ''; 
      currentTravelMode = s.m || 'DRIVING'; 
      updateModeButtons(); 
    }
  }

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

  // --- 5. PARSING ---
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

  // --- 6. GEOCODING ---
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

  // --- 7. MAP VISUALIZATION ---
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

  // --- 8. LINKS ---
  function buildMapsLegLinks(routePts, roundTrip, mode) {
    const travelmode = (mode === 'DRIVING') ? 'driving' : 'walking';
    
    const encodeLoc = (p) => {
        if (typeof p.lat === 'number' && typeof p.lon === 'number') return `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
        return p.name;
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

  function renderLinks(links) {
    const el = $('links'); el.innerHTML = '';
    for (const L of links) {
      const row = document.createElement('div'); row.className = 'linkrow';
      row.innerHTML = `<span class="badge">${L.label}</span> <a href="${L.url}" target="_blank">Open in Maps ↗</a>`;
      el.appendChild(row);
    }
  }

  // --- 9. LIBRARY ---
  function initTripTree() {
    if (!window.TRIP_LIBRARY) return;
    const tree = $('presetTree'); tree.innerHTML = '';
    presetLookup = {};

    window.TRIP_LIBRARY.forEach(region => {
      const rNode = document.createElement('div');
      rNode.innerHTML = `<div class="tree-header">› ${region.region}</div><div class="tree-group"></div>`;
      const rGroup = rNode.querySelector('.tree-group');

      region.categories.forEach(cat => {
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
          };
          cGroup.appendChild(item);
        });
        cNode.querySelector('.tree-header').onclick = function() { cGroup.classList.toggle('open'); this.textContent = (cGroup.classList.contains('open') ? '⌄ ' : '› ') + cat.name; };
        rGroup.appendChild(cNode);
      });
      rNode.querySelector('.tree-header').onclick = function() { rGroup.classList.toggle('open'); this.textContent = (rGroup.classList.contains('open') ? '⌄ ' : '› ') + region.region; };
      tree.appendChild(rNode);
    });
  }

  // --- 10. RUN ---
  
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

  function setPlanningMode(enabled) {
    const rightPanel = document.querySelector('.panel:nth-of-type(2)');
    const mapCont = $('mapContainer');
    const stats = document.querySelector('.stats');
    const list = $('routeList');
    const links = $('links');
    
    // Create Big Chat if missing
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
        
        // Wire up Big Chat Input
        $('btnSendBigChat').onclick = () => handleChatSend('bigChatInput', 'bigChatHistory');
        $('bigChatInput').onkeypress = (e) => { if(e.key==='Enter') handleChatSend('bigChatInput', 'bigChatHistory'); };
    }

    if (enabled) {
        // HIDE Map Elements
        mapCont.style.display = 'none';
        stats.style.display = 'none';
        list.style.display = 'none';
        links.style.display = 'none';
        
        // SHOW Big Chat
        bigChat.style.display = 'flex';
        bigChat.style.flexDirection = 'column';
        bigChat.style.height = '100%';
        
        // HIDE Small Chat
        $('chatPanel').style.display = 'none';
        
        // SYNC History
        $('bigChatHistory').innerHTML = $('chatHistory').innerHTML;
        
    } else {
        // SHOW Map Elements
        mapCont.style.display = 'block';
        stats.style.display = 'flex';
        list.style.display = 'block';
        links.style.display = 'flex';
        
        // HIDE Big Chat
        bigChat.style.display = 'none';
        
        // SHOW Small Chat
        $('chatPanel').style.display = 'flex';
        
        // SYNC History back
        $('chatHistory').innerHTML = $('bigChatHistory').innerHTML;
    }
  }

  async function run(profile) {
    // Exit planning mode when running
    setPlanningMode(false);

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

  // --- 11. AI ---
  async function initAI() {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const d = await r.json();
      
      // 1. Filter: Chat models only (Gemini), remove vision/embedding/nano
      let v = d.models.filter(m => 
          m.name.includes('gemini') && 
          !m.name.includes('vision') && 
          !m.name.includes('embedding') &&
          !m.name.includes('nano')
      );
      
      // 2. Sort: Newest First
      // Strategy: Check for 'latest', then version numbers
      v.sort((a, b) => {
          // Prefer 'latest' aliases
          if (a.name.includes('latest') && !b.name.includes('latest')) return -1;
          if (!a.name.includes('latest') && b.name.includes('latest')) return 1;
          
          // Parse version numbers (1.5 > 1.0)
          const va = parseFloat(a.version) || 0;
          const vb = parseFloat(b.version) || 0;
          if (va !== vb) return vb - va; // Descending
          
          return 0;
      });

      const s = $('modelSelector'); s.innerHTML='';
      v.forEach(m => { const o=document.createElement('option'); o.value=m.name; o.textContent=m.displayName; s.appendChild(o); });
      
      // Default to first (newest)
      if (v.length > 0) {
          currentGeminiModel = v[0].name;
          s.value = currentGeminiModel;
      }
      s.onchange = () => currentGeminiModel = s.value;
      
      console.log("AI Models Loaded:", v.map(m=>m.displayName));

    } catch(e){ console.error("AI Init Error", e); }
  }

  async function handleChatSend(inputId, historyId) {
      const i = $(inputId), t = i.value.trim(), h = $(historyId);
      if (!t) return;
      
      i.value = '';
      h.innerHTML += `<div class="msg user">${t}</div>`;
      h.scrollTop = h.scrollHeight;
      
      // Sync to other chat history buffer if it exists
      const otherHistory = historyId === 'chatHistory' ? $('bigChatHistory') : $('chatHistory');
      if (otherHistory) {
          otherHistory.innerHTML = h.innerHTML;
          otherHistory.scrollTop = otherHistory.scrollHeight;
      }

      // Show typing
      const loadingId = 'loading-' + Date.now();
      h.innerHTML += `<div id="${loadingId}" class="msg ai" style="opacity:0.6">...</div>`;
      
      const r = await callAI(t);
      
      const loader = document.getElementById(loadingId);
      if(loader) loader.remove();
      
      // Process ADD
      const m = r.match(/\{ADD:\s*(.*?)\}/g); 
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
            setStatus(`AI added ${addedCount} stops. Click Optimize!`, 'ok');
        }
      }

      const cleanResponse = `<div class="msg ai"><strong>Gemini:</strong> ${r.replace(/\n/g,'<br>').replace(/\{ADD:.*?\}/g, '')}</div>`;
      h.innerHTML += cleanResponse;
      h.scrollTop = h.scrollHeight;
      
      // Sync Response
      if (otherHistory) {
          otherHistory.innerHTML = h.innerHTML;
          otherHistory.scrollTop = otherHistory.scrollHeight;
      }
  }

  async function callAI(txt) {
    chatHistoryBuffer.push({ role: "user", parts: [{ text: txt }] });
    
    const currentTripData = $('input').value.substring(0, 3000); 
    const currentDist = $('distKm').innerText;
    const currentSaved = $('savedKm').innerText;
    const stopCount = currentTripData.split('\n').filter(x=>x.trim()).length;
    
    const sysPrompt = `
      You are the 8Z Trip Co-Pilot. You help users plan complex routes.
      
      CURRENT TRIP STATUS:
      - Stops (${stopCount}): 
      ${currentTripData}
      - Total Distance: ${currentDist}
      - Distance Saved: ${currentSaved}
      
      INSTRUCTIONS:
      1. If the user asks to add a place, you MUST use this format: {ADD: Place Name, City}.
      2. You have access to Google Search. Use it to find up-to-date user opinions, opening hours, or hidden gems if asked.
      3. Be concise.
    `;

    // FIX: Updated tool definition from 'googleSearchRetrieval' to 'google_search'
    const body = {
        contents: [{role:"user", parts:[{text: sysPrompt}]}, ...chatHistoryBuffer],
        tools: [{ google_search: {} }] 
    };

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
    });
    
    const d = await res.json();
    
    // Improved Error Handling
    if (d.error) {
        console.error("Gemini API Error:", d.error);
        return "Error: " + d.error.message;
    }

    const t = d.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
    
    chatHistoryBuffer.push({ role: "model", parts: [{ text: t }] });
    return t;
  }

  // --- BOOT ---
  document.addEventListener('DOMContentLoaded', () => {
    initTripTree(); initAI(); restoreState();

    $('btnStandard').onclick = () => run('standard');
    $('btnDeep').onclick = () => run('deep');
    $('btnDriving').onclick = () => setTravelMode('DRIVING');
    $('btnWalking').onclick = () => setTravelMode('WALKING');
    $('btnEnableMap').onclick = () => ensureMapsLoaded();
    
    $('btnSave').onclick = () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([$('input').value],{type:'text/plain'})); a.download='trip.txt'; a.click(); };
    $('btnLoad').onclick = () => $('fileLoader').click();
    $('fileLoader').onchange = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=(v)=>{$('input').value=v.target.result;saveState();};r.readAsText(f);} };
    
    // UPDATED: Plan with AI Button
    $('btnPlanAI').onclick = () => {
        setPlanningMode(true);
        // Focus the BIG input
        setTimeout(() => $('bigChatInput') && $('bigChatInput').focus(), 100);
    };

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

    // Small Chat Send (Bottom Left)
    $('btnSendChat').onclick = () => handleChatSend('chatInput', 'chatHistory');
    $('chatInput').onkeypress = (e) => { if(e.key==='Enter') handleChatSend('chatInput', 'chatHistory'); };
    
    const h=$('helpOverlay'); 
    $('btnHelp').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=HELP_HTML;}; 
    $('btnAbout').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=window.ABOUT_CONTENT || "About content missing.";}; 
    $('btnCloseHelp').onclick=()=>h.style.display='none';
    
    if (window.innerWidth >= 1800) {
        $('chatPanel').classList.add('open');
    }
  });
  
  function setTravelMode(mode) {
    currentTravelMode = mode;
    updateModeButtons();
  }
})();