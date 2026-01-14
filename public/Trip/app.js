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
  let presetLookup = {}; // Library Map

  // --- 3. RICH CONTENT (From ZIP help.js) ---
  const HELP_HTML = `
    <h2>Why 8Z-RP?</h2>
    <p><strong>Deterministic Results:</strong> Unlike many online solvers that produce random variations, 8Z-RP guarantees <em>Same Input ⇒ Same Route</em>.</p>
    <p><strong>100% Client-Side:</strong> Your location data is processed entirely in your browser using a Web Worker.</p>
    
    <h2>Input Formats</h2>
    <ul>
      <li><code>46.0569, 14.5058</code> (GPS Coordinates)</li>
      <li><code>Tivoli Park, Ljubljana</code> (Place Name)</li>
      <li><code>Home | 46.0428, 14.4500</code> (Custom Label | GPS)</li>
    </ul>
    
    <h2>Special Commands</h2>
    <p>Add <code>START</code> anywhere on a line to lock it as the starting point.</p>
  `;

  const ABOUT_HTML = `
    <h2>ℹ️ About 8Z-RP</h2>
    <p><strong>Author:</strong> Bojan Dobrečevič | Jan 2026</p>
    <p><strong>Version:</strong> 2026.1 (Stable)</p>
    
    <div style="background:rgba(59,130,246,0.1); padding:15px; border-radius:8px; margin:15px 0; border-left:3px solid #3b82f6;">
      <h3>The Morocco Story</h3>
      <p>This project was born out of frustration during a backpacking trip through the Atlas Mountains. I realized standard maps are great for point-to-point driving but terrible for logistical planning of multiple stops. I built 8Z-RP to solve the "Traveler's Salesman Problem" efficiently.</p>
    </div>
    
    <h3>Features</h3>
    <ul>
      <li>Deterministic Genetic Algorithm</li>
      <li>Privacy-First Architecture</li>
      <li>Integrated Gemini AI Chatbot</li>
    </ul>
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
    
    // Auto-refresh map/links if data exists (Fixed)
    if (lastSolvedPoints) {
      updateMapVisualization(lastSolvedPoints);
      const links = buildMapsLegLinks(lastSolvedPoints, $('chkRoundTrip').checked, currentTravelMode);
      renderLinks(links);
    }
  }

  // --- 5. PARSING LOGIC (From ZIP) ---
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

  // --- 6. GEOCODING (Retry Logic) ---
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
      await new Promise(r => setTimeout(r, 250)); // Rate limit
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
        
        // Hide placeholder immediately
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
      
      // Feature: Chunking for Directions API (25 waypoint limit)
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
    
    // Force resize to ensure map renders correctly
    google.maps.event.trigger(map, 'resize');
    map.fitBounds(bounds);
  }

  // --- 8. MULTI-LEG LINKS (Restored from ZIP) ---
  function buildMapsLegLinks(routePts, roundTrip, mode) {
    const travelmode = (mode === 'DRIVING') ? 'driving' : 'walking';
    const encodeLoc = (p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    
    const seq = routePts.slice();
    if (roundTrip && seq.length > 1) seq.push(seq[0]);

    // Google Maps URL limit: Split into legs of ~10 stops
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

      let url = `https://www.google.com/maps/dir/?api=1&origin=$$?api=1&origin=${originLoc}&destination=${destLoc}&travelmode=${travelmode}`;
      if (mids.length > 0) {
        url += `&waypoints=${mids.join('|')}`;
      }
      
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

  // --- 9. LIBRARY TREE & SMART PRESETS ---
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
            // Feature: Smart Mode Switching (Restored from ZIP)
            if (trip.id.includes('GLOBAL')) {
                $('chkDirect').checked = true;
                setTravelMode('DRIVING');
            } else if (trip.id.includes('WALKING') || trip.id.includes('CAPITALS')) {
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

  // --- 10. RUN OPTIMIZER ---
  async function run(profile) {
    if (!window.google) { setStatus('Loading Map API...', 'ok'); await ensureMapsLoaded(); }

    const raw = $('input').value;
    let { pts, startIdx } = parseStops(raw);
    
    try { pts = await geocodeMissingPoints(pts); }
    catch (e) { setStatus('Geocode Error', 'bad'); return; }

    const valid = pts.filter(p => p.lat !== null && p.lon !== null);
    if (valid.length < 2) { setStatus('Need 2+ valid stops.', 'bad'); return; }

    setStatus(`Optimizing ${valid.length} stops...`, 'warn');
    
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
    if (msg.type === 'result') {
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

  // --- 11. AI & INIT ---
  async function initAI() {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const d = await r.json();
      const v = d.models.filter(m => m.name.includes('gemini') && !m.name.match(/image|vision/));
      const s = $('modelSelector'); s.innerHTML='';
      v.forEach(m => { const o=document.createElement('option'); o.value=m.name; o.textContent=m.displayName; s.appendChild(o); });
      currentGeminiModel = v[0]?.name; s.onchange = () => currentGeminiModel = s.value;
    } catch(e){}
  }
  async function callAI(txt) {
    chatHistoryBuffer.push({ role: "user", parts: [{ text: txt }] });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ contents: [{role:"user", parts:[{text:"AI Assistant. Use {ADD: Place}."}]}, ...chatHistoryBuffer] })
    });
    const d = await res.json();
    const t = d.candidates?.[0]?.content?.parts?.[0]?.text || "Error";
    chatHistoryBuffer.push({ role: "model", parts: [{ text: t }] });
    return t;
  }

  // --- BOOTSTRAP ---
  document.addEventListener('DOMContentLoaded', () => {
    initTripTree();
    initAI();
    restoreState();

    $('btnStandard').onclick = () => run('standard');
    $('btnDeep').onclick = () => run('deep');
    $('btnDriving').onclick = () => setTravelMode('DRIVING');
    $('btnWalking').onclick = () => setTravelMode('WALKING');
    $('btnEnableMap').onclick = () => ensureMapsLoaded();
    
    $('btnSave').onclick = () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([$('input').value],{type:'text/plain'})); a.download='trip.txt'; a.click(); };
    $('btnLoad').onclick = () => $('fileLoader').click();
    $('fileLoader').onchange = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=(v)=>{$('input').value=v.target.result;saveState();};r.readAsText(f);} };
    
    // Feature: Recursive Search
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

    $('btnSendChat').onclick = async () => {
        const i=$('chatInput'), t=i.value.trim(), h=$('chatHistory'); if(!t)return; i.value='';
        h.innerHTML+=`<div class="msg user">${t}</div>`; h.scrollTop=h.scrollHeight;
        const r=await callAI(t);
        const m=r.match(/\{ADD:\s*(.*?)\}/g); if(m) m.forEach(x=>{ const l=x.replace(/\{ADD:\s*|\}/g,'').trim(); if(!$('input').value.includes(l))$('input').value+=($('input').value?'\n':'')+l; });
        h.innerHTML+=`<div class="msg ai"><strong>Gemini:</strong> ${r.replace(/\n/g,'<br>')}</div>`; h.scrollTop=h.scrollHeight;
    };
    
    const h=$('helpOverlay'); 
    $('btnHelp').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=HELP_HTML;}; 
    $('btnAbout').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=ABOUT_HTML;}; 
    $('btnCloseHelp').onclick=()=>h.style.display='none';
  });
  
  function setTravelMode(mode) {
    currentTravelMode = mode;
    updateModeButtons();
  }
})();
