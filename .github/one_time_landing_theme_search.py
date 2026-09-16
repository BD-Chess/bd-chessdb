#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return Path(path).read_text(encoding='utf-8')

def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

def one(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {n}')
    return text.replace(old, new, 1)

def add_before_head_end(text, block, sentinel, label):
    if sentinel in text:
        return text
    if '</head>' not in text:
        raise SystemExit(f'{label}: </head> missing')
    return text.replace('</head>', block + '\n</head>', 1)

def add_before_body_end(text, block, sentinel, label):
    if sentinel in text:
        return text
    if '</body>' not in text:
        raise SystemExit(f'{label}: </body> missing')
    return text.replace('</body>', block + '\n</body>', 1)

# ---------------------------------------------------------------------------
# 1) Landing: visual width, real light cards, project-Page-safe smart search.
# ---------------------------------------------------------------------------
p = Path('public/index.html')
s = read(p)

s = one(
    s,
    '.topline,main,footer{max-width:var(--max);width:calc(100% - 80px);margin-inline:auto}',
    '.topline,main,footer,.explore-more{max-width:var(--max);width:calc(100% - 80px);margin-inline:auto}',
    'landing shared width'
)
s = one(
    s,
    '.explore-more{margin:38px 0 0;padding:30px 0 2px;border-top:1px solid var(--line)}',
    '.explore-more{margin:38px auto 0;padding:30px 0 2px;border-top:1px solid var(--line)}',
    'explore-more desktop margin'
)
s = one(
    s,
    '.topline,main,footer{width:calc(100% - 48px)}',
    '.topline,main,footer,.explore-more{width:calc(100% - 48px)}',
    'explore-more mobile width'
)
s = one(
    s,
    '.topline,main,footer{width:calc(100% - 36px)}',
    '.topline,main,footer,.explore-more{width:calc(100% - 36px)}',
    'explore-more narrow width'
)

if '/* landing light cards v2 */' not in s:
    m = re.search(r'(:root\[data-theme=light\]\{[^\n]+\}\n)', s)
    if not m:
        raise SystemExit('landing light root anchor missing')
    light_cards = r'''/* landing light cards v2 */
:root[data-theme=light]{--card-ink:#1b2c2b}
:root[data-theme=light] .door{background:#f7f8f3;border-color:#b8c5bf;color:var(--card-ink);box-shadow:0 14px 34px rgba(48,66,62,.12)}
:root[data-theme=light] .preview img{opacity:.52;filter:brightness(1.35) contrast(.67) saturate(.58)}
:root[data-theme=light] .preview-shade{background:linear-gradient(180deg,rgba(242,241,235,.34) 10%,rgba(242,241,235,.62) 45%,rgba(242,241,235,.95) 73%,#f2f1eb 100%)}
:root[data-theme=light] .door-copy p{color:#526563}
:root[data-theme=light] .enter{border-color:#617b7d55}
@media(hover:hover) and (pointer:fine){:root[data-theme=light] .door{filter:opacity(.55) brightness(1)}:root[data-theme=light] .door:hover,:root[data-theme=light] .door:focus-visible{filter:opacity(1) brightness(1)}}
'''
    s = s[:m.end()] + light_cards + s[m.end():]

# Make search use the repository base on GitHub Pages and enrich it with curated hubs.
old = "const STORE='mdlxdcc-search-history-v1',MAX_HISTORY=12,MAX_QUERY=120;"
new = r'''const STORE='mdlxdcc-search-history-v1',MAX_HISTORY=12,MAX_QUERY=120;
const SITE_BASE=new URL('./',location.href),BASE_PATH=SITE_BASE.pathname.endsWith('/')?SITE_BASE.pathname:SITE_BASE.pathname+'/';
const SMART_ROUTES=Object.freeze([
 {path:'Trip/',title:'8z Trip Optimizer',aliases:'trip route routes travel journey planner optimizer optimisation tsp app application map maps',description:'Interactive trip and route optimizer.',priority:320},
 {path:'chess/',title:'ChessDCC',aliases:'chess chessdcc chessdb dcc board analysis app application game',description:'ChessDB + DCC analysis application.',priority:315},
 {path:'S/',title:'8z Sudoku',aliases:'sudoku puzzle proof proofatlas app application game solver',description:'Sudoku reasoning and proof application.',priority:310},
 {path:'F4M/',title:'Flip 4M',aliases:'flip flip4m f4m connect four game app application magnets gravity',description:'Flip4M playable game and DCC laboratory.',priority:305},
 {path:'CW/',title:'Crosswords',aliases:'crossword crosswords words puzzle app application game mdl',description:'Crossword × MDL application.',priority:300},
 {path:'AI8/',title:'AI8',aliases:'ai8 architecture arenaloop evidence continuity agi agents research',description:'AI8 architecture, evidence and continuity.',priority:290},
 {path:'BD/BD_AIM3.html',title:'AIm3',aliases:'aim3 aim³ mental arena multi llm reasoning council orchestration',description:'AIm3 reasoning and orchestration system.',priority:285},
 {path:'BD/BD_AIM3_RHP.html',title:'RHP',aliases:'rhp resonance work reasoning protocol prompt adaptive front door',description:'RHP adaptive reasoning front door.',priority:280},
 {path:'BD/BD_AIM3_RHPm.html',title:'AIm3 Protocols',aliases:'aim3 aim³ protocols rhpm prompt builder reasoning protocols genes',description:'AIm3 / RHPm protocol tools.',priority:275},
 {path:'crp/8z_MDLxDCC.html',title:'8z–MDL×DCC architecture',aliases:'mdl dcc mdldcc mdlxdcc 8z minimum description length dynamic complexity controller architecture evidence',description:'Core 8z–MDL×DCC architecture and evidence.',priority:330},
 {path:'crp/MDLxDCC.html',title:'MDL×DCC Explained',aliases:'mdl dcc mdldcc mdlxdcc minimum description length dynamic complexity controller explained domain map',description:'Public MDL×DCC explanation and domain map.',priority:325},
 {path:'BD/BD_8ZRP.html',title:'8Z-RP / Different TSP',aliases:'tsp traveling travelling salesman 8z rp route routing optimizer different tsp',description:'8Z-RP and TSP research.',priority:265},
 {path:'8zMaterials.html',title:'8zMaterials',aliases:'materials material discovery chemistry b6 h1 arena mdl dcc',description:'Native MDL×DCC materials discovery.',priority:260},
 {path:'BD/BD_CCH_Consciousness_Field.html',title:'CFH / CCH',aliases:'cfh cch consciousness claustrum field hypothesis consciousness hypothesis',description:'Consciousness hypothesis lineage and science boundary.',priority:250},
 {path:'BD/8z_shield_landing.html',title:'8Z Shield',aliases:'shield encryption encrypted html protection security password access',description:'Encrypted HTML protection technology.',priority:245},
 {path:'Nara/',title:'Nara / Illuminara Stories',aliases:'nara illuminara story stories fiction literature narrative creative',description:'Nara and Illuminara story world.',priority:270},
 {path:'Birds/',title:'The Birds — story world',aliases:'birds bird story stories fiction horror flying salami narrative creative',description:'The Birds cinematic horror story project.',priority:268},
 {path:'crp/Top100I.html',title:'Top100I — Inventions',aliases:'devices device machines machine inventions invention physical engineering hardware concepts apparatus proposals',description:'Top inventions, devices and machine concepts.',priority:275},
 {path:'crp/Top100.html',title:'Top 100 Atlas',aliases:'problems theories inventions devices machines atlas ideas',description:'Problems, theories and inventions atlas.',priority:230},
 {path:'index-atlas.html',title:'The whole atlas',aliases:'portfolio atlas projects inventions devices machines physical engineering stories apps applications',description:'Complete BD × AI portfolio atlas.',priority:240},
 {path:'BD-work-at-a-glance.html',title:'BD — work at a glance',aliases:'portfolio work inventions devices machines projects overview',description:'Plain-language guide to the work.',priority:220},
 {path:'BD/BD_Trading_Research_Atlas.html',title:'BD Trading Research Atlas',aliases:'trading trader markets crypto strategies arena evidence',description:'Trading research, strategies and evidence.',priority:220},
 {path:'BD/',title:'BD portfolio',aliases:'bd bojan portfolio person projects ideas inventions',description:'BD portfolio and personal project map.',priority:210},
 {path:'crp/',title:'Core research papers',aliases:'crp core research papers mdl dcc research',description:'Core research-paper hub.',priority:205}
]);'''
s = one(s, old, new, 'search base + smart routes')

old = "const normalize=s=>String(s).normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();"
new = r'''const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function smartQuery(raw){let q=normalize(raw),compact=q.replace(/\s+/g,'');if(['mdldcc','mdlxdcc','8zmdldcc','8zmdlxdcc'].includes(compact))return 'mdl dcc';if(compact==='tripoptimizer'||compact==='8ztripoptimizer')return 'trip';if(compact==='flip4m')return 'flip4m';return q;}
function stripBase(path){path=String(path||'').replace(/\/{2,}/g,'/');if(BASE_PATH!=='/'&&path.startsWith(BASE_PATH))path='/'+path.slice(BASE_PATH.length);return path||'/';}
function localURL(raw){const u=new URL(String(raw).replace(/^\/+/,''),SITE_BASE);return u.pathname+u.search+u.hash;}'''
s = one(s, old, new, 'search normalize helpers')

old = "function siteKey(raw){try{let p=new URL(raw,location.href).pathname.replace(/\\/{2,}/g,'/').replace(/\\.(?:html?|htm)$/i,'').replace(/\\/index$/i,'').replace(/\\/$/,'');return (p||'/').toLowerCase();}catch(_){return '';}}"
new = "function siteKey(raw){try{let p=stripBase(new URL(raw,location.href).pathname).replace(/\\.(?:html?|htm)$/i,'').replace(/\\/index$/i,'').replace(/\\/$/,'');return (p||'/').toLowerCase();}catch(_){return '';}}"
s = one(s, old, new, 'search siteKey')

old = "function safePath(raw){try{const u=new URL(raw,location.href),allowed=new Set([location.hostname.toLowerCase(),'www.mdlxdcc.org','mdlxdcc.org']);if(!allowed.has(u.hostname.toLowerCase()))return null;return {key:siteKey(u.href),url:u.pathname+(u.search||'')};}catch(_){return null;}}"
new = "function safePath(raw){try{const u=new URL(raw,location.href),allowed=new Set([location.hostname.toLowerCase(),'www.mdlxdcc.org','mdlxdcc.org']);if(!allowed.has(u.hostname.toLowerCase()))return null;const canonical=stripBase(u.pathname);return {key:siteKey(canonical),url:localURL(canonical+(u.search||''))};}catch(_){return null;}}"
s = one(s, old, new, 'search safePath')

old = "function indexedPage(p){return {...p,nt:normalize(p.title),np:normalize(p.url),na:normalize(p.aliases||''),nd:normalize(p.description||'')};}"
new = "function indexedPage(p){const route=siteKey(p.url).split('/').filter(Boolean).join(' '),aliases=((p.aliases||'')+' '+route).trim();return {...p,aliases,nt:normalize(p.title),np:normalize(p.url),na:normalize(aliases),nd:normalize(p.description||'')};}"
s = one(s, old, new, 'search indexedPage folder aliases')
s = one(s, " const q=normalize(query);if(!q)return [];", " const q=smartQuery(query);if(!q)return [];", 'search smartQuery rank')

s = s.replace("fetchText('/sitemap.xml')", "fetchText(new URL('sitemap.xml',SITE_BASE).href)")
s = s.replace("fetchText('/index-search.html')", "fetchText(new URL('index-search.html',SITE_BASE).href)")
if "fetchText('/sitemap.xml')" in s or "fetchText('/index-search.html')" in s:
    raise SystemExit('search absolute index fetch remains')

anchor = "  }else{for(const p of ref){const key=siteKey(p.url);if(key&&!byKey.has(key))byKey.set(key,p);}}\n  pages=[...byKey.values()].filter(p=>p&&p.url&&p.title).map(indexedPage);"
replacement = r'''  }else{for(const p of ref){const key=siteKey(p.url);if(key&&!byKey.has(key))byKey.set(key,p);}}
  for(const item of SMART_ROUTES){
   const smart={...item,url:localURL(item.path)},key=siteKey(smart.url),prior=byKey.get(key);
   if(!key)continue;
   if(prior)byKey.set(key,{...prior,aliases:((prior.aliases||'')+' '+smart.aliases).trim(),priority:Math.max(Number(prior.priority)||0,smart.priority||0),description:prior.description||smart.description,title:prior.title||smart.title});
   else byKey.set(key,smart);
  }
  pages=[...byKey.values()].filter(p=>p&&p.url&&p.title).map(indexedPage);'''
s = one(s, anchor, replacement, 'search smart route merge')

s = one(s, "history.length?history:['history','Sudoku','DGTE']", "history.length?history:['Trip','MDL×DCC','stories','devices']", 'search quick picks')
s = s.replace("input.placeholder=text('history, Sudoku, DGTE…','history, Sudoku, DGTE…');", "input.placeholder=text('Trip, MDL×DCC, stories, devices…','Trip, MDL×DCC, stories, devices…');")
s = s.replace("Search '+pages.length+' public sitemap pages by title, topic or path.", "Search '+pages.length+' public pages and smart routes by title, topic or path.")
s = s.replace("Išči med '+pages.length+' javnimi stranmi iz sitemap.xml po naslovu, temi ali poti.", "Išči med '+pages.length+' javnimi stranmi in pametnimi potmi po naslovu, temi ali poti.")
write(p, s)

# ---------------------------------------------------------------------------
# 2) Four entrance pages inherit the landing theme before paint.
# ---------------------------------------------------------------------------
THEME_PREF = '''<script id="entry-theme-preference">(function(){try{document.documentElement.dataset.theme=localStorage.getItem('mdlxdcc-theme')==='light'?'light':'dark'}catch(_){document.documentElement.dataset.theme='dark'}})();</script>'''
THEME_SYNC = '''<script id="entry-theme-sync-runtime">(function(){addEventListener('storage',function(e){if(e.key==='mdlxdcc-theme')document.documentElement.dataset.theme=e.newValue==='light'?'light':'dark';});})();</script>'''

ATLAS_LIGHT = r'''<style id="entry-shared-light-theme">
html[data-theme="light"]{color-scheme:light;--bg:#f4f6f3;--bg2:#eef3f6;--panel:#fff;--panel2:#f2f5f8;--line:rgba(54,79,93,.18);--line2:rgba(49,97,146,.30);--text:#172331;--muted:#566678;--dim:#738195;--blue:#2c65a4;--cyan:#17717b;--green:#2c7452;--gold:#956400;--rose:#a33c55;--violet:#6954ad;--orange:#a85b1e;--shadow:0 18px 48px rgba(47,64,78,.12)}
html[data-theme="light"] body{background:radial-gradient(circle at 12% 8%,rgba(44,101,164,.10),transparent 32%),radial-gradient(circle at 86% 18%,rgba(44,116,82,.08),transparent 28%),linear-gradient(180deg,#f7f9f6 0%,#eef3f6 100%);color:var(--text)}
html[data-theme="light"] .topbar{background:rgba(248,250,247,.90)}
html[data-theme="light"] :is(.tool-card,.quick-card,.link-item a,.chapter,.map-panel,.crp-card,.flag-card,.maturity-item,.path-card,.structured details,.stewardship-note){background:#fff;color:var(--text)}
html[data-theme="light"] .flag-card{background:linear-gradient(180deg,#fff,#f5f7fa)}
html[data-theme="light"] :is(h1 .white,.tool-card strong,.quick-card b,.chapter summary strong,.subgroup summary,.link-title,.map-panel summary,.flag-card strong,.maturity-item b,.path-card b,.stewardship-line,.stewardship-body strong){color:var(--text)}
html[data-theme="light"] :is(.topnav a,.badge,.mind-node){background:rgba(255,255,255,.72)}
</style>'''

TODO_LIGHT = r'''<style id="entry-shared-light-theme">
html[data-theme="light"]{color-scheme:light;--bg:#f4f6f3;--bg2:#eef3f6;--panel:#fff;--panel2:#f2f5f8;--line:rgba(54,79,93,.18);--line2:rgba(49,97,146,.30);--text:#172331;--muted:#566678;--dim:#738195;--blue:#2c65a4;--cyan:#17717b;--green:#2c7452;--gold:#956400;--rose:#a33c55;--violet:#6954ad;--orange:#a85b1e;--shadow:0 18px 48px rgba(47,64,78,.12)}
html[data-theme="light"] body{background:radial-gradient(circle at 12% 8%,rgba(44,101,164,.10),transparent 32%),radial-gradient(circle at 86% 18%,rgba(44,116,82,.08),transparent 28%),linear-gradient(180deg,#f7f9f6 0%,#eef3f6 100%);color:var(--text)}
html[data-theme="light"] .topbar{background:rgba(248,250,247,.90)}
html[data-theme="light"] :is(.card,.news,.task,.plan-toolbar,.step,.link-card,.details,.reader-tools,.priority-shell,.control-shell,.arena-card,.status-card,.project-card,.metric-card,.run-card,.evidence-card,.control-card){background:#fff;color:var(--text)}
html[data-theme="light"] :is(.hero h1 .white,.card h3,.news b,.plan-toolbar b,.step b,.link-card b,.details summary,.reader-tools button,.priority-intro h2,.priority-card h3,.task label){color:var(--text)}
html[data-theme="light"] :is(.topnav a,.button.ghost,.plan-toolbar button,.plan-toolbar a,.reader-tools button){background:rgba(255,255,255,.78);color:var(--text)}
html[data-theme="light"] .notes{background:#fff;color:var(--text)}
html[data-theme="light"] .toast{background:#fff;color:var(--text)}
</style>'''

INTRO_LIGHT = r'''<style id="entry-shared-light-theme">
html[data-theme="light"]{color-scheme:light;--bg:#f5f7f6;--bg2:#fff;--bg3:#edf2f4;--surface:#fff;--border:rgba(21,88,100,.16);--cyan:#08717c;--cyan-dim:rgba(8,113,124,.10);--gold:#9a6600;--gold-dim:rgba(154,102,0,.10);--rose:#a43b56;--rose-dim:rgba(164,59,86,.09);--green:#287451;--green-dim:rgba(40,116,81,.09);--violet:#6d54ad;--violet-dim:rgba(109,84,173,.09);--orange:#a65a1f;--orange-dim:rgba(166,90,31,.09);--text:#172331;--muted:#5a6b7d;--subtle:#d8e1e8}
html[data-theme="light"] body{background:var(--bg);color:var(--text)}
html[data-theme="light"] .hero-bg{background:radial-gradient(ellipse 70% 55% at 65% 35%,rgba(8,113,124,.08) 0%,transparent 60%),radial-gradient(ellipse 50% 65% at 15% 75%,rgba(109,84,173,.06) 0%,transparent 55%),radial-gradient(ellipse 40% 40% at 85% 80%,rgba(154,102,0,.05) 0%,transparent 50%)}
html[data-theme="light"] .hero-grid{opacity:.30}
html[data-theme="light"] :is(.card,.project-card,.tool-card,.story-card,.panel,.feature-card){background:var(--surface);color:var(--text);box-shadow:0 16px 42px rgba(45,62,76,.10)}
</style>'''

for rel, extra in [
    ('public/index-atlas.html', ATLAS_LIGHT),
    ('public/index-todo.html', TODO_LIGHT),
    ('public/index-intro.html', INTRO_LIGHT),
    ('public/index-search.html', ''),
]:
    q = Path(rel)
    t = read(q)
    if 'id="entry-theme-preference"' not in t:
        pos = t.find('<style')
        if pos < 0:
            raise SystemExit(f'{rel}: first style missing')
        t = t[:pos] + THEME_PREF + '\n' + t[pos:]
    if extra:
        t = add_before_head_end(t, extra, 'id="entry-shared-light-theme"', rel+' light style')
    t = add_before_body_end(t, THEME_SYNC, 'id="entry-theme-sync-runtime"', rel+' theme sync')
    write(q, t)

# ---------------------------------------------------------------------------
# Static acceptance checks.
# ---------------------------------------------------------------------------
landing = read('public/index.html')
checks = [
    ('.topline,main,footer,.explore-more{max-width:var(--max)' in landing, 'explore width does not match landing'),
    ('/* landing light cards v2 */' in landing, 'landing light-card CSS missing'),
    ("const SITE_BASE=new URL('./',location.href)" in landing, 'base-aware search missing'),
    ('SMART_ROUTES=Object.freeze([' in landing, 'smart routes missing'),
    ("title:'8z Trip Optimizer'" in landing, 'Trip smart route missing'),
    ("title:'Nara / Illuminara Stories'" in landing and "title:'The Birds — story world'" in landing, 'stories smart routes missing'),
    ("title:'Top100I — Inventions'" in landing, 'devices/machines route missing'),
    ("return 'mdl dcc'" in landing, 'MDL/DCC compact synonym missing'),
    ("fetchText('/sitemap.xml')" not in landing and "fetchText('/index-search.html')" not in landing, 'root-only search fetch remains'),
]
for ok, msg in checks:
    if not ok:
        raise SystemExit(msg)
for rel in ['public/index-search.html','public/index-atlas.html','public/index-todo.html','public/index-intro.html']:
    t=read(rel)
    if 'id="entry-theme-preference"' not in t or 'id="entry-theme-sync-runtime"' not in t:
        raise SystemExit(rel+': theme inheritance missing')
for rel in ['public/index-atlas.html','public/index-todo.html','public/index-intro.html']:
    if 'id="entry-shared-light-theme"' not in read(rel):
        raise SystemExit(rel+': light theme CSS missing')

print('LANDING_THEME_SEARCH_PATCH_OK')
