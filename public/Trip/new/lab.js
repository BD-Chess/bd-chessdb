/* LAB presentation and language controls. Solver and route state live in app.js. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const bi = (en,sl) => `<span class="lang-en">${en}</span><span class="lang-sl">${sl}</span>`;
  const cities = ['Berlin, Germany','Madrid, Spain','Rome, Italy','Paris, France','Vienna, Austria','Hamburg, Germany','Warsaw, Poland','Bucharest, Romania','Barcelona, Spain','Budapest, Hungary','Munich, Germany','Prague, Czechia','Milan, Italy','Sofia, Bulgaria'];
  const photo = (file,en,sl) => `<figure><a href="images/${file}.webp" target="_blank" rel="noopener"><img loading="lazy" src="images/${file}.webp" alt="${en}"></a><figcaption>${bi(en,sl)}</figcaption></figure>`;
  function renderDemo() {
    $('demoPanel').innerHTML = `
      <div class="demo-hero"><p class="eyebrow">8Z · EU15 · iPhone 16 Pro</p>
      <h1 id="demoTitle">${bi('4 milliseconds to a solution.<br>57 minutes to exhaustive confirmation.','4 milisekunde do rešitve.<br>57 minut do popolnega preverjanja.')}</h1>
      <p>${bi('One extra city. Fourteen times as many orders. Explore BD’s recorded European road trips and the difference between finding a good route and checking every possible order.','En dodaten kraj. Štirinajstkrat več vrstnih redov. Razišči BD-jevi evropski cestni poti in razliko med iskanjem dobre poti ter preverjanjem vseh možnih vrstnih redov.')}</p>
      <div class="demo-cards"><div><strong>87,178,291,200</strong>${bi('orders checked · EU15','preverjenih vrstnih redov · EU15')}</div><div><strong>9,801.35 km</strong>${bi('Deep = completed Brute Force','Deep = dokončani Brute Force')}</div><div><strong>≈ 855,000×</strong>${bi('ratio of displayed compute times','razmerje prikazanih časov izračuna')}</div></div></div>
      <section><h2>${bi('The measurements','Meritve')}</h2>
      <p>${bi('BD’s screenshots, 13 September 2026; iPhone 16 Pro as reported by BD. Drive · Round Trip · fixed START · the same directed road table within each case.','BD-jeve slike, 13. september 2026; iPhone 16 Pro po BD-jevem podatku. Drive · Round Trip · fiksen START · ista usmerjena cestna matrika znotraj posameznega primera.')}</p>
      <div class="comparison-scroll"><table class="demo-table"><thead><tr><th>${bi('Case','Primer')}</th><th>Fast</th><th>Deep</th><th>Brute Force</th></tr></thead><tbody>
      <tr><th>EU14 · 13!</th><td>1.00 ms<br>9,633.59 km</td><td>12.00 ms<br>9,633.59 km</td><td>3.5 min<br>9,633.59 km</td></tr>
      <tr><th>EU15 · 14!</th><td>${bi('Below timer resolution¹','Pod ločljivostjo časovnika¹')}<br>10,177.43 km<br><small>+376.08 km · +3.84%</small></td><td>4.00 ms<br>9,801.35 km</td><td>57.0 min<br>9,801.35 km</td></tr></tbody></table></div>
      <p class="demo-note">${bi('¹ The historical screenshot reads “0 s”; this does not mean zero computation. Displayed times are rounded and exclude geocoding, road-table retrieval and map drawing. Brute Force includes cooperative pauses. These are two observed cases, not a universal speed or optimality guarantee.','¹ Zgodovinska slika kaže »0 s«; to ne pomeni ničelnega časa izračuna. Prikazani časi so zaokroženi in ne vključujejo geokodiranja, pridobivanja cestne matrike in risanja mape. Brute Force vključuje premore za odzivnost. To sta dva opažena primera, ne splošno jamstvo hitrosti ali optimalnosti.')}</p>
      <p>${bi('Deep matched the table optimum in both cases. Fast missed it in EU15. Full enumeration is one way to prove an optimum; faster exact algorithms also exist. This demo compares our heuristic with enumeration, not with the best exact solvers.','Deep se v obeh primerih ujema z optimumom matrike. Fast ga pri EU15 ni dosegel. Popolno naštevanje je eden od načinov dokazovanja optimuma; obstajajo tudi hitrejši eksaktni algoritmi. Demo primerja našo hevristiko s popolnim naštevanjem, ne z najboljšimi eksaktnimi reševalniki.')}</p>
      <div class="demo-actions"><button id="demoLoad14" class="btn-secondary">${bi('Load EU14 city set','Naloži nabor EU14')}</button><button id="demoLoad15" class="btn-primary">${bi('Load EU15 · Ljubljana START','Naloži EU15 · Ljubljana START')}</button></div>
      <p class="demo-note">${bi('Loads the city names without starting calculation. These presets reproduce the city set, not the historical coordinates/table. Google may resolve different endpoints or update routes. EU14 uses Berlin as the preset START; EU15 uses Ljubljana.','Naloži imena mest in ne zažene računanja. Predlogi ponovijo nabor mest, ne zgodovinskih koordinat/matrike. Google lahko izbere drugačne točke ali posodobi poti. Predlog EU14 ima START v Berlinu, EU15 v Ljubljani.')}</p></section>
      <section class="factorial-lab"><h2>${bi('How quickly does the search grow?','Kako hitro naraste prostor iskanja?')}</h2>
      <label for="demoCities">${bi('Stops, including START','Postanki, vključno s START')} <output id="demoCityCount">15</output></label>
      <input id="demoCities" type="range" min="2" max="40" value="15">
      <label for="demoRate">${bi('Orders checked per second','Preverjenih vrstnih redov na sekundo')}</label>
      <select id="demoRate"><option value="25511839">EU15 · 25,511,839 / s</option><option value="1000000">1,000,000 / s</option><option value="1000000000">1,000,000,000 / s</option></select>
      <div id="factorialResult" role="status"></div><div class="cosmic-scale"><span>${bi('A human journey','Človeško potovanje')}</span><div id="cosmicBar"></div><span>${bi('Age of the universe','Starost vesolja')}</span></div>
      <p class="demo-note">${bi('Estimate = (n−1)! ÷ selected rate. START is fixed; opposite directions are counted separately. The rate is held constant for illustration; larger trips and phone backgrounding can be slower. The graphic uses a logarithmic time scale.','Ocena = (n−1)! ÷ izbrana hitrost. START je fiksen; nasprotni smeri se štejeta ločeno. Hitrost je za ponazoritev konstantna; večje poti in delo telefona v ozadju so lahko počasnejši. Grafika uporablja logaritemsko časovno skalo.')}
      <a href="https://science.nasa.gov/universe/overview/" target="_blank" rel="noopener">NASA · ≈ 13.8 billion years</a></p></section>
      <section><h2>${bi('Original screenshots · tap to inspect','Izvirne slike · dotakni se za ogled')}</h2><div class="demo-gallery">
      ${photo('EU-15-08-method-comparison-final','EU15 · final method comparison','EU15 · končna primerjava metod')}
      ${photo('EU-15-07-bruteforce-complete','EU15 · all 87,178,291,200 orders checked','EU15 · preverjenih vseh 87.178.291.200 vrstnih redov')}
      ${photo('EU-15-02-road-route','EU15 · road route','EU15 · cestna pot')}
      ${photo('EU-14-06-method-comparison','EU14 · final method comparison','EU14 · končna primerjava metod')}
      ${photo('EU-14-05-bruteforce-complete','EU14 · completed enumeration','EU14 · dokončano naštevanje')}
      ${photo('EU-14-01-cities-top14','BD’s selected EU14 city list','BD-jev izbrani seznam mest EU14')}
      </div><p class="demo-note">${bi('Original CURRENT screenshots are preserved unchanged. The road map displays 9,801.39 km while the EU15 comparison table sums to 9,801.35 km: a displayed multi-stop route can differ from independently routed pairs. The population list is BD’s input selection, not a verified population ranking.','Izvirne slike takratne verzije CURRENT so ohranjene brez sprememb. Cestna mapa kaže 9.801,39 km, matrika EU15 pa skupaj 9.801,35 km: prikazana pot z več postanki se lahko razlikuje od vsote neodvisno izračunanih odsekov. Seznam prebivalstva je BD-jev izbor vhodnih podatkov, ne preverjena demografska lestvica.')}</p></section>`;
    const update = () => {
      const n = Number($('demoCities').value), total = TripBruteForce.orders(n), rate = Number($('demoRate').value);
      const sec = Number(total)/rate, age = 13.8e9*31557600, ratio = sec/age;
      $('demoCityCount').textContent = n;
      $('factorialResult').innerHTML = `<strong>(${n}−1)! = ${total.toLocaleString('en-US')}</strong><p>${bi('Estimated full search','Ocenjen čas celotnega iskanja')}: <b>${TripBruteForce.duration(sec)}</b></p><p>${ratio.toExponential(2)} × ${bi('the age of the universe','starost vesolja')}</p>`;
      $('cosmicBar').style.width = Math.max(0,Math.min(100,Math.log10(1+sec)/Math.log10(1+age)*100))+'%';
    };
    $('demoCities').oninput=update; $('demoRate').onchange=update; update();
    function load(withLj) {
      const stops = withLj ? ['Ljubljana, Slovenia',...cities] : cities.slice();
      $('input').value=stops.map((s,i)=>s+(i===0?' START':'')).join('\n');
      $('input').dispatchEvent(new Event('input',{bubbles:true}));
      $('btnMapMode').click(); $('input').focus(); $('input').scrollIntoView({block:'center'});
    }
    $('demoLoad14').onclick=()=>load(false); $('demoLoad15').onclick=()=>load(true);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    renderDemo();
    const labels = {btnPlanMode:['Plan','Načrt'],btnMapMode:['Map','Mapa'],btnHelp:['Help','Pomoč'],btnAbout:['About','O aplikaciji'],btnDeep:['Optimize (Deep)','Optimiziraj (Deep)'],btnPrepare:['Prepare distances','Pripravi razdalje'],btnCancelWork:['Cancel calculation','Prekliči računanje'],btnDriving:['🚗 Drive','🚗 Vožnja'],btnWalking:['🚶 Walk','🚶 Hoja'],btnSave:['💾 Save','💾 Shrani'],btnLoad:['📂 Load','📂 Naloži'],btnEnableMap:['Load Map','Naloži mapo']};
    const apply = lang => {
      document.documentElement.lang=lang; const sl=lang==='sl';
      for(const [id,pair] of Object.entries(labels)) $(id).textContent=pair[sl?1:0];
      document.querySelectorAll('[data-language]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===lang)));
      $('chatInput').placeholder=sl?'Vprašaj pomočnika …':'Ask the trip assistant …';
      if ($('bigChatInput')) $('bigChatInput').placeholder=$('chatInput').placeholder;
      $('input').placeholder=sl?'En postanek v vsako vrstico. START označi izhodišče.':'One stop per line. START fixes the starting stop.';
      $('tripSearch').placeholder=sl?'Išči po knjižnici …':'Search library…';
      $('btnStandard').textContent=$('chkBrute').checked?'Run Brute Force':sl?'Optimiziraj (Fast)':'Optimize (Fast)';
      document.querySelector('#editorPanel > h3').textContent=sl?'Urejevalnik poti':'Trip Editor';
      document.querySelector('#librarySection h3').textContent=sl?'Knjižnica poti':'Trip Library';
      document.querySelector('#comparisonPanel h3').textContent=sl?'Primerjava izračunov':'Calculation comparison';
      const heads=sl?['Metoda','Čas izračuna','Razdalja po matriki','Rezultat']:['Method','Compute time','Table distance','Result'];
      document.querySelectorAll('#comparisonPanel th').forEach((el,i)=>el.textContent=heads[i]);
      let note=$('chatGroundingNote'); if(!note) {note=document.createElement('p');note.id='chatGroundingNote';note.className='demo-note';$('chatPanel').insertBefore(note,$('chatHistory'));}
      note.textContent=sl?'Aktualni podatki prek Google Search. Razpoložljivost prenočišč preveri za izbrane datume.':'Current information via Google Search; English place questions can also use Google Maps. Check bookable availability for your dates.';
    };
    window.MDLxDCCLocale.subscribe(apply);
    document.querySelectorAll('[data-language]').forEach(b=>b.onclick=()=>window.MDLxDCCLocale.choose(b.dataset.language));
    $('chkBrute').addEventListener('change',()=>apply(window.MDLxDCCLocale.current()));
    $('btnDemo').onclick=()=>{document.body.classList.add('demo-open');$('demoPanel').hidden=false;$('btnDemo').classList.add('active');$('demoPanel').scrollIntoView({block:'start'});history.replaceState(null,'','#demo');};
    for(const id of ['btnMapMode','btnPlanMode']) $(id).addEventListener('click',()=>{if(location.hash==='#demo')history.replaceState(null,'',location.pathname+location.search);});
    if(location.hash==='#demo')$('btnDemo').click();
    // Keep the desktop library in its original left column; mobile puts it after results.
    const mq=matchMedia('(min-width:1024px)');
    const arrange=()=>{if(mq.matches)$('editorPanel').appendChild($('librarySection'));else $('resultsPanel').appendChild($('librarySection'));};
    mq.addEventListener('change',arrange); arrange();
  });
})();
