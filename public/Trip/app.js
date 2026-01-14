(() => {
  'use strict';

  // --- CONFIGURATION ---
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA'; 
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  // --- HELPER ---
  const $ = (id) => document.getElementById(id);
  const worker = new Worker('worker.js');
  const STORAGE_KEY = '8z_trip_backup_v1';

  // --- STATE ---
  let map, geocoder, directionsService, infoWindow;
  let mapMarkers = [], directionsRenderers = [], mapPolyline = null;
  let lastSolvedPoints = null, chatHistoryBuffer = [], currentGeminiModel = '', currentTravelMode = 'DRIVING';

  // --- HTML CONTENT ---
  const HELP_HTML = `
    <h2>📖 Guide</h2><hr>
    <p><strong>1. Add Stops:</strong> Type cities or GPS (48.85, 2.35) in the box.</p>
    <p><strong>2. Optimize:</strong> Use 'Standard' for speed, 'Precise' for complex trips (10+ stops).</p>
    <p><strong>3. AI:</strong> Use the bottom bar to ask Gemini for suggestions.</p>`;

  const ABOUT_HTML = `
    <h2>ℹ️ About</h2><hr>
    <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:6px;border-left:3px solid #3b82f6;margin-bottom:15px;">
    <h3>The Morocco Story</h3>
    <p>Created during a backpacking trip in the Atlas Mountains where I realized standard maps fail at logistics. This tool solves the "Traveler's Salesman Problem" locally.</p>
    </div>
    <p><strong>v2026.1</strong> • Genetic Optimizer • Gemini AI</p>`;

  const DARK_STYLE = [{elementType:"geometry",stylers:[{color:"#242f3e"}]},{elementType:"labels.text.stroke",stylers:[{color:"#242f3e"}]},{elementType:"labels.text.fill",stylers:[{color:"#746855"}]},{featureType:"administrative.locality",elementType:"labels.text.fill",stylers:[{color:"#d59563"}]},{featureType:"road",elementType:"geometry",stylers:[{color:"#38414e"}]},{featureType:"road",elementType:"geometry.stroke",stylers:[{color:"#212a37"}]},{featureType:"water",elementType:"geometry",stylers:[{color:"#17263c"}]}];

  // --- CORE FUNCTIONS ---
  function setStatus(msg) {
    const el = $('status'); if(el) el.textContent = msg;
  }

  function toggleChat(forceOpen) {
    const p = $('chatPanel');
    if(forceOpen || !p.classList.contains('open')) {
      p.classList.add('open');
      $('chatInput').focus();
    } else {
      p.classList.remove('open');
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
    if (currentTravelMode === 'DRIVING') {
      dr.classList.add('active'); wk.classList.remove('active');
    } else {
      wk.classList.add('active'); dr.classList.remove('active');
    }
  }

  // --- MAP ---
  function loadGoogleMaps() {
    if (window.google) return;
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap&loading=async&v=weekly`;
    document.body.appendChild(s);
    $('btnEnableMap').textContent = "Loading...";
  }

  window.initMap = function() {
    map = new google.maps.Map($('map'), { zoom:12, center:{lat:46.0569,lng:14.5058}, mapTypeId:'hybrid', styles:DARK_STYLE });
    geocoder = new google.maps.Geocoder();
    directionsService = new google.maps.DirectionsService();
    infoWindow = new google.maps.InfoWindow();
    $('mapPlaceholder').style.display = 'none';
    restoreState();
  };

  function updateMap(points) {
    if (!map) return;
    mapMarkers.forEach(m => m.setMap(null)); mapMarkers=[];
    directionsRenderers.forEach(d => d.setMap(null)); directionsRenderers=[];
    if(mapPolyline) { mapPolyline.setMap(null); mapPolyline=null; }

    const bounds = new google.maps.LatLngBounds();
    points.forEach((pt, i) => {
      const loc = { lat: pt.lat, lng: pt.lon };
      bounds.extend(loc);
      const m = new google.maps.Marker({ position: loc, map: map, label: (i+1).toString(), title: pt.name });
      m.addListener("click", () => {
        infoWindow.setContent(`<strong>#${i+1} ${pt.name}</strong>`);
        infoWindow.open(map, m);
      });
      mapMarkers.push(m);
    });

    if ($('chkDirect').checked) {
      mapPolyline = new google.maps.Polyline({ path: points.map(p => ({lat:p.lat, lng:p.lon})), geodesic: true, strokeColor: "#3b82f6", strokeWeight: 4 });
      mapPolyline.setMap(map);
    } else {
      const path = points.map(p => ({lat:p.lat, lng:p.lon}));
      if ($('chkRoundTrip').checked) path.push(path[0]);
      
      for(let i=0; i<path.length-1; i+=24) {
        const seg = path.slice(i, i+25);
        const r = new google.maps.DirectionsRenderer({ map:map, suppressMarkers:true, polylineOptions:{strokeColor:"#3b82f6", strokeWeight:5} });
        directionsRenderers.push(r);
        directionsService.route({
          origin: seg[0], destination: seg[seg.length-1],
          waypoints: seg.slice(1,-1).map(l => ({location:l, stopover:true})),
          travelMode: google.maps.TravelMode[currentTravelMode]
        }, (res, st) => { if(st === "OK") r.setDirections(res); });
      }
    }
    map.fitBounds(bounds);
  }

  // --- ENGINE ---
  async function run(profile) {
    if (!window.google) { loadGoogleMaps(); return; }
    
    const lines = $('input').value.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    if (lines.length < 2) return alert("Please enter at least 2 locations.");

    const pts = [];
    for (let line of lines) {
      // Check for Coord
      const m = line.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
      if (m) {
        pts.push({ name: line.replace(m[0],'').trim() || 'Pt', lat: parseFloat(m[1]), lon: parseFloat(m[2]) });
      } else {
        // Geocode
        try {
          const res = await new Promise(r => geocoder.geocode({ address: line }, (res, st) => r(st==='OK'?res[0]:null)));
          if (res) pts.push({ name: line.trim(), lat: res.geometry.location.lat(), lon: res.geometry.location.lng() });
          await new Promise(r => setTimeout(r, 250)); // Throttle
        } catch(e) {}
      }
    }

    worker.postMessage({
      type: 'solve', profile: profile, points: pts,
      roundTrip: $('chkRoundTrip').checked
    });
  }

  worker.onmessage = (e) => {
    const { pointsSorted, totalKm, baseKm } = e.data;
    lastSolvedPoints = pointsSorted;
    $('distKm').textContent = totalKm.toFixed(2) + ' km';
    $('savedKm').textContent = (baseKm - totalKm).toFixed(2) + ' km';
    $('routeList').innerHTML = pointsSorted.map(p => `<li>${p.name}</li>`).join('');
    updateMap(pointsSorted);
    
    // Links
    const baseUrl = "https://www.google.com/maps/dir/?$";
    const origin = `${pointsSorted[0].lat},${pointsSorted[0].lon}`;
    const destIdx = $('chkRoundTrip').checked ? 0 : pointsSorted.length-1;
    const dest = `${pointsSorted[destIdx].lat},${pointsSorted[destIdx].lon}`;
    const waypoints = pointsSorted.slice(1, destIdx===0 ? pointsSorted.length : pointsSorted.length-1).map(p => `${p.lat},${p.lon}`).join('|');
    
    $('links').innerHTML = `<a href="${baseUrl}&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=${currentTravelMode.toLowerCase()}" target="_blank" style="display:block; margin-top:10px; color:#3b82f6; text-align:center;">Open in Google Maps ↗</a>`;
  };

  // --- AI ---
  async function initAI() {
    try {
      const d = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`)).json();
      const v = d.models.filter(m => m.name.includes('gemini') && !m.name.match(/image|vision/));
      v.sort((a,b) => { 
        const g = n => (n.match(/gemini-(\d+(\.\d+)?)/)||[,0])[1];
        return parseFloat(g(b.name)) - parseFloat(g(a.name));
      });
      const s = $('modelSelector');
      if(s) {
        s.innerHTML = '';
        v.forEach(m => { const o = document.createElement('option'); o.value = m.name; o.textContent = m.displayName; s.appendChild(o); });
        currentGeminiModel = v[0]?.name;
        s.onchange = () => currentGeminiModel = s.value;
      }
    } catch(e){}
  }

  async function callAI(txt) {
    chatHistoryBuffer.push({ role: "user", parts: [{ text: txt }] });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{role:"user", parts:[{text:"AI Assistant. Use {ADD: Place} to add stops."}]}, ...chatHistoryBuffer] })
    });
    const d = await res.json();
    const t = d.candidates?.[0]?.content?.parts?.[0]?.text || "Error";
    chatHistoryBuffer.push({ role: "model", parts: [{ text: t }] });
    return t;
  }

  // --- LIBRARY ---
  function initLib() {
    if (!window.TRIP_LIBRARY) return;
    const tree = $('presetTree');
    tree.innerHTML = '';
    window.TRIP_LIBRARY.forEach(reg => {
      const d = document.createElement('div');
      d.innerHTML = `<div class="tree-header">› ${reg.region}</div><div class="tree-group"></div>`;
      const g = d.querySelector('.tree-group');
      
      reg.categories.forEach(cat => {
        const cd = document.createElement('div');
        cd.innerHTML = `<div class="tree-header">› ${cat.name}</div><div class="tree-group"></div>`;
        const cg = cd.querySelector('.tree-group');
        cat.items.forEach(trip => {
          const item = document.createElement('span');
          item.className = 'tree-item';
          item.textContent = trip.label;
          item.onclick = () => { $('input').value = trip.data; saveState(); };
          cg.appendChild(item);
        });
        cd.querySelector('.tree-header').onclick = function() { cg.classList.toggle('open'); };
        g.appendChild(cd);
      });
      d.querySelector('.tree-header').onclick = function() { g.classList.toggle('open'); };
      tree.appendChild(d);
    });
  }

  // --- INIT SAFEGUARD ---
  document.addEventListener('DOMContentLoaded', () => {
    initLib();
    initAI();
    restoreState();

    // Buttons
    $('btnStandard').onclick = () => run('standard');
    $('btnDeep').onclick = () => run('deep');
    $('btnDriving').onclick = () => { currentTravelMode='DRIVING'; updateModeButtons(); saveState(); };
    $('btnWalking').onclick = () => { currentTravelMode='WALKING'; updateModeButtons(); saveState(); };
    $('btnEnableMap').onclick = loadGoogleMaps;
    
    // File
    $('btnSave').onclick = () => { 
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$('input').value],{type:'text/plain'})); a.download='trip.txt'; a.click(); 
    };
    $('btnLoad').onclick = () => $('fileLoader').click();
    $('fileLoader').onchange = (e) => {
      const f = e.target.files[0];
      if(f) { const r=new FileReader(); r.onload=(v)=>{$('input').value=v.target.result;saveState();}; r.readAsText(f); }
    };

    // Chat
    $('btnSendChat').onclick = async () => {
      const i = $('chatInput');
      const t = i.value.trim();
      if(!t) return;
      i.value = '';
      
      const h = $('chatHistory');
      h.innerHTML += `<div class="msg user">${t}</div>`;
      
      const r = await callAI(t);
      // Tag Parser
      const m = r.match(/\{ADD:\s*(.*?)\}/g);
      if(m) m.forEach(x => {
        const loc = x.replace(/\{ADD:\s*|\}/g,'').trim();
        if(!$('input').value.includes(loc)) $('input').value += '\n' + loc;
      });
      
      h.innerHTML += `<div class="msg ai"><strong>Gemini:</strong> ${r.replace(/\n/g,'<br>')}</div>`;
      h.scrollTop = h.scrollHeight;
    };

    // Modals
    const h = $('helpOverlay');
    $('btnHelp').onclick = () => { h.style.display='flex'; $('helpBody').innerHTML = HELP_HTML; };
    $('btnAbout').onclick = () => { h.style.display='flex'; $('helpBody').innerHTML = ABOUT_HTML; };
    $('btnCloseHelp').onclick = () => h.style.display='none';
    
    // Search
    $('tripSearch').oninput = (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.tree-item').forEach(i => {
        i.style.display = i.textContent.toLowerCase().includes(q) ? 'block' : 'none';
        if(q && i.style.display==='block') {
          let p = i.parentElement;
          while(p && p.id!=='presetTree') { if(p.classList.contains('tree-group')) p.classList.add('open'); p=p.parentElement; }
        }
      });
    };
  });

})();