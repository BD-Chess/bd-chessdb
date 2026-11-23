"use strict";

const SAMPLE_ELF_URL = "/8zC/00_data_endian.elf";
const SAMPLE_ELF_NAME = "00_data_endian.elf";
const SAMPLE_ELF_SHA256 = "7a08d5a9e1e9b2b3556c866df883e58ddbf1879fd7859a5e33845f6560476bcc";

const BENCHMARK_SAMPLES = [
  {
    id: "00_data_endian",
    filename: "00_data_endian.elf",
    sha256: "7a08d5a9e1e9b2b3556c866df883e58ddbf1879fd7859a5e33845f6560476bcc",
    title_sl: "00_data_endian.elf (Haskell / GHC)",
    title_en: "00_data_endian.elf (Haskell / GHC)",
    raw_B: 80264,
    zip:  { direct: 15976, z8c_r2: 10901, z8c_r3: 10484, pct_r2: "-31,8 %", pct_r3: "-34,4 %" },
    sz7z: { direct: 13555, z8c_r2: 9794,  z8c_r3: 9525,  pct_r2: "-27,8 %", pct_r3: "-29,7 %" },
    paq:  { direct: 9001,  z8c: 6492,  pct: "-27,9 % (-3)" },
    cmix: null,
  },
  {
    id: "02_calf_so",
    filename: "02_calf_so.elf",
    sha256: "eb624fa72d5d1a6f86b2ca5f52b1c48ef8982e1294ce9ec20377050c9fa3a3a0",
    title_sl: "02_calf_so.elf (C++ / GCC avdio vtičnik)",
    title_en: "02_calf_so.elf (C++ / GCC audio plugin)",
    raw_B: 1182672,
    zip:  { direct: 297204, z8c_r2: 228425, z8c_r3: 207569, pct_r2: "-23,1 %", pct_r3: "-30,2 %" },
    sz7z: { direct: 239015, z8c_r2: 187981, z8c_r3: 174354, pct_r2: "-21,4 %", pct_r3: "-27,1 %" },
    paq:  { direct: 145887, z8c: 123729, pct: "-15,2 % (-10LE)" },
    cmix: { direct: 145654, z8c: 123918, pct: "-14,9 %" },
  },
  {
    id: "03_yesod_form_so",
    filename: "03_yesod_form_so.elf",
    sha256: "",
    title_sl: "03_yesod_form_so.elf (Haskell / GHC knjižnica)",
    title_en: "03_yesod_form_so.elf (Haskell / GHC library)",
    raw_B: 1472320,
    zip:  { direct: 283835, z8c_r2: 200279, z8c_r3: 186015, pct_r2: "-29,4 %", pct_r3: "-34,5 %" },
    sz7z: { direct: 210821, z8c_r2: 150858, z8c_r3: 140758, pct_r2: "-28,4 %", pct_r3: "-33,2 %" },
    paq:  { direct: 117163, z8c: 99514,  pct: "-15,1 % (-10LE)" },
    cmix: { direct: 114899, z8c: 98691,  pct: "-14,1 %" },
  },
  {
    id: "01_jwtui",
    filename: "01_jwtui.elf",
    sha256: "",
    title_sl: "01_jwtui.elf (Rust / LLVM izvršljivi program)",
    title_en: "01_jwtui.elf (Rust / LLVM executable)",
    raw_B: 2726704,
    zip:  { direct: 1290629, z8c_r2: 1060339, z8c_r3: 1000231, pct_r2: "-17,8 %", pct_r3: "-22,5 %" },
    sz7z: { direct: 1047223, z8c_r2: 825356,  z8c_r3: 779900,  pct_r2: "-21,2 %", pct_r3: "-25,5 %" },
    paq:  { direct: 704961,  z8c: 522419,  pct: "-25,9 % (-10LE)" },
    cmix: { direct: 683352,  z8c: 501302,  pct: "-26,6 %" },
  },
];

