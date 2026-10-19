/* Current reader scores are rendered into the HTML. No historic score overlay. */
(()=>{'use strict';document.addEventListener('click',event=>{const b=event.target.closest?.('[data-score-open]');if(!b)return;const d=document.getElementById(b.dataset.scoreOpen);if(d?.showModal){event.preventDefault();event.stopPropagation();d.showModal()}})})();
