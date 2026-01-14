(() => {
  'use strict';

  // --- 1. CONFIG & STATE ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA'; 
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  const worker = new Worker('worker.js');
  const STORAGE_KEY = '8z_trip_backup_v1';
  const $ = (id) => document.getElementById(id);

  let map, geocoder, directionsService, infoWindow;
  let mapMarkers = [], directionsRenderers = [], mapPolyline = null;
  let lastSolvedPoints = null, currentTravelMode = 'DRIVING', mapScriptLoadingPromise = null;
  let presetLookup = {};
  let chatHistoryBuffer = [];
  let currentGeminiModel = '';

  const DARK_STYLE = [
    {elementType:"geometry",stylers:[{color:"#242f3e"}]},
    {elementType:"labels.text.stroke",stylers:[{color:"#242f3e"}]},
    {elementType:"labels.text.fill",stylers:[{color:"#746855"}]},
    {featureType:"administrative.locality",elementType:"labels.text.fill",stylers:[{color:"#d59563"}]},
    {featureType:"road",elementType:"geometry",stylers:[{color:"#38414e"}]},
    {featureType:"road",elementType:"geometry.stroke",stylers:[{color:"#212a37"}]},
    {featureType:"water",elementType:"geometry",stylers:[{color:"#17263c"}]}
  ];

  // --- 2. HTML CONTENT (From ZIP) ---
  const HELP_HTML = `
    <h2>How to Use</h2>
    <ul>
      <li><strong>1. Trip Library:</strong> Click the folders above.</li>
      <li><strong>2. Edit:</strong> Add/remove stops in the text box.</li>
      <li><strong>3. Optimize:</strong> Use "Standard" (Fast) or "Precise" (Deep).</li>
      <li><strong>4. Export:</strong> Click "Open in Maps" to navigate.</li>
    </ul>
    <h2>Input Formats</h2>
    <p>Supported: <code>GPS (46.0, 14.5)</code>, <code>Address</code>, or <code>Name | GPS</code>.</p>
    <p>Add <code>START</code> to lock the first stop.</p>
  `;
  const ABOUT_HTML = `
    <h2>ℹ️ About 8Z-RP</h2>
    <p><strong>Deterministic:</strong> Same Input ⇒ Same Route.</p>
    <p><strong>Client-Side:</strong> Processed locally using Genetic Algorithms.</p>
    <div style="background:rgba(59,130,246,0.1); padding:10px; border-radius:6px; border-left:3px solid #3b82f6; margin-top:10px;">
      <h3>The Morocco Inspiration</h3>
      <p>Created to solve the logistical nightmare of multi-stop travel that standard maps can't handle.</p>
    </div>
  `;

  // --- 3. UTILS ---
  function setStatus(msg, cls) {
    const el = $('status'); 
    if(el) { el.textContent = msg; el.style.display = 'block'; el.style.color = cls==='bad'?'#ef4444':(cls==='warn'?'#f59e0b':'#10b981'); if(cls==='ok') setTimeout(()=>{el.style.display='none'},4000); }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ t: $('input').value, m: currentTravelMode })); }
  function restoreState() { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); if(s) { $('input').value = s.t||''; currentTravelMode = s.m||'DRIVING'; updateModeButtons(); } }
  
  function updateModeButtons() {
    const dr=$('btnDriving'), wk=$('btnWalking');
    if (currentTravelMode === 'DRIVING') { dr.classList.add('active'); wk.classList.remove('active'); }
    else { wk.classList.add('active'); dr.classList.remove('active'); }
    if (lastSolvedPoints) {
      updateMapVisualization(lastSolvedPoints);
      renderLinks(buildMapsLegLinks(lastSolvedPoints, $('chkRoundTrip').checked, currentTravelMode));
    }
  }

  // --- 4. MAPS LOGIC ---
  function ensureMapsLoaded() {
    if (window.google && window.google.maps) return Promise.resolve();
    if (mapScriptLoadingPromise) return mapScriptLoadingPromise;
    mapScriptLoadingPromise = new Promise((resolve, reject) => {
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

    // Reset Map
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
      // 25 Waypoint Limit Chunking
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
    google.maps.event.trigger(map, 'resize');
    map.fitBounds(bounds);
  }

  // --- 5. PARSING & GEOCODING ---
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

      let name = raw, lat = null, lon = null;
      if (raw.includes('|')) {
        const p = raw.split('|');
        const m = coordRe.exec(p[1]); 
        if (m) { name = p[0].trim(); lat = parseFloat(m[1]); lon = parseFloat(m[2]); }
      } else {
        const m = coordRe.exec(raw);
        if (m) { lat = parseFloat(m[1]); lon = parseFloat(m[2]); name = raw.replace(m[0], '').trim() || `(${lat},${lon})`; }
      }
      const p = { name, lat, lon };
      if (isStart) startIdx = pts.length;
      pts.push(p);
    }
    return { pts, startIdx };
  }

  async function resolveLocation(rawName) {
    if (!geocoder) return null;
    return new Promise(r => geocoder.geocode({ address: rawName }, (res, st) => r(st==='OK' && res[0] ? { lat: res[0].geometry.location.lat(), lon: res[0].geometry.location.lng() } : null)));
  }

  // --- 6. OPTIMIZATION RUNNER ---
  async function run(profile) {
    if (!window.google) { setStatus('Loading Map...', 'ok'); await ensureMapsLoaded(); }
    
    let { pts, startIdx } = parseStops($('input').value);
    
    // Geocode missing coords
    const missing = pts.filter(p => p.lat === null);
    if (missing.length > 0) {
      setStatus(`Looking up ${missing.length} places...`, 'warn');
      for (const p of missing) {
        const res = await resolveLocation(p.name);
        if (res) { p.lat = res.lat; p.lon = res.lon; }
        await new Promise(r => setTimeout(r, 250));
      }
    }

    const valid = pts.filter(p => p.lat !== null);
    if (valid.length < 2) return setStatus('Need 2+ valid stops.', 'bad');

    setStatus(`Optimizing ${valid.length} stops...`, 'ok');
    
    // Send to Worker
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
    // COMPATIBILITY FIX: Handle 'result' type from ZIP worker
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
    } else if (msg.type === 'error') {
      setStatus(msg.error, 'bad');
    }
  };

  function buildMapsLegLinks(routePts, roundTrip, mode) {
    const travelmode = mode === 'DRIVING' ? 'driving' : 'walking';
    const encodeLoc = (p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    const seq = routePts.slice();
    if (roundTrip && seq.length > 1) seq.push(seq[0]);

    const links = [];
    let i = 0;
    while (i < seq.length - 1) {
      const origin = seq[i];
      let j = Math.min(seq.length - 1, i + 10); // 10 stop legs
      const segment = seq.slice(i, j + 1);
      
      const originLoc = encodeLoc(segment[0]);
      const destLoc = encodeLoc(segment[segment.length-1]);
      const mids = segment.slice(1, -1).map(encodeLoc);
      
      let url = `https://www.google.com/maps/dir/?api=1&origin=$?api=1&origin=${originLoc}&destination=${destLoc}&travelmode=${travelmode}`;
      if (mids.length) url += `&waypoints=${mids.join('|')}`;
      
      links.push({ url, label: `Leg ${links.length+1} (${segment.length} stops)` });
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

  // --- 7. LIBRARY & AI ---
  function initTripTree() {
    if (!window.TRIP_LIBRARY) return;
    const t = $('presetTree'); t.innerHTML = '';
    presetLookup = {};
    window.TRIP_LIBRARY.forEach(r => {
      const d = document.createElement('div');
      d.innerHTML = `<div class="tree-header">› ${r.region}</div><div class="tree-group"></div>`;
      r.categories.forEach(c => {
        const cd = document.createElement('div'); cd.innerHTML = `<div class="tree-header">› ${c.name}</div><div class="tree-group"></div>`;
        c.items.forEach(i => {
          presetLookup[i.id] = i.data;
          const sp = document.createElement('span'); sp.className='tree-item'; sp.textContent = i.label;
          sp.onclick = () => { 
            $('input').value = i.data; saveState(); 
            if(i.id.includes('GLOBAL')) { $('chkDirect').checked=true; currentTravelMode='DRIVING'; }
            else if(i.id.includes('WALKING')) currentTravelMode='WALKING';
            else currentTravelMode='DRIVING';
            updateModeButtons();
          };
          cd.lastChild.appendChild(sp);
        });
        cd.firstChild.onclick = function(){ this.nextSibling.classList.toggle('open'); };
        d.lastChild.appendChild(cd);
      });
      d.firstChild.onclick = function(){ this.nextSibling.classList.toggle('open'); };
      t.appendChild(d);
    });
  }

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

  // --- 8. INIT ---
  document.addEventListener('DOMContentLoaded', () => {
    initTripTree(); initAI(); restoreState();

    $('btnStandard').onclick = () => run('standard');
    $('btnDeep').onclick = () => run('deep');
    $('btnDriving').onclick = () => { currentTravelMode='DRIVING'; updateModeButtons(); saveState(); };
    $('btnWalking').onclick = () => { currentTravelMode='WALKING'; updateModeButtons(); saveState(); };
    $('btnEnableMap').onclick = () => ensureMapsLoaded();
    
    $('btnSave').onclick = () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([$('input').value],{type:'text/plain'})); a.download='trip.txt'; a.click(); };
    $('btnLoad').onclick = () => $('fileLoader').click();
    $('fileLoader').onchange = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=(v)=>{$('input').value=v.target.result;saveState();};r.readAsText(f);} };
    $('tripSearch').oninput = (e) => { 
        const q=e.target.value.toLowerCase(); document.querySelectorAll('.tree-item').forEach(i=>{ 
        i.style.display=i.textContent.toLowerCase().includes(q)?'block':'none';
        if(q&&i.style.display==='block'){let p=i.parentElement;while(p.id!=='presetTree'){if(p.classList.contains('tree-group'))p.classList.add('open');p=p.parentElement;}}}); 
    };

    $('btnSendChat').onclick = async () => {
        const i=$('chatInput'), t=i.value.trim(), h=$('chatHistory'); if(!t)return; i.value='';
        h.innerHTML+=`<div class="msg user">${t}</div>`; h.scrollTop=h.scrollHeight;
        const r=await callAI(t);
        const m=r.match(/\{ADD:\s*(.*?)\}/g); if(m) m.forEach(x=>{ const l=x.replace(/\{ADD:\s*|\}/g,'').trim(); if(!$('input').value.includes(l))$('input').value+=($('input').value?'\n':'')+l; });
        h.innerHTML+=`<div class="msg ai"><strong>Gemini:</strong> ${r.replace(/\n/g,'<br>')}</div>`; h.scrollTop=h.scrollHeight;
    };
    
    const h=$('helpOverlay'); $('btnHelp').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=HELP_HTML;}; $('btnAbout').onclick=()=>{h.style.display='flex';$('helpBody').innerHTML=ABOUT_HTML;}; $('btnCloseHelp').onclick=()=>h.style.display='none';
  });
})();
