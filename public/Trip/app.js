(() => {
  'use strict';

  // --- 1. CONFIGURATION ---
  // Map API Key (Used for rendering only)
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA'; 
  
  // Gemini API is now handled via Secure Netlify Proxy
  const PROXY_URL = 'https://remarkable-sopapillas-d3e79a.netlify.app/.netlify/functions/gemini';
  
  const worker = new Worker('worker.js');
  const STORAGE_KEY = '8z_trip_backup_v2'; 

  // --- 2. GLOBAL STATE ---
  const $ = (id) => document.getElementById(id);
  
  let map, geocoder, directionsService, infoWindow;
  let mapMarkers = [], directionsRenderers = [], mapPolyline = null;
  let lastSolvedPoints = null;
  let currentGeminiModel = '';
  let currentTravelMode = 'DRIVING';
  let currentNavApp = 'apple'; // Default to Apple for the list
  let mapScriptLoadingPromise = null;
  let chatHistoryBuffer = [];
  
  let presetLookup = {};
  let userRegion = null;
  let useMiles = false; // New flag for Unit Conversion

  // --- 3. HTML CONTENT ---
  const HELP_HTML = `
    <div class="help-block">
      <h2>How to Use</h2>
      <ul>
        <li><strong>1. Trip Library:</strong> Click [+] to expand continents. Click a tour name to load it.</li>
        <li><strong>2. Edit:</strong> Add or remove stops in the text box.</li>
        <li><strong>3. Optimize:</strong> Use "Standard" for fast results or "Deep Search" for complex routes.</li>
        <li><strong>4. Navigation:</strong> Use the toggle above the list to switch between Google/Apple Maps for turn-by-turn guidance.</li>
        <li><strong>5. Share:</strong> Click the button at the bottom to create a shareable link.</li>
      </ul>
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

  // --- 5. MARKDOWN PARSER ---
  function formatMarkdown(text) {
    if (!text) return '';
    const lines = text.split('\n');
    let inTable = false;
    let html = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|')) {
            if (!inTable) {
                inTable = true;
                html += '<div class="chat-table-wrapper"><table>';
                const cells = line.split('|').filter(c => c.trim() !== '').map(c => `<th>${c.trim()}</th>`).join('');
                html += `<thead><tr>${cells}</tr></thead><tbody>`;
            } else if (line.includes('---')) {
                continue;
            } else {
                const cells = line.split('|').filter(c => c.trim() !== '').map(c => `<td>${c.trim()}</td>`).join('');
                html += `<tr>${cells}</tr>`;
            }
        } else {
            if (inTable) { inTable = false; html += '</tbody></table></div>'; }
            let formatted = line;
            formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formatted = formatted.replace(/^\*\s/, '• ');
            html += formatted + '<br>';
        }
    }
    if (inTable) html += '</tbody></table></div>';
    return html;
  }

  // --- 6. PERSISTENCE ---
  function saveState() { 
    const state = {
        t: $('input').value,
        m: currentTravelMode,
        chatBuf: chatHistoryBuffer,
        chatHTML: $('chatHistory').innerHTML,
        ts: Date.now()
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } 
    catch (e) { console.warn("Storage full", e); }
  }
  
  function restoreState() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('trip')) {
        try {
            const sharedTrip = decodeURIComponent(params.get('trip'));
            $('input').value = sharedTrip;
            window.history.replaceState({}, document.title, window.location.pathname);
            setStatus('Shared trip loaded!', 'ok');
            setPlanningMode(true); 
            return true;
        } catch(e) { console.error("Share load failed", e); }
    }

    const sStr = localStorage.getItem(STORAGE_KEY);
    if (!sStr) return false;

    try {
        const s = JSON.parse(sStr);
        $('input').value = s.t || ''; 
        currentTravelMode = s.m || 'DRIVING'; 
        updateModeButtons(); 

        if (s.chatBuf && s.chatHTML) {
            chatHistoryBuffer = s.chatBuf;
            const historyEl = $('chatHistory');
            historyEl.innerHTML = s.chatHTML;
            historyEl.querySelectorAll('.suggestions-box').forEach(el => el.remove());
            historyEl.querySelectorAll('.recovery-msg').forEach(el => el.remove());
            return true; 
        }
    } catch(e) { console.error("Restore failed", e); }
    return false;
  }

  window.shareTrip = function() {
      const tripData = $('input').value.trim();
      if (!tripData) { setStatus('List is empty!', 'bad'); return; }
      const url = window.location.origin + window.location.pathname + '?trip=' + encodeURIComponent(tripData);
      navigator.clipboard.writeText(url).then(() => {
          setStatus('Link copied!', 'ok');
          const btn = $('btnShareTrip');
          const originalText = btn.innerHTML;
          btn.innerHTML = '✅ Copied!';
          setTimeout(() => btn.innerHTML = originalText, 2000);
      }).catch(() => prompt("Copy this link:", url));
  };

  // --- GPX EXPORT LOGIC ---
  function generateGPX(points) {
    const head = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="8Z Trip Optimizer">
  <metadata>
    <name>8Z Optimized Route</name>
    <desc>Generated by 8Z Trip Optimizer</desc>
  </metadata>`;
    
    let wpts = '';
    points.forEach(p => {
      const name = p.name.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
      wpts += `\n  <wpt lat="${p.lat}" lon="${p.lon}">\n    <name>${name}</name>\n  </wpt>`;
    });

    let trk = '\n  <trk>\n    <name>Optimized Track</name>\n    <trkseg>';
    points.forEach(p => {
      trk += `\n      <trkpt lat="${p.lat}" lon="${p.lon}"></trkpt>`;
    });
    if($('chkRoundTrip').checked && points.length > 0) {
       trk += `\n      <trkpt lat="${points[0].lat}" lon="${points[0].lon}"></trkpt>`;
    }
    trk += '\n    </trkseg>\n  </trk>';

    return head + wpts + trk + '\n</gpx>';
  }

  window.downloadGPX = function() {
    if(!lastSolvedPoints || lastSolvedPoints.length === 0) {
      setStatus('No optimized route to export.', 'bad');
      return;
    }
    try {
      const gpxContent = generateGPX(lastSolvedPoints);
      const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '8z-route.gpx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('GPX Downloaded!', 'ok');
    } catch(e) {
      console.error(e);
      setStatus('Export failed.', 'bad');
    }
  };

  window.resetSession = function() { localStorage.removeItem(STORAGE_KEY); location.reload(); };
  window.continueSession = function(btn) {
      if(btn) btn.closest('.msg').remove();
      const historyId = $('bigChatContainer').style.display !== 'none' ? 'bigChatHistory' : 'chatHistory';
      renderSuggestions(historyId);
      setStatus('Session Resumed', 'ok');
  };

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

  // --- 7. INPUT & MAPS ---
  function parseStops(text) {
    const lines = text.split(/\r?\n/);
    const pts = [];
    let startIdx = 0;
    const coordRe = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/;

    for (let raw of lines) {
      raw = raw.trim();
      if (!raw || raw.startsWith('#')) continue;
      let isStart = false;
      if (/\bSTART\b/i.test(raw)) { isStart = true; raw = raw.replace(/\bSTART\b/i, '').trim(); }
      let name = raw; let lat = null, lon = null;
      if (raw.includes('|')) {
        const parts = raw.split('|');
        const p0 = parts[0].trim(); const p1 = parts[1].trim();
        const m0 = coordRe.exec(p0); const m1 = coordRe.exec(p1);
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
      pts.push({ name, lat, lon, raw: raw });
      if (isStart) startIdx = pts.length;
    }
    return { pts, startIdx };
  }

  async function geocodeMissingPoints(pts) {
    const missing = pts.filter(p => p.lat === null || p.lon === null);
    if (missing.length === 0) return pts;
    setStatus(`Looking up ${missing.length} addresses...`, 'warn');
    for (let i = 0; i < missing.length; i++) {
      const p = missing[i];
      if (!geocoder) geocoder = new google.maps.Geocoder();
      const result = await new Promise((resolve) => {
        geocoder.geocode({ address: p.name }, (results, status) => {
          if (status === 'OK') resolve(results[0]); else resolve(null);
        });
      });
      if (result) { p.lat = result.geometry.location.lat(); p.lon = result.geometry.location.lng(); }
      await new Promise(r => setTimeout(r, 250)); 
    }
    return pts;
  }

  function ensureMapsLoaded() {
    if (window.google && window.google.maps) return Promise.resolve();
    if (mapScriptLoadingPromise) return mapScriptLoadingPromise;
    mapScriptLoadingPromise = new Promise((resolve) => {
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
        directionsService.route({ origin: seg[0], destination: seg[seg.length-1], waypoints: seg.slice(1,-1).map(l => ({location:l, stopover:true})), travelMode: gMode }, (res, st) => { if(st === "OK") r.setDirections(res); });
      }
    }
    google.maps.event.trigger(map, 'resize');
    map.fitBounds(bounds);
  }

  // --- 8. SMART LINKS & TOGGLE ---
  function buildMapsLegLinks(routePts, roundTrip, mode) {
    const travelmode = (mode === 'DRIVING') ? 'driving' : 'walking';
    const encodeCoords = (p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
    const encodeName = (p) => { if (p.name.match(/^-?\d+\./)) return encodeCoords(p); return encodeURIComponent(p.name); };
    const seq = routePts.slice();
    if (roundTrip && seq.length > 1) seq.push(seq[0]);
    const links = []; let i = 0;
    while (i < seq.length - 1) {
      const origin = seq[i];
      let j = Math.min(seq.length - 1, i + 1 + 9 + 1);
      if (j <= i + 1) j = i + 2;
      const segment = seq.slice(i, j + 1);
      const originPin = encodeCoords(segment[0]); const destPin = encodeCoords(segment[segment.length - 1]); const midsPin = segment.slice(1, -1).map(encodeCoords);
      let urlPins = `https://www.google.com/maps/dir/?api=1&origin=${originPin}&destination=${destPin}&travelmode=${travelmode}`;
      if (midsPin.length) urlPins += `&waypoints=${midsPin.join('%7C')}`;
      const originName = encodeName(segment[0]); const destName = encodeName(segment[segment.length - 1]); const midsName = segment.slice(1, -1).map(encodeName);
      let urlNames = `https://www.google.com/maps/dir/?api=1&origin=${originName}&destination=${destName}&travelmode=${travelmode}`;
      if (midsName.length) urlNames += `&waypoints=${midsName.join('%7C')}`;
      links.push({ label: `Leg ${links.length + 1} (${segment.length} stops)`, urlPins, urlNames });
      i = j;
    }
    return links;
  }

  function renderLinks(links) {
    const el = $('links'); 
    
    // UPDATED: Added Header "Open in Google Maps"
    el.innerHTML = '<h4>Open in Google Maps</h4>';
    
    for (const L of links) {
      const row = document.createElement('div'); row.className = 'linkrow';
      row.style.display = 'flex'; row.style.flexWrap = 'wrap'; row.style.alignItems = 'center'; row.style.gap = '10px';
      
      // UPDATED: Changed label from 'Open in Google Map' to 'Pins'
      row.innerHTML = `<span class="badge" style="min-width:60px;">${L.label}</span><div style="display:flex; gap:8px; flex:1;"><a href="${L.urlPins}" target="_blank" style="flex:1; text-align:center; padding:6px; background:rgba(59,130,246,0.1); border-radius:4px; font-size:0.85rem; text-decoration:none; color:#bfdbfe;">📍 Pins</a><a href="${L.urlNames}" target="_blank" style="flex:1; text-align:center; padding:6px; background:rgba(16,185,129,0.1); color:#6ee7b7; border-radius:4px; font-size:0.85rem; text-decoration:none;">🏷️ Names</a></div>`;
      el.appendChild(row);
    }
    const shareArea = document.createElement('div');
    shareArea.className = 'share-area';
    
    // UPDATED: Renamed 'Share Link' to 'Share trip'
    // UPDATED: Darkened GPX button background to #14532d (Dark Green)
    shareArea.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <button id="btnShareTrip" class="btn-share" onclick="window.shareTrip()">🔗 Share trip</button>
        <button id="btnGPX" class="btn-share" style="background:#14532d; color:white; border-color:#14532d;" onclick="window.downloadGPX()">⛰️ Save GPX</button>
      </div>
    `;
    el.appendChild(shareArea);
  }

  window.setNavApp = function(app) {
      currentNavApp = app;
      if (lastSolvedPoints) renderRouteList(lastSolvedPoints);
  };

  function renderRouteList(points) {
      const list = $('routeList'); list.innerHTML = '';
      const toggleRow = document.createElement('div');
      toggleRow.style.cssText = "display:flex; justify-content:center; gap:10px; padding:10px; border-bottom:1px solid var(--border); margin-bottom:5px;";
      const isGoogle = currentNavApp === 'google';
      const activeStyle = "background:var(--primary); color:white; border-color:var(--primary);";
      const inactiveStyle = "background:transparent; color:var(--text-dim); border:1px solid var(--border);";
      toggleRow.innerHTML = `<button onclick="window.setNavApp('google')" style="padding:6px 12px; font-size:0.8rem; border-radius:20px; cursor:pointer; ${isGoogle ? activeStyle : inactiveStyle}">Google Maps</button><button onclick="window.setNavApp('apple')" style="padding:6px 12px; font-size:0.8rem; border-radius:20px; cursor:pointer; ${!isGoogle ? activeStyle : inactiveStyle}">Apple Maps</button>`;
      list.appendChild(toggleRow);
      const modeChar = currentTravelMode === 'DRIVING' ? 'd' : 'w';
      const googleMode = currentTravelMode === 'DRIVING' ? 'driving' : 'walking';
      points.forEach((p, i) => { 
          const li = document.createElement('li');
          const destCoords = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
          let navUrl = "";
          if (currentNavApp === 'apple') {
              if (i === 0) navUrl = `http://maps.apple.com/?daddr=${destCoords}&dirflg=${modeChar}`;
              else { const prevCoords = `${points[i-1].lat.toFixed(6)},${points[i-1].lon.toFixed(6)}`; navUrl = `http://maps.apple.com/?saddr=${prevCoords}&daddr=${destCoords}&dirflg=${modeChar}`; }
          } else {
              if (i === 0) navUrl = `https://www.google.com/maps/dir/?api=1&destination=${destCoords}&travelmode=${googleMode}`;
              else { const prevCoords = `${points[i-1].lat.toFixed(6)},${points[i-1].lon.toFixed(6)}`; navUrl = `https://www.google.com/maps/dir/?api=1&origin=${prevCoords}&destination=${destCoords}&travelmode=${googleMode}`; }
          }
          li.innerHTML = `<a href="${navUrl}" target="_blank">${i + 1}. ${p.name}<small>Tap to navigate here ↗</small></a>`;
          list.appendChild(li); 
      });
  }

  // --- 9. LIBRARY (GEO-AWARE) ---
  async function detectUserLocation() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const code = data.country_code; 
        
        // UPDATED: Check for US/UK to set imperial units
        if (['US', 'GB'].includes(code)) useMiles = true;

        if (['US', 'CA', 'MX'].includes(code)) return 'Americas';
        if (['CN', 'JP', 'KR', 'TH', 'VN', 'IN'].includes(code)) return 'Asia';
        if (['DE', 'FR', 'IT', 'ES', 'UK', 'GB', 'SI'].includes(code)) return 'Europe';
        return 'Global';
    } catch(e) { return null; }
  }

  async function initTripTree() {
    if (!window.TRIP_LIBRARY) return;
    const region = await detectUserLocation();
    userRegion = region; 
    let sortedLib = window.TRIP_LIBRARY.slice();
    if (region) sortedLib.sort((a, b) => (b.region.includes(region) - a.region.includes(region)));
    const tree = $('presetTree'); tree.innerHTML = '';
    presetLookup = {};
    sortedLib.forEach((regionData, idx) => {
      const rNode = document.createElement('div');
      const isUserRegion = idx === 0 && region; 
      rNode.innerHTML = `<div class="tree-header">${isUserRegion?'⌄':'›'} ${regionData.region}</div><div class="tree-group${isUserRegion?' open':''}"></div>`;
      const rGroup = rNode.querySelector('.tree-group');
      regionData.categories.forEach(cat => {
        const cNode = document.createElement('div');
        cNode.innerHTML = `<div class="tree-header">› ${cat.name}</div><div class="tree-group"></div>`;
        const cGroup = cNode.querySelector('.tree-group');
        cat.items.forEach(trip => {
          presetLookup[trip.id] = trip.data;
          const item = document.createElement('span'); item.className = 'tree-item'; item.textContent = trip.label;
          item.onclick = () => { 
            $('input').value = trip.data; saveState(); 
            if (trip.id.includes('GLOBAL')) { $('chkDirect').checked = true; setTravelMode('DRIVING'); }
            else if (trip.id.includes('WALKING')) { $('chkDirect').checked = false; setTravelMode('WALKING'); }
            else { $('chkDirect').checked = false; setTravelMode('DRIVING'); }
            setStatus(`Loaded: ${trip.label}`, 'ok'); renderSuggestions('bigChatHistory');
          };
          cGroup.appendChild(item);
        });
        cNode.querySelector('.tree-header').onclick = function() { cGroup.classList.toggle('open'); this.textContent = (cGroup.classList.contains('open') ? '⌄ ' : '› ') + cat.name; };
        rGroup.appendChild(cNode);
      });
      rNode.querySelector('.tree-header').onclick = function() { rGroup.classList.toggle('open'); this.textContent = (rGroup.classList.contains('open') ? '⌄ ' : '› ') + regionData.region; };
      tree.appendChild(rNode);
    });
  }

  // --- 10. AI & SUGGESTIONS (FIXED) ---
  function renderSuggestions(containerId) {
    const el = $(containerId); if (!el) return;
    const old = el.querySelector('.suggestions-box'); if (old) old.remove();
    
    const inputVal = $('input').value.trim();
    const isNew = inputVal.length < 10; 
    
    const box = document.createElement('div'); 
    box.className = 'suggestions-box';
    
    // HELP HTML (Shared)
    const helpHtml = `<div class="suggestion-group"><div class="suggestion-label">ℹ️ Help</div><div class="chip-grid"><div class="chip" onclick="window.sendChat('How do I use the Trip Library?')">How to use Library?</div><div class="chip" onclick="window.sendChat('What does Optimize do?')">Explain Optimization</div></div></div>`;

    if (isNew) {
        let regionChip = "";
        if (userRegion === 'Europe') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a classic Europe tour (Paris, Rome, Berlin)\')">🇪🇺 Classic Europe Tour</div>';
        if (userRegion === 'Americas') regionChip = '<div class="chip logistics" onclick="window.sendChat(\'Plan a USA West Coast road trip\')">🇺🇸 USA West Coast</div>';
        
        box.innerHTML = `<div class="suggestion-group"><div class="suggestion-label">✨ Start a New Adventure</div><div class="chip-grid">${regionChip}<div class="chip logistics" onclick="window.sendChat('Create a 3-day itinerary for Rome, Italy')">Create 3-Day Rome Itinerary</div><div class="chip logistics" onclick="window.sendChat('Suggest a romantic weekend in Paris')">Paris Weekend</div></div></div>${helpHtml}`;
    } else {
        box.innerHTML = `<div class="suggestion-group"><div class="suggestion-label">🛏️ Sleeping Strategy</div><div class="chip-grid"><div class="chip sleep" onclick="window.sendChat('Where should I stay? Calculate the best base camp.')">Find Best Base Camp</div></div></div><div class="suggestion-group"><div class="suggestion-label">🍴 Eating</div><div class="chip-grid"><div class="chip eat" onclick="window.sendChat('Suggest lunch spots with high ratings but low price')">Best Cheap Eats</div><div class="chip eat" onclick="window.sendChat('Where is a good romantic dinner spot nearby?')">Romantic Dinner</div></div></div><div class="suggestion-group"><div class="suggestion-label">🚕 Logistics</div><div class="chip-grid"><div class="chip logistics" onclick="window.sendChat('How much time do I need for each stop?')">Time per Stop?</div><div class="chip logistics" onclick="window.sendChat('Is this route walkable or do I need a taxi?')">Walk vs Taxi</div></div></div>${helpHtml}`;
    }
    el.insertBefore(box, el.firstChild);
  }