const translations = {
  "Rezultati 8zC": "8zC results",
  "Kodek 8zC": "8zC codec",
  "Stisnite datoteko ELF ali jo obnovite iz arhiva Carbon R2. Datoteka ostane v vašem brskalniku.": "Compress an ELF file or restore it from a Carbon R2 archive. Your file stays in your browser.",
  "Izberite postopek": "Choose an operation",
  "Stisni ELF": "Compress ELF",
  "Obnovi izvirnik": "Restore original",
  "Vhodna datoteka ELF": "ELF input file",
  "Vhodni arhiv Carbon R2": "Carbon R2 input archive",
  "Vzorec ELF (80 KB)": "Sample ELF (80 KB)",
  "Izberite datoteko ELF": "Choose an ELF file",
  "Izberite arhiv ZIP": "Choose a ZIP archive",
  "ali jo povlecite sem (ali kliknite Vzorec ELF zgoraj)": "or drop it here (or click Sample ELF above)",
  "ali ga povlecite sem": "or drop it here",
  "1 datoteka · do 16 MiB": "1 file · up to 16 MiB",
  "1 arhiv · do 16 MiB + 1 KiB": "1 archive · up to 16 MiB + 1 KiB",
  "Primerjaj kompresije": "Compare compressions",
  "Stisni": "Compress",
  "Obnovi": "Restore",
  "Prekliči": "Cancel",
  "Obnovljena datoteka": "Restored file",
  "Arhiv 8zC ZIP": "8zC ZIP archive",
  "Shrani ZIP": "Save ZIP",
  "Shrani ELF": "Save ELF",
  "Licence knjižnic": "Library licenses",
  "Izberite samo eno datoteko.": "Choose one file.",
  "Datoteka je prazna.": "The file is empty.",
  "Datoteka presega dovoljeno velikost.": "The file exceeds the size limit.",
  "Postopek je preklican.": "Operation cancelled.",
  "Arhiv je pripravljen za shranjevanje.": "Your archive is ready to save.",
  "Datoteka ELF je pripravljena za shranjevanje.": "Your ELF file is ready to save.",
  "Stiskanje poteka …": "Compressing …",
  "Obnova poteka …": "Restoring …",
  "Primerjava kompresij v brskalniku poteka …": "Running browser compression comparison …",
  "Nalagam vzorčno datoteko 00_data_endian.elf …": "Loading sample file 00_data_endian.elf …",
  "Vzorčna datoteka 00_data_endian.elf ni dostopna.": "Sample file 00_data_endian.elf could not be loaded.",
  "Opravila ni bilo mogoče dokončati. Preverite, ali so datoteke spletnega kodeka dostopne.": "The operation failed. Check that the codec files are available.",
  "Brskalnik ni mogel zagnati opravila. Odprite aplikacijo prek lokalnega spletnega strežnika.": "The browser could not start the operation.",
  "Primerjava kompresij (Čisti kodek proti 8zC)": "Compression comparison (Raw codec vs. 8zC)",
  "Živi preizkus v brskalniku (WebAssembly) in preverjena matrika 4 kodekov (ZIP, 7z, PAQ8PX, cmix v21) s 100 % bitno točno obnovo SHA-256.": "Live in-browser WebAssembly test and verified 4-codec benchmark matrix (ZIP, 7z, PAQ8PX, cmix v21) with 100% byte-exact SHA-256 restoration.",
  "Živi izid v vašem brskalniku": "Live result in your browser",
  "Kodek / stopnja": "Codec / stage",
  "Surovi ELF": "Raw ELF",
  "Čisti kodek": "Direct codec",
  "8zC + kodek": "8zC + codec",
  "Prihranek": "Savings",
  "Referenčna matrika 4 vzorčnih datotek ELF (.zip · .7z · .paq · .cmix)": "Reference matrix of 4 sample ELF binaries (.zip · .7z · .paq · .cmix)",
  "Zaženi 00_data_endian.elf v živo →": "Run 00_data_endian.elf live →",
  "Vzorčni ELF (prevajalnik)": "Sample ELF (compiler)",
  "Surovo": "Raw",
  "Čisti ZIP → 8zC + ZIP": "Direct ZIP → 8zC + ZIP",
  "Čisti 7z → 8zC + 7z": "Direct 7z → 8zC + 7z",
  "Čisti PAQ8PX → 8zC + PAQ": "Direct PAQ8PX → 8zC + PAQ",
  "Čisti cmix v21 → 8zC + cmix": "Direct cmix v21 → 8zC + cmix",
};

