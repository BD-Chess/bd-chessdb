'use strict';
// Display-only composition. The game, history and engine remain in navigator-ui.
(() => {
 const $=id=>document.getElementById(id),status=$('status');
 const summary=document.createElement('p');summary.id='plGameStatus';summary.className='pl-caption';summary.setAttribute('role','status');
 const anchor=document.querySelector('.mobile-input-panel')||$('gridWrap');
 anchor.after(status,summary,$('plNotice'));
 const style=document.createElement('style');
 style.textContent='body:not([data-view=lab]) #status,body:not([data-view=lab]) #plRating,body[data-view=lab] #plGameStatus{display:none!important}#plGameStatus{width:100%;text-align:center;line-height:1.5;min-height:1.5em;margin:12px 0 4px}.col-center>.pl-notice{margin:6px 0 16px;width:100%;justify-content:center}.pl-tabs{margin-bottom:12px}.pl-tabs .btn{width:auto;flex:0 1 auto;font-size:14px;letter-spacing:normal}';
 document.head.append(style);
 function display(raw) {
  if(/original givens|givens.*AI steps/.test(raw))raw=(typeof currentDiff==='string'?currentDiff:'')+' · Ready to play';
  else if(/Page reload detected|Stored completed trace restored/.test(raw))raw=(typeof currentDiff==='string'?currentDiff:'')+' · Saved game recovered';
  summary.textContent=raw;
 }
 const original=setStatus;setStatus=function(text,cls){original(text,cls);display(text);};
 display(status.textContent);
})();
