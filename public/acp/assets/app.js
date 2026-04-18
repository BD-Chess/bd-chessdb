
(function(){
  const progress = document.getElementById('progress');
  const onScroll = () => {
    const h = document.documentElement;
    const scrolled = h.scrollTop || document.body.scrollTop;
    const height = h.scrollHeight - h.clientHeight;
    const pct = height > 0 ? (scrolled / height) * 100 : 0;
    if(progress) progress.style.width = pct + '%';
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  const canvas = document.getElementById('stars');
  if(canvas){
    const ctx = canvas.getContext('2d');
    const resize = ()=>{ canvas.width = window.innerWidth; canvas.height = window.innerHeight; draw(); };
    const stars = [];
    function seed(){
      stars.length = 0;
      const n = Math.min(160, Math.floor((window.innerWidth*window.innerHeight)/12000));
      for(let i=0;i<n;i++) stars.push({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:Math.random()*1.2+0.2,a:Math.random()*0.5+0.15});
    }
    function draw(){
      if(!ctx) return;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      stars.forEach(s=>{ ctx.beginPath(); ctx.fillStyle = 'rgba(255,244,220,'+s.a+')'; ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); });
    }
    seed(); resize(); window.addEventListener('resize', ()=>{seed(); resize();});
  }

  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('visible'); });
  }, {threshold: 0.08});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
})();
