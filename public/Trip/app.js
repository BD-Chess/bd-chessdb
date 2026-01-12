(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  
  // --- CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA'; // Maps
  const GEMINI_API_KEY = 'AIzaSyC_dP04dW4oJt5LE51pCIh9nkeDwusw_4s'; // Chatbot

  // --- UI ELEMENTS ---
  const inputEl = $('input');
  const statusEl = $('status');
  const btnStandard = $('btnStandard');
  const btnDeep = $('btnDeep');
  
  // Panels & Toggles
  const btnCollapse = $('btnCollapse');
  const btnExpand = $('btnExpand');
  const leftPanel = $('leftPanel');

  // Files & Search
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

  // Map Elements
  const mapContainer = $('mapContainer');
  const mapPlaceholder = $('mapPlaceholder');
  const btnEnableMap = $('btnEnableMap'); 
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
  let pendingRunProfile = null; 
  let chatHistoryBuffer = []; 
  
  let presetLookup = {};
  const STORAGE_KEY = '8z_trip_backup_v1';

  const CUSTOM_DARK_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  ];

  // --- GOOGLE MAPS LAZY LOADER ---
  function loadGoogleMaps() {
    if (window.google && window.google.maps) return; // Already loaded

    if (btnEnableMap) {
        btnEnableMap.disabled = true;
        btnEnableMap.textContent = "Loading Maps API...";
    }
    
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap&loading=async&v=weekly`;
    script.defer = true;
    script.async = true;
    document.body.appendChild(script);
  }

  window.initMap = function() {
    const defaultCenter = { lat: 46.0569, lng: 14.5058 }; 
    
    map = new google.maps.Map(mapDiv, {
      zoom: 12,
      center: defaultCenter,
      mapTypeId: 'hybrid',
      mapTypeControl: true,
      styles: CUSTOM_DARK_STYLE,
    });

    geocoder = new google.maps.Geocoder();
    directionsService = new google.maps.DirectionsService();
    
    restoreState(); 

    setStatus('Maps API Loaded. Ready.', 'ok');
    
    if (btnEnableMap) btnEnableMap.parentElement.style.display = 'none'; 
    mapPlaceholder.style.display = 'none'; 
    mapDiv.style.display = 'block'; 

    if (pendingRunProfile) {
        run(pendingRunProfile);
        pendingRunProfile = null;
    }
  };

  // --- AI CHATBOT LOGIC ---
  
  function toggleChatMode(showChat) {
    if (showChat) {
      mapContainer.style.display = 'none';
      chatPanel.style.display = 'flex';
      btnChatToggle.style.color = '#fff';
      chatInput.focus();
    } else {
      chatPanel.style.display = 'none';
      mapContainer.style.display = 'block';
      btnChatToggle.style.color = ''; 
    }
  }

  async function handleSendChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendChatMessage('user', text);
    chatInput.value = '';
    
    const loadingId = appendChatMessage('ai', 'Gemini is thinking...', true);

    try {
      const response = await callGeminiAPI(text);
      
      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) loadingEl.remove();
      
      // PARSING: Look for {ADD: Place} commands
      let cleanResponse = response;
      const addRegex = /\{ADD:\s*(.*?)\}/g;
      let match;
      let addedPlaces = [];

      while ((match = addRegex.exec(response)) !== null) {
        const place = match[1].trim();
        addedPlaces.push(place);
        window.addStopToRoute(place); // Auto-add to trip
        // Remove the tag from the visible message
        cleanResponse = cleanResponse.replace(match[0], '');
      }

      if (addedPlaces.length > 0) {
        cleanResponse += `<br><br><em>(I added <strong>${addedPlaces.length} locations</strong> to your trip list automatically.)</em>`;
      }
      
      appendChatMessage('ai', cleanResponse);

    } catch (err) {
      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) loadingEl.remove();
      appendChatMessage('ai', "Error: Could not connect to Gemini. " + err.message);
    }
  }

  function appendChatMessage(role, text, isLoading = false) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    if (isLoading) div.id = 'chat-loading-' + Date.now();
    
    const label = role === 'user' ? 'You' : 'Gemini';
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\n/g, '<br>');

    div.innerHTML = `<strong>${label}:</strong><br>${formattedText}`;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return div.id;
  }

  async function callGeminiAPI(userPrompt) {
    // UPDATED URL: Changed to 'gemini-pro' to fix the 404 Error
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    chatHistoryBuffer.push({ role: "user", parts: [{ text: userPrompt }] });
    if (chatHistoryBuffer.length > 10) chatHistoryBuffer.shift();

    // SYSTEM PROMPT: Teaches AI about the app and the {ADD: ...} tool
    const systemPrompt = {
      role: "user",
      parts: [{ text: `You are the AI Assistant for '8Z-RP Trip Optimizer'. 
      CONTEXT:
      - This is a high-performance, privacy-focused, client-side Trip Optimizer using deterministic TSP math.
      - Users can add stops to a list and optimize the route.
      
      YOUR GOAL:
      - Help users find locations, hidden gems, or itinerary ideas.
      - Be concise and helpful.
      
      TOOL USE:
      - If the user asks to add a specific place to their trip (or if you suggest specific places they definitely want), you MUST append this special tag to the end of your response: {ADD: Place Name}
      - Example: "The Tivoli Park is great. {ADD: Tivoli Park, Ljubljana}"
      - You can add multiple tags if needed.` }]
    };

    const payload = {
      contents: [systemPrompt, ...chatHistoryBuffer]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`API Status ${response.status}`);

    const data = await response.json();
    const aiText = data.candidates[0].content.parts[0].text;
    
    chatHistoryBuffer.push({ role: "model", parts: [{ text: aiText }] });
    
    return aiText;
  }

  // --- AUTO-SAVE SYSTEM ---
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  const saveState = debounce(() => {
    const state = {
      text: inputEl.value,
      mode: currentTravelMode,
      roundTrip: chkRoundTrip.checked,
      direct: chkDirect.checked,
      googleStyle: chkGoogleStyle.checked,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }, 1000); 

  function restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      
      if (state.text) inputEl.value = state.text;
      
      if (state.mode) {
        setTravelMode(state.mode);
      }
      
      if (typeof state.roundTrip === 'boolean') chkRoundTrip.checked = state.roundTrip;
      if (typeof state.direct === 'boolean') chkDirect.checked = state.direct;
      if (typeof state.googleStyle === 'boolean') {
        chkGoogleStyle.checked = state.googleStyle;
        if (map && !state.googleStyle) map.setOptions({ styles: CUSTOM_DARK_STYLE });
        if (map && state.googleStyle) map.setOptions({ styles: null });
      }

      setStatus('Restored your last session.', 'ok');
    } catch (e) {
      console.warn('Failed to restore state', e);
    }
  }

  // --- INIT FUNCTIONS & SEARCH ---
  function initTripTree() {
    if (!window.TRIP_LIBRARY || !presetTree) return;

    presetTree.innerHTML = '';
    presetLookup = {};

    window.TRIP_LIBRARY.forEach(region => {
      const regionNode = document.createElement('div');
      regionNode.className = 'tree-node';
      
      const regionHeader = document.createElement('div');
      regionHeader.className = 'tree-header';
      regionHeader.innerHTML = `<span class="tree-icon">[+]</span> ${region.region}`;
      
      const regionGroup = document.createElement('div');
      regionGroup.className = 'tree-group';

      region.categories.forEach(cat => {
        const catNode = document.createElement('div');
        catNode.className = 'tree-node';

        const catHeader = document.createElement('div');
        catHeader.className = 'tree-header';
        catHeader.innerHTML = `<span class="tree-icon">[+]</span> ${cat.name}`;

        const catGroup = document.createElement('div');
        catGroup.className = 'tree-group';

        cat.items.forEach(trip => {
          presetLookup[trip.id] = trip.data;
          const tripItem = document.createElement('span');
          tripItem.className = 'tree-item';
          tripItem.textContent = trip.label;
          tripItem.dataset.key = trip.id;
          tripItem.addEventListener('click', () => loadPreset(trip.id));
          catGroup.appendChild(tripItem);
        });

        catHeader.addEventListener('click', () => toggleTreeGroup(catHeader, catGroup));
        catNode.appendChild(catHeader);
        catNode.appendChild(catGroup);
        regionGroup.appendChild(catNode);
      });

      regionHeader.addEventListener('click', () => toggleTreeGroup(regionHeader, regionGroup));
      regionNode.appendChild(regionHeader);
      regionNode.appendChild(regionGroup);
      presetTree.appendChild(regionNode);
    });
  }

  function filterTripTree(query) {
    if (!presetTree) return;
    const lowerQ = query.toLowerCase().trim();
    
    const allItems = presetTree.querySelectorAll('.tree-item');
    const allNodes = presetTree.querySelectorAll('.tree-node');
    const allGroups = presetTree.querySelectorAll('.tree-group');

    if (!lowerQ) {
      allItems.forEach(el => el.style.display = 'block');
      allNodes.forEach(el => el.style.display = 'block');
      allGroups.forEach(el => {
        el.style.display = 'none'; 
        el.classList.remove('open');
      });
      presetTree.querySelectorAll('.tree-icon').forEach(icon => icon.textContent = '[+]');
      return;
    }

    allItems.forEach(el => el.style.display = 'none');
    allNodes.forEach(el => el.style.display = 'none');
    
    allItems.forEach(item => {
      if (item.textContent.toLowerCase().includes(lowerQ)) {
        item.style.display = 'block';
        let parent = item.parentElement;
        while (parent && parent !== presetTree) {
          if (parent.classList.contains('tree-group')) {
            parent.style.display = 'block';
            parent.classList.add('open');
            if (parent.previousElementSibling) {
              const icon = parent.previousElementSibling.querySelector('.tree-icon');
              if (icon) icon.textContent = '[-]';
            }
          }
          if (parent.classList.contains('tree-node')) {
            parent.style.display = 'block';
          }
          parent = parent.parentElement;
        }
      }
    });
  }

  function openOverlay(content) {
    if (!helpBody) return;
    helpBody.innerHTML = content;
    helpOverlay.classList.add('active');
  }

  function toggleTreeGroup(header, group) {
    const icon = header.querySelector('.tree-icon');
    if (group.classList.contains('open')) {
      group.classList.remove('open');
      group.style.display = 'none';
      icon.textContent = '[+]';
    } else {
      group.classList.add('open');
      group.style.display = 'block';
      icon.textContent = '[-]';
    }
  }

  function loadPreset(key) {
    toggleChatMode(false);
    
    if (!window.google || !window.google.maps) {
        loadGoogleMaps();
    }

    if (key && presetLookup[key]) {
      inputEl.value = presetLookup[key];
      saveState(); 
      
      if (key.includes('GLOBAL_')) {
        chkDirect.checked = true;
        setTravelMode('DRIVING');
        setStatus(`Loaded Global Trip: ${key}\n(Switched to Direct Lines ✈️)`, 'ok');
      } else {
        chkDirect.checked = false;
        const isDriving = key.includes('_DRIVE') || key.includes('COMPLEX') || key.startsWith('EUROPE_');
        
        if (isDriving) {
          setTravelMode('DRIVING');
          setStatus(`Loaded Driving Tour: ${key}\n(Switched to Car Mode 🚗)`, 'ok');
        } else {
          setTravelMode('WALKING');
          setStatus(`Loaded Walking Tour: ${key}\n(Switched to Walk Mode 🚶)`, 'ok');
        }
      }
      chkRoundTrip.checked = true;
      saveState();
    }
  }

  // --- API FOR CHAT ASSISTANT (HOOK) ---
  window.addStopToRoute = function(locationName) {
    const current = inputEl.value;
    const cleanName = locationName.trim();
    if (!cleanName) return;

    if (!current.trim()) {
      inputEl.value = cleanName;
    } else {
      // Check for duplicates roughly
      if (!current.includes(cleanName)) {
        inputEl.value = current.trim() + '\n' + cleanName;
      }
    }
    
    inputEl.scrollTop = inputEl.scrollHeight;
    inputEl.style.borderColor = '#7ee787'; 
    setTimeout(() => { inputEl.style.borderColor = '#1f2a3a'; }, 300);
    
    saveState();
    setStatus(`Added "${cleanName}" to list.`, 'ok');
  };

  // --- HELPERS ---
  function clearMap() {
    if (!map) return;
    mapMarkers.forEach(m => m.setMap(null));
    mapMarkers = [];
    if (mapPolyline) mapPolyline.setMap(null);
    directionsRenderers.forEach(dr => dr.setMap(null));
    directionsRenderers = [];
    
    distKmEl.textContent = '—';
    savedKmEl.textContent = '—';
    routeList.innerHTML = '';
    linksEl.innerHTML = '';
    lastSolvedPoints = null;
  }

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (cls ? (' ' + cls) : '');
  }

  if (btnCollapse) {
    btnCollapse.addEventListener('click', () => {
      $('leftPanel').classList.add('collapsed');
      btnExpand.style.display = 'flex';
    });
  }
  if (btnExpand) {
    btnExpand.addEventListener('click', () => {
      $('leftPanel').classList.remove('collapsed');
      btnExpand.style.display = 'none';
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const text = inputEl.value;
      if (!text.trim()) { setStatus('Nothing to save.', 'warn'); return; }
      const blob = new Blob([text], { type: 'text/plain' });
      const anchor = document.createElement('a');
      anchor.download = 'MyTrip.txt';
      anchor.href = window.URL.createObjectURL(blob);
      anchor.click();
      window.URL.revokeObjectURL(anchor.href);
    });
  }
  if (btnLoad && fileLoader) {
    btnLoad.addEventListener('click', () => fileLoader.click());
    fileLoader.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        clearMap(); 
        inputEl.value = evt.target.result;
        saveState();
        setStatus(`Loaded file: ${file.name}`, 'ok');
        fileLoader.value = '';
      };
      reader.readAsText(file);
    });
  }

  function setTravelMode(mode) {
    currentTravelMode = mode;
    if (mode === 'DRIVING') {
      btnDriving.classList.remove('secondary');
      btnWalking.classList.add('secondary');
    } else {
      btnDriving.classList.add('secondary');
      btnWalking.classList.remove('secondary');
    }
    saveState();
    if (lastSolvedPoints) {
      const links = buildMapsLegLinks(lastSolvedPoints, chkRoundTrip.checked, currentTravelMode);
      renderLinks(links);
      updateMapVisualization(lastSolvedPoints);
    }
  }

  function updateOptimizeButtons(activeType) {
    if (activeType === 'standard') {
      btnStandard.classList.remove('secondary');
      btnDeep.classList.add('secondary');
    } else if (activeType === 'deep') {
      btnStandard.classList.add('secondary');
      btnDeep.classList.remove('secondary');
    }
  }

  function drawFallbackPolyline(pathCoords) {
    if (mapPolyline) mapPolyline.setMap(null);
    mapPolyline = new google.maps.Polyline({
      path: pathCoords,
      geodesic: true,
      strokeColor: "#6aa9ff",
      strokeOpacity: 0.8,
      strokeWeight: 4,
    });
    mapPolyline.setMap(map);
    const bounds = new google.maps.LatLngBounds();
    pathCoords.forEach(p => bounds.extend(p));
    map.fitBounds(bounds);
  }

  function updateMapVisualization(points) {
    if (!map) return;
    lastSolvedPoints = points;
    hideHelp();

    mapMarkers.forEach(m => m.setMap(null));
    mapMarkers = [];
    if (mapPolyline) mapPolyline.setMap(null);
    directionsRenderers.forEach(dr => dr.setMap(null));
    directionsRenderers = [];
    
    // Auto-switch to map view
    toggleChatMode(false);
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
          position: latLng,
          map: map,
          label: {
            text: (index + 1).toString(),
            color: "white",
            fontWeight: "bold"
          },
          title: pt.name,
          zIndex: 100 + index
        });
        mapMarkers.push(marker);
      }
    });

    const routePath = [...pathCoords];
    if (chkRoundTrip.checked && routePath.length > 1) {
      routePath.push(routePath[0]);
    }

    if (chkDirect.checked) {
      drawFallbackPolyline(routePath);
      return;
    }

    const CHUNK_SIZE = 24; 
    
    for (let i = 0; i < routePath.length - 1; i += CHUNK_SIZE) {
      const chunk = routePath.slice(i, i + CHUNK_SIZE + 1);
      if (chunk.length < 2) continue;

      const origin = chunk[0];
      const destination = chunk[chunk.length - 1];
      const waypoints = chunk.slice(1, -1).map(loc => ({
        location: loc,
        stopover: true
      }));

      const renderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true, 
        preserveViewport: true, 
        polylineOptions: {
          strokeColor: "#6aa9ff",
          strokeWeight: 5,
          strokeOpacity: 0.7
        }
      });
      directionsRenderers.push(renderer);

      directionsService.route({
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode[currentTravelMode],
      }, (response, status) => {
        if (status === "OK") {
          renderer.setDirections(response);
        } else {
          console.warn("Directions chunk failed: " + status);
        }
      });
    }
    
    map.fitBounds(bounds);
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function resolveLocation(rawName) {
    if (!geocoder) return null;
    try {
      const response = await geocoder.geocode({ address: rawName });
      if (response.results && response.results.length > 0) {
        const res = response.results[0];
        const loc = res.geometry.location;
        return {
          lat: loc.lat(),
          lon: loc.lng(),
          formatted: res.formatted_address 
        };
      }
    } catch (e) {
      console.warn("Geocode error for:", rawName, e);
    }
    return null;
  }

  async function geocodeMissingPoints(pts) {
    const missing = pts.filter(p => p.lat === null || p.lon === null);
    if (missing.length === 0) return pts;
    setStatus(`Looking up ${missing.length} addresses...`, 'warn');
    for (let i = 0; i < missing.length; i++) {
      const p = missing[i];
      setStatus(`Looking up (${i+1}/${missing.length}):\n${p.name}`, 'warn');
      const result = await resolveLocation(p.name);
      if (result) {
        p.lat = result.lat;
        p.lon = result.lon;
      } else {
        p.error = true; 
      }
      await sleep(300);
    }
    return pts;
  }

  function parseStops(text) {
    const lines = text.split(/\r?\n/);
    const pts = [];
    let startIdx = 0;
    const coordRe = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/;

    for (let raw of lines) {
      raw = raw.trim();
      if (!raw) continue;
      if (raw.startsWith('#')) continue;

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
      } 
      else {
        const m = coordRe.exec(raw);
        if (m) {
          lat = parseFloat(m[1]); lon = parseFloat(m[2]);
          const potentialName = raw.replace(m[0], '').trim();
          if (potentialName.length > 1) name = potentialName.replace(/^,/, '').trim();
          else name = `(${lat.toFixed(3)}, ${lon.toFixed(3)})`;
        } else { name = raw; }
      }
      const p = { name, lat, lon, raw: raw };
      if (isStart) startIdx = pts.length;
      pts.push(p);
    }
    return { pts, startIdx };
  }

  function fmtKm(x) {
    if (!isFinite(x)) return '—';
    if (x < 1) return `${(x * 1000).toFixed(0)} m`;
    return `${x.toFixed(2)} km`;
  }

  function buildMapsLegLinks(routePts, roundTrip, mode) {
    const travelmode = (mode === 'DRIVING') ? 'driving' : 'walking';
    
    const encodeLoc = (p) => {
      if (typeof p.lat === 'number' && typeof p.lon === 'number') {
        return `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
      }
      return encodeURIComponent(p.name);
    };

    const seq = routePts.slice();
    if (roundTrip && seq.length > 1) seq.push(seq[0]);

    const MAX_MID = 20;
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

      // FIXED: URL Construction
      const url = `https://www.google.com/maps/dir/?${params.toString()}`;
      
      links.push({ url, label: `Leg ${links.length + 1} (${segment.length} stops)` });
      i = j;
    }
    return links;
  }

  function renderRoute(routePts, totalKm, baseKm) {
    routeList.innerHTML = '';
    for (const p of routePts) {
      const li = document.createElement('li');
      li.textContent = p.name || p.raw || '(unnamed)';
      if (p.error) li.style.color = '#ff6b6b';
      routeList.appendChild(li);
    }
    distKmEl.textContent = fmtKm(totalKm);
    const saved = (isFinite(baseKm) && isFinite(totalKm)) ? (baseKm - totalKm) : NaN;
    savedKmEl.textContent = isFinite(saved) ? fmtKm(saved) : '—';
  }

  function renderLinks(links) {
    linksEl.innerHTML = '';
    for (const L of links) {
      const row = document.createElement('div');
      row.className = 'linkrow';
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = L.label;
      const a = document.createElement('a');
      a.href = L.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Open in Maps ↗';
      row.appendChild(badge);
      row.appendChild(a);
      linksEl.appendChild(row);
    }
  }

  function disableWhileRunning(disabled) {
    if (btnStandard) btnStandard.disabled = disabled;
    if (btnDeep) btnDeep.disabled = disabled;
    inputEl.disabled = disabled;
  }

  async function run(profile) {
    // Check if Map is loaded. If not, load it and wait.
    if (!geocoder || !directionsService) {
      setStatus('Awaking the map... please wait.', 'warn');
      pendingRunProfile = profile; // Remember what user wanted
      loadGoogleMaps();
      return;
    }

    updateOptimizeButtons(profile);
    saveState();

    disableWhileRunning(true);
    let { pts, startIdx } = parseStops(inputEl.value);
    
    try { pts = await geocodeMissingPoints(pts); } 
    catch (err) { setStatus('Geocoding Error: ' + err.message, 'bad'); disableWhileRunning(false); return; }

    const validPts = pts.filter(p => p.lat !== null && p.lon !== null);
    if (validPts.length < 2) { setStatus('Need at least 2 valid locations.', 'bad'); disableWhileRunning(false); return; }

    setStatus(`Optimizing ${validPts.length} stops...`, 'warn');
    linksEl.innerHTML = '';
    routeList.innerHTML = '';
    distKmEl.textContent = '—';
    savedKmEl.textContent = '—';
    
    hideHelp();
    
    worker.postMessage({ type: 'solve', profile, points: validPts, startIdx: (startIdx < validPts.length) ? startIdx : 0, roundTrip: chkRoundTrip.checked });
  }

  worker.onmessage = (ev) => {
    const msg = ev.data || {};
    if (msg.type === 'result') {
      disableWhileRunning(false);
      const { totalKm, baseKm, pointsSorted } = msg;
      renderRoute(pointsSorted, totalKm, baseKm);
      
      const links = buildMapsLegLinks(pointsSorted, chkRoundTrip.checked, currentTravelMode);
      renderLinks(links);
      updateMapVisualization(pointsSorted);
      
      setStatus(`Done. Distance: ${fmtKm(totalKm)}`, 'ok');
    } else if (msg.type === 'error') {
      setStatus(msg.error || 'Error.', 'bad');
      disableWhileRunning(false);
    } else if (msg.type === 'progress') {
      setStatus(msg.text, 'warn');
    }
  };

  function showHelp() { helpOverlay.classList.add('active'); }
  function hideHelp() { helpOverlay.classList.remove('active'); }

  // --- EVENT LISTENERS ---
  
  // Input Auto-Save listener
  inputEl.addEventListener('input', saveState);
  
  // New Search Listener
  if (tripSearch) {
    tripSearch.addEventListener('input', (e) => filterTripTree(e.target.value));
  }

  // Map Trigger
  if (btnEnableMap) {
    btnEnableMap.addEventListener('click', loadGoogleMaps);
  }

  // Chat Triggers
  if (btnChatToggle) {
    btnChatToggle.addEventListener('click', (e) => {
      e.preventDefault();
      const isChatVisible = chatPanel.style.display === 'flex';
      toggleChatMode(!isChatVisible);
    });
  }
  if (btnCloseChat) {
    btnCloseChat.addEventListener('click', () => toggleChatMode(false));
  }
  if (btnSendChat) {
    btnSendChat.addEventListener('click', handleSendChat);
  }
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSendChat();
    });
  }

  if (btnStandard) btnStandard.addEventListener('click', () => run('standard'));
  if (btnDeep) btnDeep.addEventListener('click', () => run('deep'));
  
  if (btnHelp) {
    btnHelp.addEventListener('click', (e) => { 
      e.preventDefault(); 
      if (window.HELP_CONTENT) openOverlay(window.HELP_CONTENT);
    });
  }
  if (btnAbout) {
    btnAbout.addEventListener('click', (e) => { 
      e.preventDefault(); 
      if (window.ABOUT_CONTENT) openOverlay(window.ABOUT_CONTENT);
    });
  }
  if (btnCloseHelp) btnCloseHelp.addEventListener('click', (e) => { e.preventDefault(); hideHelp(); });

  if (btnDriving) btnDriving.addEventListener('click', () => setTravelMode('DRIVING'));
  if (btnWalking) btnWalking.addEventListener('click', () => setTravelMode('WALKING'));

  chkRoundTrip.addEventListener('change', saveState);

  chkDirect.addEventListener('change', () => {
    saveState();
    if (lastSolvedPoints) updateMapVisualization(lastSolvedPoints);
  });
  
  chkGoogleStyle.addEventListener('change', (e) => {
    saveState();
    if (map) {
      map.setOptions({ styles: e.target.checked ? null : CUSTOM_DARK_STYLE });
    }
  });
  
  // INIT
  initTripTree();
  
})();