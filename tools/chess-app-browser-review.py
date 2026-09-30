#!/usr/bin/env python3
"""Bounded Chromium review. Synthetic legal CDB fixtures; real board, UI and SF.
No credentials, external account actions, or deployment effects.
"""
import argparse, functools, http.server, json, os, threading
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',default='review-evidence');ap.add_argument('--layout-only',action='store_true');ap.add_argument('--live',default='');args=ap.parse_args()
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'public')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=args.live.rstrip('/')+'/' if args.live else f'http://127.0.0.1:{server.server_port}/chess/app/'
    report={'base':base,'tested_sha':os.environ.get('TESTED_SHA'),'fixture':'synthetic legal CDB; real local Stockfish, UI and CSS','checks':[],'errors':[],'metrics':[]}
    def record(name,ok,detail=None): report['checks'].append({'name':name,'pass':bool(ok),'detail':detail})
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or None)
        def setup(viewport,ua=None,mobile=False):
            ctx=browser.new_context(viewport=viewport,user_agent=ua,is_mobile=mobile,has_touch=mobile,locale='en-US',service_workers='block')
            ctx.on('page',lambda page:page.on('pageerror',lambda e:report['errors'].append(str(e))))
            def cdb(route):
                params=parse_qs(urlparse(route.request.url).query);fen=params.get('board',[''])[0];action=params.get('action',[''])[0]
                try:
                    text=route.request.frame.evaluate('''({fen,action}) => {
                      const game=new Chess(fen);
                      const bits=fen.split(' '), ply=(Number(bits[5])-1)*2+(bits[1]==='b'?1:0);
                      const score=(25-80*ply)*(bits[1]==='b'?-1:1);
                      if(action==='queryall')return game.moves({verbose:true}).slice(0,5).map((m,i)=>`move:${m.from}${m.to}${m.promotion||''},score:${score-i},rank:1,note:*`).join('|');
                      if(action==='querypv'){const pv=[];for(let i=0;i<8;i++){const m=game.moves({verbose:true})[0];if(!m)break;pv.push(m.from+m.to+(m.promotion||''));game.move(m);}return 'score:30,depth:20,pv:'+pv.join('|');}
                      return 'eval:30';
                    }''',{'fen':fen,'action':action})
                    route.fulfill(status=200,content_type='text/plain',headers={'Access-Control-Allow-Origin':'*'},body=text)
                except Exception: route.fulfill(status=200,content_type='text/plain',headers={'Access-Control-Allow-Origin':'*'},body='unknown')
            ctx.route('**/cdb.php?*',cdb)
            return ctx
        def ready(page):
            page.goto(base,wait_until='load',timeout=25000)
            page.frame_locator('iframe').locator('body').wait_for(timeout=10000)
            inner=page.frames[1]
            inner.wait_for_function("!!window.ChessLabHost && document.querySelector('#appTopLine')?.parentElement.id === 'appBoardControls'",timeout=12000)
            inner.wait_for_function('!!ChessLabHost.getContext().analysisSources.CDB',timeout=10000)
            page.wait_for_timeout(300)
            return inner
        def metrics(frame,case,fit=True):
            m=frame.evaluate('''() => {
              const status=document.getElementById('analysisSourceStatus'),top=document.getElementById('appTopLine'),tabs=document.getElementById('appTabs'),board=document.getElementById('board'),controls=document.getElementById('appBoardControls');
              const sr=status.getBoundingClientRect(),br=board.getBoundingClientRect(),nr=tabs.getBoundingClientRect(),cr=controls.getBoundingClientRect();
              return {statusHeight:sr.height,statusFlex:getComputedStyle(status).flex,topHidden:top.hidden,controlsBottom:cr.bottom,tabTop:nr.top,boardWidth:br.width,boardHeight:br.height,viewportHeight:innerHeight,scrollHeight:document.documentElement.scrollHeight,squares:document.querySelectorAll('#board .square-55d63').length,overflowX:document.documentElement.scrollWidth>innerWidth+1};
            }''');m['case']=case;report['metrics'].append(m)
            record(case+' content-height status',m['statusHeight']<48,m)
            record(case+' Top Line default hidden',m['topHidden'],m)
            record(case+' full square board',m['squares']==64 and abs(m['boardWidth']-m['boardHeight'])<5,m)
            record(case+' no horizontal overflow',not m['overflowX'])
            if fit: record(case+' controls above tabs',m['controlsBottom']<=m['tabTop']-3,m)
            frame.evaluate("window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");frame.wait_for_timeout(100)
            record(case+' bottom content reachable',frame.evaluate("document.getElementById('appBoardControls').getBoundingClientRect().bottom <= document.getElementById('appTabs').getBoundingClientRect().top-3"))
            frame.evaluate('window.scrollTo(0,0)')
        try:
            ctx=setup({'width':1920,'height':1080});page=ctx.new_page();inner=ready(page)
            record('preview default iPhone 16 Pro 402',page.locator('#previewWidth').input_value()=='402')
            record('preview width in header',page.locator('header #previewWidth').count()==1)
            record('no without-frame action',page.get_by_text('Open without frame',exact=False).count()==0)
            record('desktop frame',not page.locator('html').evaluate("el=>el.classList.contains('app-phone-browser')"))
            # Approved iPhone 16 Pro portrait preview, independent of desktop height.
            device=inner.evaluate("""() => ({width:innerWidth,height:innerHeight,top:getComputedStyle(document.body).paddingTop,bottom:getComputedStyle(document.getElementById('appTabs')).paddingBottom,device:document.documentElement.dataset.previewDevice})""")
            record('iPhone 16 Pro viewport and safe areas',device['width']==402 and device['height']==874 and device['top']=='62px' and device['bottom']=='34px' and device['device']=='iphone-16-pro',device)
            gap=inner.evaluate("document.getElementById('appTabs').getBoundingClientRect().top-document.getElementById('board-container').getBoundingClientRect().bottom")
            record('reference bottom gap close to BD phone screenshot',10<=gap<=45,gap)
            for w,h in [(1280,720),(3840,2160),(900,650)]:
                page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
                geometry=inner.evaluate("[innerWidth,innerHeight]")
                bounds=page.locator('.phone-frame').bounding_box()
                record('fixed phone viewport '+str(w),geometry==[402,874],geometry)
                record('whole preview fits '+str(w),bounds['x']>=-1 and bounds['y']>=0 and bounds['x']+bounds['width']<=w+1 and bounds['y']+bounds['height']<=h+1,bounds)
            page.set_viewport_size({'width':1920,'height':1080});page.wait_for_timeout(100)
            page.locator('.phone-frame').screenshot(path=str(out/'iphone-16-pro-402.png'))
            # Inventory of real static and dynamically constructed close actions.
            close_selector='.dialog-close,#btnCloseGames,#btnCloseSettings,#btnCoachClose,#geminiClose,#gameReviewPanel .game-review-heading > button,#deepAnalysisPanel [data-deep="close"],#simTournamentDialog [data-action="close"],.chess-study-close,.research-close'
            for language in ['en','sl']:
                inner.locator('[data-app-lang="'+language+'"]').click()
                for light in [False,True]:
                    inner.evaluate('(light)=>document.body.classList.toggle("light-theme",light)',light)
                    close_styles=inner.locator(close_selector).evaluate_all("els=>els.map(e=>({id:e.id||e.getAttribute('data-deep')||e.getAttribute('data-action')||e.className,bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}))")
                    record('burgundy close controls '+language+str(light),len(close_styles)>=10 and all(x['bg']=='rgb(111, 38, 59)' and x['color']=='rgb(255, 244, 246)' for x in close_styles),close_styles)
                    record('navigation not burgundy '+language+str(light),inner.locator('#appNew').evaluate("e=>getComputedStyle(e).backgroundColor")!='rgb(111, 38, 59)')
            inner.evaluate('document.body.classList.remove("light-theme")')
            inner.locator('[data-app-lang="en"]').click()
            inner.locator('#appGames').click()
            inner.locator('#btnCloseGames').click()
            record('library X still closes',not inner.locator('#popularGamesPanel').evaluate('e=>e.classList.contains("open")'))
            inner.locator('#appTabs [data-app-tab="board"]').click()
            top_default=inner.evaluate("""() => ({hidden:document.getElementById('appTopLine').hidden,checked:document.getElementById('settingAppTopLine').checked,saved:localStorage.getItem('ChessBest:APP:v1:showTopLine')})""")
            record('Top Line default off',top_default['hidden'] and not top_default['checked'] and top_default['saved'] is None,top_default)
            inner.evaluate("document.getElementById('settingAppTopLine').click()")
            top_style=inner.evaluate("""() => {
              const top=document.getElementById('appTopLine'),label=document.getElementById('appTopLineLabel'),moves=document.getElementById('appTopLineMoves');
              const ts=getComputedStyle(top), ms=getComputedStyle(moves);
              return {direction:ts.flexDirection,label:label.textContent,whiteSpace:ms.whiteSpace,overflow:ms.overflow,textOverflow:ms.textOverflow};
            }""")
            record('compact one-line Top',top_style['direction']=='row' and top_style['whiteSpace']=='nowrap' and top_style['overflow']=='hidden' and top_style['textOverflow']=='ellipsis',top_style)
            record('Top Line preference persisted on',inner.evaluate("localStorage.getItem('ChessBest:APP:v1:showTopLine')")=='1')
            inner.evaluate("document.getElementById('settingAppTopLine').click()")
            record('Top Line hides again',inner.evaluate("document.getElementById('appTopLine').hidden && localStorage.getItem('ChessBest:APP:v1:showTopLine')==='0'"))
            separators=inner.evaluate("""() => [...document.querySelectorAll('#appTabs button')].slice(1).map(b=>{
              const s=getComputedStyle(b,'::before'); return {content:s.content,width:s.width,opacity:s.opacity,height:s.height};
            })""")
            record('subtle bottom-tab separators',len(separators)==4 and all(x['content']!='none' and float(x['width'].replace('px','') or 0)>=1 and 0<float(x['opacity'])<0.7 for x in separators),separators)
            for width in [375,390,402,430]:
                page.locator('#previewWidth').select_option(str(width));page.wait_for_timeout(200)
                metrics(inner,'desktop-'+str(width))
                if width==390: page.locator('.phone-frame').screenshot(path=str(out/'phone-390.png'))
            page.set_viewport_size({'width':1280,'height':720});page.wait_for_timeout(200);metrics(inner,'HD-short',False)
            if not args.layout_only:
                page.set_viewport_size({'width':1920,'height':1080});page.locator('#previewWidth').select_option('390');page.wait_for_timeout(150)
                for i,lang in enumerate(['sl','en','sl','en']):
                    inner.locator(f'[data-app-lang="{lang}"]').click();page.wait_for_timeout(150)
                    label=inner.locator('#appTabs [data-app-tab="board"]').inner_text()
                    record(f'language {lang} roundtrip {i}',('Šahovnica' if lang=='sl' else 'Board') in label)
                    record(f'Sim label {lang} {i}',inner.locator('#appSim').inner_text()=='Sim / Play')
                origin=inner.evaluate('ChessLabHost.getContext().fen');inner.locator('#next').click();page.wait_for_timeout(300)
                record('next plays measured move',inner.evaluate('ChessLabHost.getContext().fen')!=origin)
                inner.locator('#prev').click();page.wait_for_timeout(300);record('previous restores position',inner.evaluate('ChessLabHost.getContext().fen')==origin)
                for view in ['moves','review','deep','dcc','board']:
                    inner.locator(f'#appTabs [data-app-tab="{view}"]').click();page.wait_for_timeout(150)
                    record('tab '+view,inner.locator('body').get_attribute('data-app-view')==view)
                record('view switching keeps position',inner.evaluate('ChessLabHost.getContext().fen')==origin)
                inner.locator('#appTabs [data-app-tab="deep"]').click()
                depths=inner.locator('[data-deep="budget"] option').evaluate_all('(opts)=>opts.map(o=>o.value)')
                record('Deep depth-only presets',depths==[f'depth:{d}' for d in [14,18,22,26,30,34,38,42]],depths)
                inner.locator('#appTabs [data-app-tab="board"]').click()
                inner.wait_for_function('!!ChessLabHost.getContext().analysisSources.SF',timeout=15000)
                sf=inner.evaluate('ChessLabHost.getContext().analysisSources.SF.receipt');record('real local SF completes',sf.get('status')=='ready',sf)
                coords=inner.evaluate('''() => [...document.querySelectorAll('#board .notation-322f9')].map(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return {text:el.textContent,inside:a.left>=b.left&&a.top>=b.top&&a.right<=b.right&&a.bottom<=b.bottom};})''')
                record('16 coordinates inside squares',len(coords)==16 and all(x['inside'] for x in coords),coords)
                inner.locator('#appSim').click()
                inner.locator('#simTournamentDialog [data-ui="white"]').select_option('sf')
                inner.locator('#simTournamentDialog [data-ui="black"]').select_option('raw')
                inner.locator('#simTournamentDialog [data-ui="depth"]').fill('5')
                inner.locator('#simTournamentDialog [data-ui="move-pause"]').select_option('400')
                inner.evaluate("""() => {
                  window.simEvalSamples=[];
                  const bar=document.getElementById('positionEval');
                  window.simEvalObserver=new MutationObserver(()=>{
                    if(document.getElementById('appActivity').hidden || bar.dataset.evalState!=='known' || bar.dataset.evalSource!=='CDB')return;
                    const fen=ChessLabHost.getContext().fen;
                    if(bar.dataset.evalFen!==fen || bar.dataset.positionFen!==fen)return;
                    if(!simEvalSamples.some(s=>s.fen===fen))simEvalSamples.push({fen,label:document.getElementById('positionEvalLabel').textContent});
                  });
                  simEvalObserver.observe(bar,{subtree:true,attributes:true,childList:true,characterData:true});
                }""")
                inner.locator('#simTournamentDialog [data-ui="start"]').click()
                inner.wait_for_function('simEvalSamples.length>=6',timeout=20000)
                inner.locator('#appPause').click();page.wait_for_timeout(200)
                samples=inner.evaluate('simEvalSamples');inner.evaluate('simEvalObserver.disconnect()')
                def expected_sample(row):
                    bits=row['fen'].split();ply=(int(bits[5])-1)*2+(1 if bits[1]=='b' else 0);cp=25-80*ply
                    return row['label']==('+' if cp>0 else '')+format(cp/100,'.2f')
                record('real SF5 vs CDB/SF spectator follows both colors',len(samples)>=6 and {s['fen'].split()[1] for s in samples}=={'w','b'} and all(expected_sample(s) for s in samples),samples)
                record('spectator numeric evaluations change with positions',len({s['label'] for s in samples})>=6)
                page.locator('.phone-frame').screenshot(path=str(out/'sim-evaluation.png'))
            ctx.close()
            if not args.layout_only:
                for name,ua,mobile,vp in [
                  ('phone','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',True,{'width':390,'height':844}),
                  ('tablet','Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',True,{'width':820,'height':1180})]:
                    ctx=setup(vp,ua,mobile);page=ctx.new_page();inner=ready(page)
                    full=page.locator('html').evaluate("el=>el.classList.contains('app-phone-browser')");record(name+' frame rule',full==(name=='phone'))
                    if name=='phone': metrics(inner,'phone-390');page.screenshot(path=str(out/'mobile-390.png'))
                    ctx.close()
        except Exception as error:
            record('review completed',False,str(error))
            try: page.screenshot(path=str(out/'failure.png'),timeout=3000)
            except Exception: pass
        finally: browser.close();server.shutdown()
    record('no browser JS errors',not report['errors'],report['errors'])
    report['passed']=sum(c['pass'] for c in report['checks']);report['total']=len(report['checks'])
    (out/'browser-review.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(report,indent=2,ensure_ascii=False))
    return 0 if report['passed']==report['total'] else 1
if __name__=='__main__': raise SystemExit(main())
