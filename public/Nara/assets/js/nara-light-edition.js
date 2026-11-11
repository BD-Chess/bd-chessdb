/* Lahko branje. The easy-reading edition is a plain <details> block and opens without JavaScript.
   This only opens it when the address points at it, e.g. ...-story.html#lahko-branje. */
(()=>{
  'use strict';
  const openFromHash=()=>{
    let id;
    try{id=decodeURIComponent(location.hash.slice(1))}catch{return}
    const el=id?document.getElementById(id):null;
    if(el&&el.matches('details.light-edition')){
      el.open=true;
      requestAnimationFrame(()=>el.scrollIntoView());
    }
  };
  window.addEventListener('hashchange',openFromHash);
  openFromHash();
})();
