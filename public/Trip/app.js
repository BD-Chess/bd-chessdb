(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  
  // --- CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA'; 
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  // --- UI ELEMENTS ---
  const inputEl = $('input'), statusEl = $('status'), btnStandard = $('btnStandard'), btnDeep = $('btnDeep');
  const btnCollapse = $('btnCollapse'), btnExpand = $('btnExpand'), leftPanel = $('leftPanel');
  const tripSearch = $('tripSearch'), routeList = $('routeList'), distKmEl = $('distKm'), savedKmEl = $('savedKm'), linksEl = $('links');
  const chkRoundTrip = $('chkRoundTrip'), btnDriving = $('btnDriving'), btnWalking = $('btnWalking'), chkDirect = $('chkDirect'), chkGoogleStyle = $('chkGoogleStyle'); 
  const mapContainer = $('mapContainer'), mapPlaceholder = $('mapPlaceholder'), btnEnableMap = $('btnEnableMap'), mapDiv = $('map');
  const presetTree = $('presetTree'), chatPanel = $('chatPanel'), btnCloseChat = $('btnCloseChat'), chatInput = $('chatInput'), btnSendChat = $('btnSendChat'), chatHistory = $('chatHistory'), modelSelector = $('modelSelector');

  const worker = new Worker('worker.js');
  let map, geocoder, infoWindow, lastSolvedPoints = null, currentTravelMode = 'DRIVING', chatHistoryBuffer = [], currentGeminiModel = '', presetLookup = {};
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
          presetLookup[trip.id] = trip.data;
          const item = document.createElement('span'); item.className = 'tree-item'; item.textContent = trip.label;
          item.addEventListener('click', () => { inputEl.value = trip.data; saveState(); });
          cGroup.appendChild(item);
        });
        cHeader.addEventListener('click', () => { cGroup.classList.toggle('open'); cHeader.querySelector('.tree-icon').textContent = cGroup.classList.contains('open') ? '[-]' : '[+]'; });
        group.appendChild(cHeader); group.appendChild(cGroup);
      });
      header.addEventListener('click', () => { group.classList.toggle('open'); header.querySelector('.tree-icon').textContent = group.classList.contains('open') ? '[-]' : '[+]'; });
      presetTree.appendChild(header); presetTree.appendChild(group);
    });
  }

  // --- 2026 SMART VERSION SORTING ---
  async function initModelSelector() {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const data = await res.json();
      if (!data.models) return;

      // Filter text models and sort by version (3.0 > 2.5 > 2.0 > 1.5)
      const valid = data.models.filter(m => m.name.includes('gemini') && !m.name.includes('embedding') && !m.name.includes('vision'));
      
      valid.sort((a, b) => {
        const getV = (name) => {
          const match = name.match(/gemini-(\d+(\.\d+)?)/i);
          return match ? parseFloat(match[1]) : 0;
        };
        const vA = getV(a.name);
        const vB = getV(b.name);
        if (vB !== vA) return vB - vA; // Primary sort: Version number
        return a.name.includes('pro') ? -1 : 1; // Secondary sort: Pro over Flash
      });

      modelSelector.innerHTML = '';
      valid.forEach(m => {
        const opt = document.createElement('option'); opt.value = m.name;
        opt.textContent = m.displayName || m.name.split('/').pop();
        modelSelector.appendChild(opt);
      });
      
      // Select the newest model (Gemini 3 Pro/Flash) automatically
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
    const payload = { contents: [{ role: "user", parts: [{ text: "You are the AI Assistant. Use {ADD: Place Name} tag." }]}, ...chatHistoryBuffer] };
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    if (!data.candidates) return "AI Error: Try a different model.";
    const aiText = data.candidates[0].content.parts[0].text;
    chatHistoryBuffer.push({ role: "model", parts: [{ text: aiText }] });
    return aiText;
  }

  // --- RESULTS & ASK AI BUTTON ---
  function renderLinks(links) {
    linksEl.innerHTML = '';
    if (lastSolvedPoints) {
      const aiBtn = document.createElement('button'); aiBtn.innerHTML = '✨ Ask AI: "Is this order logical?"';
      aiBtn.className = 'secondary'; aiBtn.style.width = '100%'; aiBtn.style.marginBottom = '10px';
      aiBtn.addEventListener('click', () => {
        chatInput.value = "I have optimized my trip. Is this order logical?\n" + lastSolvedPoints.map((pt, i) => `${i+1}. ${pt.name}`).join('\n');
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

  // --- WORKER & ENGINE ---
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
  window.addStopToRoute = function(loc) { inputEl.value += (inputEl.value.trim() ? '\n' : '') + loc; saveState(); };

  initTripTree(); initModelSelector();
  inputEl.addEventListener('input', saveState);
  btnEnableMap.addEventListener('click', loadGoogleMaps);
  btnStandard.addEventListener('click', () => run('standard'));
  btnSendChat.addEventListener('click', async () => {
    const txt = chatInput.value; chatInput.value = '';
    const resp = await callGeminiAPI(txt);
    const div = document.createElement('div'); div.className = 'chat-msg ai';
    div.innerHTML = `<strong>AI:</strong><br>${resp.replace(/\n/g, '<br>')}`;
    chatHistory.appendChild(div); chatHistory.scrollTop = chatHistory.scrollHeight;
  });
})();