async function initAI() {
    // Proxy uses a fixed model for security (Gemini 2.5 Flash)
    currentGeminiModel = 'gemini-2.5-flash';
    const s = $('modelSelector'); 
    if(s) {
      s.innerHTML='<option value="gemini-2.5-flash">8Z Trip Architect (Secure Proxy)</option>';
      s.disabled = true;
    }
  }

  window.sendChat = function(text) {
      if(document.getElementById('bigChatInput').offsetParent) {
          document.getElementById('bigChatInput').value = text;
          handleChatSend('bigChatInput', 'bigChatHistory');
      } else {
          document.getElementById('chatInput').value = text;
          handleChatSend('chatInput', 'chatHistory');
      }
  };

  async function handleChatSend(inputId, historyId) {
      const i = $(inputId), t = i.value.trim(), h = $(historyId); if (!t) return;
      i.value = ''; h.innerHTML += `<div class="msg user">${t}</div>`; h.scrollTop = h.scrollHeight;
      const otherHistory = historyId === 'chatHistory' ? $('bigChatHistory') : $('chatHistory');
      if (otherHistory) { otherHistory.innerHTML = h.innerHTML; otherHistory.scrollTop = otherHistory.scrollHeight; }
      saveState(); 

      const loadingId = 'loading-' + Date.now();
      h.innerHTML += `<div id="${loadingId}" class="msg ai" style="opacity:0.6">...</div>`;
      
      const r = await callAI(t);
      const loader = document.getElementById(loadingId); if(loader) loader.remove();
      
      let processedText = r;
      const replaceMatch = r.match(/\{REPLACE:\s*([\s\S]*?)\}/);
      if (replaceMatch && replaceMatch[1].trim()) {
          $('input').value = replaceMatch[1].trim(); saveState(); setStatus('Trip updated.', 'ok');
          setTimeout(() => { renderSuggestions('bigChatHistory'); if (historyId === 'chatHistory') renderSuggestions('chatHistory'); }, 500);
          processedText = processedText.replace(/\{REPLACE:\s*[\s\S]*?\}/g, '<div class="action-badge">📋 <strong>Trip Editor Updated</strong><small>Check list above.</small></div>');
      }
      const m = processedText.match(/\{ADD:\s*(.*?)\}/g); 
      if(m) {
        let addedCount = 0;
        m.forEach(x=>{ const l=x.replace(/\{ADD:\s*|\}/g,'').trim(); if(!$('input').value.includes(l)) { $('input').value += ($('input').value.endsWith('\n') ? '' : '\n') + l; addedCount++; } });
        if(addedCount > 0) { saveState(); setStatus(`AI added ${addedCount} stops.`, 'ok'); renderSuggestions('bigChatHistory'); }
        processedText = processedText.replace(/\{ADD:.*?\}/g, '<div class="action-badge">➕ <strong>Stops Added</strong><small>Check list above.</small></div>');
      }

      h.innerHTML += `<div class="msg ai"><strong>Gemini:</strong> ${formatMarkdown(processedText)}</div>`;
      h.scrollTop = h.scrollHeight;
      if (otherHistory) { otherHistory.innerHTML = h.innerHTML; otherHistory.scrollTop = otherHistory.scrollHeight; }
      saveState(); 
  }

