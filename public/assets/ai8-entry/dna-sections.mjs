import {FEATURED_IDS} from './featured-catalog.mjs';

// Labels describe subjects, not claims of validation. Original groups, kinds,
// descriptions and related IDs remain on every underlying catalogue record.
export const SECTIONS = Object.freeze([
  {id:'top',sl:'TOP 8',en:'TOP 8',name:{sl:'Osem izbranih projektov',en:'Eight featured projects'},description:{sl:'Osem bližnjic do izbranih projektov, iger, raziskav in zgodb.',en:'Eight starting points for selected projects, games, research and stories.'}},
  {id:'cfh',sl:'CFH / Zavest',en:'CFH / Consciousness',name:{sl:'CFH in raziskovanje zavesti',en:'CFH and consciousness research'},description:{sl:'Hipoteza polja zavesti (CFH), CCH in Absolute Consciousness: zamisli in raziskave o zavesti.',en:'Consciousness Field Hypothesis (CFH), CCH and Absolute Consciousness: ideas and research on consciousness.'}},
  {id:'ai8',sl:'AI8',en:'AI8',name:{sl:'Arhitektura in sodelovanje AI8',en:'AI8 architecture and collaboration'},description:{sl:'AI8, AI8 Live, AIM³, RHP, spomin, kontinuiteta in sodelovanje človeka z agenti.',en:'AI8, AI8 Live, AIM³, RHP, memory, continuity and collaboration between people and agents.'}},
  {id:'games',sl:'IGRE',en:'GAMES',name:{sl:'Igre in sklepanje',en:'Games and reasoning'},description:{sl:'ChessBest, Sudoku, Flip4M in križanke: igre, navodila in povezane strani.',en:'ChessBest, Sudoku, Flip4M and crosswords: games, guides and related pages.'}},
  {id:'apps',sl:'APPS',en:'APPS',name:{sl:'Aplikacije in uporabna orodja',en:'Applications and useful tools'},description:{sl:'TripOpti, Shield, graditelji pozivov in druga uporabna programska orodja ter njihove predstavitve.',en:'TripOpti, Shield, prompt builders and other useful software tools and their introductions.'}},
  {id:'machines',sl:'NAPRAVE',en:'MACHINES',name:{sl:'Naprave, stroji in izumi',en:'Devices, machines and inventions'},description:{sl:'HTH, DGTE, SORA, pogoni, plovila in drugi fizični izumi.',en:'HTH, DGTE, SORA, propulsion, watercraft and other physical inventions.'}},
  {id:'theories',sl:'TEORIJE',en:'THEORIES',name:{sl:'Teorije, modeli in zamisli',en:'Theories, models and ideas'},description:{sl:'MDL × DCC, 8Z, ToE in sorodni koncepti: osnovne razlage, modeli ter povezave med področji.',en:'MDL × DCC, 8Z, ToE and related concepts: core explanations, models and connections across domains.'}},
  {id:'stories',sl:'ZGODBE',en:'STORIES',name:{sl:'Zgodbe, podobe in galerije',en:'Stories, images and galleries'},description:{sl:'Nara, Illuminara, Human in the Middle, umetnost, pripovedi in vizualno delo.',en:'Nara, Illuminara, Human in the Middle, art, narratives and visual work.'}},
  {id:'lab',sl:'LAB / RAZISKAVE',en:'LAB / RESEARCH',name:{sl:'Laboratorij in raziskovalne različice',en:'Laboratory and research variants'},description:{sl:'Eksperimenti, arene, primerjave, meritve, arhivske različice in druga raziskovalna gradiva. Povezave do izvirnih tem ostanejo ohranjene.',en:'Experiments, arenas, comparisons, measurements, archived variants and other research materials. Connections to their original subjects are preserved.'}}
]);
const primary = {
  'page-1acawln':'theories', // Top 100 Universe-Origin & Existence Theories
  'page-17igdys':'lab','page-8q559z':'lab', // RouteSignal prompt-method comparisons
  'page-t8mklc':'ai8', // DCC Meta-Architecture

  tripopti:'apps','mdl-dcc':'theories',chessbest:'games',sudoku:'games',ai8:'ai8',materials:'lab','8zip':'theories','human-middle':'stories',nara:'stories',flip4m:'games',crosswords:'games',tsp:'lab',hth:'machines',dgte:'machines',compression:'theories',aim3:'ai8',rhp:'ai8',os:'lab',consciousness:'cfh',toe:'theories',top100:'theories','who-are-we':'ai8',birds:'stories','discovery-map':'cfh','dna-research':'lab',bd:'ai8','ai8-codex':'ai8','ai8-dna':'ai8','ai8-live':'ai8'
};
// Match the actual title and path first. Broad generated descriptions sometimes
// contain cross-domain boilerplate, so they must not determine the main subject.
const rules = [
 ['stories', /\/(?:Nara|Birds|Art|Someone|history|knjiga)\/|Human in the Middle|Visual Identity|Origin Story|OS_Story|Heroes\.html/i],
 ['lab', /\/(?:new|lab|chess-lab|Mix|8ZT)\/|\b(?:benchmark|comparison|testbed|tournament|arenas?|experimental?|evidence|review|statistics|audit)\b|(?:_ARENAS|_Testbed|_Challenge|_stats|_evidence|_Review|_Benchmark)|\/LO\/|\/SLO\/|trading|trader|HSR_|Hedge_Separation|Ukraine_|LCI_|kardiolog/i],
 ['cfh', /\/(?:acp)\/|consciousness|\bCFH\b|\bCCH\b|conscious love|BD_CCH|BD_CFH|\/(?:AC\d*|AC_AA|AC_01_Flagship|AC_07_Resonance_Communications|Physics_CFH_MDLxDCC)\.html|Birth.of.Thought|Fifth.Mind/i],
 ['apps', /\/Trip\/|shield|8z_publish|8z_auth|file.manager|prompt.builder|RHPm(?:_v[\d_]+)?\.html|RouteSignal_Scout/i],
 ['games', /\/(?:S|CW|F4M|chess|8zS|igra|game)\/|sudoku|crossword|flip4|ChessBest/i],
 ['machines', /(?:\bHTH\b|\bDGTE\b|\bSORA\b|\bAPSV\b|\bMGHB\b|\bWFERA\b)|HTH-|DGTE-|Hydrofoil|Propulsor|Maglev|Kayak|Top100I\.html|DeepTech|wifi\.html/i],
 ['ai8', /\/(?:AI8|AIm3|c|w)\/|AI8|AIM[³3]|RHP|Resonance.Hybrid|MentalArena|Mind.of.Minds|C_soul|BDR|BD_8Z_Reasoning|AI.Storm|Trust.Pact|portfolio/i],
 ['theories', /MDL|DCC|\b8Z\b|8zip|\/8Z\/|ToE|Top100|\bPiC\b|\/RH\.html|AC.WFP|Origin\.html/i]
];
export function classify(entries) {
  return entries.map(item=>{
    const text=decodeURI(item.url)+' '+item.title;
    const subjects=[...new Set(rules.filter(([,rule])=>rule.test(text)).map(([id])=>id))];
    const category=primary[item.id]||subjects[0]||'lab';
    return {...item,category,secondaryCategories:subjects.filter(id=>id!==category)};
  });
}
export const LOOP_HEIGHT=500, FIRST_Y=144, PER_LOOP=12;
export function buildStrand(items, height=LOOP_HEIGHT) {
  const instances=[],loops=[];
  for(const section of SECTIONS){
    const records=section.id==='top'?FEATURED_IDS.map(id=>items.find(p=>p.id===id)).filter(Boolean):items.filter(p=>p.category===section.id).sort((a,b)=>Number(!!b.dnaTop)-Number(!!a.dnaTop));
    const total=Math.ceil(records.length/PER_LOOP);
    for(let part=0;part<total;part++){
      const start=FIRST_Y+loops.length*height;
      const loop={section:section.id,start,end:start+height,centre:start+height/2,part:part+1,total,count:records.length};loops.push(loop);
      const chunk=records.slice(part*PER_LOOP,(part+1)*PER_LOOP);
      chunk.forEach((item,i)=>instances.push({id:`${section.id}:${item.id}`,project:item,section:section.id,y:start+56+i*(height-112)/Math.max(1,chunk.length-1),side:i%2}));
    }
  }
  return {instances,loops,end:FIRST_Y+loops.length*height};
}
