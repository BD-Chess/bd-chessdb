(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // UI Elements
  const inputEl = $('input');
  const statusEl = $('status');
  const btnStandard = $('btnStandard');
  const btnDeep = $('btnDeep');
  
  // Collapse Panel
  const btnCollapse = $('btnCollapse');
  const btnExpand = $('btnExpand');
  const leftPanel = $('leftPanel');

  // Files
  const btnSave = $('btnSave');
  const btnLoad = $('btnLoad');
  const fileLoader = $('fileLoader');

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

  const mapPlaceholder = $('mapPlaceholder');
  const helpOverlay = $('helpOverlay');
  const btnHelp = $('btnHelp');
  const btnCloseHelp = $('btnCloseHelp');

  const worker = new Worker('worker.js');

  // State
  let map;
  let geocoder;
  let directionsService;
  let directionsRenderers = [];
  let mapMarkers = [];
  let mapPolyline = null;
  let lastSolvedPoints = null;
  let currentTravelMode = 'DRIVING'; 

  // --- PRESET DATA ---
  const PRESETS = {
    // --- EU SPLIT ---
    'EUROPE_NORTH': `# 🇪🇺 EU Capitals (North/West - 13 Stops)
Dublin, Ireland START
Helsinki, Finland
Stockholm, Sweden
Tallinn, Estonia
Riga, Latvia
Vilnius, Lithuania
Copenhagen, Denmark
Berlin, Germany
Warsaw, Poland
Amsterdam, Netherlands
Brussels, Belgium
Luxembourg City, Luxembourg
Paris, France`,

    'EUROPE_SOUTH': `# 🇪🇺 EU Capitals (South/East - 14 Stops)
Lisbon, Portugal START
Madrid, Spain
Rome, Italy
Valletta, Malta
Athens, Greece
Nicosia, Cyprus
Sofia, Bulgaria
Bucharest, Romania
Budapest, Hungary
Vienna, Austria
Bratislava, Slovakia
Prague, Czechia
Ljubljana, Slovenia
Zagreb, Croatia`,

    'SLOVENIA_DRIVE': `# 🇸🇮 Slovenia Full Loop (Driving)
Ljubljana START
Lake Bled
Postojna Cave
Piran
Maribor
Triglav National Park
Predjama Castle
Velika Planina`,

    'CALIFORNIA': `# 🇺🇸 California Road Trip (Driving)
San Francisco, CA START
Yosemite National Park, CA
Monterey, CA
Santa Barbara, CA
Los Angeles, CA
San Diego, CA
Death Valley National Park, CA
Las Vegas, NV`,

    'GERMANY': `# 🇩🇪 Germany Autobahn (Driving)
Berlin, Germany START
Hamburg, Germany
Cologne, Germany
Frankfurt, Germany
Heidelberg, Germany
Munich, Germany
Neuschwanstein Castle, Germany`,

    'ICELAND': `# 🇮🇸 Iceland Ring Road (Driving)
Reykjavik, Iceland START
Vik, Iceland
Hofn, Iceland
Egilsstadir, Iceland
Akureyri, Iceland
Snaefellsnes Peninsula, Iceland
Golden Circle, Iceland`,

    // === WALKING TOURS ===
    'VIENNA': `# 🇦🇹 Vienna Walking
St. Stephen's Cathedral, Vienna
Hofburg Palace, Vienna
Schönbrunn Palace, Vienna
Belvedere Palace, Vienna
Prater, Vienna
Naschmarkt, Vienna`,

    'PARIS': `# 🇫🇷 Paris Walking
Eiffel Tower, Paris
Louvre Museum, Paris
Notre Dame Cathedral, Paris
Arc de Triomphe, Paris
Sacré-Cœur, Paris
Jardin du Luxembourg, Paris`,

    'ROME': `# 🇮🇹 Rome Walking
Colosseum, Rome
Pantheon, Rome
Trevi Fountain, Rome
Spanish Steps, Rome
St. Peter's Basilica, Vatican City`,

    'NY': `# 🇺🇸 New York Manhattan (Walking/Metro)
Times Square, New York START
Central Park, New York
Empire State Building, New York
Brooklyn Bridge, New York
Statue of Liberty, New York
9/11 Memorial, New York`,

    'TOKYO': `# 🇯🇵 Tokyo Highlights (Metro)
Shinjuku Station, Tokyo START
Shibuya Crossing, Tokyo
Senso-ji, Tokyo
Meiji Jingu, Tokyo
Tokyo Tower
Akihabara, Tokyo`,

    'LJUBLJANA': `# 🇸🇮 Ljubljana Walking
Prešernov trg, Ljubljana
Ljubljana Castle
Dragon Bridge, Ljubljana
Tivoli Park, Ljubljana
Metelkova Art Center`,

    'PRAGUE': `# 🇨🇿 Prague Walking
Charles Bridge, Prague
Prague Castle
Old Town Square, Prague
Wenceslas Square, Prague
Dancing House, Prague`,

    'BERLIN': `# 🇩🇪 Berlin Walking
Brandenburg Gate, Berlin
Reichstag Building, Berlin
Berlin Wall Memorial
Checkpoint Charlie, Berlin
Alexanderplatz, Berlin`,

    'MADRID': `# 🇪🇸 Madrid Walking
Royal Palace of Madrid
Plaza Mayor, Madrid
Retiro Park, Madrid
Prado Museum, Madrid
Puerta del Sol, Madrid`,

    'AMSTERDAM': `# 🇳🇱 Amsterdam Walking
Rijksmuseum, Amsterdam
Anne Frank House, Amsterdam
Vondelpark, Amsterdam
Dam Square, Amsterdam
Red Light District, Amsterdam`,

    'COMPLEX_EU': `# 🇪🇺💀 THE GAUNTLET (Capitals + Stops)
# Warning: This is a massive route!
Vienna, Austria
Hofburg Palace, Vienna
Brussels, Belgium
Grand Place, Brussels
Sofia, Bulgaria
Alexander Nevsky Cathedral, Sofia
Zagreb, Croatia
Ban Jelačić Square, Zagreb
Nicosia, Cyprus
Prague, Czechia
Charles Bridge, Prague
Copenhagen, Denmark
Nyhavn, Copenhagen
Tallinn, Estonia
Helsinki, Finland
Paris, France
Eiffel Tower, Paris
Berlin, Germany
Brandenburg Gate, Berlin
Athens, Greece
Acropolis of Athens
Budapest, Hungary
Hungarian Parliament, Budapest
Dublin, Ireland
Temple Bar, Dublin
Rome, Italy
Colosseum, Rome
Riga, Latvia
Vilnius, Lithuania
Luxembourg City, Luxembourg
Valletta, Malta
Amsterdam, Netherlands
Rijksmuseum, Amsterdam
Warsaw, Poland
Old Town, Warsaw
Lisbon, Portugal
Belém Tower, Lisbon
Bucharest, Romania
Bratislava, Slovakia
Ljubljana, Slovenia
Ljubljana Castle
Madrid, Spain
Royal Palace, Madrid
Stockholm, Sweden
Gamla Stan, Stockholm`
  };

  const CUSTOM_DARK_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  ];

  window.initMap = function() {
    const defaultCenter = { lat: 46.0569, lng: 14.5058 }; 
    
    map = new google.maps.Map($('map'), {
      zoom: 12,
      center: defaultCenter,
      mapTypeId: 'hybrid',
      mapTypeControl: true,
      styles: CUSTOM_DARK_STYLE,
    });

    geocoder = new google.maps.Geocoder();
    directionsService = new google.maps.DirectionsService();
  };

  // --- TREE VIEW LOGIC ---
  const treeHeaders = document.querySelectorAll('.tree-header');
  treeHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const group = header.nextElementSibling;
      const icon = header.querySelector('.tree-icon');
      if (group) {
        if (group.classList.contains('open')) {
          group.classList.remove('open');
          icon.textContent = '[+]';
        } else {
          group.classList.add('open');
          icon.textContent = '[-]';
        }
      }
    });
  });

  const treeItems = document.querySelectorAll('.tree-item');
  treeItems.forEach(item => {
    item.addEventListener('click', () => {
      const key = item.getAttribute('data-key');
      loadPreset(key);
    });
  });

  function loadPreset(key) {
    clearMap();
    if (key && PRESETS[key]) {
      inputEl.value = PRESETS[key];
      setStatus(`Loaded preset: ${key}`, 'ok');
      
      const isWalking = key !== 'EUROPE_NORTH' && 
                        key !== 'EUROPE_SOUTH' &&
                        key !== 'SLOVENIA_DRIVE' && 
                        key !== 'CALIFORNIA' && 
                        key !== 'GERMANY' && 
                        key !== 'ICELAND' && 
                        key !== 'COMPLEX_EU';
      
      setTravelMode(isWalking ? 'WALKING' : 'DRIVING');
      chkRoundTrip.checked = true;
    }
  }

  // --- HELPERS ---
  function clearMap() {
    if (!map) return;
    mapMarkers.forEach(m => m.setMap(null));
    mapMarkers = [];
    if (mapPolyline) mapPolyline.setMap(null);
    directionsRenderers.forEach(dr => dr.setMap(null));
    directionsRenderers = [];
    
    mapPlaceholder.style.display = 'block'; 
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
    
    mapPlaceholder.style.display = 'none';

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
    updateOptimizeButtons(profile);

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

  function showHelp() { helpOverlay.classList.add('active'); }
  function hideHelp() { helpOverlay.classList.remove('active'); }

  // --- EVENT LISTENERS ---
  if (btnStandard) btnStandard.addEventListener('click', () => run('standard'));
  if (btnDeep) btnDeep.addEventListener('click', () => run('deep'));
  
  if (btnHelp) btnHelp.addEventListener('click', (e) => { e.preventDefault(); showHelp(); });
  if (btnCloseHelp) btnCloseHelp.addEventListener('click', (e) => { e.preventDefault(); hideHelp(); });

  if (btnDriving) btnDriving.addEventListener('click', () => setTravelMode('DRIVING'));
  if (btnWalking) btnWalking.addEventListener('click', () => setTravelMode('WALKING'));

  chkDirect.addEventListener('change', () => {
    if (lastSolvedPoints) updateMapVisualization(lastSolvedPoints);
  });
  
  chkGoogleStyle.addEventListener('change', (e) => {
    if (map) {
      map.setOptions({ styles: e.target.checked ? null : CUSTOM_DARK_STYLE });
    }
  });
  
})();