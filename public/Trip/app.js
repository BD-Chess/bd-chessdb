(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  
  // --- CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA';
  // Scrambled Gemini Key Logic
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  // --- UI ELEMENTS ---
  const inputEl = $('input'), statusEl = $('status'), btnStandard = $('btnStandard'), btnDeep = $('btnDeep');
  const btnDriving = $('btnDriving'), btnWalking = $('btnWalking');
  const routeList = $('routeList'), distKmEl = $('distKm'), savedKmEl = $('savedKm'), linksEl = $('links');
  const chkRoundTrip = $('chkRoundTrip'), chkDirect = $('chkDirect'), chkGoogleStyle = $('chkGoogleStyle');
  const mapDiv = $('map'), mapPlaceholder = $('mapPlaceholder'), mapContainer = $('mapContainer');
  const presetTree = $('presetTree'), tripSearch = $('tripSearch'), chatPanel = $('chatPanel'), chatInput = $('chatInput');
  const btnSendChat = $('btnSendChat'), chatHistory = $('chatHistory'), modelSelector = $('modelSelector');
  const btnCollapse = $('btnCollapse'), btnExpand = $('btnExpand'), leftPanel = $('leftPanel');
  
  const btnChatToggle = $('btnChatToggle'), btnAbout = $('btnAbout'), btnHelp = $('btnHelp');
  const btnCloseChat = $('btnCloseChat'), btnCloseHelp = $('btnCloseHelp'), helpOverlay = $('helpOverlay'), helpBody = $('helpBody');
  const btnEnableMapInitial = $('btnEnableMapInitial'), btnStartAIChat = $('btnStartAIChat');

  // --- CORE STATE ---
  const worker = new Worker('worker.js');
  let map, geocoder, directionsService, directionsRenderers = [], mapMarkers = [], mapPolyline = null, infoWindow = null;
  let lastSolvedPoints = null, chatHistoryBuffer = [], currentGeminiModel = '', currentTravelMode = 'DRIVING';
  const STORAGE_KEY = '8z_trip_backup_v1';

  const CUSTOM_DARK_STYLE = [{ elementType: "geometry", stylers: [{ color: "#242f3e" }] }, { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] }, { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] }, { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }];

  // --- NAVIGATION LOGIC ---
  function showView(view) {
    mapContainer.style.display = 'none';
    chatPanel.style.display = 'none';
    helpOverlay.classList.remove('active');
    if (view === 'map') { mapContainer.style.display = 'block'; }
    else if (view === 'chat') { chatPanel.style.display = 'flex'; chatInput.focus(); }
    else if (view === 'help' || view === 'about') { helpOverlay.classList.add('active'); helpBody.innerHTML = view === 'help' ? window.HELP_CONTENT : window.ABOUT_CONTENT; }
  }

  function setStatus(msg, cls) { statusEl.textContent = msg; statusEl.className = 'status' + (cls ? (' ' + cls) : ''); }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // --- MAP ENGINE ---
  function loadGoogleMaps() {
    if (window.google && window.google.maps) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap&loading=async&v=weekly`;
    document.body.appendChild(script);
  }

  window.initMap = function() {
    map = new google.maps.Map(mapDiv, { zoom: 12, center: { lat: 46.0569, lng: 14.5058 }, mapTypeId: 'hybrid', styles: CUSTOM_DARK_STYLE });
    geocoder = new google.maps.Geocoder(); directionsService = new google.maps.DirectionsService(); infoWindow = new google.maps.InfoWindow();
    mapPlaceholder.style.display = 'none'; mapDiv.style.display = 'block';
    restoreState();
  };

  function clearMap() {
    mapMarkers.forEach(m => m.setMap(null)); mapMarkers = [];
    if (mapPolyline) mapPolyline.setMap(null);
    directionsRenderers.forEach(dr => dr.setMap(null)); directionsRenderers = [];
  }

  function updateMapVisualization(points) {
    if (!map) return;
    clearMap();
    const pathCoords = [];
    const bounds = new google.maps.LatLngBounds();
    points.forEach((pt, idx) => {
      const latLng = { lat: pt.lat, lng: pt.lon };
      pathCoords.push(latLng); bounds.extend(latLng);
      const marker = new google.maps.Marker({ position: latLng, map, label: { text: (idx + 1).toString(), color: "white", fontWeight: "bold" }, title: pt.name });
      marker.addListener("click", () => { infoWindow.setContent(`<div style="color:black;padding:5px;"><strong>#${idx+1}: ${pt.name}</strong></div>`); infoWindow.open(map, marker); });
      mapMarkers.push(marker);
    });
    if (chkDirect.checked) {
      mapPolyline = new google.maps.Polyline({ path: pathCoords, strokeColor: "#6aa9ff", strokeWeight: 4 });
      mapPolyline.setMap(map);
    } else {
      const CHUNK_SIZE = 24; //
      for (let i = 0; i < pathCoords.length - 1; i += CHUNK_SIZE) {
        const chunk = pathCoords.slice(i, i + CHUNK_SIZE + 1);
        const renderer = new google.maps.DirectionsRenderer({ map, suppressMarkers: true, polylineOptions: { strokeColor: "#6aa9ff", strokeWeight: 5 } });
        directionsRenderers.push(renderer);
        directionsService.route({ origin: chunk[0], destination: chunk[chunk.length-1], waypoints: chunk.slice(1, -1).map(l => ({ location: l, stopover: true })), travelMode: google.maps.TravelMode[currentTravelMode] }, (res, stat) => { if (stat === "OK") renderer.setDirections(res); });
      }
    }
    map.fitBounds(bounds);
  }

  // --- DATA & GEOCODING ---
  async function geocodeMissingPoints(pts) {
    const missing = pts.filter(p => p.lat === null);
    for (let i = 0; i < missing.length; i++) {
      const p = missing[i];
      setStatus(`Locating (${i+1}/${missing.length}): ${p.name}`, "warn");
      const res = await new Promise(r => { geocoder.geocode({ address: p.name }, (results, stat) => r(stat === "OK" ? results[0].geometry.location : null)); });
      if (res) { p.lat = res.lat(); p.lon = res.lng(); }
      await sleep(300); //
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
        const parts = raw.split('|'); const m1 = coordRe.exec(parts[1]);
        if (m1) { name = parts[0].trim(); lat = parseFloat(m1[1]); lon = parseFloat(m1[2]); }
      } else {
        const m = coordRe.exec(raw); if (m) { lat = parseFloat(m[1]); lon = parseFloat(m[2]); name = raw.replace(m[0], '').replace(/^,/, '').trim() || "Stop"; }
      }
      if (isStart) startIdx = pts.length;
      pts.push({ name, lat, lon });
    });
    return { pts, startIdx };
  }

  async function run(profile) {
    showView('map'); if (!window.google) { loadGoogleMaps(); setStatus("Loading Maps...", "warn"); return; }
    saveState(); let { pts, startIdx } = parseStops(inputEl.value);
    pts = await geocodeMissingPoints(pts);
    const valid = pts.filter(p => p.lat !== null);
    if (valid.length < 2) { setStatus("Add at least 2 locations.", "bad"); return; }
    setStatus(`Optimizing ${valid.length} stops...`, "warn");
    worker.postMessage({ type: 'solve', profile, points: valid, startIdx, roundTrip: chkRoundTrip.checked });
  }

  worker.onmessage = (ev) => {
    if (ev.data.type === 'result') {
      lastSolvedPoints = ev.data.pointsSorted;
      routeList.innerHTML = lastSolvedPoints.map(p => `<li>${p.name}</li>`).join('');
      distKmEl.textContent = ev.data.totalKm.toFixed(2) + ' km';
      savedKmEl.textContent = (ev.data.baseKm - ev.data.totalKm).toFixed(2) + ' km';
      renderLinks(lastSolvedPoints);
      updateMapVisualization(lastSolvedPoints); setStatus("Route optimized!", "ok");
    }
  };

  function renderLinks(pts) {
    linksEl.innerHTML = ''; if (!pts) return;
    const aiBtn = document.createElement('button');
    aiBtn.innerHTML = '✨ Ask AI: "Is this order logical?"'; aiBtn.className = 'secondary'; aiBtn.style.width = '100%'; aiBtn.style.marginBottom = '10px'; aiBtn.style.border = '1px dashed var(--accent)';
    aiBtn.addEventListener('click', () => { chatInput.value = "Review this route for logical flow: " + pts.map(p => p.name).join(' -> '); showView('chat'); });
    linksEl.appendChild(aiBtn);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${pts[0].lat},${pts[0].lon}&destination=${pts[pts.length-1].lat},${pts[pts.length-1].lon}&waypoints=${pts.slice(1,-1).map(p=>`${p.lat},${p.lon}`).join('|')}&travelmode=${currentTravelMode.toLowerCase()}`;
    linksEl.innerHTML += `<div class="linkrow"><span class="badge">Maps</span><a href="${url}" target="_blank">Open in Maps ↗</a></div>`;
  }

  // --- TRIP LIBRARY ---
  function initTripTree() {
    if (!window.TRIP_LIBRARY || !presetTree) return;
    presetTree.innerHTML = '';
    window.TRIP_LIBRARY.forEach(region => {
      const header = document.createElement('div'); header.className = 'tree-header';
      header.innerHTML = `<span class="tree-icon">[+]</span> ${region.region}`;
      const group = document.createElement('div'); group.className = 'tree-group'; group.style.display = 'none';
      region.categories.forEach(cat => {
        const cHeader = document.createElement('div'); cHeader.className = 'tree-header';
        cHeader.innerHTML = `<span class="tree-icon">[+]</span> ${cat.name}`;
        const cGroup = document.createElement('div'); cGroup.className = 'tree-group'; cGroup.style.display = 'none';
        cat.items.forEach(trip => {
          const item = document.createElement('span'); item.className = 'tree-item'; item.textContent = trip.label;
          item.addEventListener('click', () => { inputEl.value = trip.data; if(trip.id.includes('GLOBAL')) chkDirect.checked = true; else chkDirect.checked = false; saveState(); setStatus(`Loaded: ${trip.label}`, "ok"); });
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

  function filterLibrary(query) {
    const q = query.toLowerCase().trim();
    const allItems = presetTree.querySelectorAll('.tree-item');
    allItems.forEach(item => {
      const match = item.textContent.toLowerCase().includes(q);
      item.style.display = match ? 'block' : 'none';
      if (match && q) {
        let p = item.parentElement;
        while (p && p !== presetTree) { if (p.classList.contains('tree-group')) { p.style.display = 'block'; } p = p.parentElement; }
      }
    });
  }

  // --- AI LOGIC ---
  async function initModelSelector() {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const data = await res.json();
      const valid = data.models.filter(m => m.name.includes('gemini') && !/vision|banana|tts|image/i.test(m.name));
      modelSelector.innerHTML = valid.map(m => `<option value="${m.name}">${m.displayName || m.name.split('/').pop()}</option>`).join('');
      currentGeminiModel = valid[0]?.name;
    } catch (e) { console.warn("AI failed."); }
  }

  async function callGeminiAPI(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ role: "user", parts: [{ text: "System: You are a Travel AI. Use {ADD: Place Name} to add stops." }]}, ...chatHistoryBuffer, { role: "user", parts: [{ text: prompt }] }] };
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    const aiText = data.candidates[0].content.parts[0].text;
    chatHistoryBuffer.push({ role: "user", parts: [{ text: prompt }] }, { role: "model", parts: [{ text: aiText }] });
    return aiText;
  }

  // --- STATE & LISTENERS ---
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: inputEl.value, mode: currentTravelMode })); }
  function restoreState() { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (s) { inputEl.value = s.text; currentTravelMode = s.mode || 'DRIVING'; } }

  const initListeners = () => {
    btnChatToggle.addEventListener('click', (e) => { e.preventDefault(); showView('chat'); });
    btnAbout.addEventListener('click', (e) => { e.preventDefault(); showView('about'); });
    btnHelp.addEventListener('click', (e) => { e.preventDefault(); showView('help'); });
    btnCloseChat.addEventListener('click', () => showView('map'));
    btnCloseHelp.addEventListener('click', () => showView('map'));
    btnEnableMapInitial.addEventListener('click', loadGoogleMaps);
    btnStartAIChat.addEventListener('click', (e) => { e.preventDefault(); showView('chat'); });
    btnStandard.addEventListener('click', () => run('standard'));
    btnDeep.addEventListener('click', () => run('deep'));
    btnDriving.addEventListener('click', () => { currentTravelMode = 'DRIVING'; saveState(); if(lastSolvedPoints) updateMapVisualization(lastSolvedPoints); });
    btnWalking.addEventListener('click', () => { currentTravelMode = 'WALKING'; saveState(); if(lastSolvedPoints) updateMapVisualization(lastSolvedPoints); });
    btnCollapse.addEventListener('click', () => { leftPanel.classList.add('collapsed'); btnExpand.style.display = 'flex'; });
    btnExpand.addEventListener('click', () => { leftPanel.classList.remove('collapsed'); btnExpand.style.display = 'none'; });
    tripSearch.addEventListener('input', (e) => filterLibrary(e.target.value));
    btnSendChat.addEventListener('click', async () => {
      const txt = chatInput.value; if(!txt) return; chatInput.value = '';
      chatHistory.innerHTML += `<div class="chat-msg user"><strong>You:</strong><br>${txt}</div>`;
      const resp = await callGeminiAPI(txt); const addRegex = /\{ADD:\s*(.*?)\}/gi; let match;
      while ((match = addRegex.exec(resp)) !== null) { inputEl.value += (inputEl.value.trim() ? '\n' : '') + match[1]; saveState(); }
      chatHistory.innerHTML += `<div class="chat-msg ai"><strong>AI:</strong><br>${resp.replace(addRegex, '✅ Added: $1')}</div>`;
      chatHistory.scrollTop = chatHistory.scrollHeight;
    });
    inputEl.addEventListener('input', saveState);
  };

  initListeners(); initTripTree(); initModelSelector(); showView('map');
})();