async function callAI(txt) {
    chatHistoryBuffer.push({ role: "user", parts: [{ text: txt }] });
    const currentTripData = $('input').value.substring(0, 3000); 
    const locationContext = userRegion ? `USER LOCATION: ${userRegion}` : "";
    let sysPrompt = "";
    
    if (currentTripData.length < 20) {
        sysPrompt = `You are the 8Z Trip Architect. User has EMPTY itinerary. ${locationContext} Help create a list. Use {REPLACE: \nStop 1\nStop 2...} to fill list.`;
    } else {
        sysPrompt = `You are the 8Z Logistics Co-Pilot. ${locationContext} CURRENT STOPS: ${currentTripData} RULES: 1. Value for Money. 2. UI AWARENESS: Say "I have updated your Trip Editor above." 3. Use Markdown tables for times/prices. COMMANDS: {ADD: ...} to append. {REPLACE: ...} to overwrite.`;
    }

    // Merge history and system prompt for the proxy
    const fullPrompt = sysPrompt + "\n\nHistory:\n" + 
      chatHistoryBuffer.map(m => `${m.role.toUpperCase()}: ${m.parts[0].text}`).join('\n') + 
      "\n\nLatest Question: " + txt;

    try {
      const res = await fetch(PROXY_URL, { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ prompt: fullPrompt }) 
      });

      const d = await res.json();
      const t = d.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't reach the Architect.";
      chatHistoryBuffer.push({ role: "model", parts: [{ text: t }] });
      return t;
    } catch (err) {
      console.error("Proxy Error:", err);
      return "The Trip Architect is currently offline. Please try again later.";
    }
  }

  // --- 11. OPTIMIZER ---
  function showBusy(msg) {
    let overlay = $('busyOverlay');
    if (!overlay) {
        overlay = document.createElement('div'); overlay.id = 'busyOverlay';
        overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:white;font-family:sans-serif;";
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div style="font-size:2rem;margin-bottom:20px;">🧬</div><div style="font-size:1.2rem;font-weight:bold;">${msg}</div><div style="margin-top:10px;color:#6aa9ff;">Please wait...</div>`;
    overlay.style.display = 'flex';
  }
  function hideBusy() { const o = $('busyOverlay'); if (o) o.style.display = 'none'; }

  function setPlanningMode(enabled) {
    const rightPanel = document.querySelector('.panel:nth-of-type(2)');
    const mapCont = $('mapContainer'), stats = document.querySelector('.stats'), list = $('routeList'), links = $('links');
    const btnPlan = $('btnPlanMode'), btnMap = $('btnMapMode');
    let bigChat = $('bigChatContainer');
    if (!bigChat) {
        bigChat = document.createElement('div'); bigChat.id = 'bigChatContainer'; bigChat.style.display = 'none';
        bigChat.innerHTML = `<div id="bigChatHistory" style="flex:1; overflow-y:auto; padding:20px; border-bottom:1px solid #1f2a3a;"></div><div class="chat-input" style="padding:15px; background:#0f1621;"><input type="text" id="bigChatInput" placeholder="Message Gemini (Internet Enabled)..."><button id="btnSendBigChat">➤</button></div>`;
        rightPanel.appendChild(bigChat);
        $('btnSendBigChat').onclick = () => handleChatSend('bigChatInput', 'bigChatHistory');
        $('bigChatInput').onkeypress = (e) => { if(e.key==='Enter') handleChatSend('bigChatInput', 'bigChatHistory'); };
    }
    if (enabled) {
        btnPlan.classList.add('active'); btnMap.classList.remove('active');
        mapCont.style.display = 'none'; stats.style.display = 'none'; list.style.display = 'none'; links.style.display = 'none';
        bigChat.style.display = 'flex'; bigChat.style.flexDirection = 'column'; bigChat.style.height = '100%'; $('chatPanel').style.display = 'none';
        $('bigChatHistory').innerHTML = $('chatHistory').innerHTML; renderSuggestions('bigChatHistory');
        setTimeout(() => $('bigChatInput') && $('bigChatInput').focus(), 100);
    } else {
        btnMap.classList.add('active'); btnPlan.classList.remove('active');
        mapCont.style.display = 'block'; stats.style.display = 'flex'; list.style.display = 'block'; links.style.display = 'flex';
        bigChat.style.display = 'none'; $('chatPanel').style.display = 'flex';
        $('chatHistory').innerHTML = $('bigChatHistory').innerHTML;
    }
  }

  async function run(profile) {
    setPlanningMode(false);
    if (!window.google) { setStatus('Loading Map API...', 'ok'); await ensureMapsLoaded(); }
    const raw = $('input').value;
    let { pts, startIdx } = parseStops(raw);
    try { pts = await geocodeMissingPoints(pts); } catch (e) { setStatus('Geocode Error', 'bad'); return; }
    const valid = pts.filter(p => p.lat !== null && p.lon !== null);
    if (valid.length < 2) { setStatus('Need 2+ valid stops.', 'bad'); return; }
    setStatus(`Optimizing ${valid.length} stops...`, 'warn');
    if (profile === 'deep') showBusy("Deep Genetic Optimization...");
    worker.postMessage({ type: 'solve', profile: profile, points: valid, startIdx: (startIdx < valid.length) ? startIdx : 0, roundTrip: $('chkRoundTrip').checked });
  }

  worker.onmessage = (ev) => {
    const msg = ev.data || {};
    if (msg.type === 'progress') showBusy(msg.text); 
    else if (msg.type === 'result') {
      hideBusy();
      const { pointsSorted, totalKm, baseKm } = msg;
      lastSolvedPoints = pointsSorted;
      
      // UPDATED: Convert to Miles if useMiles is true
      let distDisplay = totalKm.toFixed(2) + ' km';
      let savedDisplay = '';
      
      if (useMiles) {
        const totalMi = totalKm * 0.621371;
        const baseMi = baseKm * 0.621371;
        const savedMi = baseMi - totalMi;
        distDisplay = totalMi.toFixed(2) + ' mi';
        savedDisplay = savedMi > 0 ? savedMi.toFixed(2) + ' mi' : '—';
      } else {
        const savedKm = baseKm - totalKm;
        savedDisplay = savedKm > 0 ? savedKm.toFixed(2) + ' km' : '—';
      }

      $('distKm').textContent = distDisplay;
      $('savedKm').textContent = savedDisplay;

      renderRouteList(pointsSorted);
      updateMapVisualization(pointsSorted);
      const links = buildMapsLegLinks(pointsSorted, $('chkRoundTrip').checked, currentTravelMode);
      renderLinks(links);
      setStatus('Done!', 'ok');
    }
  };

  // --- 12. INIT ---
  document.addEventListener('DOMContentLoaded', () => {
    initTripTree(); initAI(); 
    const restored = restoreState();
    $('btnStandard').onclick = () => run('standard');
    $('btnDeep').onclick = () => run('deep');
    $('btnDriving').onclick = () => setTravelMode('DRIVING');
    $('btnWalking').onclick = () => setTravelMode('WALKING');
    $('btnEnableMap').onclick = () => ensureMapsLoaded();
    $('btnSave').onclick = () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([$('input').value],{type:'text/plain'})); a.download='trip.txt'; a.click(); };
    $('btnLoad').onclick = () => $('fileLoader').click();
    $('fileLoader').onchange = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=(v)=>{$('input').value=v.target.result;saveState();};r.readAsText(f);} };
    $('btnPlanMode').onclick = () => setPlanningMode(true);
    $('btnMapMode').onclick = () => setPlanningMode(false);
    $('tripSearch').oninput = (e) => { 
        const q=e.target.value.toLowerCase(); 
        document.querySelectorAll('.tree-item').forEach(i => { 
          const match = i.textContent.toLowerCase().includes(q); i.style.display = match ? 'block' : 'none';
          if(q && match){ let p=i.parentElement; while(p.id!=='presetTree'){ if(p.classList.contains('tree-group')) { p.classList.add('open'); const h = p.previousElementSibling; if(h) h.textContent = h.textContent.replace('›', '⌄'); } p=p.parentElement; } }
        }); 
    };
    $('btnSendChat').onclick = () => handleChatSend('chatInput', 'chatHistory');
    $('chatInput').onkeypress = (e) => { if(e.key==='Enter') handleChatSend('chatInput', 'chatHistory'); };
    const h=$('helpOverlay'); $('btnHelp').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=HELP_HTML;}; $('btnAbout').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=window.ABOUT_CONTENT || "About content missing.";}; $('btnCloseHelp').onclick=()=>h.style.display='none';
    if(restored) {
        const historyEl = $('chatHistory');
        if(!historyEl.querySelector('.recovery-msg')) {
             historyEl.innerHTML += `<div class="msg ai recovery-msg" style="border-left:3px solid var(--success)"><strong>System:</strong> Session restored.<div style="margin-top:10px; display:flex; gap:10px;"><button class="chip logistics" onclick="window.continueSession(this)">✅ Continue</button><button class="chip eat" style="border-color:var(--danger); color:var(--danger); background:rgba(239,68,68,0.1)" onclick="window.resetSession()">🗑️ Fresh Start</button></div></div>`;
        }
        setPlanningMode(true);
    } else { setPlanningMode(true); }
  });
  
  function setTravelMode(mode) { currentTravelMode = mode; updateModeButtons(); }
})();
