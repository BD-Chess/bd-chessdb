#!/usr/bin/env python3
"""Idempotent, bounded source upgrade 2.3.1 -> 2.4.0; no network or production effects.
Run once before build.py. All anchors are checked before writing; each file is
atomically replaced. Re-running after success is a no-op. Old runtime assets
are never overwritten. This is a UI build recipe, not a research arena.
"""
from pathlib import Path
import os
from refine_magnets_demo import one

HERE = Path(__file__).resolve().parent

def main() -> None:
    path=HERE/'build.py'; s=path.read_text(encoding='utf-8')
    if "VERSION = '2.4.0-petrol'" in s:
        print('2.4 source integration already present'); return
    s=one(s,"VERSION = '2.3.1-petrol'","VERSION = '2.4.0-petrol'")
    s=one(s,"SHARED = '_shared/petrol-2.3.1'","SHARED = '_shared/petrol-2.4.0'")
    s=one(s,"const VERSION='2.3.1-petrol'","const VERSION='2.4.0-petrol'")
    s=one(s,'from pathlib import Path','from pathlib import Path\nfrom refine_magnets_demo import refine_document, refine_controller')
    s=one(s,"outputs[f'{SHARED}/f4m-ui.js']=ui.encode()","outputs[f'{SHARED}/f4m-ui.js']=refine_controller(ui).encode()")
    s=one(s,"outputs[f'{dirname}/index.html']=document(original,channel).encode()","outputs[f'{dirname}/index.html']=refine_document(document(original,channel)).encode()")
    s=one(s,"for name in ('violet.css','shell.js','pwa.js'):","for name in ('violet.css','magnet-rim.css','shell.js','pwa.js'):")
    s=one(s,'<link rel="stylesheet" href="../{SHARED}/violet.css">{scripts}',
          '<link rel="stylesheet" href="../{SHARED}/violet.css"><link rel="stylesheet" href="../{SHARED}/magnet-rim.css">{scripts}')
    css=(HERE/'violet.css').read_text(encoding='utf-8')
    for side,edge in enumerate(('top','right','bottom','left')):
        css=one(css,'body[data-board-size="max"] .mag-slot[data-side="'+str(side)+'"]{'+edge+':-5%!important}\n','')
    pwa=one((HERE/'pwa.js').read_text(encoding='utf-8'),"build:'2.3.1-petrol'","build:'2.4.0-petrol'")
    verify=(HERE/'verify.py').read_text(encoding='utf-8').replace('2.3.1-petrol','2.4.0-petrol')
    # The UI idle flag is not a durable-storage barrier. Do not race Undo's
    # asynchronous writes with reload; verify the saved zero-ply state first.
    verify=one(verify,'app.reload();wait_idle(app);ctx.set_offline(True)',
        "check('APP verified save before cold reload',app.evaluate('F4MLab.saveForUpdate()') in ('indexeddb','localstorage'));app.reload();wait_idle(app);check('APP saved undo restored before outage',state(app)['ply']==0,state(app));ctx.set_offline(True)")
    verify=one(verify,"check('APP offline cold load',state(app)['ply']==0)",
        "check('APP offline cold load',state(app)['ply']==0,state(app))")
    focused=(HERE/'verify_magnets_demo.py').read_text(encoding='utf-8')
    focused=one(focused,'from pathlib import Path','from pathlib import Path\nimport http.client, urllib.error')
    focused=one(focused,"""            network_down.set();blocked=False
            try:
                with urllib.request.urlopen(p.url+'__uncached_probe__',timeout=3) as response:response.read()
            except Exception:blocked=True""", """            probe=p.url+'?origin_probe=1'
            with urllib.request.urlopen(probe,timeout=3) as response:
                check(label+' origin control initially available',response.status==200)
                response.read()
            network_down.set();blocked=False
            try:
                with urllib.request.urlopen(probe,timeout=3) as response:response.read()
            except urllib.error.HTTPError:raise
            except (http.client.RemoteDisconnected,urllib.error.URLError,ConnectionError,OSError):blocked=True""")
    readme=(HERE/'README.md').read_text(encoding='utf-8')
    readme=one(readme,'Version 2.3.1-petrol','Version 2.4.0-petrol')
    readme=readme.replace('one shared engine in `_shared/petrol-2.3.1/`','one shared engine in `_shared/petrol-2.4.0/`')
    readme+='\n## 2.4.0 — compact magnets and AI vs AI\n\nBoard/phone geometry and the approved Petrol design are retained. Rim visuals are compact 12px-thick markers, separate from transparent 24px-deep hit targets; lane positions follow matrix insets. Empty slots are subdued outside Magnet mode, owned magnets show color and remaining turns.\n\nNew game → Opponent includes AI vs AI as a normal single game (not a Sim batch). Both side policies can be selected as Classical AI or AI + DCC; existing strength, clocks, pause, history, Undo, export/import and save/resume paths are reused. Red starts; human-only controls are hidden. No automated tournaments or external AI API calls are added.\n\n`refine_magnets_demo.py` performs checked pure UI transformations inside the canonical builder. `prepare_2_4.py` is the idempotent source upgrade recipe; `verify_magnets_demo.py` provides focused geometry and lifecycle acceptance. Evidence of execution is in the release receipt, not inferred from this source description.\n'
    outputs={'violet.css':css,'pwa.js':pwa,'verify.py':verify,'verify_magnets_demo.py':focused,'README.md':readme,'build.py':s}
    # build.py is the final checkpoint marker: incomplete upgrades fail closed.
    for name,text in outputs.items():
        dest=HERE/name;tmp=HERE/(name+'.upgrade-tmp')
        with tmp.open('w',encoding='utf-8',newline='') as f:
            f.write(text);f.flush();os.fsync(f.fileno())
        tmp.replace(dest)
    print('Integrated 2.4 UI sources; CURRENT/PREVIOUS and earlier assets untouched')

if __name__=='__main__': main()