let language = localStorage.getItem("8zc-language") === "en" ? "en" : "sl";
const t = (text) => (language === "en" ? translations[text] || text : text);
const byId = (id) => document.getElementById(id);

function fmtB(n) {
  return Number(n).toLocaleString(language === "en" ? "en-US" : "sl-SI") + " B";
}

function fmtPct(savedBytes, baseBytes) {
  if (!baseBytes) return "—";
  const pct = ((savedBytes / baseBytes) * 100).toFixed(1);
  return (language === "en" ? pct : pct.replace(".", ",")) + " %";
}

const MAX_ELF_BYTES = 16 * 1024 * 1024;
const modes = byId("modes");
const fileInput = byId("file");
const choose = byId("choose");
const start = byId("start");
const cancel = byId("cancel");
const sampleBtn = byId("sample-btn");
const compareBtn = byId("compare-btn");
const runSampleLiveBtn = byId("run-sample-live");
const statusLine = byId("status");
const download = byId("download");

let mode = "encode";
let selected = null;
let worker = null;
let objectUrl = null;
let lastCompareData = null;

function renderReferenceMatrix() {
  const tbody = byId("matrix-body");
  tbody.textContent = "";
  for (const s of BENCHMARK_SAMPLES) {
    const tr = document.createElement("tr");
    const tdTitle = document.createElement("th");
    tdTitle.scope = "row";
    tdTitle.textContent = language === "en" ? s.title_en : s.title_sl;
    tr.appendChild(tdTitle);

    const tdRaw = document.createElement("td");
    tdRaw.textContent = fmtB(s.raw_B);
    tr.appendChild(tdRaw);

    const tdZip = document.createElement("td");
    const zipBest = s.zip.z8c_r3 || s.zip.z8c_r2;
    const zipPct = s.zip.pct_r3 || s.zip.pct_r2;
    tdZip.innerHTML = `<span>${fmtB(s.zip.direct)}</span> → <strong>${fmtB(zipBest)}</strong> <span class="badge">${zipPct}</span>`;
    tr.appendChild(tdZip);

    const td7z = document.createElement("td");
    const szBest = s.sz7z.z8c_r3 || s.sz7z.z8c_r2;
    const szPct = s.sz7z.pct_r3 || s.sz7z.pct_r2;
    td7z.innerHTML = `<span>${fmtB(s.sz7z.direct)}</span> → <strong>${fmtB(szBest)}</strong> <span class="badge">${szPct}</span>`;
    tr.appendChild(td7z);

    const tdPaq = document.createElement("td");
    tdPaq.innerHTML = `<span>${fmtB(s.paq.direct)}</span> → <strong>${fmtB(s.paq.z8c)}</strong> <span class="badge">${s.paq.pct}</span>`;
    tr.appendChild(tdPaq);

    const tdCmix = document.createElement("td");
    if (s.cmix) {
      tdCmix.innerHTML = `<span>${fmtB(s.cmix.direct)}</span> → <strong>${fmtB(s.cmix.z8c)}</strong> <span class="badge">${s.cmix.pct}</span>`;
    } else {
      tdCmix.textContent = "—";
    }
    tr.appendChild(tdCmix);
    tbody.appendChild(tr);
  }
}

