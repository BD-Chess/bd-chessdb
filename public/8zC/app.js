"use strict";

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
  byId("filename").textContent = file ? file.name : (encoding ? "Izberite datoteko ELF" : "Izberite arhiv ZIP");
  byId("filehint").textContent = file
    ? file.size.toLocaleString("sl-SI") + " B · Kliknite za zamenjavo"
    : (encoding ? "ali jo povlecite sem" : "ali ga povlecite sem");
}

function acceptFiles(files) {
  if (!files.length || worker) return;
  const file = files[0];
  const maxBytes = MAX_ELF_BYTES + (mode === "decode" ? 1024 : 0);
  if (files.length !== 1 || !file.size || file.size > maxBytes) {
    selectFile(null);
    status(files.length !== 1 ? "Izberite samo eno datoteko." :
      !file.size ? "Datoteka je prazna." : "Datoteka presega dovoljeno velikost.", true);
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
  byId("input-heading").textContent = encoding ? "Vhodna datoteka ELF" : "Vhodni arhiv Carbon R2";
  byId("file-icon").textContent = encoding ? "ELF" : "ZIP";
  byId("limits").textContent = encoding ? "1 datoteka · do 16 MiB" : "1 arhiv · do 16 MiB + 1 KiB";
  byId("start-label").textContent = encoding ? "Stisni" : "Obnovi";
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
  status("Postopek je preklican.");
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
  byId("result-heading").textContent = encoding ? "Arhiv 8zC ZIP" : "Obnovljena datoteka";
  byId("save-label").textContent = encoding ? "Shrani ZIP" : "Shrani ELF";
  byId("output-name").textContent = name + " · " + bytes.byteLength.toLocaleString("sl-SI") + " B";
  byId("digest").textContent = digest || "";
  byId("digest-row").hidden = !digest;
  byId("result").hidden = false;
  status(encoding ? "Arhiv je pripravljen za shranjevanje." : "Datoteka ELF je pripravljena za shranjevanje.");
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
      status("Opravila ni bilo mogoče dokončati. Preverite, ali so datoteke spletnega kodeka dostopne.", true);
      start.focus();
    };
    busy(true);
    cancel.focus();
    status(mode === "encode" ? "Stiskanje poteka …" : "Obnova poteka …");
    worker.postMessage({ mode, file: selected });
  } catch {
    finish();
    status("Brskalnik ni mogel zagnati opravila. Odprite aplikacijo prek lokalnega spletnega strežnika.", true);
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
switchMode();
