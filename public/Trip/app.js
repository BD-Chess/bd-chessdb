(() => {
  'use strict';

  // ==========================================================================
  //  1. CONFIGURATION & SECURITY
  // ==========================================================================
  
  const GOOGLE_API_KEY = 'AIzaSyDnoXSDUJx19gruRE3ZRzgQRYZwWDa4KlA'; 
  
  // Scrambled Key (Safety)
  const _s1 = 'QUl6YVN5Q3hIanBw', _s2 = 'S2l4YW85OU5IOURv', _s3 = 'YWYtUTBLTzRmQ1FhZUhz';
  const GEMINI_API_KEY = atob(_s1) + atob(_s2) + atob(_s3);

  const worker = new Worker('worker.js');
  const STORAGE_KEY = '8z_trip_backup_v1';
  
  let map, geocoder, directionsService, infoWindow;
  let mapMarkers = [], directionsRenderers = [], mapPolyline = null;
  let lastSolvedPoints = null, chatHistoryBuffer = [], currentGeminiModel = '', currentTravelMode = 'DRIVING';
  
  // Tracks if we are currently waiting for Google Script to finish
  let mapScriptLoadingPromise = null; 


  // ==========================================================================
  //  2. HELPER FUNCTIONS
  // ==========================================================================
  
  const $ = (id) => document.getElementById(id);

  function setStatus(msg, type) {
    const el = $('status');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
      if (type === 'ok') setTimeout(() => { el.style.display = 'none'; }, 3000);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: $('input').value, mode: currentTravelMode }));
  }

  function restoreState() {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s) {
      $('input').value = s.text || '';
      currentTravelMode = s.mode || 'DRIVING';
      updateModeButtons();
    }
  }

  function updateModeButtons() {
    const btnDrive = $('btnDriving'), btnWalk = $('btnWalking');
    if (currentTravelMode === 'DRIVING') {
      btnDrive.classList.add('active'); btnWalk.classList.remove('active');
    } else {
      btnWalk.classList.add('active'); btnDrive.classList.remove('active');
    }
  }


  // ==========================================================================
  //  3. HTML CONTENT
  // ==========================================================================

  const HELP_HTML = `
    <div style="padding: 10px;">
      <h2>📖 Guide</h2><hr style="border-color:#334155; margin:15px 0;">
      <h3 style="color:#3b82f6;">1. Add Stops</h3>
      <p>Type cities or GPS coordinates (48.85, 2.35).</p>
      <h3 style="color:#3b82f6;">2. Optimize</h3>
      <p><strong>Standard:</strong> Fast result.<br><strong>Precise:</strong> Genetic Algorithm (Deep) for 10+ stops.</p>
      <h3 style="color:#3b82f6;">3. AI</h3>
      <p>Ask Gemini to "Add 5 museums in Rome".</p>
    </div>`;

  const ABOUT_HTML = `
    <div style="padding: 10px;">
      <h2>ℹ️ About</h2><hr style="border-color:#334155; margin:15px 0;">
      <div style="background:rgba(59,130,246,0.1); padding:15px; border-left:4px solid #3b82f6; margin-bottom:20px;">
        <h3 style="margin-top:0;">The Morocco Story</h3>
        <p>Created during a backpacking trip in the Atlas Mountains. Standard maps are great for driving, but fail at <em>logistics</em>. This tool solves the route efficiency problem locally.</p>
      </div>
      <p><strong>v2026.1</strong> • Privacy First • Gemini AI</p>
    </div>`;


  // ==========================================================================
  //  4. GOOGLE MAPS ENGINE (FIXED LOADING)
  // ==========================================================================

  // Returns a Promise that resolves when Google Maps is ready
  function ensureMapsLoaded() {
    // 1. Already loaded?
    if (window.google && window.google.maps) return Promise.resolve();

    // 2. Already loading? Return the existing promise
    if (mapScriptLoadingPromise) return mapScriptLoadingPromise;

    // 3. Start loading
    mapScriptLoadingPromise = new Promise((resolve, reject) => {
      // Hook into the global initMap callback
      window.initMap = function() {
        // Initialize the map objects
        map = new google.maps.Map($('map'), {
          zoom: 12, center: { lat: 46.0569, lng: 14.5058 }, mapTypeId: 'hybrid',
          styles: [{elementType:"geometry",stylers:[{color:"#242f3e"}]},{elementType:"labels.text.stroke",stylers:[{color:"#242f3e"}]},{elementType:"labels.text.fill",stylers:[{color:"#746855"}]},{featureType:"administrative.locality",elementType:"labels.text.fill",stylers:[{color:"#d59563"}]},{featureType:"road",elementType:"geometry",stylers:[{color:"#38414e"}]},{featureType:"road",elementType:"geometry.stroke",stylers:[{color:"#212a37"}]},{featureType:"water",elementType:"geometry",stylers:[{color:"#17263c"}]}]
        });
        geocoder = new google.maps.Geocoder();
        directionsService = new google.maps.DirectionsService();
        infoWindow = new google.maps.InfoWindow();
        
        // Hide placeholder
        $('mapPlaceholder').style.display = 'none';
        restoreState();
        
        // Resolve the promise to let callers know we are done
        resolve();
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap&loading=async&v=weekly`;
      script.onerror = reject;
      document.body.appendChild(script);
      
      const btn = $('btnEnableMap');
      if(btn) btn.textContent = "Loading API...";
    });

    return mapScriptLoadingPromise;
  }

  function updateMapVisualization(points) {
    if (!map) return;
    mapMarkers.forEach(m => m.setMap(null)); mapMarkers = [];
    directionsRenderers.forEach(d => d.setMap(null)); directionsRenderers = [];
    if (mapPolyline) { mapPolyline.setMap(null); mapPolyline = null; }

    const bounds = new google.maps.LatLngBounds();

    points.forEach((pt, i) => {
      const loc = { lat: pt.lat, lng: pt.lon };
      bounds.extend(loc);
      const marker = new google.maps.Marker({ position: loc, map: map, label: (i + 1).toString(), title: pt.name });
      marker.addListener("click", () => {
        infoWindow.setContent(`<strong>#${i + 1} ${pt.name}</strong>`);
        infoWindow.open(map, marker);
      });
      mapMarkers.push(marker);
    });

    if ($('chkDirect').checked) {
      mapPolyline = new google.maps.Polyline({
        path: points.map(p => ({ lat: p.lat, lng: p.lon })),
        geodesic: true, strokeColor: "#3b82f6", strokeWeight: 4
      });
      mapPolyline.setMap(map);
    } else {
      const path = points.map(p => ({ lat: p.lat, lng: p.lon }));
      if ($('chkRoundTrip').checked) path.push(path[0]);

      for (let i = 0; i < path.length - 1; i += 24) {
        const seg = path.slice(i, i + 25);
        const r = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: true, polylineOptions: { strokeColor: "#3b82f6", strokeWeight: 5 } });
        directionsRenderers.push(r);
        directionsService.route({
          origin: seg[0], destination: seg[seg.length - 1],
          waypoints: seg.slice(1, -1).map(l => ({ location: l, stopover: true })),
          travelMode: google.maps.TravelMode[currentTravelMode]
        }, (res, st) => { if (st === "OK") r.setDirections(res); });
      }
    }
    map.fitBounds(bounds);
  }


  // ==========================================================================
  //  5. LIBRARY
  // ==========================================================================

  function initTripTree() {
    if (!window.TRIP_LIBRARY) return;
    const tree = $('presetTree');
    tree.innerHTML = '';

    window.TRIP_LIBRARY.forEach(region => {
      const rNode = document.createElement('div');
      rNode.innerHTML = `<div class="tree-header">› ${region.region}</div><div class="tree-group"></div>`;
      const rGroup = rNode.querySelector('.tree-group');

      region.categories.forEach(cat => {
        const cNode = document.createElement('div');
        cNode.innerHTML = `<div class="tree-header">› ${cat.name}</div><div class="tree-group"></div>`;
        const cGroup = cNode.querySelector('.tree-group');

        cat.items.forEach(trip => {
          const item = document.createElement('span');
          item.className = 'tree-item';
          item.textContent = trip.label;
          item.onclick = () => { $('input').value = trip.data; saveState(); };
          cGroup.appendChild(item);
        });

        cNode.querySelector('.tree-header').onclick = function() {
          cGroup.classList.toggle('open');
          this.textContent = (cGroup.classList.contains('open') ? '⌄ ' : '› ') + cat.name;
        };
        rGroup.appendChild(cNode);
      });

      rNode.querySelector('.tree-header').onclick = function() {
        rGroup.classList.toggle('open');
        this.textContent = (rGroup.classList.contains('open') ? '⌄ ' : '› ') + region.region;
      };
      tree.appendChild(rNode);
    });
  }

  function filterTripTree(q) {
    const query = q.toLowerCase();
    document.querySelectorAll('.tree-item').forEach(item => {
      const match = item.textContent.toLowerCase().includes(query);
      item.style.display = match ? 'block' : 'none';
      if (match && query) {
        let p = item.parentElement;
        while (p && p.id !== 'presetTree') {
          if (p.classList.contains('tree-group')) {
            p.classList.add('open');
            const h = p.previousElementSibling;
            if(h) h.textContent = h.textContent.replace('›', '⌄');
          }
          p = p.parentElement;
        }
      }
    });
  }


  // ==========================================================================
  //  6. AI ENGINE
  // ==========================================================================

  async function initAI() {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const d = await r.json();
      const valid = d.models.filter(m => m.name.includes('gemini') && !m.name.match(/image|vision/));
      valid.sort((a,b) => {
        const g = n => (n.match(/gemini-(\d+(\.\d+)?)/)||[,0])[1];
        return parseFloat(g(b.name)) - parseFloat(g(a.name));
      });

      const s = $('modelSelector');
      s.innerHTML = '';
      valid.forEach(m => {
        const o = document.createElement('option');
        o.value = m.name; o.textContent = m.displayName; s.appendChild(o);
      });
      currentGeminiModel = valid[0]?.name;
      s.onchange = () => currentGeminiModel = s.value;
    } catch(e){}
  }

  async function callAI(text) {
    chatHistoryBuffer.push({ role: "user", parts: [{ text: text }] });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${currentGeminiModel}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ contents: [{role:"user", parts:[{text:"AI Assistant. Use {ADD: Place} to add stops."}]}, ...chatHistoryBuffer] })
    });
    const d = await res.json();
    const ans = d.candidates?.[0]?.content?.parts?.[0]?.text || "Error";
    chatHistoryBuffer.push({ role: "model", parts: [{ text: ans }] });
    return ans;
  }


  // ==========================================================================
  //  7. MAIN LOGIC (FIXED ASYNC FLOW)
  // ==========================================================================

  async function runOptimization(profile) {
    // 1. Auto-Load Maps & Wait (FIXED)
    if (!window.google) {
      setStatus('Loading Google Maps...', 'ok');
      await ensureMapsLoaded(); // <--- WAITS HERE
    }

    const raw = $('input').value;
    const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    
    if (lines.length < 2) { alert("Need 2+ locations."); return; }

    setStatus('Geocoding...', 'ok');
    const pts = [];

    for (let line of lines) {
      const m = line.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
      if (m) {
        pts.push({ name: line.replace(m[0],'').trim()||'Pt', lat: parseFloat(m[1]), lon: parseFloat(m[2]) });
      } else {
        try {
          const res = await new Promise(r => geocoder.geocode({ address: line }, (res, st) => r(st === 'OK' ? res[0] : null)));
          if (res) pts.push({ name: line.trim(), lat: res.geometry.location.lat(), lon: res.geometry.location.lng() });
          await new Promise(r => setTimeout(r, 200));
        } catch(e){}
      }
    }

    setStatus(`Optimizing ${pts.length} stops...`, 'ok');
    worker.postMessage({ type: 'solve', profile: profile, points: pts, roundTrip: $('chkRoundTrip').checked });
  }

  worker.onmessage = (e) => {
    const { pointsSorted, totalKm, baseKm } = e.data;
    lastSolvedPoints = pointsSorted;

    $('distKm').textContent = totalKm.toFixed(2) + ' km';
    $('savedKm').textContent = (baseKm - totalKm).toFixed(2) + ' km';
    
    const list = $('routeList');
    list.innerHTML = '';
    pointsSorted.forEach(p => {
      const li = document.createElement('li'); li.textContent = p.name; list.appendChild(li);
    });

    updateMapVisualization(pointsSorted);
    
    // Create Map Link
    const baseUrl = "https://www.google.com/maps/dir/?$";
    const origin = `${pointsSorted[0].lat},${pointsSorted[0].lon}`;
    const destIdx = $('chkRoundTrip').checked ? 0 : pointsSorted.length-1;
    const dest = `${pointsSorted[destIdx].lat},${pointsSorted[destIdx].lon}`;
    const waypoints = pointsSorted.slice(1, destIdx===0?pointsSorted.length:pointsSorted.length-1).map(p=>`${p.lat},${p.lon}`).join('|');
    
    $('links').innerHTML = `<a href="${baseUrl}&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=${currentTravelMode.toLowerCase()}" target="_blank" style="display:block; text-align:center; padding:10px; color:#3b82f6;">Open in Google Maps ↗</a>`;
    setStatus('Done!', 'ok');
  };


  // ==========================================================================
  //  8. INIT
  // ==========================================================================

  document.addEventListener('DOMContentLoaded', () => {
    initTripTree();
    initAI();
    restoreState();

    $('btnSave').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([$('input').value],{type:'text/plain'}));
      a.download = 'trip.txt'; a.click();
    };
    $('btnLoad').onclick = () => $('fileLoader').click();
    $('fileLoader').onchange = (e) => {
      const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=(v)=>{$('input').value=v.target.result; saveState();}; r.readAsText(f); }
    };

    $('tripSearch').oninput = (e) => filterTripTree(e.target.value);
    
    $('btnStandard').onclick = () => runOptimization('standard');
    $('btnDeep').onclick = () => runOptimization('deep');
    
    $('btnDriving').onclick = () => { currentTravelMode='DRIVING'; updateModeButtons(); saveState(); };
    $('btnWalking').onclick = () => { currentTravelMode='WALKING'; updateModeButtons(); saveState(); };
    
    $('btnEnableMap').onclick = () => ensureMapsLoaded();

    $('btnSendChat').onclick = async () => {
      const i = $('chatInput');
      const txt = i.value.trim();
      if(!txt) return;
      i.value = '';
      
      const h = $('chatHistory');
      h.innerHTML += `<div class="msg user">${txt}</div>`;
      
      const res = await callAI(txt);
      
      const m = res.match(/\{ADD:\s*(.*?)\}/g);
      if(m) {
        m.forEach(x => {
          const loc = x.replace(/\{ADD:\s*|\}/g,'').trim();
          if(!$('input').value.includes(loc)) $('input').value += ($('input').value?'\n':'')+loc;
        });
        saveState();
      }
      h.innerHTML += `<div class="msg ai"><strong>Gemini:</strong> ${res.replace(/\n/g,'<br>')}</div>`;
      h.scrollTop = h.scrollHeight;
    };

    const ov = $('helpOverlay');
    $('btnHelp').onclick = () => { ov.style.display='flex'; $('helpBody').innerHTML=HELP_HTML; };
    $('btnAbout').onclick = () => { ov.style.display='flex'; $('helpBody').innerHTML=ABOUT_HTML; };
    $('btnCloseHelp').onclick = () => ov.style.display='none';
  });

})();
