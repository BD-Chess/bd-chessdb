/* Presentation-only help and Appearance shortcuts. Preferences retain their
 * existing controls/stores; these actions never call an analysis controller. */
(function(root){
  'use strict';const doc=root.document,byId=id=>doc.getElementById(id);
  function start(){
    const dialog=doc.createElement('dialog');dialog.id='analysisHelp';dialog.className='analysis-help-dialog';dialog.setAttribute('aria-labelledby','analysisHelpTitle');
    dialog.innerHTML='<header><h2 id="analysisHelpTitle">Analysis help</h2><button type="button" data-close-analysis-help aria-label="Close analysis help">×</button></header><dl>'+[
      ['CPU per engine','CPU applies to each engine. SF Full uses the effective count shown; Lite, Reckless, LC0 and Berserk keep their supported limits.'],
      ['All engines','All runs the four families concurrently, each with its full selected budget. Stop all stops interactive analysis, not games, Sim or replay.'],
      ['Each move','Off by default. Enable Cards/All or Deep explicitly. Stop disables follow; Analyze starts a new search. Only one follow owner is armed.'],
      ['Link and display','Link selects the source shown on the board. Displaying ChessDB does not mean a local Deep search has stopped. A Deep card Stop stops its whole Deep group.'],
      ['Time and depth','Time is a search limit for each engine, excluding loading. With Time Off, depth applies where supported. Elapsed search time is measured separately.'],
      ['Partial results','A stopped or failed search may retain valid earlier lines. Partial coverage is not a complete comparable set. Each engine keeps its own typed score.'],
      ['Restricted roots','Enter legal SAN or coordinate first moves, separated by commas. Empty means all first moves. Disabled controls mean that the selected engine mode does not support this restriction.']
    ].map(([title,text])=>'<dt>'+title+'</dt><dd>'+text+'</dd>').join('')+'</dl>';
    (doc.querySelector('.app-preview-screen')||doc.body).append(dialog);
    let returnFocus=null;
    const close=()=>dialog.close();dialog.querySelector('[data-close-analysis-help]').onclick=close;
    dialog.addEventListener('close',()=>{if(returnFocus?.isConnected&&returnFocus.getClientRects().length)returnFocus.focus({preventScroll:true});});
    doc.addEventListener('click',event=>{
      const help=event.target.closest('[data-analysis-help]');
      if(help){returnFocus=help;dialog.showModal();dialog.querySelector('[data-close-analysis-help]').focus({preventScroll:true});return;}
      if(event.target.closest('[data-open-appearance]')){
        byId('btnSettings').click();byId('appearanceSettings').open=true;
        root.requestAnimationFrame(()=>root.requestAnimationFrame(()=>byId('settingFont').focus({preventScroll:true})));
      }
    });
    const heading=byId('settingsPanel')?.querySelector('.drawer-heading');
    if(heading){const help=doc.createElement('button');help.type='button';help.className='analysis-help-action';help.dataset.analysisHelp='';help.textContent='?';help.setAttribute('aria-label','Analysis help');help.setAttribute('aria-controls','analysisHelp');heading.insertBefore(help,byId('btnCloseSettings'));}
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
