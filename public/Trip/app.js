(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // UI Elements
  const inputEl = $('input');
  const statusEl = $('status');
  const btnFast = $('btnFast');
  const btnBalanced = $('btnBalanced');
  const routeList = $('routeList');
  const distKmEl = $('distKm');
  const savedKmEl = $('savedKm');
  const linksEl = $('links');
  const chkRoundTrip = $('chkRoundTrip');
  
  // NEW: Mode Buttons
  const btnDriving = $('btnDriving');
  const btnWalking = $('btnWalking');
  const chkDirect = $('chkDirect'); 

  // Panels & Overlays
  const mapPlaceholder = $('mapPlaceholder');
  const helpOverlay = $('helpOverlay');
  const btnHelp = $('btnHelp');
  const btnCloseHelp = $('btnCloseHelp');

  // Worker
  const worker = new Worker('worker.js');

  // Map State
  let map;
  let geocoder;
  let directionsService;
  let directionsRenderer;
  let mapMarkers = [];
  let mapPolyline = null;
  
  let lastSolvedPoints = null;
  let currentTravelMode = 'DRIVING'; // Default mode

  // --------------------------------------------------------------------------
  // GOOGLE MAPS INIT
  // --------------------------------------------------------------------------
  window.initMap = function() {
    const defaultCenter = { lat: 46.0569, lng: 14.5058 }; 
    
    map = new google.maps.Map($('map'), {
      zoom: 12,
      center: defaultCenter,
      // CHANGED: Set to 'hybrid' (Satellite + Labels)
      mapTypeId: 'hybrid', 
      mapTypeControl: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
      ],
    });

    geocoder = new google.maps.Geocoder();
    directionsService = new google.maps.DirectionsService();
    
    directionsRenderer = new google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: true,
      preserveViewport: false,
      polylineOptions: {
        strokeColor: "#6aa9ff",
        strokeWeight: 5,
        strokeOpacity: 0.7
      }
    });
  };

  // --------------------------------------------------------------------------
  // UI LOGIC (Help & Modes)
  // --------------------------------------------------------------------------
  function showHelp() { helpOverlay.classList.add('active'); }
  function hideHelp() { helpOverlay.classList.remove('active'); }

  function setTravelMode(mode) {
    currentTravelMode = mode;
    
    // Toggle visual state (Secondary class makes it gray, removing it makes it blue)
    if (mode === 'DRIVING') {
      btnDriving.classList.remove('secondary');
      btnWalking.classList.add('secondary');
    } else {
      btnDriving.classList.add('secondary');
      btnWalking.classList.remove('secondary');
    }

    // If we have a route, update it instantly
    if (lastSolvedPoints) {
      // Update Links
      const links = buildMapsLegLinks(lastSolvedPoints, chkRoundTrip.checked, currentTravelMode);
      renderLinks(links);
      // Update Map Line
      updateMapVisualization(lastSolvedPoints);
    }
  }

  // --------------------------------------------------------------------------
  // VISUALIZATION LOGIC
  // --------------------------------------------------------------------------

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

    // 1. Clear old
    mapMarkers.forEach(m => m.setMap(null));
    mapMarkers = [];
    if (mapPolyline) mapPolyline.setMap(null);
    directionsRenderer.setDirections({ routes: [] });
    mapPlaceholder.style.display = 'none';

    // 2. Markers & Coords
    const pathCoords = [];
    points.forEach((pt, index) => {
      if (typeof pt.lat === 'number' && typeof pt.lon === 'number') {
        const latLng = { lat: pt.lat, lng: pt.lon };
        pathCoords.push(latLng);

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

    // 3. DECISION: Direct Lines OR Roads?
    if (chkDirect.checked || points.length > 25) {
      drawFallbackPolyline(routePath);
      return;
    }

    // 4. Road Directions
    // Use the variable currentTravelMode ('DRIVING' or 'WALKING')
    const origin = routePath[0];
    const destination = routePath[routePath.length - 1];
    const waypoints = routePath.slice(1, -1).map(loc => ({
      location: loc,
      stopover: true
    }));

    directionsService.route({
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      travelMode: google.maps.TravelMode[currentTravelMode],
    }, (response, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(response);
      } else {
        console.warn("Directions request failed: " + status);
        drawFallbackPolyline(routePath);
      }
    });
  }

  // --------------------------------------------------------------------------
  // GEOCODING & HELPERS
  // --------------------------------------------------------------------------
  
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

  // --------------------------------------------------------------------------
  // APP LOGIC
  // --------------------------------------------------------------------------

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (cls ? (' ' + cls) : '');
  }

  function defaultExample() {
    return [
      '# My Ljubljana Trip',
      '# --- Start ---',
      '46.0428, 14.4500 | Home START',
      '',
      '# --- Stops (Addresses & GPS) ---',
      'Prešernov trg, Ljubljana',
      'Zmajski most, Ljubljana',
      '46.0681, 14.4701 | Cinema',
      'Tivoli Park, Ljubljana',
      '46.0389, 14.5108',
      'Ljubljanski grad, Ljubljana',
    ].join('\n');
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
    btnFast.disabled = disabled;
    btnBalanced.disabled = disabled;
    inputEl.disabled = disabled;
  }

  async function run(profile) {
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
    }
  };

  btnFast.addEventListener('click', () => run('fast'));
  btnBalanced.addEventListener('click', () => run('balanced'));
  
  // Listeners
  btnHelp.addEventListener('click', (e) => { e.preventDefault(); showHelp(); });
  btnCloseHelp.addEventListener('click', (e) => { e.preventDefault(); hideHelp(); });

  // Mode Button Listeners
  btnDriving.addEventListener('click', () => setTravelMode('DRIVING'));
  btnWalking.addEventListener('click', () => setTravelMode('WALKING'));

  chkDirect.addEventListener('change', () => {
    if (lastSolvedPoints) updateMapVisualization(lastSolvedPoints);
  });
  
  inputEl.value = defaultExample();
})();