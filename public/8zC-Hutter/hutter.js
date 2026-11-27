"use strict";
const root = document.documentElement;
const mast = document.getElementById("results-mast");
const languages = document.querySelector(".languages");
const languageButtons = [...languages.querySelectorAll("[data-select-language]")];
const themeButtons = [...document.querySelectorAll("[data-theme-choice]")];
const fontButtons = [...document.querySelectorAll("[data-font-step]")];
const fontReset = document.getElementById("font-reset");
const titles = {
  sl: "8zC-Hutter · Dirkalni raziskovalni poligon sistema 8zC (Hutter Prize & Wikipedija) | MDL×DCC",
  en: "8zC-Hutter · The Formula 1 Research Track of 8zC (Hutter Prize & Wikipedia) | MDL×DCC"
};

function read(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
function store(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
function updateMastHeight() {
  if (mast) root.style.setProperty("--results-mast-height", Math.ceil(mast.getBoundingClientRect().height) + "px");
}

function selectLanguage(lang, persist) {
  const language = lang === "en" ? "en" : "sl";
  root.lang = language;
  root.dataset.language = language;
  document.title = titles[language];
  for (const button of languageButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.selectLanguage === language));
  }
  for (const link of document.querySelectorAll("a[href]")) {
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && ["/8zc/", "/8zc-story/", "/8zc-results/", "/8zc-hutter/"].includes(url.pathname.toLowerCase())) {
      url.searchParams.set("lang", language);
      link.href = url.href;
    }
  }
  if (persist) {
    store("8zc-language", language);
    if (location.protocol !== "file:") {
      const url = new URL(location.href);
      url.searchParams.set("lang", language);
      history.replaceState(null, "", url);
    }
  }
  updateMastHeight();
}

function selectTheme(value) {
  const theme = value === "light" ? "light" : "dark";
  root.dataset.theme = theme;
  for (const button of themeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
  }
  store("8zc-theme", theme);
}

let fontPercent = 100;
function setFont(value) {
  fontPercent = Math.max(80, Math.min(180, Math.round(value / 10) * 10));
  root.style.setProperty("--results-font-percent", fontPercent + "%");
  if (fontReset) fontReset.textContent = fontPercent + "%";
  for (const button of fontButtons) {
    button.disabled = Number(button.dataset.fontStep) < 0 ? fontPercent <= 80 : fontPercent >= 180;
  }
  store("8zc-results-font-percent", String(fontPercent));
  updateMastHeight();
}

const requested = new URL(location.href).searchParams.get("lang");
selectLanguage(requested === "en" || requested === "sl" ? requested : read("8zc-language"), true);
selectTheme(read("8zc-theme"));
const savedFont = Number(read("8zc-results-font-percent"));
setFont(Number.isFinite(savedFont) && savedFont >= 80 && savedFont <= 180 ? savedFont : 100);

for (const button of languageButtons) button.addEventListener("click", () => selectLanguage(button.dataset.selectLanguage, true));
for (const button of themeButtons) button.addEventListener("click", () => selectTheme(button.dataset.themeChoice));
for (const button of fontButtons) button.addEventListener("click", () => setFont(fontPercent + Number(button.dataset.fontStep)));
if (fontReset) fontReset.addEventListener("click", () => setFont(100));
for (const el of document.querySelectorAll(".mast-controls")) el.hidden = false;
updateMastHeight();
if ("ResizeObserver" in window && mast) new ResizeObserver(updateMastHeight).observe(mast);
window.addEventListener("resize", updateMastHeight);

fetch("/8zC-Hutter/hutter-data.json", { cache: "no-store" })
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => {
    if (!data) return;
    const stamp = document.getElementById("live-data-timestamp");
    if (stamp && data.updated_utc) stamp.textContent = data.updated_utc;
  })
  .catch(() => {});
