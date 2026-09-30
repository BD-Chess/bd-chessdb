#!/usr/bin/env python3
"""Flip4M 2.4.0 scoped presentation/setup refinement, authored for BD.

The build imports refine_ui/refine_document on every rebuild. Running this file
once upgrades the hash-pinned 2.3.1 build templates; repeating it is a no-op.
Physics, search, clocks, storage identity, Sim and preview layout are retained.
"""
from __future__ import annotations
import hashlib
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
VERSION = '2.4.0-petrol'
SHARED = '_shared/petrol-2.4.0'


def one(text: str, before: str, after: str) -> str:
    if text.count(before) != 1:
        raise ValueError('Source anchor drift: ' + repr(before[:100]))
    return text.replace(before, after, 1)


def refine_document(html: str) -> str:
    pattern = r'(<select id="mode">)(.*?)(</select></label>)'
    matches = list(re.finditer(pattern, html))
    if len(matches) != 1 or 'value="demo"' in matches[0].group(2):
        raise ValueError('Unexpected Opponent selector')
    engines = '<option value="classical">Classical AI</option><option value="dcc">AI + DCC</option>'
    setup = ('\n    <div id="demoOptions" class="two-fields" hidden>'
             '<label><span data-i18n="redEngine">Rdeči motor</span><select id="demoRed">' + engines + '</select></label>'
             '<label><span data-i18n="yellowEngine">Rumeni motor</span><select id="demoYellow">' + engines + '</select></label></div>')
    return re.sub(pattern, lambda m: m.group(1) + m.group(2) +
                  '<option value="demo" data-i18n="demo">AI vs AI</option>' + m.group(3) + setup, html, count=1)


def refine_ui(ui: str) -> str:
    ui = one(ui, "demo:'AI proti AI'", "demo:'AI vs AI'")
    ui = one(ui, "cpuEngine:'classical',showTimers:", "cpuEngine:'classical',demoRed:'classical',demoYellow:'dcc',showTimers:")
    ui = one(ui, "'first','cpuEngine','timeControl','guard'", "'first','cpuEngine','demoRed','demoYellow','timeControl','guard'")
    ui = one(ui, "$('customTime').hidden=prefs.timeControl!=='custom';",
             "$('customTime').hidden=prefs.timeControl!=='custom';\n "
             "$('demoOptions').hidden=prefs.mode!=='demo';"
             "$('cpuEngine').closest('label').hidden=prefs.mode!=='cpu';"
             "$('first').closest('.two-fields').hidden=prefs.mode!=='cpu';")
    ui = one(ui, "engine:prefs.cpuEngine};states=[E.create(game.tools)]",
             "engine:prefs.cpuEngine,...(prefs.mode==='demo'?{policies:{1:prefs.demoRed,2:prefs.demoYellow}}:{})};states=[E.create(game.tools)]")
    ui = one(ui, "$('instruction').textContent=inSimulation?t('watch')", "$('instruction').textContent=(inSimulation||game.mode==='demo')?t('watch')")
    old = """ const b=document.createElement('button');b.className='mag-slot';b.dataset.side=side;b.dataset.idx=idx;b.append(document.createElement('span'));
 const along=1.25+idx*12.5;
 if(side===0||side===2){b.style.left=along+'%';b.style[side===0?'top':'bottom']='-9%';}
 else{b.style.top=along+'%';b.style[side===1?'right':'left']='-9%';b.style.width='7%';b.style.height='10%';}"""
    new = """ const b=document.createElement('button');b.type='button';b.className='mag-slot';b.dataset.side=side;b.dataset.idx=idx;
 const cap=document.createElement('span'),life=document.createElement('span');cap.className='mag-cap';life.className='mag-life';cap.setAttribute('aria-hidden','true');cap.append(life);b.append(cap);
 // Centers follow the actual cell matrix, not the outer board frame.
 b.style.setProperty('--lane',((idx+.5)*12.5)+'%');"""
    ui = one(ui, old, new)
    ui = one(ui, "b.firstChild.textContent=m?m.life:'·';", "b.querySelector('.mag-life').textContent=m?m.life:'';")
    return ui


