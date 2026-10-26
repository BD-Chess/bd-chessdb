/* AI8 display controls. No provider calls, cookies or external resources. */
"use strict";
(() => {
  const root = document.documentElement;
  const toolbar = document.querySelector("[data-ai8-toolbar]");
  if (!toolbar) return;
  const get = (key) => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const put = (key, value) => { try { localStorage.setItem(key, String(value)); } catch (_) {} };
  let lang = "sl", theme = "dark", scale = 1;

  function apply() {
    root.lang = lang;
    root.dataset.theme = theme;
    root.style.setProperty("--scale", String(scale));
    toolbar.querySelectorAll("[data-ai8-lang]").forEach((button) => {
      const selected = button.dataset.ai8Lang === lang;
      button.setAttribute("aria-pressed", String(selected));
    });
    toolbar.querySelectorAll("[data-ai8-theme]").forEach((button) => {
      const selected = button.dataset.ai8Theme === theme;
      button.setAttribute("aria-pressed", String(selected));
    });
    toolbar.querySelector("[data-ai8-reset]").textContent = `${Math.round(scale * 100)}%`;
    toolbar.querySelector("[data-ai8-down]").disabled = scale <= .8;
    toolbar.querySelector("[data-ai8-up]").disabled = scale >= 1.5;
    document.querySelectorAll("[data-lang]").forEach((item) => { item.hidden = item.dataset.lang !== lang; });
    document.querySelectorAll("[data-aria-sl][data-aria-en]").forEach((item) => {
      item.setAttribute("aria-label", lang === "en" ? item.dataset.ariaEn : item.dataset.ariaSl);
    });
    if (root.dataset.titleSl && root.dataset.titleEn) document.title = lang === "en" ? root.dataset.titleEn : root.dataset.titleSl;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#0b1220" : "#f5f7f9";
    document.dispatchEvent(new CustomEvent("ai8:display", { detail: { lang, theme, scale } }));
  }
  function setLang(value) { if (value !== "sl" && value !== "en") return; lang = value; put("mdlxdcc-lang", lang); apply(); }
  function setTheme(value) { if (value !== "dark" && value !== "light") return; theme = value; put("mdlxdcc-theme", theme); apply(); }
  function setScale(value) { scale = Math.round(Math.min(1.5, Math.max(.8, value)) * 100) / 100; put("mdlxdcc-font", scale); apply(); }
  const storedLang = get("mdlxdcc-lang");
  const storedTheme = get("mdlxdcc-theme");
  const storedScale = Number(get("mdlxdcc-font"));
  if (storedLang === "sl" || storedLang === "en") lang = storedLang;
  if (storedTheme === "dark" || storedTheme === "light") theme = storedTheme;
  if (Number.isFinite(storedScale) && storedScale >= .8 && storedScale <= 1.5) scale = storedScale;
  toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !toolbar.contains(button)) return;
    if (button.dataset.ai8Lang) setLang(button.dataset.ai8Lang);
    else if (button.dataset.ai8Theme) setTheme(button.dataset.ai8Theme);
    else if (button.hasAttribute("data-ai8-down")) setScale(scale - .05);
    else if (button.hasAttribute("data-ai8-up")) setScale(scale + .05);
    else if (button.hasAttribute("data-ai8-reset")) setScale(1);
  });
  window.addEventListener("storage", (event) => {
    if (!["mdlxdcc-lang", "mdlxdcc-theme", "mdlxdcc-font", null].includes(event.key)) return;
    const nextLang = get("mdlxdcc-lang"), nextTheme = get("mdlxdcc-theme"), nextScale = Number(get("mdlxdcc-font"));
    lang = nextLang === "en" ? "en" : "sl";
    theme = nextTheme === "light" || nextTheme === "dark" ? nextTheme : "dark";
    scale = Number.isFinite(nextScale) && nextScale >= .8 && nextScale <= 1.5 ? nextScale : 1;
    apply();
  });
  apply();
})();
