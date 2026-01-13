(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  
  // --- CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA';
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  // --- UI ELEMENTS ---
  const inputEl = $('input'), statusEl = $('status'), btnStandard = $('btnStandard'), btnDeep = $('btnDeep');
  const btnDriving = $('btnDriving'), btnWalking = $('btnWalking');
  const routeList = $('routeList'), distKmEl = $('distKm'), savedKmEl = $('savedKm'), linksEl = $('links');
  const chkRoundTrip = $('chkRoundTrip'), chkDirect = $('chkDirect'), chkGoogleStyle = $('chkGoogleStyle');
  const mapDiv = $('map'), mapPlaceholder = $('mapPlaceholder'), mapContainer = $('mapContainer');
  const presetTree = $('presetTree'), chatPanel = $('chatPanel'), chatInput = $('chatInput');
  const btnSendChat = $('btnSendChat'), chatHistory = $('chatHistory'), modelSelector = $('modelSelector');
  
  const btnChatToggle = $('btnChatToggle'), btnCloseChat = $('btnCloseChat');
  const btnAbout = $('btnAbout'), btnHelp = $('btnHelp'), helpOverlay = $('helpOverlay'), helpBody = $('helpBody'), btnCloseHelp = $('btnCloseHelp');
  const btnEnableMapInitial = $('btnEnableMapInitial'), btnStartAIChat = $('btnStartAIChat');

  const worker = new Worker('worker.js');
  let map, geocoder, directionsService, directionsRenderers = [], mapMarkers = [], mapPolyline = null, infoWindow = null;
  let lastSolvedPoints = null, chatHistoryBuffer = [], currentGeminiModel = '', currentTravelMode = 'DRIVING';
  const STORAGE_KEY = '8z_trip_backup_v1';

  const CUSTOM_DARK_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  ];

  // --- NAVIGATION & UI ---
  function showView(view) {
    mapContainer.style.display = 'none';
    chatPanel.style.display = 'none';
    helpOverlay.classList.remove('active');
    if (view === 'map') mapContainer.style.display = 'block';
    else if (view === 'chat') chatPanel.style.display = 'flex';
    else if (view === 'help' || view === 'about') {
      helpOverlay.classList.add('active');
      helpBody.innerHTML = view === 'help' ? window.HELP_CONTENT : window.ABOUT_CONTENT;
    }
  }

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (cls ? (' ' + cls) : '');
  }

  // --- MAP CORE ---
  function loadGoogleMaps() {
    if (window.google && window.google.maps) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap&loading=async&v=weekly`;
    document.body.appendChild(script);
  }

  window.initMap = function() {
    map = new google.maps.Map(mapDiv, { zoom: 12, center: { lat: 46.0569, lng: 14.5058 }, mapTypeId: 'hybrid', styles: CUSTOM_DARK_STYLE });
    geocoder = new google.maps.Geocoder(); 
    directionsService = new google.maps.DirectionsService();
    infoWindow = new google.maps.InfoWindow();
    mapPlaceholder.style.display = 'none';
    mapDiv.style.display = 'block';
    restoreState();
  };

  function updateMapVisualization(points) {
    if (!map) return;
    mapMarkers.forEach(m => m.setMap(null)); mapMarkers = [];
    if (mapPolyline) mapPolyline.setMap(null);
    directionsRenderers.forEach(dr => dr.setMap(null)); directionsRenderers = [];

    const pathCoords = [];
    const bounds = new google.maps.LatLngBounds();

    points.forEach((pt, idx) => {
      const latLng = { lat: pt.lat, lng: pt.lon };
      pathCoords.push(latLng); bounds.extend(latLng);
      const marker = new google.maps.Marker({
        position: latLng, map, label: { text: (idx + 1).toString(), color: "white" }, title: pt.name
      });
      marker.addListener("click", () => {
        infoWindow.setContent(`<div style="color:black;padding:5px;"><strong>#${idx+1}: ${pt.name}</strong></div>`);
        infoWindow.open(map, marker);
      });
      mapMarkers.push(marker);
    });

    if (chkDirect.checked) {
      mapPolyline = new google.maps.Polyline({ path: pathCoords, strokeColor: "#6aa9ff", strokeWeight: 4 });
      mapPolyline.setMap(map);
    } else {
      const renderer = new google.maps.DirectionsRenderer({ map, suppressMarkers: true, polylineOptions: { strokeColor: "#6aa9ff", strokeWeight: 5 } });
      directionsRenderers.push(renderer);
      directionsService.route({
        origin: pathCoords[0], destination: chkRoundTrip.checked ? pathCoords[0] : pathCoords[pathCoords.length-1],
        waypoints: pathCoords.slice(1, chkRoundTrip.checked ? undefined : -1).map(l => ({ location: l, stopover: true })),
        travelMode: google.maps.TravelMode[currentTravelMode]
      }, (res, stat) => { if (stat === "OK") renderer.setDirections(res); });
    }
    map.fitBounds(bounds);
  }

  // --- DATA & GEOCODING ---
  async function geocodeMissingPoints(pts) {
    for (let p of pts) {
      if (p.lat === null) {
        const res = await new Promise(r => geocoder.geocode({ address: p.name }, (results, stat) => r(stat === "OK" ? results[0].geometry.location : null)));
        if (res) { p.lat = res.lat(); p.lon = res.lng(); }
      }
    }
    return pts;
  }

  function parsePoint(line) {
    let raw = line.trim();
    if (!raw || raw.startsWith('#')) return null;
    let isStart = /\bSTART\b/i.test(raw);
    raw = raw.replace(/\bSTART\b/i, '').trim();
    const coordMatch = raw.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    return { name: raw, lat: coordMatch ? parseFloat(coordMatch[1]) : null, lon: coordMatch ? parseFloat(coordMatch[2]) : null, isStart };
  }

  // --- OPTIMIZER RUN ---
  async function run(profile) {
    showView('map');
    if (!window.google) { loadGoogleMaps(); setStatus("Loading Maps...", "warn"); return; }
    saveState();
    let { pts } = { pts: inputEl.value.split('\n').map(parsePoint).filter(p => p) };
    setStatus("Geocoding addresses...", "warn");
    pts = await geocodeMissingPoints(pts);
    const valid = pts.filter(p => p.lat !== null);
    if (valid.length < 2) { setStatus("Need 2+ valid stops", "bad"); return; }
    const startIdx = Math.max(0, pts.findIndex(p => p.isStart));
    worker.postMessage({ type: 'solve', profile, points: valid, startIdx, roundTrip: chkRoundTrip.checked });
  }

  worker.onmessage = (ev) => {
    if (ev.data.type === 'result') {
      lastSolvedPoints = ev.data.pointsSorted;
      routeList.innerHTML = lastSolvedPoints.map(p => `<li>${p.name}</li>`).join('');
      distKmEl.textContent = ev.data.totalKm.toFixed(2) + ' km';
      savedKmEl.textContent = (ev.data.baseKm - ev.data.totalKm).toFixed(2) + ' km';
      updateMapVisualization(lastSolvedPoints);
      setStatus("Optimized.", "ok");
    }
  };

  // --- AI LOGIC ---
  async function initModelSelector() {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const data = await res.json();
      const valid = data.models.filter(m => m.name.includes('gemini') && !/vision|banana|tts|image/i.test(m.name));
      modelSelector.innerHTML = valid.map(m => `<option value="${m.name}">${m.displayName || m.name.split('/').pop()}</option>`).join('');
      currentGeminiModel = valid[0]?.name;
    } catch (e) { console.warn("Models failed"); }
  }

  async function callGeminiAPI(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [...chatHistoryBuffer, { role: "user", parts: [{ text: `System: Use {ADD: Place Name} to add stops. User: ${prompt}` }] }] };
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    const aiText = data.candidates[0].content.parts[0].text;
    chatHistoryBuffer.push({ role: "model", parts: [{ text: aiText }] });
    return aiText;
  }

  // --- STATE & INIT ---
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: inputEl.value, mode: currentTravelMode })); }
  function restoreState() { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (s) { inputEl.value = s.text; currentTravelMode = s.mode || 'DRIVING'; } }

  // --- EVENT LISTENERS ---
  btnEnableMapInitial.addEventListener('click', loadGoogleMaps);
  btnStartAIChat.addEventListener('click', () => showView('chat'));
  btnStandard.addEventListener('click', () => run('standard'));
  btnDeep.addEventListener('click', () => run('deep'));
  btnDriving.addEventListener('click', () => { currentTravelMode = 'DRIVING'; if(lastSolvedPoints) updateMapVisualization(lastSolvedPoints); });
  btnWalking.addEventListener('click', () => { currentTravelMode = 'WALKING'; if(lastSolvedPoints) updateMapVisualization(lastSolvedPoints); });
  btnSendChat.addEventListener('click', async () => {
    const txt = chatInput.value; chatInput.value = '';
    chatHistory.innerHTML += `<div class="chat-msg user"><strong>You:</strong><br>${txt}</div>`;
    const resp = await callGeminiAPI(txt);
    const addRegex = /\{ADD:\s*(.*?)\}/gi; let match;
    while ((match = addRegex.exec(resp)) !== null) { inputEl.value += `\n${match[1]}`; saveState(); }
    chatHistory.innerHTML += `<div class="chat-msg ai"><strong>AI:</strong><br>${resp.replace(addRegex, '✅ Added: $1')}</div>`;
    chatHistory.scrollTop = chatHistory.scrollHeight;
  });

  // Init Global Functions for Library
  window.addStopToRoute = (loc) => { inputEl.value += `\n${loc}`; saveState(); };

  initModelSelector(); restoreState(); showView('map');
  if (window.TRIP_LIBRARY) { /* Library init logic from app_ok.js should go here */ }
})();
