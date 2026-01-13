(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  
  // --- CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA'; 
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  // --- UI ELEMENTS ---
  const inputEl = $('input'), statusEl = $('status'), btnStandard = $('btnStandard'), btnDeep = $('btnDeep');
  const tripSearch = $('tripSearch'), routeList = $('routeList'), distKmEl = $('distKm'), linksEl = $('links');
  const chkRoundTrip = $('chkRoundTrip'), btnEnableMap = $('btnEnableMap'), mapDiv = $('map');
  const presetTree = $('presetTree'), chatPanel = $('chatPanel'), mapContainer = $('mapContainer');
  const chatInput = $('chatInput'), btnSendChat = $('btnSendChat'), chatHistory = $('chatHistory'), modelSelector = $('modelSelector');

  const worker = new Worker('worker.js');
  let map, geocoder, infoWindow, lastSolvedPoints = null, chatHistoryBuffer = [], currentGeminiModel = '';
  const STORAGE_KEY = '8z_trip_backup_v1';

  // --- MAP & LIBRARY ---
  function loadGoogleMaps() {
    if (window.google && window.google.maps) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap&loading=async&v=weekly`;
    document.body.appendChild(script);
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
          item.addEventListener('click', () => { inputEl.value = trip.data; saveState(); });
          cGroup.appendChild(item);
        });
        cHeader.addEventListener('click', () => { cGroup.classList.toggle('open'); });
        group.appendChild(cHeader); group.appendChild(cGroup);
      });
      header.addEventListener('click', () => { group.classList.toggle('open'); });
      presetTree.appendChild(header); presetTree.appendChild(group);
    });
  }

  // --- MODERN MODEL FILTERING (2026) ---
  async function initModelSelector() {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const data = await res.json();
      if (!data.models) return;

      // Filter: Strictly Chat/Text models. Exclude Image (Nano Banana) and Audio-only.
      const valid = data.models.filter(m => 
        m.name.includes('gemini') && 
        !m.name.includes('image') && 
        !m.name.includes('vision') && 
        !m.name.includes('banana') && 
        !m.name.includes('tts')
      );

      // Sort: Highest version (3 > 2.5 > 2.0)
      valid.sort((a, b) => {
        const getV = (n) => {
          const match = n.match(/gemini-(\d+(\.\d+)?)/);
          return match ? parseFloat(match[1]) : 0;
        };
        return getV(b.name) - getV(a.name);
      });

      modelSelector.innerHTML = '';
      valid.forEach(m => {
        const opt = document.createElement('option'); opt.value = m.name;
        opt.textContent = m.displayName || m.name.split('/').pop();
        modelSelector.appendChild(opt);
      });
      
      // Auto-set default to the newest generation (Gemini 3 or 2.5)
      if (valid.length > 0) {
        currentGeminiModel = valid[0].name;
        modelSelector.value = currentGeminiModel;
      }
      modelSelector.addEventListener('change', () => currentGeminiModel = modelSelector.value);
    } catch (e) { console.warn("Model fetch failed"); }
  }

  async function callGeminiAPI(prompt) {
    if (!currentGeminiModel) return "Error: Select a model first.";
    const url = `https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`;
    chatHistoryBuffer.push({ role: "user", parts: [{ text: prompt }] });
    
    const payload = { 
      contents: [{ role: "user", parts: [{ text: "You are the AI Assistant. Use {ADD: Place Name} to add stops." }]}, ...chatHistoryBuffer],
      safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }]
    };

    const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    
    if (data.error) return "Error: " + data.error.message;
    if (!data.candidates || data.candidates.length === 0) return "AI refused to answer. Try a different question.";

    const aiText = data.candidates[0].content.parts[0].text;
    chatHistoryBuffer.push({ role: "model", parts: [{ text: aiText }] });
    return aiText;
  }

  // --- RESULTS & ASK AI BUTTON ---
  function renderLinks(links) {
    linksEl.innerHTML = '';
    if (lastSolvedPoints) {
      const aiBtn = document.createElement('button');
      aiBtn.innerHTML = '✨ Ask AI: "Is this order logical?"';
      aiBtn.className = 'secondary'; aiBtn.style.width = '100%'; aiBtn.style.marginBottom = '10px';
      aiBtn.addEventListener('click', () => {
        chatInput.value = "Review this itinerary for logic:\n" + lastSolvedPoints.map((pt, i) => `${i+1}. ${pt.name}`).join('\n');
        chatPanel.style.display = 'flex'; mapContainer.style.display = 'none'; chatInput.focus();
      });
      linksEl.appendChild(aiBtn);
    }
    links.forEach(L => {
      const row = document.createElement('div'); row.className = 'linkrow';
      row.innerHTML = `<span class="badge">${L.label}</span> <a href="${L.url}" target="_blank">Open in Maps ↗</a>`;
      linksEl.appendChild(row);
    });
  }

  async function run(profile) {
    if (!window.google) { loadGoogleMaps(); return; }
    worker.postMessage({ type: 'solve', profile, points: inputEl.value.split('\n').map(l => ({ name: l.trim() })).filter(p => p.name), roundTrip: chkRoundTrip.checked });
  }

  worker.onmessage = (ev) => {
    lastSolvedPoints = ev.data.pointsSorted;
    routeList.innerHTML = lastSolvedPoints.map(p => `<li>${p.name}</li>`).join('');
    renderLinks([{ label: 'Full Trip', url: '#' }]);
  };

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: inputEl.value })); }
  function restoreState() { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (s) inputEl.value = s.text || ''; }

  initTripTree(); initModelSelector();
  btnStandard.addEventListener('click', () => run('standard'));
  btnSendChat.addEventListener('click', async () => {
    const txt = chatInput.value; chatInput.value = '';
    const resp = await callGeminiAPI(txt);
    const div = document.createElement('div'); div.className = 'chat-msg ai'; div.innerHTML = `<strong>AI:</strong><br>${resp.replace(/\n/g, '<br>')}`;
    chatHistory.appendChild(div); chatHistory.scrollTop = chatHistory.scrollHeight;
  });
})();
