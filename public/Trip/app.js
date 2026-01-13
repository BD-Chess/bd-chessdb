(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  
  // --- CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA';
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  // --- UI ELEMENTS ---
  const inputEl = $('input'), statusEl = $('status'), btnStandard = $('btnStandard');
  const routeList = $('routeList'), distKmEl = $('distKm'), linksEl = $('links');
  const chkRoundTrip = $('chkRoundTrip'), mapDiv = $('map'), mapPlaceholder = $('mapPlaceholder');
  const presetTree = $('presetTree'), chatPanel = $('chatPanel'), mapContainer = $('mapContainer');
  const chatInput = $('chatInput'), btnSendChat = $('btnSendChat'), chatHistory = $('chatHistory'), modelSelector = $('modelSelector');
  
  // Navigation & Landing Buttons
  const btnChatToggle = $('btnChatToggle'), btnCloseChat = $('btnCloseChat');
  const btnAbout = $('btnAbout'), btnHelp = $('btnHelp'), helpOverlay = $('helpOverlay'), helpBody = $('helpBody'), btnCloseHelp = $('btnCloseHelp');
  const btnEnableMapInitial = $('btnEnableMapInitial'), btnStartAIChat = $('btnStartAIChat');

  const worker = new Worker('worker.js');
  let map, geocoder, infoWindow, lastSolvedPoints = null, chatHistoryBuffer = [], currentGeminiModel = '';
  const STORAGE_KEY = '8z_trip_backup_v1';

  // --- NAVIGATION LOGIC ---
  function showView(view) {
    mapContainer.style.display = 'none';
    chatPanel.style.display = 'none';
    helpOverlay.classList.remove('active');

    if (view === 'map') {
      mapContainer.style.display = 'block';
    } else if (view === 'chat') {
      chatPanel.style.display = 'flex';
    } else if (view === 'help' || view === 'about') {
      helpOverlay.classList.add('active');
      helpBody.innerHTML = view === 'help' ? window.HELP_CONTENT : window.ABOUT_CONTENT;
    }
  }

  // --- MAP & LIBRARY ---
  function loadGoogleMaps() {
    if (window.google && window.google.maps) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap&loading=async&v=weekly`;
    document.body.appendChild(script);
    mapPlaceholder.style.display = 'none';
    mapDiv.style.display = 'block';
  }

  window.initMap = function() {
    map = new google.maps.Map(mapDiv, { zoom: 12, center: { lat: 46.0569, lng: 14.5058 }, mapTypeId: 'hybrid' });
    geocoder = new google.maps.Geocoder(); infoWindow = new google.maps.InfoWindow();
    restoreState();
  };

  function initTripTree() {
    if (!window.TRIP_LIBRARY || !presetTree) return;
    presetTree.innerHTML = '';
    window.TRIP_LIBRARY.forEach(region => {
      const header = document.createElement('div'); header.className = 'tree-header';
      header.innerHTML = `<span class="tree-icon">[+]</span> ${region.region}`;
      const group = document.createElement('div'); group.className = 'tree-group';
      region.categories.forEach(cat => {
        const cHeader = document.createElement('div'); cHeader.className = 'tree-header';
        cHeader.innerHTML = `<span class="tree-icon">[+]</span> ${cat.name}`;
        const cGroup = document.createElement('div'); cGroup.className = 'tree-group';
        cat.items.forEach(trip => {
          const item = document.createElement('span'); item.className = 'tree-item'; item.textContent = trip.label;
          item.addEventListener('click', () => { 
            inputEl.value = trip.data; 
            saveState(); 
            statusEl.textContent = `Loaded: ${trip.label}`;
            statusEl.className = "status ok";
          });
          cGroup.appendChild(item);
        });
        cHeader.addEventListener('click', (e) => { 
            e.stopPropagation();
            cGroup.classList.toggle('open'); 
            cHeader.querySelector('.tree-icon').textContent = cGroup.classList.contains('open') ? '[-]' : '[+]';
        });
        group.appendChild(cHeader); group.appendChild(cGroup);
      });
      header.addEventListener('click', () => { 
          group.classList.toggle('open'); 
          header.querySelector('.tree-icon').textContent = group.classList.contains('open') ? '[-]' : '[+]';
      });
      presetTree.appendChild(header); presetTree.appendChild(group);
    });
  }

  // --- AI LOGIC ---
  async function initModelSelector() {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const data = await res.json();
      const valid = data.models.filter(m => m.name.includes('gemini') && !/vision|banana|tts|image/i.test(m.name));
      valid.sort((a, b) => b.name.localeCompare(a.name));
      modelSelector.innerHTML = '';
      valid.forEach(m => {
        const opt = document.createElement('option'); opt.value = m.name;
        opt.textContent = m.displayName || m.name.split('/').pop();
        modelSelector.appendChild(opt);
      });
      if (valid.length > 0) { currentGeminiModel = valid[0].name; modelSelector.value = currentGeminiModel; }
      modelSelector.addEventListener('change', () => currentGeminiModel = modelSelector.value);
    } catch (e) { console.warn("Model fetch failed"); }
  }

  async function callGeminiAPI(prompt) {
    if (!currentGeminiModel) return "Error: Select a model first.";
    const url = `https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`;
    chatHistoryBuffer.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { 
      contents: [{ role: "user", parts: [{ text: "You are the AI Travel Assistant. If suggesting places, you MUST use the format {ADD: Place Name}." }]}, ...chatHistoryBuffer]
    };
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.error) return "Error: " + data.error.message;
    const aiText = data.candidates[0].content.parts[0].text;
    chatHistoryBuffer.push({ role: "model", parts: [{ text: aiText }] });
    return aiText;
  }

  // --- CORE UTILS ---
  window.addStopToRoute = function(loc) {
    const currentVal = inputEl.value.trim();
    inputEl.value = currentVal + (currentVal ? '\n' : '') + loc;
    saveState();
  };

  async function run(profile) {
    showView('map');
    if (!window.google) loadGoogleMaps();
    saveState();
    const pts = inputEl.value.split('\n').map(l => ({ name: l.trim() })).filter(p => p.name);
    if(pts.length === 0) { statusEl.textContent = "Error: Input is empty"; return; }
    worker.postMessage({ type: 'solve', profile, points: pts, roundTrip: chkRoundTrip.checked });
  }

  worker.onmessage = (ev) => {
    lastSolvedPoints = ev.data.pointsSorted;
    routeList.innerHTML = lastSolvedPoints.map(p => `<li>${p.name}</li>`).join('');
    distKmEl.textContent = ev.data.totalKm.toFixed(2) + ' km';
    linksEl.innerHTML = `<div class="linkrow"><span class="badge">Full Trip</span> <a href="#" target="_blank">Open in Maps ↗</a></div>`;
  };

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: inputEl.value })); }
  function restoreState() { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (s) inputEl.value = s.text || ''; }

  // --- EVENT LISTENERS ---
  btnEnableMapInitial.addEventListener('click', loadGoogleMaps);
  btnStartAIChat.addEventListener('click', () => showView('chat'));
  btnChatToggle.addEventListener('click', (e) => { e.preventDefault(); showView('chat'); });
  btnCloseChat.addEventListener('click', () => showView('map'));
  btnAbout.addEventListener('click', (e) => { e.preventDefault(); showView('about'); });
  btnHelp.addEventListener('click', (e) => { e.preventDefault(); showView('help'); });
  btnCloseHelp.addEventListener('click', () => showView('map'));
  btnStandard.addEventListener('click', () => run('standard'));

  btnSendChat.addEventListener('click', async () => {
    const txt = chatInput.value; if(!txt) return;
    chatInput.value = '';
    const userDiv = document.createElement('div'); userDiv.className = 'chat-msg user';
    userDiv.innerHTML = `<strong>You:</strong><br>${txt}`;
    chatHistory.appendChild(userDiv);

    const resp = await callGeminiAPI(txt);
    const addRegex = /\{ADD:\s*(.*?)\}/gi;
    let match, addedCount = 0;
    while ((match = addRegex.exec(resp)) !== null) {
      if (match[1].trim()) { window.addStopToRoute(match[1].trim()); addedCount++; }
    }

    const aiDiv = document.createElement('div'); aiDiv.className = 'chat-msg ai';
    let formattedText = resp.replace(/\n/g, '<br>').replace(addRegex, (m, p1) => `<span style="color:var(--accent2); font-weight:bold;">✅ Added: ${p1}</span>`);
    aiDiv.innerHTML = `<strong>AI:</strong><br>${formattedText}`;
    chatHistory.appendChild(aiDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    if(addedCount > 0) { statusEl.textContent = `AI added ${addedCount} stop(s).`; statusEl.className = "status ok"; }
  });

  initTripTree();
  initModelSelector();
  showView('map');
  inputEl.addEventListener('input', saveState);
})();
