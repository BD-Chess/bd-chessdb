/* Nara Daily illustrated stories: viewport-filling, orientation-responsive, accessible image viewer.
 * No dependencies, network requests, page navigation, image mutation, or scroll-position changes.
 * Progressive enhancement: inline illustrations work without JavaScript.
 */
(()=>{
  'use strict';
  const images=[...document.querySelectorAll('.daily-scene-figure img:not([data-nara-responsive])')];
  if(!images.length)return;

  const viewer=document.createElement('dialog');
  viewer.className='nara-daily-lightbox';
  viewer.setAttribute('aria-label','Full-screen illustration');
  const stage=document.createElement('div');
  stage.className='nara-daily-lightbox-stage';
  const surface=document.createElement('button');
  surface.type='button';
  surface.className='nara-daily-lightbox-surface';
  surface.setAttribute('aria-label','Close full-screen illustration');
  const large=document.createElement('img');
  large.alt='';
  large.decoding='async';
  surface.append(large);
  const close=document.createElement('button');
  close.type='button';
  close.className='nara-daily-lightbox-close';
  close.textContent='×';
  close.setAttribute('aria-label','Close full-screen illustration');
  stage.append(surface,close);
  viewer.append(stage);
  document.body.append(viewer);

  let source=null;
  let at=null;
  let hadFullscreen=false;
  const closeViewer=()=>{
    if(!viewer.open)return;
    viewer.close();
    document.documentElement.classList.remove('nara-lightbox-open');
    if(document.fullscreenElement===stage){
      try{document.exitFullscreen?.()?.catch(()=>{});}catch{}
    }
    const restore=source,position=at;
    source=null;
    at=null;
    hadFullscreen=false;
    if(restore?.isConnected!==false){
      try{restore?.focus({preventScroll:true});}catch{}
    }
    if(position)requestAnimationFrame(()=>window.scrollTo(position.x,position.y));
  };
  const openViewer=img=>{
    if(viewer.open)return;
    source=img;
    at={x:window.scrollX,y:window.scrollY};
    large.src=img.currentSrc||img.src;
    large.alt=img.alt||'';
    viewer.setAttribute('aria-label',img.alt||'Full-screen illustration');
    try{viewer.showModal();}catch{source=null;at=null;return;}
    document.documentElement.classList.add('nara-lightbox-open');
    close.focus({preventScroll:true});
    // Desktop and supporting Android browsers hide browser chrome. iOS Safari
    // without element Fullscreen API retains the viewport-filling dialog fallback.
    // A <dialog> cannot enter native fullscreen; its nested DIV can.
    // Keep the modal alone as the fallback when fullscreen is unavailable.
    try{stage.requestFullscreen?.({navigationUI:'hide'})?.catch(()=>{});}catch{}
  };

  for(const img of images){
    img.setAttribute('role','button');
    img.setAttribute('aria-haspopup','dialog');
    img.setAttribute('aria-label','Open full-screen illustration: '+(img.alt||'Image'));
    if(!img.hasAttribute('tabindex'))img.tabIndex=0;
    img.addEventListener('click',()=>openViewer(img));
    img.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        openViewer(img);
      }
    });
  }
  surface.addEventListener('click',closeViewer);
  close.addEventListener('click',closeViewer);
  viewer.addEventListener('click',event=>{
    if(event.target===viewer)closeViewer();
  });
  viewer.addEventListener('cancel',event=>{
    event.preventDefault();
    closeViewer();
  });
  document.addEventListener('keydown',event=>{
    if(viewer.open&&event.key==='Escape'){
      event.preventDefault();
      closeViewer();
    }
  });
  document.addEventListener('fullscreenchange',()=>{
    if(document.fullscreenElement===stage)hadFullscreen=true;
    else if(hadFullscreen){
      hadFullscreen=false;
      closeViewer();
    }
  });
})();