RIM_CSS = r'''
/* COMPACT_RIM_240: a slim visible cap, separate larger transparent tap target.
   Board/matrix dimensions remain unchanged in Standard, Large and Max.
   Matrix inset includes the one-pixel board-frame border. */
#rim{--rim-inset:10px;--rim-offset:7px;position:absolute;inset:var(--rim-inset);pointer-events:none;z-index:2}
#rim .mag-slot{position:absolute;left:auto;right:auto;top:auto;bottom:auto;width:calc(12.5% - 2px);height:32px;min-width:0;min-height:0;padding:0;margin:0;border:0;border-radius:0;background:transparent;box-shadow:none;outline:none;opacity:1;display:block;transform:translate(-50%,-50%);transition:none;pointer-events:none}
#rim .mag-slot:not(:disabled){pointer-events:auto}
#rim .mag-slot[data-side="0"]{left:var(--lane);top:calc(0px - var(--rim-inset) - var(--rim-offset))}
#rim .mag-slot[data-side="2"]{left:var(--lane);top:calc(100% + var(--rim-inset) + var(--rim-offset))}
#rim .mag-slot[data-side="1"]{left:calc(100% + var(--rim-inset) + var(--rim-offset));top:var(--lane);width:32px;height:calc(12.5% - 2px)}
#rim .mag-slot[data-side="3"]{left:calc(0px - var(--rim-inset) - var(--rim-offset));top:var(--lane);width:32px;height:calc(12.5% - 2px)}
#rim .mag-slot .mag-cap{position:absolute;left:50%;top:50%;width:clamp(16px,72%,30px);height:12px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);border:1px solid var(--line);border-radius:4px;background:var(--raised);color:var(--muted);opacity:.18;pointer-events:none;transition:opacity .15s,border-color .15s,background .15s}
#rim .mag-slot[data-side="1"] .mag-cap,#rim .mag-slot[data-side="3"] .mag-cap{width:12px;height:clamp(16px,72%,30px)}
#rim .mag-slot .mag-life{display:block;transform:rotate(calc(-1 * var(--angle)));font:800 9px/1 system-ui,sans-serif;pointer-events:none}
.magnet-mode #rim .mag-slot.empty:not(:disabled) .mag-cap{opacity:1;border-color:var(--mint);color:var(--mint)}
#rim .mag-slot.owned1 .mag-cap{opacity:1;background:var(--red);border-color:var(--red);color:#101820}
#rim .mag-slot.owned2 .mag-cap{opacity:1;background:var(--yellow);border-color:var(--yellow);color:#101820}
#rim .mag-slot.expiring .mag-cap{box-shadow:0 0 0 1px var(--text)}
#rim .mag-slot:focus-visible .mag-cap,#rim .mag-slot.hint-flash .mag-cap{opacity:1;outline:2px solid var(--mint);outline-offset:1px}
#rim .mag-slot:hover:not(:disabled) .mag-cap{opacity:1;border-color:var(--text);box-shadow:0 0 0 1px var(--mint)}
@media(max-width:680px){#rim{--rim-inset:8px}}
'''


def install() -> None:
    """Upgrade only known source templates; fail before writes on source drift."""
    path = HERE / 'build.py'
    raw = path.read_bytes()
    text = raw.decode('utf-8')
    if "VERSION = '2.4.0-petrol'" in text:
        if 'from upgrade_240 import refine_ui, refine_document' not in text:
            raise ValueError('Incomplete 2.4.0 template installation')
        print('2.4.0 templates already installed')
        return
    digest = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    if digest != 'e77f8d02675d7b3a43a87060db36d24b188945e0':
        raise ValueError('Build template drift: ' + digest)
    text = one(text, "VERSION = '2.3.1-petrol'", "VERSION = '2.4.0-petrol'")
    text = one(text, "SHARED = '_shared/petrol-2.3.1'", "SHARED = '_shared/petrol-2.4.0'")
    text = one(text, "const VERSION='2.3.1-petrol'", "const VERSION='2.4.0-petrol'")
    text = one(text, 'from pathlib import Path\n', 'from pathlib import Path\nfrom upgrade_240 import refine_ui, refine_document\n')
    text = one(text, '    outputs={}\n', '    ui=refine_ui(ui)\n    outputs={}\n')
    text = one(text, '=document(original,channel).encode()', '=refine_document(document(original,channel)).encode()')
    css = (HERE/'violet.css').read_text()
    # Remove the superseded 2.3 Max offsets; all sizes now share matrix-aligned caps.
    css,n = re.subn(r'body\[data-board-size="max"\] \.mag-slot\[data-side="[0-3]"\]\{(?:top|right|bottom|left):-5%!important\}\n', '', css)
    if n != 4 or 'COMPACT_RIM_240' in css:
        raise ValueError('Unexpected old rim CSS')
    css = css.replace('Flip4M Petrol 2.3.1', 'Flip4M Petrol 2.4.0', 1) + RIM_CSS
    pwa = one((HERE/'pwa.js').read_text(), "build:'2.3.1-petrol'", "build:'2.4.0-petrol'")
    tests = (HERE/'verify.py').read_text().replace('2.3.1-petrol', VERSION)
    readme = (HERE/'README.md').read_text().replace('Version 2.3.1-petrol', 'Version 2.4.0-petrol').replace('_shared/petrol-2.3.1/', '_shared/petrol-2.4.0/')
    readme += '\n## 2.4.0 compact rim and AI vs AI\n\nVisible magnetic caps stay outside the board; larger transparent tap targets are enabled only for legal magnetic placement. Owner color and remaining lifetime stay readable after rotation. The existing demo policy now appears under New game / Opponent with separate Red/Yellow Classical or DCC choices. Uses the existing single scheduler, stop/pause, journal and save validation. Run `python scripts/flip4m_violet/verify_240.py` for targeted geometry and demo tests; it writes bounded evidence after each check.\n'
    # All anchors resolved before writing. Each file replacement is atomic.
    for name,data in {'build.py':text,'violet.css':css,'pwa.js':pwa,'verify.py':tests,'README.md':readme}.items():
        target = HERE/name
        tmp = target.with_suffix(target.suffix+'.tmp')
        tmp.write_text(data, encoding='utf-8')
        tmp.replace(target)
    print('Installed 2.4.0 templates; run build.py to materialize isolated channels.')


if __name__ == '__main__':
    install()
