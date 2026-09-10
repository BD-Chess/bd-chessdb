(()=>{
const root=document.documentElement;
const themeBtn=document.querySelector('[data-theme-toggle]');
const media=window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(theme){
  theme=theme==='dark'?'dark':'light';
  root.dataset.theme=theme;
  document.querySelectorAll('img[data-light][data-dark]').forEach(img=>{
    img.src=theme==='dark'?img.dataset.dark:img.dataset.light;
  });
  if(themeBtn){
    themeBtn.textContent=theme==='dark'?'☀ Light':'☾ Dark';
    themeBtn.setAttribute('aria-label',theme==='dark'?'Use light theme':'Use dark theme');
  }
}
applyTheme(media.matches?'dark':'light');
if(themeBtn)themeBtn.addEventListener('click',()=>applyTheme(root.dataset.theme==='dark'?'light':'dark'));
const open=document.querySelector('[data-open-architecture]');
const dlg=document.getElementById('architectureDialog');
const close=dlg&&dlg.querySelector('[data-dialog-close]');
let opener=null;
if(open&&dlg){
  open.addEventListener('click',()=>{opener=open;dlg.showModal();close?.focus();});
  close?.addEventListener('click',()=>dlg.close());
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
  dlg.addEventListener('close',()=>opener?.focus());
}
})();
