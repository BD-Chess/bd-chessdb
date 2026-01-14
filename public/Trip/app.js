(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  
  // --- CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA'; 
  // Scrambled Gemini Key (Security Feature from New Code)
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  // --- UI ELEMENTS ---
  const inputEl = $('input');
  const statusEl = $('status');
  const btnStandard = $('btnStandard');
  const btnDeep = $('btnDeep');
  
  // Panels & Toggles
  const btnCollapse = $('btnCollapse');
  const btnExpand = $('btnExpand');
  const leftPanel = $('leftPanel');

  // Files & Search (Restored from app_ok.js)
  const btnSave = $('btnSave');
  const btnLoad = $('btnLoad');
  const fileLoader = $('fileLoader');
  const tripSearch = $('tripSearch');

  // Outputs
  const routeList = $('routeList');
  const distKmEl = $('distKm');
  const savedKmEl = $('savedKm');
  const linksEl = $('links');
  
  // Options
  const chkRoundTrip = $('chkRoundTrip');
  const btnDriving = $('btnDriving');
  const btnWalking = $('btnWalking');
  const chkDirect = $('chkDirect'); 
  const chkGoogleStyle = $('chkGoogleStyle'); 

  // Map Elements & Landing Page (Merged)
  const mapContainer = $('mapContainer');
  const mapPlaceholder = $('mapPlaceholder');
  const btnEnableMapInitial = $('btnEnableMapInitial'); // Updated ID
  const btnStartAIChat = $('btnStartAIChat');           // New Button
  const mapDiv = $('map');

  // Help & About Overlays
  const helpOverlay = $('helpOverlay');
  const btnHelp = $('btnHelp');
  const btnAbout = $('btnAbout');
  const btnCloseHelp = $('btnCloseHelp');
  const presetTree = $('presetTree');
  const helpBody = $('helpBody'); 

  // Chat Elements
  const btnChatToggle = $('btnChatToggle');
  const chatPanel = $('chatPanel');
  const btnCloseChat = $('btnCloseChat');
  const chatInput = $('chatInput');
  const btnSendChat = $('btnSendChat');
  const chatHistory = $('chatHistory');
  const modelSelector = $('modelSelector');

  // Core Worker
  const worker = new Worker('worker.js');

  // --- STATE ---
  let map;
  let geocoder;
  let directionsService;
  let directionsRenderers = [];
  let mapMarkers = [];
  let mapPolyline = null;
  let lastSolvedPoints = null;
  let currentTravelMode = 'DRIVING'; 
  let chatHistoryBuffer = []; 
  let currentGeminiModel = ''; 
  let infoWindow = null;
  let presetLookup = {}; // Restored Library Lookup
  const STORAGE_KEY = '8z_trip_backup_v1';

  const CUSTOM_DARK_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  ];

  // --- VIEW LOGIC (Unified) ---
  function showView(view) {
    // Hide everything first
    mapContainer.style.display = 'none';
    chatPanel.style.display = 'none';
    helpOverlay.classList.remove('active');

    if (view === 'map') {
      mapContainer.style.display = 'block';
    } else if (view === 'chat') {
      chatPanel.style.display = 'flex';
      chatInput.focus();
    } else if (view === 'help' || view === 'about') {
      helpOverlay.classList.add('active');
      helpBody.innerHTML = view === 'help' ? window.HELP_CONTENT : window.ABOUT_CONTENT;
    }
  }

  // --- GOOGLE MAPS ENGINE (Restored Chunking & Lazy Load) ---
  function loadGoogleMaps() {
    if (window.google && window.google.maps) return; 
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap&loading=async&v=weekly`;
    document.body.appendChild(script);
  }

  window.initMap = function() {
    map = new google.maps.Map(mapDiv, {
      zoom: 12, center: { lat: 46.0569, lng: 14.5058 },
      mapTypeId: 'hybrid', styles: CUSTOM_DARK_STYLE,
    });
    geocoder = new google.maps.Geocoder();
    directionsService = new google.maps.DirectionsService();
    infoWindow = new google.maps.InfoWindow();
    
    // UI Update on Load
    mapPlaceholder.style.display = 'none'; 
    mapDiv.style.display = 'block'; 
    restoreState(); 
    setStatus('Maps API Loaded.', 'ok');
  };

  // --- MAP VISUALIZATION (Restored Complex Logic) ---
  function updateMapVisualization(points) {
    if (!map) return;
    lastSolvedPoints = points;
    
    // Clear old objects
    mapMarkers.forEach(m => m.setMap(null)); mapMarkers = [];
    if (mapPolyline) mapPolyline.setMap(null);
    directionsRenderers.forEach(dr => dr.setMap(null)); directionsRenderers = [];
    
    // Ensure view is correct
    mapPlaceholder.style.display = 'none';
    mapDiv.style.display = 'block';

    const pathCoords = [];
    const bounds = new google.maps.LatLngBounds();

    points.forEach((pt, index) => {
      if (typeof pt.lat === 'number' && typeof pt.lon === 'number') {
        const latLng = { lat: pt.lat, lng: pt.lon };
        pathCoords.push(latLng);
        bounds.extend(latLng);

        const marker = new google.maps.Marker({
          position: latLng, map: map,
          label: { text: (index + 1).toString(), color: "white", fontWeight: "bold" },
          title: pt.name, zIndex: 100 + index
        });
        
        marker.addListener("click", () => {
          if (infoWindow) {
            infoWindow.setContent(`<div style="color:black;padding:5px;"><strong>#${index + 1}: ${pt.name}</strong></div>`);
            infoWindow.open(map, marker);
          }
        });
        mapMarkers.push(marker);
      }
    });

    const routePath = [...pathCoords];
    if (chkRoundTrip.checked && routePath.length > 1) routePath.push(routePath[0]);

    if (chkDirect.checked) {
      mapPolyline = new google.maps.Polyline({ path: routePath, strokeColor: "#6aa9ff", strokeWeight: 4 });
      mapPolyline.setMap(map);
    } else {
      // --- RESTORED CHUNKING LOGIC ---
      const CHUNK_SIZE = 24; 
      for (let i = 0; i < routePath.length - 1; i += CHUNK_SIZE) {
        const chunk = routePath.slice(i, i + CHUNK_SIZE + 1);
        if (chunk.length < 2) continue;
        
        const renderer = new google.maps.DirectionsRenderer({
          map: map, suppressMarkers: true, preserveViewport: true,
          polylineOptions: { strokeColor: "#6aa9ff", strokeWeight: 5, strokeOpacity: 0.7 }
        });
        directionsRenderers.push(renderer);

        directionsService.route({
          origin: chunk[0], destination: chunk[chunk.length - 1],
          waypoints: chunk.slice(1, -1).map(loc => ({ location: loc, stopover: true })),
          travelMode: google.maps.TravelMode[currentTravelMode],
        }, (response, status) => { if (status === "OK") renderer.setDirections(response); });
      }
    }
    map.fitBounds(bounds);
  }

  // --- AI CHATBOT LOGIC ---
  async function initModelSelector() {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const data = await res.json();
      const valid = data.models.filter(m => m.name.includes('gemini') && !/vision|banana|tts|image/i.test(m.name));
      modelSelector.innerHTML = valid.map(m => `<option value="${m.name}">${m.displayName || m.name.split('/').pop()}</option>`).join('');
      currentGeminiModel = valid[0]?.name;
      modelSelector.addEventListener('change', () => currentGeminiModel = modelSelector.value);
    } catch (e) { console.warn("AI Init Failed", e); }
  }

  async function callGeminiAPI(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`;
    // Context management
    chatHistoryBuffer.push({ role: "user", parts: [{ text: prompt }] });
    if (chatHistoryBuffer.length > 10) chatHistoryBuffer.shift();

    const payload = { 
      contents: [
        { role: "user", parts: [{ text: "System: You are an AI Travel Assistant. If user wants to add a place, append {ADD: Place Name} to your response." }]},
        ...chatHistoryBuffer
      ] 
    };

    const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    const aiText = data.candidates[0].content.parts[0].text;
    chatHistoryBuffer.push({ role: "model", parts: [{ text: aiText }] });
    return aiText;
  }

  // --- TRIP TREE & SEARCH (Restored Logic) ---
  function initTripTree() {
    if (!window.TRIP_LIBRARY || !presetTree) return;
    presetTree.innerHTML = '';
    presetLookup = {};

    window.TRIP_LIBRARY.forEach(region => {
      const header = document.createElement('div'); header.className = 'tree-header';
      header.innerHTML = `<span class="tree-icon">[+]</span> ${region.region}`;
      const group = document.createElement('div'); group.className = 'tree-group'; group.style.display = 'none';

      region.categories.forEach(cat => {
        const cHeader = document.createElement('div'); cHeader.className = 'tree-header';
        cHeader.innerHTML = `<span class="tree-icon">[+]</span> ${cat.name}`;
        const cGroup = document.createElement('div'); cGroup.className = 'tree-group'; cGroup.style.display = 'none';

        cat.items.forEach(trip => {
          presetLookup[trip.id] = trip.data;
          const item = document.createElement('span'); item.className = 'tree-item'; 
          item.textContent = trip.label;
          item.addEventListener('click', () => loadPreset(trip));
          cGroup.appendChild(item);
        });

        cHeader.addEventListener('click', (e) => { e.stopPropagation(); toggleGroup(cHeader, cGroup); });
        group.appendChild(cHeader); group.appendChild(cGroup);
      });
      header.addEventListener('click', () => toggleGroup(header, group));
      presetTree.appendChild(header); presetTree.appendChild(group);
    });
  }

  function toggleGroup(header, group) {
    const isOpen = group.style.display === 'block';
    group.style.display = isOpen ? 'none' : 'block';
    header.querySelector('.tree-icon').textContent = isOpen ? '[+]' : '[-]';
  }

  function loadPreset(trip) {
    inputEl.value = trip.data;
    // Auto-detect Global trips for Direct Lines mode
    chkDirect.checked = trip.id.includes('GLOBAL');
    saveState();
    setStatus(`Loaded: ${trip.label}`, 'ok');
  }

  function filterLibrary(query) {
    const q = query.toLowerCase().trim();
    const allItems = presetTree.querySelectorAll('.tree-item');
    allItems.forEach(item => {
      const match = item.textContent.toLowerCase().includes(q);
      item.style.display = match ? 'block' : 'none';
      if (match && q) {
        // Expand parents if searching
        let p = item.parentElement;
        while (p && p !== presetTree) {
          if (p.classList.contains('tree-group')) { p.style.display = 'block'; }
          p = p.parentElement;
        }
      }
    });
  }

  // --- GEOCODING & PARSING (Restored Robustness) ---
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function resolveLocation(rawName) {
    if (!geocoder) return null;
    try {
      const res = await geocoder.geocode({ address: rawName });
      if (res.results && res.results.length > 0) {
        return { lat: res.results[0].geometry.location.lat(), lon: res.results[0].geometry.location.lng() };
      }
    } catch (e) { console.warn(e); }
    return null;
  }

  async function geocodeMissingPoints(pts) {
    const missing = pts.filter(p => p.lat === null);
    if (missing.length === 0) return pts;
    for (let i = 0; i < missing.length; i++) {
      const p = missing[i];
      setStatus(`Locating (${i+1}/${missing.length}): ${p.name}`, "warn");
      const res = await resolveLocation(p.name);
      if (res) { p.lat = res.lat; p.lon = res.lon; }
      await sleep(300); // Rate limiting restoration
    }
    return pts;
  }

  function parseStops(text) {
    const lines = text.split('\n');
    const pts = [];
    let startIdx = 0;
    const coordRe = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/;
    lines.forEach((line) => {
      let raw = line.trim(); if (!raw || raw.startsWith('#')) return;
      let isStart = /\bSTART\b/i.test(raw); raw = raw.replace(/\bSTART\b/i, '').trim();
      let name = raw, lat = null, lon = null;
      if (raw.includes('|')) {
        const parts = raw.split('|'); const m = coordRe.exec(parts[1]);
        if (m) { name = parts[0].trim(); lat = parseFloat(m[1]); lon = parseFloat(m[2]); }
      } else {
        const m = coordRe.exec(raw); 
        if (m) { lat = parseFloat(m[1]); lon = parseFloat(m[2]); name = raw.replace(m[0], '').replace(/^,/, '').trim() || "Stop"; }
      }
      if (isStart) startIdx = pts.length;
      pts.push({ name, lat, lon });
    });
    return { pts, startIdx };
  }

  // --- OPTIMIZER ---
  async function run(profile) {
    showView('map');
    if (!window.google) { loadGoogleMaps(); setStatus("Loading Maps...", "warn"); return; }
    
    // Disable inputs while running
    if (btnStandard) btnStandard.disabled = true;
    
    let { pts, startIdx } = parseStops(inputEl.value);
    pts = await geocodeMissingPoints(pts);
    const valid = pts.filter(p => p.lat !== null);
    
    if (valid.length < 2) { 
      setStatus("Add at least 2 locations.", "bad"); 
      if (btnStandard) btnStandard.disabled = false;
      return; 
    }
    
    setStatus(`Optimizing ${valid.length} stops...`, "warn");
    worker.postMessage({ type: 'solve', profile, points: valid, startIdx, roundTrip: chkRoundTrip.checked });
  }

  worker.onmessage = (ev) => {
    if (ev.data.type === 'result') {
      if (btnStandard) btnStandard.disabled = false;
      lastSolvedPoints = ev.data.pointsSorted;
      
      // Render Text List
      routeList.innerHTML = lastSolvedPoints.map(p => `<li>${p.name}</li>`).join('');
      distKmEl.textContent = ev.data.totalKm.toFixed(2) + ' km';
      
      // Calculate Saved
      const saved = ev.data.baseKm - ev.data.totalKm;
      savedKmEl.textContent = saved > 0 ? saved.toFixed(2) + ' km' : '—';
      
      renderLinks(lastSolvedPoints);
      updateMapVisualization(lastSolvedPoints);
      setStatus("Route optimized!", "ok");
    }
  };

  function renderLinks(pts) {
    linksEl.innerHTML = '';
    // 1. AI Button
    const aiBtn = document.createElement('button');
    aiBtn.innerHTML = '✨ Ask AI: "Is this order logical?"';
    aiBtn.className = 'secondary'; aiBtn.style.width = '100%'; aiBtn.style.marginBottom = '10px';
    aiBtn.addEventListener('click', () => {
      chatInput.value = "Review this route logic: " + pts.map(p => p.name).join(' -> ');
      showView('chat');
    });
    linksEl.appendChild(aiBtn);
    
    // 2. Maps Links (Restored from app_ok.js)
    const url = `https://www.google.com/maps/dir/?api=1&origin=$?api=1&origin=${pts[0].lat},${pts[0].lon}&destination=${pts[pts.length-1].lat},${pts[pts.length-1].lon}&waypoints=${pts.slice(1,-1).map(p=>`${p.lat},${p.lon}`).join('|')}&travelmode=${currentTravelMode.toLowerCase()}`;
    linksEl.innerHTML += `<div class="linkrow"><span class="badge">Full Route</span><a href="${url}" target="_blank">Open in Maps ↗</a></div>`;
  }

  // --- STATE MANAGEMENT ---
  function saveState() {
    const state = { text: inputEl.value, mode: currentTravelMode, round: chkRoundTrip.checked, direct: chkDirect.checked };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function restoreState() {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s) {
      inputEl.value = s.text || '';
      if(s.mode) currentTravelMode = s.mode;
      if(typeof s.round === 'boolean') chkRoundTrip.checked = s.round;
      if(typeof s.direct === 'boolean') chkDirect.checked = s.direct;
    }
  }

  // --- GLOBAL HELPERS & LISTENERS ---
  window.addStopToRoute = (loc) => {
    inputEl.value += (inputEl.value.trim() ? '\n' : '') + loc;
    saveState();
    setStatus(`Added: ${loc}`, 'ok');
  };

  const initListeners = () => {
    // Navigation
    btnChatToggle.addEventListener('click', (e) => { e.preventDefault(); showView('chat'); });
    btnAbout.addEventListener('click', (e) => { e.preventDefault(); showView('about'); });
    btnHelp.addEventListener('click', (e) => { e.preventDefault(); showView('help'); });
    btnCloseChat.addEventListener('click', () => showView('map'));
    btnCloseHelp.addEventListener('click', () => showView('map'));
    
    // Landing Page
    btnEnableMapInitial.addEventListener('click', loadGoogleMaps);
    btnStartAIChat.addEventListener('click', (e) => { e.preventDefault(); showView('chat'); });

    // Inputs
    btnStandard.addEventListener('click', () => run('standard'));
    btnDeep.addEventListener('click', () => run('deep'));
    btnDriving.addEventListener('click', () => { currentTravelMode = 'DRIVING'; saveState(); if(lastSolvedPoints) updateMapVisualization(lastSolvedPoints); });
    btnWalking.addEventListener('click', () => { currentTravelMode = 'WALKING'; saveState(); if(lastSolvedPoints) updateMapVisualization(lastSolvedPoints); });
    
    // File I/O (Restored)
    if (btnSave) btnSave.addEventListener('click', () => {
      const blob = new Blob([inputEl.value], {type: 'text/plain'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'trip.txt'; a.click();
    });
    if (btnLoad) btnLoad.addEventListener('click', () => fileLoader.click());
    if (fileLoader) fileLoader.addEventListener('change', (e) => {
      const r = new FileReader(); r.onload = (ev) => { inputEl.value = ev.target.result; saveState(); };
      r.readAsText(e.target.files[0]);
    });

    // Search
    if (tripSearch) tripSearch.addEventListener('input', (e) => filterLibrary(e.target.value));
    
    // Chat
    btnSendChat.addEventListener('click', async () => {
      const txt = chatInput.value; if(!txt) return; chatInput.value = '';
      chatHistory.innerHTML += `<div class="chat-msg user"><strong>You:</strong><br>${txt}</div>`;
      const resp = await callGeminiAPI(txt);
      const addRegex = /\{ADD:\s*(.*?)\}/gi; let match;
      while ((match = addRegex.exec(resp)) !== null) { window.addStopToRoute(match[1]); }
      chatHistory.innerHTML += `<div class="chat-msg ai"><strong>AI:</strong><br>${resp.replace(addRegex, '✅ Added: $1')}</div>`;
      chatHistory.scrollTop = chatHistory.scrollHeight;
    });

    // Side Panel
    btnCollapse.addEventListener('click', () => { leftPanel.classList.add('collapsed'); btnExpand.style.display = 'flex'; });
    btnExpand.addEventListener('click', () => { leftPanel.classList.remove('collapsed'); btnExpand.style.display = 'none'; });

    inputEl.addEventListener('input', saveState);
    chkRoundTrip.addEventListener('change', saveState);
    chkDirect.addEventListener('change', () => { saveState(); if(lastSolvedPoints) updateMapVisualization(lastSolvedPoints); });
  };

  // --- BOOTSTRAP ---
  initListeners();
  initTripTree();
  initModelSelector();
  showView('map');
})();
