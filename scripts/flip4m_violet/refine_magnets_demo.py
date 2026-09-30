"""Build-time UI refinements for Flip4M 2.4.0 (BD design; GPT implementation).

Pure, anchored transformations of the retained 2.1 controller and generated
channel document. Physics, search, Sim and storage code are not modified.
"""
from __future__ import annotations


def one(text: str, old: str, new: str) -> str:
    count = text.count(old)
    if count != 1:
        raise ValueError(f'UI source drift: {count} matches for {old[:100]!r}')
    return text.replace(old, new, 1)


def refine_document(html: str) -> str:
    html = one(html, '<option value="pvp" data-i18n="pvp">Dva igralca</option>',
               '<option value="pvp" data-i18n="pvp">Dva igralca</option><option value="demo" data-i18n="demo">AI vs AI</option>')
    duel = '''<div id="duelPolicies" class="two-fields" hidden>
      <label><span data-i18n="redEngine">Rdeči motor</span><select id="demoRed"><option value="classical">Classical AI</option><option value="dcc">AI + DCC</option></select></label>
      <label><span data-i18n="yellowEngine">Rumeni motor</span><select id="demoYellow"><option value="classical">Classical AI</option><option value="dcc" selected>AI + DCC</option></select></label>
    </div>
    '''
    html = one(html, '<label><span data-i18n="engine">', duel + '<label id="cpuEngineField"><span data-i18n="engine">')
    html = one(html, '<div class="two-fields"><label><span data-i18n="first">',
               '<div id="firstField" class="two-fields"><label><span data-i18n="first">')
    return html


def refine_controller(js: str) -> str:
    js = one(js, "demo:'AI proti AI'", "demo:'AI vs AI'")
    js = one(js, "cpuEngine:'classical',showTimers:",
             "cpuEngine:'classical',demoRed:'classical',demoYellow:'dcc',showTimers:")
    js = one(js, "'first','cpuEngine','timeControl'", "'first','cpuEngine','demoRed','demoYellow','timeControl'")
    js = one(js, 'function preferences(){', '''function setupVisibility(){
 $('duelPolicies').hidden=prefs.mode!=='demo';
 $('cpuEngineField').hidden=prefs.mode!=='cpu';
 $('firstField').hidden=prefs.mode!=='cpu';
}
function preferences(){''')
    js = one(js, " try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch(_){}",
             " setupVisibility();\n try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch(_){}")
    js = one(js, 'helpText();render();showStats(lastStats);renderBatch();}',
             'helpText();setupVisibility();render();showStats(lastStats);renderBatch();}')
    js = one(js, "engine:prefs.cpuEngine};states=[E.create(game.tools)];",
             "engine:prefs.cpuEngine,...(prefs.mode==='demo'?{policies:{1:prefs.demoRed,2:prefs.demoYellow}}:{})};states=[E.create(game.tools)];")
    js = one(js, "$('instruction').textContent=inSimulation?t('watch'):",
             "$('instruction').textContent=(inSimulation||game.mode==='demo')?t('watch'):")
    js = one(js, """ const b=document.createElement('button');b.className='mag-slot';b.dataset.side=side;b.dataset.idx=idx;b.append(document.createElement('span'));
 const along=1.25+idx*12.5;
 if(side===0||side===2){b.style.left=along+'%';b.style[side===0?'top':'bottom']='-9%';}
 else{b.style.top=along+'%';b.style[side===1?'right':'left']='-9%';b.style.width='7%';b.style.height='10%';}""", """ const b=document.createElement('button');b.type='button';b.className='mag-slot';b.dataset.side=side;b.dataset.idx=idx;
 b.style.setProperty('--lane',String((idx+.5)/8));
 const marker=document.createElement('span'),life=document.createElement('span');
 marker.className='mag-marker';life.className='mag-life';marker.setAttribute('aria-hidden','true');marker.append(life);b.append(marker);""")
    js = one(js, "b.firstChild.textContent=m?m.life:'·';", "b.querySelector('.mag-life').textContent=m?String(m.life):'';")
    return js
