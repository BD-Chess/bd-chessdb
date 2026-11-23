"use strict";

const translations = {
  "Rezultati 8zC":"8zC results", "Kodek 8zC":"8zC codec",
  "Stisnite datoteko ELF ali jo obnovite iz arhiva Carbon R2. Datoteka ostane v vašem brskalniku.":"Compress an ELF file or restore it from a Carbon R2 archive. Your file stays in your browser.",
  "Izberite postopek":"Choose an operation", "Stisni ELF":"Compress ELF", "Obnovi izvirnik":"Restore original",
  "Vhodna datoteka ELF":"ELF input file", "Vhodni arhiv Carbon R2":"Carbon R2 input archive",
  "Izberite datoteko ELF":"Choose an ELF file", "Izberite arhiv ZIP":"Choose a ZIP archive",
  "ali jo povlecite sem":"or drop it here", "ali ga povlecite sem":"or drop it here",
  "1 datoteka · do 16 MiB":"1 file · up to 16 MiB", "1 arhiv · do 16 MiB + 1 KiB":"1 archive · up to 16 MiB + 1 KiB",
  "Stisni":"Compress", "Obnovi":"Restore", "Prekliči":"Cancel", "Obnovljena datoteka":"Restored file",
  "Shrani ZIP":"Save ZIP", "Shrani ELF":"Save ELF", "Licence knjižnic":"Library licenses",
  "Izberite samo eno datoteko.":"Choose one file.", "Datoteka je prazna.":"The file is empty.",
  "Datoteka presega dovoljeno velikost.":"The file exceeds the size limit.",
  "Postopek je preklican.":"Operation cancelled.", "Arhiv je pripravljen za shranjevanje.":"Your archive is ready to save.",
  "Datoteka ELF je pripravljena za shranjevanje.":"Your ELF file is ready to save.",
  "Stiskanje poteka …":"Compressing …", "Obnova poteka …":"Restoring …",
  "Opravila ni bilo mogoče dokončati. Preverite, ali so datoteke spletnega kodeka dostopne.":"The operation failed. Check that the codec files are available.",
  "Brskalnik ni mogel zagnati opravila. Odprite aplikacijo prek lokalnega spletnega strežnika.":"The browser could not start the operation.",
};
let language = localStorage.getItem("8zc-language") === "en" ? "en" : "sl";
const t = (text) => language === "en" ? (translations[text] || text) : text;
const staticNodes = [...document.querySelectorAll("h1, .intro, legend, #modes label span, .mast-links a, #cancel, footer a")].map(node => [node, node.textContent]);
function setLanguage(lang) {
  language = lang;
  localStorage.setItem("8zc-language", lang);
  document.documentElement.lang = lang;
  staticNodes.forEach(([node, text]) => { node.textContent = t(text); });
  document.querySelectorAll("[data-lang]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.lang === lang)));
  const encoding = mode === "encode";
  byId("input-heading").textContent = t(encoding ? "Vhodna datoteka ELF" : "Vhodni arhiv Carbon R2");
  byId("limits").textContent = t(encoding ? "1 datoteka · do 16 MiB" : "1 arhiv · do 16 MiB + 1 KiB");
  byId("start-label").textContent = t(encoding ? "Stisni" : "Obnovi");
  if (!selected) {
    byId("filename").textContent = t(encoding ? "Izberite datoteko ELF" : "Izberite arhiv ZIP");
    byId("filehint").textContent = t(encoding ? "ali jo povlecite sem" : "ali ga povlecite sem");
  }
  if (!byId("result").hidden) {
    byId("result-heading").textContent = encoding ? "Arhiv 8zC ZIP" : t("Obnovljena datoteka");
    byId("save-label").textContent = t(encoding ? "Shrani ZIP" : "Shrani ELF");
  }
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("8zc-theme", theme);
  byId("theme").textContent = theme === "dark" ? "☀ Light" : "☾ Dark";
}
const MAX_ELF_BYTES = 16 * 1024 * 1024;
const byId = (id) => document.getElementById(id);
const modes = byId("modes");
const fileInput = byId("file");
const choose = byId("choose");
const start = byId("start");
const cancel = byId("cancel");
const statusLine = byId("status");
const download = byId("download");

let mode = "encode";
let selected = null;
let worker = null;
let objectUrl = null;

function clearResult() {
  byId("result").hidden = true;
  byId("digest-row").hidden = true;
  download.removeAttribute("href");
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
}

function status(message, error = false) {
  statusLine.textContent = message;
  statusLine.toggleAttribute("data-error", error);
}

function selectFile(file) {
  const encoding = mode === "encode";
  selected = file;
  start.disabled = !file;
  clearResult();
  status("");
  byId("filename").textContent = file ? file.name : (encoding ? t("Izberite datoteko ELF") : t("Izberite arhiv ZIP"));
  byId("filehint").textContent = file
    ? file.size.toLocaleString("sl-SI") + " B · Kliknite za zamenjavo"
    : (encoding ? t("ali jo povlecite sem") : t("ali ga povlecite sem"));
}

function acceptFiles(files) {
  if (!files.length || worker) return;
  const file = files[0];
  const maxBytes = MAX_ELF_BYTES + (mode === "decode" ? 1024 : 0);
  if (files.length !== 1 || !file.size || file.size > maxBytes) {
    selectFile(null);
    status(files.length !== 1 ? t("Izberite samo eno datoteko.") :
      !file.size ? t("Datoteka je prazna.") : t("Datoteka presega dovoljeno velikost."), true);
    return;
  }
  selectFile(file);
  status("Izbrana datoteka: " + file.name);
}

function switchMode() {
  mode = modes.querySelector("input:checked").value;
  const encoding = mode === "encode";
  fileInput.accept = encoding ? "" : ".zip,application/zip";
  fileInput.value = "";
  byId("input-heading").textContent = encoding ? t("Vhodna datoteka ELF") : t("Vhodni arhiv Carbon R2");
  byId("file-icon").textContent = encoding ? "ELF" : "ZIP";
  byId("limits").textContent = encoding ? t("1 datoteka · do 16 MiB") : t("1 arhiv · do 16 MiB + 1 KiB");
  byId("start-label").textContent = encoding ? t("Stisni") : t("Obnovi");
  selectFile(null);
}

function busy(active) {
  modes.disabled = active;
  choose.disabled = active;
  start.hidden = active;
  cancel.hidden = !active;
}

function finish() {
  if (worker) worker.terminate();
  worker = null;
  busy(false);
}

function stop() {
  if (!worker) return;
  finish();
  status(t("Postopek je preklican."));
  start.focus();
}

function showResult({ bytes, digest }) {
  const encoding = mode === "encode";
  const base = selected.name.replace(encoding ? /\.elf$/i : /\.zip$/i, "");
  const stem = encoding ? base : base.replace(/\.elf$/i, "");
  const name = (stem || "carbon-r2") + (encoding ? ".zip" : ".elf");
  objectUrl = URL.createObjectURL(new Blob([bytes], {
    type: encoding ? "application/zip" : "application/octet-stream"
  }));
  download.href = objectUrl;
  download.download = name;
  byId("result-heading").textContent = encoding ? "Arhiv 8zC ZIP" : t("Obnovljena datoteka");
  byId("save-label").textContent = encoding ? t("Shrani ZIP") : t("Shrani ELF");
  byId("output-name").textContent = name + " · " + bytes.byteLength.toLocaleString("sl-SI") + " B";
  byId("digest").textContent = digest || "";
  byId("digest-row").hidden = !digest;
  byId("result").hidden = false;
  status(encoding ? t("Arhiv je pripravljen za shranjevanje.") : t("Datoteka ELF je pripravljena za shranjevanje."));
  download.focus();
}

function run() {
  if (!selected || worker) return;
  clearResult();
  try {
    worker = new Worker("/8zC/worker.js");
    const current = worker;
    worker.onmessage = ({ data }) => {
      if (worker !== current) return;
      finish();
      if (data.error) {
        status(data.error, true);
        start.focus();
      } else {
        showResult(data);
      }
    };
    worker.onerror = () => {
      if (worker !== current) return;
      finish();
      status(t("Opravila ni bilo mogoče dokončati. Preverite, ali so datoteke spletnega kodeka dostopne."), true);
      start.focus();
    };
    busy(true);
    cancel.focus();
    status(mode === "encode" ? t("Stiskanje poteka …") : t("Obnova poteka …"));
    worker.postMessage({ mode, file: selected });
  } catch {
    finish();
    status(t("Brskalnik ni mogel zagnati opravila. Odprite aplikacijo prek lokalnega spletnega strežnika."), true);
    start.focus();
  }
}

choose.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  acceptFiles(fileInput.files);
  fileInput.value = "";
});
choose.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (!worker) choose.classList.add("drag");
});
choose.addEventListener("dragleave", () => choose.classList.remove("drag"));
choose.addEventListener("drop", (event) => {
  event.preventDefault();
  choose.classList.remove("drag");
  acceptFiles(event.dataTransfer.files);
});
for (const type of ["dragover", "drop"]) {
  document.addEventListener(type, (event) => {
    if (event.dataTransfer.types.includes("Files")) event.preventDefault();
  });
}
modes.addEventListener("change", switchMode);
start.addEventListener("click", run);
cancel.addEventListener("click", stop);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && worker) stop();
});
setTheme(localStorage.getItem("8zc-theme") === "light" ? "light" : "dark");
byId("theme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
document.querySelectorAll("[data-lang]").forEach(button => button.addEventListener("click", () => setLanguage(button.dataset.lang)));
switchMode();
setLanguage(language);
