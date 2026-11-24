"use strict";
(() => {
  const root = document.documentElement;
  const key = "8z-research-preferences-v1";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (_) {}
  const langParam = new URL(location.href).searchParams.get("lang");
  let language = ["sl","en"].includes(langParam) ? langParam : (saved.language === "en" ? "en" : "sl");
  let theme = saved.theme === "light" ? "light" : "dark";
  let scale = Number.isFinite(saved.scale) ? Math.max(80, Math.min(160, Math.round(saved.scale/10)*10)) : 100;
  const names = { "8zllm": ["8zLLM — Strukturna inteligenca in učinkovito izvajanje","8zLLM — Structural Intelligence & Efficient Inference"], "8znas": ["8zNAS — Iskanje nevronskih arhitektur in struktur","8zNAS — Neural Architecture Search & Structural Search"] };
  function render() {
    root.lang = language; root.dataset.language = language; root.dataset.theme = theme;
    root.style.setProperty("--research-scale", scale+"%");
    document.title = names[root.dataset.project][language === "en" ? 1 : 0] + " | MDL×DCC";
    document.querySelectorAll("button[data-language]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.language===language)));
    document.querySelectorAll("button[data-theme]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.theme===theme)));
    document.querySelectorAll("button[data-scale]").forEach(b=>{ const n=Number(b.dataset.scale); b.disabled=n<0?scale<=80:n>0?scale>=160:false; if(n===0)b.textContent=scale+"%"; });
    document.querySelectorAll("a[href]").forEach(a=>{ const u=new URL(a.href,location.href); if(u.origin===location.origin && ["/8zllm/","/8znas/"].includes(u.pathname.toLowerCase())){u.searchParams.set("lang",language);a.href=u.href;} });
    try { localStorage.setItem(key,JSON.stringify({language,theme,scale})); } catch (_) {}
  }
  document.querySelectorAll("button[data-language]").forEach(b=>b.addEventListener("click",()=>{language=b.dataset.language;render();}));
  document.querySelectorAll("button[data-theme]").forEach(b=>b.addEventListener("click",()=>{theme=b.dataset.theme;render();}));
  document.querySelectorAll("button[data-scale]").forEach(b=>b.addEventListener("click",()=>{const n=Number(b.dataset.scale);scale=n===0?100:Math.max(80,Math.min(160,scale+n));render();}));
  render();document.querySelectorAll(".controls").forEach(el=>el.hidden=false);
})();
