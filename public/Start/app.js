
(function(){
  const root=document.getElementById('bd-start-proposal');
  if(!root)return;
  const $=function(s){return root.querySelector(s);};
  const $$=function(s){return Array.from(root.querySelectorAll(s));};
  let lang='sl',scale=100,linkGroup='daily',newsGroup='world',moreStories=false,asset=null;
  const Contract=window.BDStartState;
  function todayISO(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const a=Object.fromEntries(p.map(function(x){return [x.type,x.value];}));return a.year+'-'+a.month+'-'+a.day;}
  let selectedDate=todayISO(),year=Number(selectedDate.slice(0,4)),month=Number(selectedDate.slice(5,7))-1;
  let manageLinks=false,editingLink=null,pendingImport=null,restoring=true,storageIssue=null,lastRevision=null,protectedStorage=false;
  let favoriteUrls=null,openGroups={ai:false,research:false,development:false,daily:false,travel:false,lab:false},planBeforeSearch=null;
  let latestNews=null,latestNewsError=false;
  let lastToday=todayISO();
  const saved=new Set(),events=[];
  const tr={
    sl:{plansTitle:"Plani, marketing & razvoj",plansSummary:"22 hitrih povezav",plan_news_world:"Top 10 · Svetovne novice",plan_news_slovenia:"Top 10 · Slovenske novice",plan_strategy:"Strategija · Trg × Trading",plan_marketing:"Marketing & pilotne ponudbe",plan_ninety:"90-dnevni načrt",plan_hpc:"HPC & AI · naš plan",plan_priorities:"Prioritete & 8Z Control",plan_loops:"Debate · povzetki",plan_board:"Browser Loop · tabla",plan_trip:"Andaluzija · demo",plan_dgte:"DGTE · razvoj",plan_glance:"Naše delo · Glance",plan_seme:"AI8 Seme · N1",plan_model_results:"Rezultati modelov",omniAssistant:"AI pomočnik za OmniCPQ",welcome:'Dobrodošel doma, BD.',tagline:'Tvoj svet. Na enem mestu.',overview:'Pregled',focus:'Fokus',all:'Vse',gold:'Zlato',chartUnit:'Sprememba (%) · zadnjih 24 ur',sampleValues:'Vzorčne vrednosti',shortcuts:'Na dosegu klika',daily:'Vsak dan',addLink:'Dodaj',linkName:'Ime povezave',calendar:'Moj koledar',noEventsShort:'Brez dogodkov',addEvent:'Dodaj dogodek',eventTitle:'Dogodek',date:'Datum',time:'Ura',news:'Okno v svet',world:'Svet',local:'Slovenija',science:'Znanost & AI',sampleHeadlines:'Vzorčni naslovi',moreStories:'Več zgodb',fewerStories:'Manj zgodb',weather:'Zunaj mojega okna',partlyCloudy:'Delno oblačno',today:'Danes',tomorrow:'Jutri',dayAfter:'Pojutrišnjem',weatherSource:'Predlog vira: ARSO / Open-Meteo',notes:'Prostor za misel',blankPage:'Prazen list',browserOnly:'Shranjeno v tem brskalniku',reading:'Za pozneje',saveHint:'Shrani zanimivo zgodbo z zaznamkom.',moreWorld:'Še več tvojega sveta',extraSummary:'Raziskave · uporabna orodja · oddih',research:'Raziskave & ideje',tools:'Uporabna orodja',break:'Pet minut zase',prototype:'Novice, trgi in vreme · vzorčni podatki',footerLine:'Manj hrupa. Več tvojega sveta.',search:'Poišči povezavo ali novico …',notePlaceholder:'Zapiši misel, preden pobegne …',links:'bližnjic',stories:'izbrane zgodbe',chars:'znakov',results:'zadetkov',noResults:'Ni zadetkov. Poskusi drugo besedo.',emptyAgenda:'Izbrani dan je še prazen.',save:'Shrani za pozneje',saved:'Shranjeno',remove:'Odstrani',proposedSources:'Predlagani viri:',example:'Primer postavitve',invalidURL:'Uporabi spletni naslov, ki se začne s https:// ali http://.',filter:'Iskanje',smaller:'Pomanjšaj besedilo',larger:'Povečaj besedilo',reset:'Ponastavi velikost besedila',clear:'Počisti iskanje',prevMonth:'Prejšnji mesec',nextMonth:'Naslednji mesec',closeChart:'Zapri graf',percent:'% spremembe',hour:'ure',editLinks:'Uredi',done:'Končano',edit:'Uredi povezavo',saveLink:'Shrani povezavo',cancel:'Prekliči',dataTitle:'Podatki & nastavitve',localOnly:'Samo v tem brskalniku',dataHelp:'Nastavitve, bližnjice, koledar in beležke se shranjujejo na tej napravi. Za prenos v drug brskalnik izvozi datoteko in jo tam uvozi.',exportData:'Izvozi podatke',importData:'Uvozi podatke',importReplace:'Uvoz zamenja obstoječe podatke tega brskalnika. Pred tem jih lahko izvoziš.',replaceData:'Zamenjaj podatke',invalidData:'Datoteka ni veljaven izvoz BD Start. Obstoječi podatki so ohranjeni.',imported:'Podatki so uvoženi in shranjeni.',exported:'Izvoz je pripravljen.',saveUnavailable:'Shranjevanje ni uspelo. Izvozi podatke, da jih ohraniš.',changedElsewhere:'Podatki so se spremenili v drugem zavihku. Izvozi ta zavihek ali naloži shranjene podatke.',invalidStored:'Shranjenih podatkov ni mogoče prebrati. Obstoječi zapis je ohranjen; svoje trenutne podatke lahko izvoziš.',reloadData:'Naloži shranjene podatke',invalidEvent:'Vnesi veljaven datum in uro.',maxLinks:'V tej skupini je že 300 povezav.',maxEvents:'V koledarju je že 1000 dogodkov.',location:'Mesto za vzorčno vreme',appearance:'Videz',timezone:'Evropa / Ljubljana'},
    en:{plansTitle:"Plans, marketing & development",plansSummary:"22 quick links",plan_news_world:"Top 10 World News",plan_news_slovenia:"Top 10 Slovenian News",plan_strategy:"Strategy · Market × Trading",plan_marketing:"Marketing & pilot offers",plan_ninety:"90-day plan",plan_hpc:"HPC & AI · our plan",plan_priorities:"Priorities & 8Z Control",plan_loops:"Discussions · summaries",plan_board:"Browser Loop · board",plan_trip:"Andalusia · demo",plan_dgte:"DGTE · development",plan_glance:"Our work · Glance",plan_seme:"AI8 Seed · N1",plan_model_results:"Model results",omniAssistant:"AI assistant for OmniCPQ",welcome:'Welcome home, BD.',tagline:'Your world. One place.',overview:'Overview',focus:'Focus',all:'All',gold:'Gold',chartUnit:'Change (%) · last 24 hours',sampleValues:'Sample values',shortcuts:'A click away',daily:'Every day',addLink:'Add',linkName:'Link name',calendar:'My calendar',noEventsShort:'No events',addEvent:'Add event',eventTitle:'Event',date:'Date',time:'Time',news:'A window to the world',world:'World',local:'Slovenia',science:'Science & AI',sampleHeadlines:'Sample headlines',moreStories:'More stories',fewerStories:'Fewer stories',weather:'Outside my window',partlyCloudy:'Partly cloudy',today:'Today',tomorrow:'Tomorrow',dayAfter:'Day after',weatherSource:'Proposed source: ARSO / Open-Meteo',notes:'Room for a thought',blankPage:'A blank page',browserOnly:'Saved in this browser',reading:'For later',saveHint:'Bookmark a story to keep it here.',moreWorld:'More of your world',extraSummary:'Research · useful tools · a little break',research:'Research & ideas',tools:'Useful tools',break:'Five minutes for yourself',prototype:'News, markets and weather · sample data',footerLine:'Less noise. More of your world.',search:'Find a shortcut or a story …',notePlaceholder:'Catch a thought before it disappears …',links:'shortcuts',stories:'selected stories',chars:'characters',results:'matches',noResults:'No matches. Try another word.',emptyAgenda:'Nothing planned for the selected day.',save:'Save for later',saved:'Saved',remove:'Remove',proposedSources:'Proposed sources:',example:'Layout example',invalidURL:'Use a web address beginning with https:// or http://.',filter:'Search',smaller:'Smaller text',larger:'Larger text',reset:'Reset text size',clear:'Clear search',prevMonth:'Previous month',nextMonth:'Next month',closeChart:'Close chart',percent:'Change %',hour:'hours',editLinks:'Edit',done:'Done',edit:'Edit shortcut',saveLink:'Save shortcut',cancel:'Cancel',dataTitle:'Data & settings',localOnly:'Only in this browser',dataHelp:'Settings, shortcuts, calendar and notes are stored on this device. Export a file to move them to another browser, then import it there.',exportData:'Export data',importData:'Import data',importReplace:'Import replaces the existing data in this browser. You can export it first.',replaceData:'Replace data',invalidData:'This is not a valid BD Start export. Existing data is preserved.',imported:'Data imported and saved.',exported:'Export ready.',saveUnavailable:'Saving failed. Export your data to keep it.',changedElsewhere:'Data changed in another tab. Export this tab or load the saved data.',invalidStored:'Stored data could not be read. The existing record is preserved; you can export your current data.',reloadData:'Load saved data',invalidEvent:'Enter a valid date and time.',maxLinks:'This group already has 300 shortcuts.',maxEvents:'The calendar already has 1000 events.',location:'Sample weather location',appearance:'Appearance',timezone:'Europe / Ljubljana'}
  };
  Object.assign(tr.sl,{settings:'Nastavitve',favorites:'Pri roki',editPins:'Uredi bližnjice',donePins:'Končano',choosePin:'Dodaj iz imenika',addPin:'Pripni',pinLimit:'Največ osem pripetih povezav.',pinMoveLeft:'Premakni levo',pinMoveRight:'Premakni desno',areas:'Moja področja',areasHint:'Raziskovanje · delo · vsakdan',openAll:'Odpri vse',closeAll:'Zapri vse',groupAI:'AI & sodelovanje',hintAI:'Pogovori · domači modeli · Loops',groupResearch:'Raziskave & primerjave',hintResearch:'Ljudje · Bogovi · LLM-ji · DGTE',groupDevelopment:'Razvoj & načrti',hintDevelopment:'Prioritete · strategija · koda · infrastruktura',groupDaily:'Vsakdan & služba',hintDaily:'Pošta · datoteke · dom · OmniCPQ',groupTravel:'Potovanja & igre',hintTravel:'Andaluzija · TripOpti · šah · Sudoku',groupLab:'O laboratoriju',hintLab:'Naše delo · AI8 · izhodišča',manageMyLinks:'Moje povezave · urejanje',homePortal:'Domači portal',myDay:'Moj dan',marketsTitle:'Trgi',newsToday:'AI8 News',newsLoading:'Nalagam zadnjo izdajo …',newsUnavailable:'Zadnja izdaja trenutno ni na voljo.',newsMetadata:'Interpretacije metapodatkov RSS',newsSynthetic:'Sintetični predogled',allNews:'Vse novice ↗',oldSampleNews:'Prejšnje vzorčne zgodbe',sampleArchive:'Prejšnje vzorčne zgodbe in zaznamki',upcoming:'Naslednjih 7 dni',noUpcoming:'V naslednjih 7 dneh ni dogodkov.',weather:'Vreme & promet',prototype:'Trgi in vreme · vzorčni podatki',search:'Poišči projekt, orodje ali povezavo …'});
  Object.assign(tr.en,{settings:'Settings',favorites:'At hand',editPins:'Edit favorites',donePins:'Done',choosePin:'Add from directory',addPin:'Pin',pinLimit:'Up to eight pinned links.',pinMoveLeft:'Move left',pinMoveRight:'Move right',areas:'My areas',areasHint:'Research · work · everyday',openAll:'Open all',closeAll:'Close all',groupAI:'AI & collaboration',hintAI:'Chats · local models · loops',groupResearch:'Research & comparisons',hintResearch:'People · Gods · LLMs · DGTE',groupDevelopment:'Development & plans',hintDevelopment:'Priorities · strategy · code · infrastructure',groupDaily:'Everyday & work',hintDaily:'Mail · files · home · OmniCPQ',groupTravel:'Travel & games',hintTravel:'Andalusia · TripOpti · chess · Sudoku',groupLab:'About the lab',hintLab:'Our work · AI8 · foundations',manageMyLinks:'My links · edit',homePortal:'Home portal',myDay:'My day',marketsTitle:'Markets',newsToday:'AI8 News',newsLoading:'Loading the latest edition …',newsUnavailable:'The latest edition is not available right now.',newsMetadata:'RSS metadata interpretations',newsSynthetic:'Synthetic preview',allNews:'All news ↗',oldSampleNews:'Earlier sample stories',sampleArchive:'Earlier sample stories and bookmarks',upcoming:'Next 7 days',noUpcoming:'No events in the next 7 days.',weather:'Weather & traffic',prototype:'Markets and weather · sample data',search:'Find a project, tool or link …'});
  Object.assign(tr.sl,{codeLabel:'Koda',peopleLabel:'Ljudje',llmLabel:'LLM indeks',gameLabel:'Igra',godsLabel:'Bogovi',aboutLabel:'O AI8',oldWorld:'Arhiv: svetovne novice (24. 10.)',oldSlovenia:'Arhiv: slovenske novice (24. 10.)'});
  Object.assign(tr.en,{codeLabel:'Code',peopleLabel:'People',llmLabel:'LLM index',gameLabel:'Game',godsLabel:'Gods',aboutLabel:'About AI8',oldWorld:'Archive: world news (24 Oct)',oldSlovenia:'Archive: Slovenian news (24 Oct)'});
  const links={
    daily:[['ChatGPT','https://chatgpt.com/','GPT'],['Claude','https://claude.ai/','C'],['Gmail','https://mail.google.com/','G'],['Outlook','https://outlook.live.com/','O'],['Google Drive','https://drive.google.com/','GD'],['OneDrive','https://onedrive.live.com/','OD'],['TradingView','https://www.tradingview.com/','TV'],['start.me','https://start.me/','S']],
    lab:[['MDL×DCC','https://www.mdlxdcc.org/','BD'],['GitHub','https://github.com/BD-Chess/bd-chessdb','GH'],['Netlify','https://app.netlify.com/','N'],['arXiv','https://arxiv.org/','aX'],['Hugging Face','https://huggingface.co/','HF'],['ChessBest','https://www.mdlxdcc.org/chess/','CB'],['8zSudoku','https://www.mdlxdcc.org/S/','8z'],['TripOpti','https://www.mdlxdcc.org/Trip/','TO']],
    markets:[['TradingView','https://www.tradingview.com/','TV'],['MEXC','https://www.mexc.com/','MX'],['CoinMarketCap','https://coinmarketcap.com/','CM'],['CoinGecko','https://www.coingecko.com/','CG'],['FRED','https://fred.stlouisfed.org/','FR'],['ECB','https://www.ecb.europa.eu/','€']]
  };
  const stories=[
    {id:'w1',group:'world',cat:['Tehnologija','Technology'],title:['Naslednje poglavje umetne inteligence: od odgovorov k dejanjem','AI’s next chapter: from answering questions to taking action'],desc:['Prostor za najpomembnejšo zgodbo dneva, z jasnim virom in kratkim povzetkom.','Room for the day’s leading story, with a clear source and a short summary.']},
    {id:'w2',group:'world',cat:['Gospodarstvo','Economy'],title:['Obresti, inflacija in trgi: tri stvari, ki jih je vredno spremljati','Rates, inflation and markets: three things worth watching']},
    {id:'w3',group:'world',cat:['Energija','Energy'],title:['Energija prihodnosti se gradi danes','Tomorrow’s energy is being built today']},
    {id:'w4',group:'world',cat:['Svet','World'],title:['Pogled onkraj naslovov: kaj spreminja vsakdanje življenje','Beyond the headlines: what is changing everyday life']},
    {id:'l1',group:'local',cat:['Slovenija','Slovenia'],title:['Kaj se danes dogaja blizu doma?','What is happening close to home?'],desc:['Slovenske novice in izbrani lokalni viri na enem mestu.','Slovenian news and selected local sources, together in one place.']},
    {id:'l2',group:'local',cat:['Lokalno','Local'],title:['Promet, dogodki in uporabne informacije iz tvoje okolice','Traffic, events and useful information from your area']},
    {id:'l3',group:'local',cat:['Gospodarstvo','Economy'],title:['Podjetja in ideje, ki nastajajo v Sloveniji','Companies and ideas taking shape in Slovenia']},
    {id:'l4',group:'local',cat:['Prosti čas','Leisure'],title:['Kam za konec tedna: kultura, narava in dober oddih','Weekend ideas: culture, nature and a good break']},
    {id:'s1',group:'science',cat:['Raziskave','Research'],title:['Iz vprašanj v stvaritve: ko se znanje sreča z radovednostjo','From questions to creations: where knowledge meets curiosity'],desc:['Izbor raziskav, novih člankov in idej, ki so relevantne zate.','Research, new papers and ideas selected for what matters to you.']},
    {id:'s2',group:'science',cat:['AI','AI'],title:['Spomin agentov in sodelovanje več modelov','Agent memory and collaboration across models']},
    {id:'s3',group:'science',cat:['Optimizacija','Optimization'],title:['Manj opiše več: nove poti v kombinatornem iskanju','Less describes more: new paths in combinatorial search']},
    {id:'s4',group:'science',cat:['Ideje','Ideas'],title:['Seme tedna: eno dobro vprašanje za naslednji poskus','Seed of the week: one good question for the next experiment']}
  ];
  const sample={
    SPX:[0,.06,.03,.12,.10,.18,.16,.25,.20,.24,.32,.30,.34,.31,.40,.42],
    BTC:[0,-.2,.1,.25,.12,.38,.32,.62,.5,.76,.7,.93,.84,1.07,1.12,1.28],
    GOLD:[0,.03,.07,.02,.13,.21,.19,.3,.25,.34,.32,.4,.45,.42,.56,.61],
    OIL:[0,.06,-.04,-.09,-.03,-.17,-.22,-.14,-.27,-.25,-.2,-.33,-.29,-.38,-.32,-.34],
    EURUSD:[0,.01,.04,.03,.05,.02,.08,.06,.07,.09,.08,.10,.09,.11,.10,.12]
  };
  const t=function(k){return tr[lang][k]||k;};
  const txt=function(a){return a[lang==='sl'?0:1];};
  function icon(name){const i=document.createElement('i');i.setAttribute('data-lucide',name);i.setAttribute('aria-hidden','true');return i;}
  function icons(){if(typeof lucide!=='undefined')lucide.createIcons({attrs:{width:16,height:16}});}
  function make(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function pressed(selector,attr,value){$$(selector).forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute(attr)===value));});}
  function query(){return $('#bs-search-input').value.trim().toLocaleLowerCase(lang);}
  function normalized(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase(lang);}
  function defaultFavorites(){return ['https://chatgpt.com/','https://claude.ai/','https://drive.google.com/','../AI8/browser-loop.html','../OmniCPQ/','../BD-AI-todo.html','https://193.77.159.220/','https://www.tradingview.com/'].map(function(url){return new URL(url,document.baseURI).href;});}
  function catalog(){
    const items=new Map();
    $$('.bs-category-links a.bs-plan-link').forEach(function(a){const label=a.lastElementChild?a.lastElementChild.textContent.trim():a.textContent.trim();if(!items.has(a.href))items.set(a.href,{url:a.href,label:label});});
    Object.values(links).forEach(function(list){list.forEach(function(link){if(!items.has(link[1]))items.set(link[1],{url:link[1],label:link[0]});});});
    // Netlify can rewrite HTML links to clean URLs while old favorites retain
    // their original .html paths. Keep both forms mapped to the same entry.
    [['[data-i18n="plan_board"]','../AI8/browser-loop.html'],['#bs-private-todo-link','../BD-AI-todo.html']].forEach(function(pair){const node=$(pair[0]),a=node&&node.closest('a'),item=a&&items.get(a.href);if(item)items.set(new URL(pair[1],document.baseURI).href,item);});
    return items;
  }
  function renderCatalogLinks(){
    const hosts={};$$('[data-catalog]').forEach(function(host){host.replaceChildren();hosts[host.dataset.catalog]=host;});
    const staticUrls={};Contract.categories.concat(['markets']).forEach(function(group){const host=hosts[group];staticUrls[group]=new Set(host&&host.parentElement?Array.from(host.parentElement.querySelectorAll('a.bs-plan-link')).map(function(a){return a.href;}):[]);});
    const targetFor=function(link,source){
      const u=link[1].toLowerCase();
      if(u.includes('chatgpt.com')||u.includes('claude.ai'))return 'ai';
      if(u.includes('arxiv.org')||u.includes('huggingface.co/papers'))return 'research';
      if(u.includes('/chess/')||u.endsWith('/s/')||u.includes('/trip/'))return 'travel';
      if(u.includes('mdlxdcc.org/')&&u.endsWith('/'))return source==='lab'?'lab':'daily';
      return source==='markets'?'markets':source==='lab'?'ai':'daily';
    };
    Object.entries(links).forEach(function(pair){pair[1].forEach(function(link){const group=targetFor(link,pair[0]),host=hosts[group];if(!host||staticUrls[group].has(link[1]))return;staticUrls[group].add(link[1]);const a=make('a','bs-shortcut bs-plan-link cursor-interaction');a.href=link[1];a.target='_blank';a.rel='noopener noreferrer';a.dataset.keywords=link[0];a.append(make('span','bs-link-symbol',link[2]),make('span','',link[0]));host.append(a);});});
  }
  function renderFavorites(){
    if(!favoriteUrls)favoriteUrls=defaultFavorites();
    const entries=catalog(),host=$('#bs-pins'),order=$('#bs-pin-order'),select=$('#bs-pin-select');host.replaceChildren();order.replaceChildren();
    const q=normalized(query());
    favoriteUrls.forEach(function(url,index){
      const item=entries.get(url),label=item?item.label:new URL(url).hostname;
      const tile=make('a','bs-pin cursor-interaction');tile.href=url;tile.target='_blank';tile.rel='noopener noreferrer';
      let image='compass';if(url.includes('chatgpt'))image='focus';else if(url.includes('claude'))image='sun';else if(url.includes('drive.google'))image='rows-3';else if(url.includes('browser-loop'))image='arrow-down';else if(url.toLowerCase().includes('omnicpq'))image='layout-dashboard';else if(url.toLowerCase().includes('todo'))image='notebook-pen';else if(url.includes('tradingview'))image='focus';
      tile.append(icon(image),make('span','',label));tile.hidden=!!q&&!normalized(label+' '+url).includes(q);host.append(tile);
      const row=make('div','bs-pin-order-row');row.append(make('span','',label));
      [['←',-1,'pinMoveLeft'],['→',1,'pinMoveRight'],['×',0,'remove']].forEach(function(action){const b=make('button','',action[0]);b.type='button';b.setAttribute('aria-label',t(action[2])+': '+label);if(action[1]===-1&&index===0||action[1]===1&&index===favoriteUrls.length-1)b.disabled=true;b.addEventListener('click',function(){if(action[1]===0)favoriteUrls.splice(index,1);else{const to=index+action[1],v=favoriteUrls[index];favoriteUrls[index]=favoriteUrls[to];favoriteUrls[to]=v;}renderFavorites();persist();});row.append(b);});order.append(row);
    });
    const before=select.value;select.replaceChildren();const unique=Array.from(new Map(Array.from(entries.values(),function(item){return [item.url,item];})).values());unique.filter(function(item){return !favoriteUrls.some(function(url){return url===item.url||entries.get(url)?.url===item.url;});}).sort(function(a,b){return a.label.localeCompare(b.label,lang);}).forEach(function(item){const o=make('option','',item.label);o.value=item.url;select.append(o);});
    if(Array.from(select.options).some(function(o){return o.value===before;}))select.value=before;
    $('#bs-pin-add').disabled=favoriteUrls.length>=8||!select.options.length;$('#bs-pin-status').textContent=t('pinLimit');icons();
  }
  $('#bs-pins-edit').addEventListener('click',function(){const editor=$('#bs-pin-editor');editor.hidden=!editor.hidden;this.setAttribute('aria-expanded',String(!editor.hidden));this.textContent=t(editor.hidden?'editPins':'donePins');});
  $('#bs-pin-add').addEventListener('click',function(){const value=$('#bs-pin-select').value;if(value&&favoriteUrls.length<8&&!favoriteUrls.includes(value)){favoriteUrls.push(value);renderFavorites();persist();}});
  function updateGroupButton(){const groups=$$('.bs-category').filter(function(d){return !d.hidden;});$('#bs-open-groups').textContent=t(groups.length&&groups.every(function(d){return d.open;})?'closeAll':'openAll');}
  $('#bs-open-groups').addEventListener('click',function(){const groups=$$('.bs-category').filter(function(d){return !d.hidden;}),next=!groups.every(function(d){return d.open;});groups.forEach(function(d){d.open=next;if(!query())openGroups[d.dataset.category]=next;});updateGroupButton();if(!query())persist();});
  $$('.bs-category').forEach(function(group){group.addEventListener('toggle',function(){if(!restoring&&!query()&&group.open!==openGroups[group.dataset.category]){openGroups[group.dataset.category]=group.open;persist();}updateGroupButton();});});
  $('#bs-open-data').addEventListener('click',function(){$('#bs-data-panel').open=true;$('#bs-data-panel').scrollIntoView({behavior:'smooth',block:'start'});});
  // Built-in favorite is visible with existing saved Start data too. Keep it
  // outside the user's editable/exported links so no local state migration is needed.
  const apiCheckFavorite=['API pregled',new URL('../AI8/api-check.html',document.baseURI).href,'API'];
  function renderLinks(){
    const host=$('#bs-shortcuts');host.replaceChildren();let count=0;const q=query();
    const groups=q?Object.keys(links):[linkGroup];const seen=new Set();
    groups.forEach(function(group){const entries=links[group].map(function(link,index){return {link:link,index:index};});
      if(group==='daily'&&!entries.some(function(entry){return entry.link[1]===apiCheckFavorite[1];}))entries.unshift({link:apiCheckFavorite,index:-1});
      entries.forEach(function(entry){const link=entry.link,index=entry.index;
      if((!manageLinks&&seen.has(link[1]))||(q&&!link[0].toLocaleLowerCase(lang).includes(q)))return;
      seen.add(link[1]);count++;
      const wrapper=make('div','bs-shortcut-item'+(manageLinks?' bs-editing':''));
      const a=make('a','bs-shortcut cursor-interaction');a.href=link[1];a.target='_blank';a.rel='noopener noreferrer';
      a.append(make('span','bs-link-symbol',link[2]),make('span','',link[0]));wrapper.append(a);
      if(index===-1)a.title=lang==='sl'?'Pripeto orodje · API pregled':'Pinned tool · API check';
      if(manageLinks&&index!==-1){const controls=make('div','bs-shortcut-controls');
        const edit=make('button','');edit.type='button';edit.append(icon('pencil'));edit.setAttribute('aria-label',t('edit')+': '+link[0]);
        edit.addEventListener('click',function(){editingLink={group:group,index:index};$('#bs-link-name').value=link[0];$('#bs-link-url').value=link[1];$('#bs-add-link').hidden=false;$('#bs-add-link-toggle').setAttribute('aria-expanded','true');$('#bs-link-error').hidden=true;$('#bs-link-name').focus();});
        const remove=make('button','');remove.type='button';remove.append(icon('trash-2'));remove.setAttribute('aria-label',t('remove')+': '+link[0]);
        remove.addEventListener('click',function(){const removed=links[group][index][1];links[group].splice(index,1);closeLinkForm();renderLinks();if(!catalog().has(removed)){favoriteUrls=favoriteUrls.filter(function(url){return url!==removed;});renderFavorites();}persist();});controls.append(edit,remove);wrapper.append(controls);
      }host.append(wrapper);
    });});
    if(!count)host.append(make('span','bs-empty',t('noResults')));
    $('#bs-links-summary').textContent=count+' '+t('links');$('#bs-manage-links').textContent=t(manageLinks?'done':'editLinks');renderCatalogLinks();renderFavorites();icons();return count;
  }
  function saveButton(story){
    const b=make('button','cursor-interaction bs-small-action');b.type='button';b.setAttribute('aria-label',saved.has(story.id)?t('saved'):t('save'));b.setAttribute('aria-pressed',String(saved.has(story.id)));b.append(icon(saved.has(story.id)?'bookmark-check':'bookmark'));
    b.addEventListener('click',function(){if(saved.has(story.id))saved.delete(story.id);else saved.add(story.id);renderNews();renderReading();persist();});return b;
  }
  function renderNews(){
    const host=$('#bs-news');host.replaceChildren();const q=query();
    let list=stories.filter(function(s){return (q||s.group===newsGroup)&&(!q||(txt(s.title)+' '+txt(s.cat)).toLocaleLowerCase(lang).includes(q));});
    const count=list.length;if(!moreStories&&!q)list=list.slice(0,3);
    list.forEach(function(story,i){
      const wrap=make('article',i===0?'bs-story-lead':'bs-story-row');
      const copy=make('div','bs-story-copy');
      const meta=make('div','bs-story-meta');meta.append(make('span','bs-story-category',txt(story.cat)),make('span','',t('example')));
      if(i===0){copy.append(meta,make('h2','',txt(story.title)));if(story.desc)copy.append(make('p','',txt(story.desc)));const actions=make('div','bs-story-actions');actions.append(saveButton(story));copy.append(actions);wrap.append(copy);}
      else{copy.append(make('div','bs-story-title',txt(story.title)),meta);wrap.append(make('div','bs-story-number',String(i+1).padStart(2,'0')),copy,saveButton(story));}
      host.append(wrap);
    });
    if(!list.length)host.append(make('p','bs-empty',t('noResults')));
    $('#bs-news-summary').textContent=list.length+' '+t('stories');
    const sources={world:[['Reuters','https://www.reuters.com/'],['BBC','https://www.bbc.com/news'],['AP','https://apnews.com/']],local:[['RTV SLO','https://www.rtvslo.si/'],['24ur','https://www.24ur.com/'],['N1','https://n1info.si/']],science:[['arXiv','https://arxiv.org/'],['HF Papers','https://huggingface.co/papers'],['Nature','https://www.nature.com/']]};
    const sourceHost=$('#bs-sources');sourceHost.replaceChildren(make('span','',t('proposedSources')));sources[newsGroup].forEach(function(x){const a=make('a','',x[0]);a.href=x[1];a.target='_blank';a.rel='noopener noreferrer';sourceHost.append(a);});
    $('#bs-news-more').querySelector('span').textContent=t(moreStories?'fewerStories':'moreStories');
    $('#bs-news-more').hidden=!!q;
    icons();return count;
  }
  function renderLiveNews(){
    const host=$('#bs-live-news'),status=$('#bs-live-news-status'),date=$('#bs-live-news-date');host.replaceChildren();
    if(!latestNews){status.textContent=t(latestNewsError?'newsUnavailable':'newsLoading');date.textContent='';return 0;}
    const q=normalized(query());status.textContent=t(latestNews.synthetic?'newsSynthetic':'newsMetadata');date.textContent=latestNews.date;
    const items=latestNews.items.filter(function(item){return !q||normalized(item.title+' '+item.section+' '+item.publisher).includes(q);});
    items.forEach(function(item){const row=make('div','bs-live-story'),a=make('a','',item.title);const target=new URL('../news/',document.baseURI);target.searchParams.set('date',latestNews.date);target.searchParams.set('section',item.section);a.href=target.href;a.target='_blank';a.rel='noopener noreferrer';row.append(a,make('small','',item.publisher+(item.published?' · '+item.published:'')));host.append(row);});
    if(q&&!items.length)host.append(make('span','bs-empty',t('noResults')));
    return items.length;
  }
  async function loadLatestNews(){
    try{
      const base=new URL('../news/',document.baseURI),response=await fetch(new URL('catalog.json',base),{cache:'no-store'});
      if(!response.ok)throw new Error('catalog unavailable');const catalogData=await response.json();
      const date=catalogData.latest_published_date;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(catalogData.editions))throw new Error('invalid catalog');
      const entry=catalogData.editions.filter(function(e){return e.date===date&&/^days\/\d{4}-\d{2}-\d{2}(-r[1-9][0-9]*)?\.json$/.test(e.path)&&/^[0-9a-f]{64}$/.test(e.sha256);}).sort(function(a,b){return b.revision-a.revision;})[0];
      if(!entry||!window.crypto||!window.crypto.subtle)throw new Error('edition unavailable');
      const editionResponse=await fetch(new URL(entry.path,base),{cache:'no-store'});if(!editionResponse.ok)throw new Error('edition unavailable');
      const bytes=await editionResponse.arrayBuffer();if(bytes.byteLength>2000000)throw new Error('edition too large');
      const hash=Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256',bytes)),function(b){return b.toString(16).padStart(2,'0');}).join('');if(hash!==entry.sha256)throw new Error('edition mismatch');
      const data=JSON.parse(new TextDecoder().decode(bytes));if(data.edition_date!==date||!['live','synthetic'].includes(data.evidence_mode)||!Array.isArray(data.stories)||!Array.isArray(data.sections))throw new Error('invalid edition');
      const byId=new Map(data.stories.map(function(story){return [story.story_id,story];})),items=[];
      ['slovenia','world','ai'].forEach(function(id){const section=data.sections.find(function(s){return s.id===id;});if(!section||!Array.isArray(section.story_ids))return;const story=byId.get(section.story_ids[0]);if(!story||typeof story.title!=='string')return;const source=Array.isArray(story.source_articles)?story.source_articles[0]:null;let published='';if(source&&source.published_at&&!Number.isNaN(Date.parse(source.published_at)))published=new Intl.DateTimeFormat(lang==='sl'?'sl-SI':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Ljubljana'}).format(new Date(source.published_at));items.push({section:id,title:story.title,publisher:source&&typeof source.publisher_id==='string'?source.publisher_id:'AI8 News',published:published});});
      latestNews={date:date,synthetic:data.evidence_mode==='synthetic',items:items};latestNewsError=false;renderLiveNews();
    }catch(_){latestNews=null;latestNewsError=true;renderLiveNews();}
  }
  function renderReading(){
    const host=$('#bs-reading-list');host.replaceChildren();
    stories.filter(function(s){return saved.has(s.id);}).forEach(function(s){
      const row=make('div','bs-reading-item');row.append(make('span','',txt(s.title)));
      const b=make('button','cursor-interaction');b.type='button';b.setAttribute('aria-label',t('remove'));b.append(icon('x'));
      b.addEventListener('click',function(){saved.delete(s.id);renderReading();renderNews();persist();});row.append(b);host.append(row);
    });
    if(!saved.size)host.append(make('span','bs-empty',t('saveHint')));
    $('#bs-reading-summary').textContent=saved.size;icons();
  }
  function renderCalendar(){
    const host=$('#bs-calendar');host.replaceChildren();
    $('#bs-month-title').textContent=new Intl.DateTimeFormat(lang==='sl'?'sl-SI':'en-GB',{month:'long',year:'numeric'}).format(new Date(year,month,1,12));
    const weekdays=lang==='sl'?['PO','TO','SR','ČE','PE','SO','NE']:['MO','TU','WE','TH','FR','SA','SU'];
    weekdays.forEach(function(d){host.append(make('span','bs-weekday',d));});
    const start=(new Date(year,month,1,12).getDay()+6)%7;
    for(let i=0;i<start;i++)host.append(make('span',''));
    const days=new Date(year,month+1,0,12).getDate();
    for(let day=1;day<=days;day++){
      const date=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      const b=make('button','cursor-interaction',day);b.type='button';b.setAttribute('aria-pressed',String(date===selectedDate));b.setAttribute('data-today',String(date===todayISO()));
      if(events.some(function(e){return e.date===date;}))b.classList.add('bs-has-events');
      b.setAttribute('aria-label',new Intl.DateTimeFormat(lang==='sl'?'sl-SI':'en-GB',{dateStyle:'full'}).format(new Date(year,month,day,12)));
      b.addEventListener('click',function(){selectedDate=date;$('#bs-event-date').value=date;renderCalendar();renderAgenda();persist();});host.append(b);
    }
    renderAgenda();
  }
  function renderAgenda(){
    const host=$('#bs-agenda-list');host.replaceChildren();
    const today=events.filter(function(e){return e.date===selectedDate;}).sort(function(a,b){return a.time.localeCompare(b.time);});
    today.forEach(function(e){const r=make('div','bs-event');r.append(make('span','bs-event-time',e.time),make('span','',e.title));const b=make('button','');b.type='button';b.append(icon('trash-2'));b.setAttribute('aria-label',t('remove')+': '+e.title);b.addEventListener('click',function(){events.splice(events.findIndex(function(x){return x.id===e.id;}),1);renderCalendar();persist();});r.append(b);host.append(r);});icons();
    if(!today.length)host.append(make('span','bs-empty',t('emptyAgenda')));
    const start=todayISO(),lastDate=new Date(start+'T12:00:00Z');lastDate.setUTCDate(lastDate.getUTCDate()+6);const end=lastDate.toISOString().slice(0,10);
    const upcoming=events.filter(function(e){return e.date>=start&&e.date<=end;}).sort(function(a,b){return (a.date+'T'+a.time).localeCompare(b.date+'T'+b.time);});
    const upcomingHost=$('#bs-upcoming');upcomingHost.replaceChildren(make('strong','',t('upcoming')));
    if(!upcoming.length)upcomingHost.append(make('p','bs-empty',t('noUpcoming')));
    upcoming.slice(0,3).forEach(function(event){const b=make('button','bs-upcoming-item',event.date.slice(5)+' · '+event.time+' · '+event.title);b.type='button';b.addEventListener('click',function(){selectedDate=event.date;year=Number(event.date.slice(0,4));month=Number(event.date.slice(5,7))-1;$('#bs-event-date').value=event.date;renderCalendar();persist();});upcomingHost.append(b);});
    $('#bs-agenda-summary').textContent=upcoming.length?upcoming[0].date.slice(5)+' · '+upcoming[0].time:t('noEventsShort');
  }
  function renderNote(){
    const n=$('#bs-note').value;$('#bs-note-count').textContent=n.length+' '+t('chars');
    $('#bs-note-summary').textContent=n.trim()?n.trim().slice(0,28)+(n.trim().length>28?'…':''):t('blankPage');
  }
  function drawChart(){
    if(!asset)return;const svg=$('#bs-market-chart');const vals=sample[asset];const width=Math.max(230,svg.getBoundingClientRect().width),height=150;
    svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.replaceChildren();const ns='http://www.w3.org/2000/svg';
    const min=Math.min.apply(null,vals),max=Math.max.apply(null,vals),pad=Math.max((max-min)*.15,.03),lo=min-pad,hi=max+pad;
    const left=45,right=width-12,top=15,bottom=124;
    function y(v){return bottom-(v-lo)/(hi-lo)*(bottom-top);}
    function s(tag,attrs,text){const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(function(a){e.setAttribute(a[0],a[1]);});if(text!==undefined)e.textContent=text;svg.append(e);return e;}
    s('title',{},asset+' · '+t('sampleValues'));
    for(let i=0;i<3;i++){const v=min+(max-min)*i/2,py=y(v);s('line',{x1:left,x2:right,y1:py,y2:py,class:'bs-chart-grid'});s('text',{x:left-8,y:py+4,'text-anchor':'end'},v.toLocaleString(lang==='sl'?'sl-SI':'en-GB',{maximumFractionDigits:2})+'%');}
    s('polyline',{points:vals.map(function(v,i){return (left+i*(right-left)/(vals.length-1))+','+y(v);}).join(' '),class:'bs-chart-line'});
    s('text',{x:left,y:146},'0 h');s('text',{x:right,y:146,'text-anchor':'end'},'24 h');
    $('#bs-chart-title').textContent=(asset==='GOLD'?t('gold'):asset==='OIL'?'Brent':asset)+' · '+t('sampleValues');
  }
  function clock(){
    const now=new Date();$('#bs-clock').textContent=new Intl.DateTimeFormat(lang==='sl'?'sl-SI':'en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Ljubljana'}).format(now);
    $('#bs-date').textContent=new Intl.DateTimeFormat(lang==='sl'?'sl-SI':'en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Ljubljana'}).format(now);
  }
  function localize(){
    root.lang=lang;document.documentElement.lang=lang;document.title=lang==='sl'?'BD Start — Tvoj svet. Na enem mestu.':'BD Start — Your world. One place.';$$('[data-i18n]').forEach(function(e){e.textContent=t(e.getAttribute('data-i18n'));});pressed('button[data-lang]','data-lang',lang);
    $('#bs-search-input').placeholder=t('search');$('#bs-search-input').setAttribute('aria-label',t('search'));
    $('.bs-toolbar').setAttribute('aria-label',t('appearance'));$('#bs-city').setAttribute('aria-label',t('location'));
    $('#bs-note').placeholder=t('notePlaceholder');$('#bs-note').setAttribute('aria-label',t('notes'));
    const labels={'#bs-scale-down':'smaller','#bs-scale-up':'larger','#bs-scale-reset':'reset','#bs-clear-search':'clear','#bs-prev-month':'prevMonth','#bs-next-month':'nextMonth','#bs-chart-close':'closeChart'};
    Object.entries(labels).forEach(function(a){$(a[0]).setAttribute('aria-label',t(a[1]));});
    const prices={SPX:[6314.20,2,.42],BTC:[103284,0,1.28],GOLD:[3286.40,2,.61],OIL:[67.18,2,-.34],EURUSD:[1.1602,4,.12]};
    $$('button[data-asset]').forEach(function(b){const v=prices[b.dataset.asset],loc=lang==='sl'?'sl-SI':'en-US';b.querySelector('.bs-ticker-value').textContent=v[0].toLocaleString(loc,{minimumFractionDigits:v[1],maximumFractionDigits:v[1]});b.querySelector('.bs-ticker-change').textContent=(v[2]>=0?'↗ +':'↘ −')+Math.abs(v[2]).toLocaleString(loc,{minimumFractionDigits:2,maximumFractionDigits:2})+'%';});
    renderLinks();renderNews();renderReading();renderCalendar();renderNote();clock();drawChart();renderSearch();renderCity();renderLiveNews();storageStatus();$('#bs-pins-edit').textContent=t($('#bs-pin-editor').hidden?'editPins':'donePins');
  }
  function renderSearch(){
    const a=renderLinks(),b=renderNews(),q=normalized(query());let plans=0;
    if(q&&planBeforeSearch===null){planBeforeSearch=$('#bs-plans-panel').open;$('#bs-plans-panel').open=true;}
    $$('.bs-plan-link').forEach(function(link){const group=link.closest('.bs-category'),categoryMatch=group&&q&&normalized(group.querySelector('summary').textContent).includes(q);const match=!q||categoryMatch||normalized(link.textContent+' '+(link.dataset.keywords||'')+' '+link.href).includes(q);link.hidden=!match;if(match)plans++;});
    $$('.bs-category').forEach(function(group){const matching=Array.from(group.querySelectorAll('.bs-plan-link')).some(function(a){return !a.hidden;});group.hidden=!!q&&!matching;group.open=q?matching:openGroups[group.dataset.category];});
    if(!q&&planBeforeSearch!==null){$('#bs-plans-panel').open=planBeforeSearch;planBeforeSearch=null;}
    const c=renderLiveNews();$('#bs-filter-status').hidden=!q;$('#bs-filter-status').textContent=t('filter')+': '+(a+b+(q?plans+c:0))+' '+t('results');updateGroupButton();
  }
  $$('button[data-lang]').forEach(function(b){b.addEventListener('click',function(){lang=b.dataset.lang;localize();persist();});});
  $$('button[data-theme]').forEach(function(b){b.addEventListener('click',function(){root.dataset.theme=b.dataset.theme;document.documentElement.dataset.theme=b.dataset.theme;pressed('button[data-theme]','data-theme',b.dataset.theme);persist();});});
  function changeScale(next){scale=Math.min(140,Math.max(90,next));root.style.setProperty('--bs-type',(14*scale/100)+'px');root.dataset.size=scale>=120?'large':'normal';$('#bs-scale-reset').textContent=scale+'%';$('#bs-scale-down').disabled=scale===90;$('#bs-scale-up').disabled=scale===140;}
  $('#bs-scale-down').addEventListener('click',function(){changeScale(scale-10);persist();});$('#bs-scale-up').addEventListener('click',function(){changeScale(scale+10);persist();});$('#bs-scale-reset').addEventListener('click',function(){changeScale(100);persist();});
  $$('button[data-mode]').forEach(function(b){b.addEventListener('click',function(){root.dataset.mode=b.dataset.mode;pressed('button[data-mode]','data-mode',b.dataset.mode);if(b.dataset.mode==='all')$$('details').forEach(function(d){d.open=true;});if(b.dataset.mode==='overview'){['bs-links-panel','bs-agenda-panel','bs-news-panel','bs-weather-panel','bs-note-panel'].forEach(function(id){$('#'+id).open=true;});$('#bs-reading-panel').open=false;$('#bs-more-panel').open=false;$('#bs-data-panel').open=false;}drawChart();persist();});});
  $$('button[data-link-group]').forEach(function(b){b.addEventListener('click',function(){linkGroup=b.dataset.linkGroup;pressed('button[data-link-group]','data-link-group',linkGroup);closeLinkForm();renderLinks();persist();});});
  $$('button[data-news-group]').forEach(function(b){b.addEventListener('click',function(){newsGroup=b.dataset.newsGroup;pressed('button[data-news-group]','data-news-group',newsGroup);renderNews();persist();});});
  $('#bs-news-more').addEventListener('click',function(){moreStories=!moreStories;renderNews();});
  $('#bs-search-input').addEventListener('input',renderSearch);$('#bs-search-form').addEventListener('submit',function(e){e.preventDefault();renderSearch();});
  $('#bs-clear-search').addEventListener('click',function(){$('#bs-search-input').value='';renderSearch();$('#bs-search-input').focus();});
  $$('button[data-asset]').forEach(function(b){b.addEventListener('click',function(){const same=asset===b.dataset.asset&&!$('#bs-chart-panel').hidden;asset=b.dataset.asset;$('#bs-chart-panel').hidden=same;$$('button[data-asset]').forEach(function(x){x.setAttribute('aria-expanded',String(!same&&x===b));});drawChart();});});
  $('#bs-chart-close').addEventListener('click',function(){$('#bs-chart-panel').hidden=true;$$('button[data-asset]').forEach(function(b){b.setAttribute('aria-expanded','false');});});
  const resizeObserver=new ResizeObserver(function(){if(!$('#bs-chart-panel').hidden)drawChart();});resizeObserver.observe(root);
  function renderCity(){const city=$('#bs-city').value,temperatures={Ljubljana:12,Maribor:11,Koper:17,Celje:10};$('#bs-weather-city').textContent=city;$('#bs-weather-temp').textContent=temperatures[city]+'°';$('#bs-weather-summary').textContent=(lang==='sl'?'Vzorec':'Sample')+' · '+city;}
  $('#bs-city').addEventListener('change',function(){renderCity();persist();});
  $('#bs-prev-month').addEventListener('click',function(){if(year===1900&&month===0)return;month--;if(month<0){month=11;year--;}renderCalendar();persist();});$('#bs-next-month').addEventListener('click',function(){if(year===2100&&month===11)return;month++;if(month>11){month=0;year++;}renderCalendar();persist();});
  $('#bs-note').addEventListener('input',function(){renderNote();persist();});
  function toggleForm(button,form){const b=$(button),f=$(form);b.addEventListener('click',function(){f.hidden=!f.hidden;b.setAttribute('aria-expanded',String(!f.hidden));if(!f.hidden)f.querySelector('input').focus();});}
  toggleForm('#bs-add-event-toggle','#bs-add-event');
  function closeLinkForm(){editingLink=null;$('#bs-add-link').reset();$('#bs-add-link').hidden=true;$('#bs-link-error').hidden=true;$('#bs-add-link-toggle').setAttribute('aria-expanded','false');}
  $('#bs-add-link-toggle').addEventListener('click',function(){const wasHidden=$('#bs-add-link').hidden;closeLinkForm();if(wasHidden){$('#bs-add-link').hidden=false;$('#bs-add-link-toggle').setAttribute('aria-expanded','true');$('#bs-link-name').focus();}});
  $('#bs-link-cancel').addEventListener('click',closeLinkForm);
  $('#bs-manage-links').addEventListener('click',function(){manageLinks=!manageLinks;$('#bs-manage-links').setAttribute('aria-pressed',String(manageLinks));closeLinkForm();renderLinks();});
  $('#bs-event-cancel').addEventListener('click',function(){$('#bs-add-event').hidden=true;$('#bs-add-event-toggle').setAttribute('aria-expanded','false');$('#bs-event-error').hidden=true;});
  $('#bs-add-link').addEventListener('submit',function(e){e.preventDefault();const name=$('#bs-link-name').value.trim();let url;try{url=Contract.url($('#bs-link-url').value.trim());}catch(_){$('#bs-link-error').hidden=false;$('#bs-link-error').textContent=t('invalidURL');return;}if(!name)return;
    if(editingLink){const oldUrl=links[editingLink.group][editingLink.index][1];links[editingLink.group][editingLink.index]=[name,url,name.slice(0,2).toUpperCase()];favoriteUrls=Array.from(new Set(favoriteUrls.map(function(x){return x===oldUrl?url:x;})));}else{if(links[linkGroup].length>=300){$('#bs-link-error').hidden=false;$('#bs-link-error').textContent=t('maxLinks');return;}links[linkGroup].push([name,url,name.slice(0,2).toUpperCase()]);}
    closeLinkForm();renderLinks();persist();
  });
  $('#bs-event-date').value=selectedDate;
  $('#bs-add-event').addEventListener('submit',function(e){e.preventDefault();const title=$('#bs-event-title').value.trim(),date=$('#bs-event-date').value,time=$('#bs-event-time').value;if(!title)return;if(!Contract.date(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){$('#bs-event-error').hidden=false;$('#bs-event-error').textContent=t('invalidEvent');return;}if(events.length>=1000){$('#bs-event-error').hidden=false;$('#bs-event-error').textContent=t('maxEvents');return;}
    events.push({id:newRevision(),title:title,date:date,time:time});selectedDate=date;const parts=date.split('-');year=Number(parts[0]);month=Number(parts[1])-1;$('#bs-add-event').hidden=true;$('#bs-event-error').hidden=true;$('#bs-add-event-toggle').setAttribute('aria-expanded','false');$('#bs-event-title').value='';renderCalendar();persist();
  });
  function newRevision(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);}
  function snapshot(){const openPanels={};Contract.panels.forEach(function(id){openPanels[id]=$('#'+id).open;});if(planBeforeSearch!==null)openPanels['bs-plans-panel']=planBeforeSearch;return {version:1,preferences:{lang:lang,theme:root.dataset.theme,scale:scale,mode:root.dataset.mode||'overview',linkGroup:linkGroup,newsGroup:newsGroup,city:$('#bs-city').value,calendarDate:selectedDate,calendarMonth:year+'-'+String(month+1).padStart(2,'0'),openPanels:openPanels,favoriteUrls:favoriteUrls.slice(),openGroups:Object.assign({},openGroups)},links:links,events:events,notes:$('#bs-note').value,saved:Array.from(saved)};}
  function storageStatus(){const alert=$('#bs-storage-alert');alert.hidden=!storageIssue;$('#bs-storage-message').textContent=storageIssue?t(storageIssue):'';$('#bs-reload-data').hidden=storageIssue!=='changedElsewhere';$('#bs-save-status').textContent=storageIssue?t('localOnly'):lastRevision?t('browserOnly'):t('localOnly');$('#bs-note-save-status').textContent=storageIssue?t('localOnly'):t('browserOnly');}
  function persist(force){if(restoring)return false;if(protectedStorage&&!force){storageStatus();return false;}
    try{const raw=localStorage.getItem(Contract.KEY);const existing=raw&&!force?Contract.parse(raw):null;if(!force&&(existing?existing.revision||null:null)!==lastRevision){storageIssue='changedElsewhere';protectedStorage=true;storageStatus();return false;}
      const data=Contract.normalize(snapshot());data.revision=newRevision();data.updatedAt=new Date().toISOString();localStorage.setItem(Contract.KEY,JSON.stringify(data));lastRevision=data.revision;storageIssue=null;protectedStorage=false;storageStatus();return true;
    }catch(_){storageIssue='saveUnavailable';storageStatus();return false;}
  }
  function applyState(data){restoring=true;const p=data.preferences;lang=p.lang;linkGroup=p.linkGroup;newsGroup=p.newsGroup;selectedDate=p.calendarDate;year=Number(p.calendarMonth.slice(0,4));month=Number(p.calendarMonth.slice(5))-1;favoriteUrls=p.favoriteUrls?p.favoriteUrls.slice():defaultFavorites();openGroups=p.openGroups?Object.assign({},p.openGroups):{ai:false,research:false,development:false,daily:false,travel:false,lab:false};planBeforeSearch=null;root.dataset.theme=p.theme;document.documentElement.dataset.theme=p.theme;root.dataset.mode=p.mode;changeScale(p.scale);$('#bs-city').value=p.city;$('#bs-note').value=data.notes;$('#bs-event-date').value=selectedDate;
    Object.keys(links).forEach(function(group){links[group]=data.links[group].map(function(x){return x.slice();});});events.splice(0,events.length,...data.events);saved.clear();data.saved.forEach(function(id){saved.add(id);});
    Contract.panels.forEach(function(id){$('#'+id).open=p.openPanels[id];});pressed('button[data-theme]','data-theme',p.theme);pressed('button[data-mode]','data-mode',p.mode);pressed('button[data-link-group]','data-link-group',linkGroup);pressed('button[data-news-group]','data-news-group',newsGroup);closeLinkForm();$('#bs-add-event').hidden=true;$('#bs-add-event-toggle').setAttribute('aria-expanded','false');localize();setTimeout(function(){restoring=false;root.dataset.ready='true';},0);
  }
  const initialTheme=typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';root.dataset.theme=initialTheme;document.documentElement.dataset.theme=initialTheme;
  let initial=null;try{const raw=localStorage.getItem(Contract.KEY);if(raw){try{initial=Contract.parse(raw);lastRevision=initial.revision||null;}catch(_){storageIssue='invalidStored';protectedStorage=true;}}}catch(_){storageIssue='saveUnavailable';}
  if(initial)applyState(initial);else{pressed('button[data-theme]','data-theme',initialTheme);localize();changeScale(100);setTimeout(function(){restoring=false;root.dataset.ready='true';},0);}
  Contract.panels.forEach(function(id){$('#'+id).addEventListener('toggle',function(){if(id==='bs-plans-panel'&&query())return;persist();});});
  window.addEventListener('storage',function(e){if(e.key===Contract.KEY){storageIssue='changedElsewhere';protectedStorage=true;storageStatus();}});
  $('#bs-reload-data').addEventListener('click',function(){try{const data=Contract.parse(localStorage.getItem(Contract.KEY));lastRevision=data.revision||null;storageIssue=null;protectedStorage=false;applyState(data);}catch(_){storageIssue='invalidStored';protectedStorage=true;storageStatus();}});
  function dataStatus(key,error){$('#bs-data-status').textContent=t(key);$('#bs-data-status').classList.toggle('bs-error',!!error);}
  $('#bs-export').addEventListener('click',function(){try{const data=Contract.normalize(snapshot());data.updatedAt=new Date().toISOString();const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='BD-Start-'+todayISO()+'.json';document.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},5000);dataStatus('exported');}catch(_){dataStatus('invalidData',true);}});
  $('#bs-import').addEventListener('click',function(){$('#bs-import-file').value='';$('#bs-import-file').click();});
  $('#bs-import-file').addEventListener('change',async function(){const f=this.files[0];pendingImport=null;$('#bs-import-review').hidden=true;if(!f)return;try{if(f.size>8000000)throw new Error('tooLarge');pendingImport=Contract.parse(await f.text());const n=Object.values(pendingImport.links).reduce(function(a,x){return a+x.length;},0);$('#bs-import-summary').textContent=lang==='sl'?n+' bližnjic · '+pendingImport.events.length+' dogodkov · '+pendingImport.notes.length+' znakov beležke':n+' shortcuts · '+pendingImport.events.length+' events · '+pendingImport.notes.length+' note characters';$('#bs-import-review').hidden=false;$('#bs-data-status').textContent='';}catch(_){dataStatus('invalidData',true);}});
  $('#bs-import-cancel').addEventListener('click',function(){pendingImport=null;$('#bs-import-review').hidden=true;$('#bs-import-file').value='';});
  $('#bs-import-confirm').addEventListener('click',function(){if(!pendingImport)return;const data=pendingImport;pendingImport=null;$('#bs-import-review').hidden=true;applyState(data);setTimeout(function(){if(persist(true))dataStatus('imported');else dataStatus('saveUnavailable',true);},0);});
  document.addEventListener('keydown',function(e){if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('#bs-search-input').focus();}if(e.key==='Escape'&&document.activeElement===$('#bs-search-input')){$('#bs-search-input').value='';renderSearch();}});
  const clockTimer=setInterval(function(){if(root.isConnected){clock();if(lastToday!==todayISO()){lastToday=todayISO();renderCalendar();}}else clearInterval(clockTimer);},30000);
  loadLatestNews();
  icons();
})();

