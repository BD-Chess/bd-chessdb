/* Nara Daily first-story HD/4K selection by physical screen pixels.
   Keep exactly one selected WebP per picture; iPhone 16 Pro uses 4K. */
(()=>{
  'use strict';
  const images=[...document.querySelectorAll('img[data-nara-image-hd][data-nara-image-4k]')];
  if(!images.length)return;
  const update=()=>{
    const ratio=Number.isFinite(window.devicePixelRatio)&&window.devicePixelRatio>0?window.devicePixelRatio:1;
    const width=Number(window.screen?.width)||Number(window.innerWidth)||0;
    const height=Number(window.screen?.height)||Number(window.innerHeight)||0;
    const high=Math.max(width,height)*ratio>1920||Math.min(width,height)*ratio>1080;
    for(const image of images){
      const src=high?image.dataset.naraImage4k:image.dataset.naraImageHd;
      if(!src)continue;
      image.dataset.naraResolution=high?'4k':'hd';
      if(image.getAttribute('src')!==src)image.setAttribute('src',src);
    }
  };
  update();
  window.addEventListener('resize',update,{passive:true});
  window.addEventListener('orientationchange',update,{passive:true});
})();