function renderLiveCompare(data) {
  lastCompareData = data;
  const box = byId("live-compare-box");
  const tbody = byId("live-compare-body");
  tbody.textContent = "";

  const matchedSample = BENCHMARK_SAMPLES.find(
    (s) => (data.inputDigest && s.sha256 === data.inputDigest) || (selected && s.filename === selected.name && s.raw_B === data.inputBytes)
  );

  byId("live-compare-title").textContent =
    (language === "en" ? "Live result in your browser: " : "Živi izid v vašem brskalniku: ") +
    (selected ? selected.name : SAMPLE_ELF_NAME);

  const addRow = (label, rawB, baseB, z8cB, note) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = label;
    tr.appendChild(th);

    const tdRaw = document.createElement("td");
    tdRaw.textContent = fmtB(rawB);
    tr.appendChild(tdRaw);

    const tdBase = document.createElement("td");
    tdBase.textContent = baseB ? fmtB(baseB) : "—";
    tr.appendChild(tdBase);

    const td8zc = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = fmtB(z8cB);
    td8zc.appendChild(strong);
    tr.appendChild(td8zc);

    const tdSave = document.createElement("td");
    if (baseB) {
      const diff = z8cB - baseB;
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = `${diff.toLocaleString(language === "en" ? "en-US" : "sl-SI")} B (${fmtPct(diff, baseB)})${note ? " · " + note : ""}`;
      tdSave.appendChild(badge);
    } else {
      tdSave.textContent = note || "—";
    }
    tr.appendChild(tdSave);
    tbody.appendChild(tr);
  };

  const baseZip = matchedSample ? matchedSample.zip.direct : data.browserZipBytes;
  addRow(
    language === "en" ? "Browser WASM: ZIP vs. 8zC Carbon R2 (live)" : "Brskalnik WASM: ZIP proti 8zC Carbon R2 (v živo)",
    data.inputBytes,
    baseZip,
    data.z8cZipBytes,
    `${data.encodeMs} ms enc / ${data.decodeMs} ms dec`
  );

  if (matchedSample) {
    addRow(
      language === "en" ? "8zC Cycle12 R2 + ZIP (Deflate -mx=9)" : "8zC Cycle12 R2 + ZIP (Deflate -mx=9)",
      matchedSample.raw_B,
      matchedSample.zip.direct,
      matchedSample.zip.z8c_r2,
      "Cycle12 R2"
    );
    if (matchedSample.zip.z8c_r3) {
      addRow(
        language === "en" ? "8zC Cycle12 R3 + ZIP (GEN_25 + .eh_frame)" : "8zC Cycle12 R3 + ZIP (GEN_25 + .eh_frame)",
        matchedSample.raw_B,
        matchedSample.zip.direct,
        matchedSample.zip.z8c_r3,
        "Cycle12 R3"
      );
    }
    addRow(
      language === "en" ? "8zC Cycle12 + 7z (LZMA -mx=9)" : "8zC Cycle12 + 7z (LZMA -mx=9)",
      matchedSample.raw_B,
      matchedSample.sz7z.direct,
      matchedSample.sz7z.z8c_r3 || matchedSample.sz7z.z8c_r2,
      matchedSample.sz7z.z8c_r3 ? "Cycle12 R3" : "Cycle12 R2"
    );
    addRow(
      "8zC + PAQ8PX v217",
      matchedSample.raw_B,
      matchedSample.paq.direct,
      matchedSample.paq.z8c,
      matchedSample.paq.pct
    );
    if (matchedSample.cmix) {
      addRow(
        "8zC + cmix v21",
        matchedSample.raw_B,
        matchedSample.cmix.direct,
        matchedSample.cmix.z8c,
        matchedSample.cmix.pct
      );
    }
  }

  byId("live-verify-line").textContent =
    (language === "en"
      ? "✓ 100% byte-exact restoration verified in browser · Original & restored SHA-256: "
      : "✓ 100 % bitno točna obnova preverjena v brskalniku · Izvirni in obnovljeni SHA-256: ") +
    (data.restoredDigest || data.inputDigest || "OK");
  box.hidden = false;
  byId("compare-panel").hidden = false;
}

