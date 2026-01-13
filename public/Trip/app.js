(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  
  // --- CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA';
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  // --- UI ELEMENTS ---
  const inputEl = $('input'), statusEl = $('status'), btnStandard = $('btnStandard'), btnDeep = $('btnDeep');
  const routeList = $('routeList'), distKmEl = $('distKm'), savedKmEl = $('savedKm'), linksEl = $('links');
  const chkRoundTrip = $('chkRoundTrip'), chkDirect = $('chkDirect');
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

  // --- NAVIGATION LOGIC (The Fix) ---
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

  // --- EVENT LISTENERS (Fixed with e.preventDefault) ---
  const initListeners = () => {
    // Top Navigation
    btnChatToggle.addEventListener('click', (e) => { e.preventDefault(); showView('chat'); });
    btnAbout.addEventListener('click', (e) => { e.preventDefault(); showView('about'); });
    btnHelp.addEventListener('click', (e) => { e.preventDefault(); showView('help'); });
    
    // UI Closers
    btnCloseChat.addEventListener('click', () => showView('map'));
    btnCloseHelp.addEventListener('click', (e) => { e.preventDefault(); showView('map'); });

    // Landing Page
    btnEnableMapInitial.addEventListener('click', loadGoogleMaps);
    btnStartAIChat.addEventListener('click', () => showView('chat'));

    // Optimizer
    btnStandard.addEventListener('click', () => run('standard'));
    btnDeep.addEventListener('click', () => run('deep'));
    $('btnDriving').addEventListener('click', () => { currentTravelMode = 'DRIVING'; if(lastSolvedPoints) updateMapVisualization(lastSolvedPoints); });
    $('btnWalking').addEventListener('click', () => { currentTravelMode = 'WALKING'; if(lastSolvedPoints) updateMapVisualization(lastSolvedPoints); });
  };

  // --- REST OF THE LOGIC (Map, AI, Worker) ---
  function loadGoogleMaps() {
    if (window.google && window.google.maps) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap&loading=async&v=weekly`;
    document.body.appendChild(script);
  }

  window.initMap = function() {
    map = new google.maps.Map(mapDiv, { zoom: 12, center: { lat: 46.0569, lng: 14.5058 }, mapTypeId: 'hybrid' });
    geocoder = new google.maps.Geocoder(); 
    directionsService = new google.maps.DirectionsService();
    infoWindow = new google.maps.InfoWindow();
    mapPlaceholder.style.display = 'none';
    mapDiv.style.display = 'block';
    restoreState();
  };

  async function run(profile) {
    showView('map');
    if (!window.google) { loadGoogleMaps(); return; }
    const pts = inputEl.value.split('\n').map(l => ({ name: l.trim(), lat: null })).filter(p => p.name);
    worker.postMessage({ type: 'solve', profile, points: pts, roundTrip: chkRoundTrip.checked });
  }

  worker.onmessage = (ev) => {
    lastSolvedPoints = ev.data.pointsSorted;
    routeList.innerHTML = lastSolvedPoints.map(p => `<li>${p.name}</li>`).join('');
    distKmEl.textContent = ev.data.totalKm.toFixed(2) + ' km';
  };

  async function callGeminiAPI(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [...chatHistoryBuffer, { role: "user", parts: [{ text: prompt }] }] };
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    const aiText = data.candidates[0].content.parts[0].text;
    chatHistoryBuffer.push({ role: "model", parts: [{ text: aiText }] });
    return aiText;
  }

  btnSendChat.addEventListener('click', async () => {
    const txt = chatInput.value; chatInput.value = '';
    chatHistory.innerHTML += `<div class="chat-msg user"><strong>You:</strong><br>${txt}</div>`;
    const resp = await callGeminiAPI(txt);
    const addRegex = /\{ADD:\s*(.*?)\}/gi; let match;
    while ((match = addRegex.exec(resp)) !== null) { inputEl.value += `\n${match[1]}`; }
    chatHistory.innerHTML += `<div class="chat-msg ai"><strong>AI:</strong><br>${resp.replace(addRegex, '✅ Added: $1')}</div>`;
    chatHistory.scrollTop = chatHistory.scrollHeight;
  });

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: inputEl.value })); }
  function restoreState() { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (s) inputEl.value = s.text; }

  // START
  initListeners();
  showView('map'); // Initial State
})();