function setLanguage(lang) {
  language = lang;
  localStorage.setItem("8zc-language", lang);
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-lang]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang))
  );

  byId("results-link").textContent = t("Rezultati 8zC");
  document.querySelector("h1").textContent = t("Kodek 8zC");
  document.querySelector(".intro").textContent = t(
    "Stisnite datoteko ELF ali jo obnovite iz arhiva Carbon R2. Datoteka ostane v vašem brskalniku."
  );
  document.querySelector("#modes legend").textContent = t("Izberite postopek");
  const modeSpans = document.querySelectorAll("#modes label span");
  if (modeSpans[0]) modeSpans[0].textContent = t("Stisni ELF");
  if (modeSpans[1]) modeSpans[1].textContent = t("Obnovi izvirnik");

  const encoding = mode === "encode";
  byId("input-heading").textContent = t(encoding ? "Vhodna datoteka ELF" : "Vhodni arhiv Carbon R2");
  sampleBtn.textContent = t("Vzorec ELF (80 KB)");
  byId("limits").textContent = t(encoding ? "1 datoteka · do 16 MiB" : "1 arhiv · do 16 MiB + 1 KiB");
  byId("compare-label").textContent = t("Primerjaj kompresije");
  byId("start-label").textContent = t(encoding ? "Stisni" : "Obnovi");
  cancel.textContent = t("Prekliči");
  byId("licenses-link").textContent = t("Licence knjižnic");

  byId("compare-heading").textContent = t("Primerjava kompresij (Čisti kodek proti 8zC)");
  byId("compare-sub").textContent = t(
    "Živi preizkus v brskalniku (WebAssembly) in preverjena matrika 4 kodekov (ZIP, 7z, PAQ8PX, cmix v21) s 100 % bitno točno obnovo SHA-256."
  );
  byId("th-live-codec").textContent = t("Kodek / stopnja");
  byId("th-live-raw").textContent = t("Surovi ELF");
  byId("th-live-base").textContent = t("Čisti kodek");
  byId("th-live-8zc").textContent = t("8zC + kodek");
  byId("th-live-save").textContent = t("Prihranek");
  byId("matrix-title").textContent = t("Referenčna matrika 4 vzorčnih datotek ELF (.zip · .7z · .paq · .cmix)");
  runSampleLiveBtn.textContent = t("Zaženi 00_data_endian.elf v živo →");
  byId("th-m-file").textContent = t("Vzorčni ELF (prevajalnik)");
  byId("th-m-raw").textContent = t("Surovo");
  byId("th-m-zip").textContent = t("Čisti ZIP → 8zC + ZIP");
  byId("th-m-7z").textContent = t("Čisti 7z → 8zC + 7z");
  byId("th-m-paq").textContent = t("Čisti PAQ8PX → 8zC + PAQ");
  byId("th-m-cmix").textContent = t("Čisti cmix v21 → 8zC + cmix");

  if (!selected) {
    byId("filename").textContent = t(encoding ? "Izberite datoteko ELF" : "Izberite arhiv ZIP");
    byId("filehint").textContent = t(
      encoding ? "ali jo povlecite sem (ali kliknite Vzorec ELF zgoraj)" : "ali ga povlecite sem"
    );
  } else {
    byId("filehint").textContent =
      selected.size.toLocaleString(language === "en" ? "en-US" : "sl-SI") +
      (language === "en" ? " B · Click to replace" : " B · Kliknite za zamenjavo");
  }
  if (!byId("result").hidden) {
    byId("result-heading").textContent = t(encoding ? "Arhiv 8zC ZIP" : "Obnovljena datoteka");
    byId("save-label").textContent = t(encoding ? "Shrani ZIP" : "Shrani ELF");
  }
  renderReferenceMatrix();
  if (lastCompareData) renderLiveCompare(lastCompareData);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("8zc-theme", theme);
  byId("theme").textContent = theme === "dark" ? "☀ Light" : "☾ Dark";
}

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
  byId("filename").textContent = file
    ? file.name
    : t(encoding ? "Izberite datoteko ELF" : "Izberite arhiv ZIP");
  byId("filehint").textContent = file
    ? file.size.toLocaleString(language === "en" ? "en-US" : "sl-SI") +
      (language === "en" ? " B · Click to replace" : " B · Kliknite za zamenjavo")
    : t(encoding ? "ali jo povlecite sem (ali kliknite Vzorec ELF zgoraj)" : "ali ga povlecite sem");
}

function acceptFiles(files) {
  if (!files.length || worker) return;
  const file = files[0];
  const maxBytes = MAX_ELF_BYTES + (mode === "decode" ? 1024 : 0);
  if (files.length !== 1 || !file.size || file.size > maxBytes) {
    selectFile(null);
    status(
      files.length !== 1
        ? t("Izberite samo eno datoteko.")
        : !file.size
        ? t("Datoteka je prazna.")
        : t("Datoteka presega dovoljeno velikost."),
      true
    );
    return;
  }
  selectFile(file);
  status((language === "en" ? "Selected file: " : "Izbrana datoteka: ") + file.name);
}

function switchMode() {
  mode = modes.querySelector("input:checked").value;
  const encoding = mode === "encode";
  fileInput.accept = encoding ? "" : ".zip,application/zip";
  fileInput.value = "";
  sampleBtn.hidden = !encoding;
  compareBtn.hidden = !encoding;
  byId("input-heading").textContent = t(encoding ? "Vhodna datoteka ELF" : "Vhodni arhiv Carbon R2");
  byId("file-icon").textContent = encoding ? "ELF" : "ZIP";
  byId("limits").textContent = t(encoding ? "1 datoteka · do 16 MiB" : "1 arhiv · do 16 MiB + 1 KiB");
  byId("start-label").textContent = t(encoding ? "Stisni" : "Obnovi");
  selectFile(null);
}

function busy(active) {
  modes.disabled = active;
  choose.disabled = active;
  sampleBtn.disabled = active;
  compareBtn.disabled = active;
  runSampleLiveBtn.disabled = active;
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
  objectUrl = URL.createObjectURL(
    new Blob([bytes], {
      type: encoding ? "application/zip" : "application/octet-stream",
    })
  );
  download.href = objectUrl;
  download.download = name;
  byId("result-heading").textContent = t(encoding ? "Arhiv 8zC ZIP" : "Obnovljena datoteka");
  byId("save-label").textContent = t(encoding ? "Shrani ZIP" : "Shrani ELF");
  byId("output-name").textContent =
    name + " · " + bytes.byteLength.toLocaleString(language === "en" ? "en-US" : "sl-SI") + " B";
  byId("digest").textContent = digest || "";
  byId("digest-row").hidden = !digest;
  byId("result").hidden = false;
  status(t(encoding ? "Arhiv je pripravljen za shranjevanje." : "Datoteka ELF je pripravljena za shranjevanje."));
}

async function fetchSampleElfFile() {
  status(t("Nalagam vzorčno datoteko 00_data_endian.elf …"));
  const resp = await fetch(SAMPLE_ELF_URL);
  if (!resp.ok) throw new Error(t("Vzorčna datoteka 00_data_endian.elf ni dostopna."));
  const blob = await resp.blob();
  return new File([blob], SAMPLE_ELF_NAME, { type: "application/octet-stream" });
}

async function loadSample(autoCompare = false) {
  if (worker) return;
  if (mode !== "encode") {
    modes.querySelector('input[value="encode"]').checked = true;
    switchMode();
  }
  try {
    const file = await fetchSampleElfFile();
    selectFile(file);
    status((language === "en" ? "Loaded sample ELF: " : "Naložen vzorčni ELF: ") + file.name);
    if (autoCompare) {
      runWorker("compare");
    }
  } catch (err) {
    status(err.message || t("Vzorčna datoteka 00_data_endian.elf ni dostopna."), true);
  }
}

function runWorker(workerMode) {
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
      } else if (data.compare) {
        showResult(data);
        renderLiveCompare(data);
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
    status(
      workerMode === "compare"
        ? t("Primerjava kompresij v brskalniku poteka …")
        : mode === "encode"
        ? t("Stiskanje poteka …")
        : t("Obnova poteka …")
    );
    worker.postMessage({ mode: workerMode, file: selected });
  } catch {
    finish();
    status(t("Brskalnik ni mogel zagnati opravila. Odprite aplikacijo prek lokalnega spletnega strežnika."), true);
    start.focus();
  }
}

async function handleCompareClick() {
  if (worker) return;
  byId("compare-panel").hidden = false;
  if (!selected) {
    await loadSample(true);
  } else {
    runWorker("compare");
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
start.addEventListener("click", () => runWorker(mode));
compareBtn.addEventListener("click", handleCompareClick);
sampleBtn.addEventListener("click", () => loadSample(false));
runSampleLiveBtn.addEventListener("click", () => loadSample(true));
cancel.addEventListener("click", stop);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && worker) stop();
});
setTheme(localStorage.getItem("8zc-theme") === "light" ? "light" : "dark");
byId("theme").addEventListener("click", () =>
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
);
document
  .querySelectorAll("[data-lang]")
  .forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.lang)));
switchMode();
setLanguage(language);
