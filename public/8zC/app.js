"use strict";

const QUICK_SAMPLES = [
  {
    id: "00_data_endian",
    url: "/8zC/00_data_endian.elf",
    filename: "00_data_endian.elf",
    badge: "ELF",
    chip_sl: "ELF64 (80 KB)",
    chip_en: "ELF64 (80 KB)",
    sha256: "7a08d5a9e1e9b2b3556c866df883e58ddbf1879fd7859a5e33845f6560476bcc",
    title_sl: "00_data_endian.elf (Linux ELF64 · Haskell)",
    title_en: "00_data_endian.elf (Linux ELF64 · Haskell)",
    raw_B: 80264,
    zip:  { direct: 15976, best: 10169, pct: "-36,4 %", label: "Cycle13 R3 v6 ELF" },
    sz7z: { direct: 13555, best: 9389,  pct: "-30,7 %", label: "Cycle13 R3 v6 ELF" },
    paq:  { direct: 9001,  z8c: 6492,   pct: "-27,9 % (-3)" },
    cmix: null,
  },
  {
    id: "sample_pe64",
    url: "/8zC/samples/sample_pe64_win32.dll",
    filename: "sample_pe64_win32.dll",
    badge: "DLL",
    chip_sl: "Win64 DLL (235 KB)",
    chip_en: "Win64 DLL (235 KB)",
    sha256: "b03a3fc0014c8e7ceb3076e880af923db22fcf2a4327815d5ef7b51fc596df8f",
    title_sl: "sample_pe64_win32.dll (Windows PE32+ x64 · SPLIT_BE + T4_V6)",
    title_en: "sample_pe64_win32.dll (Windows PE32+ x64 · SPLIT_BE + T4_V6)",
    raw_B: 234896,
    zip:  { direct: 87017, best: 76553, pct: "-12,0 %", label: "Cycle13 R3 v6 PE" },
    sz7z: { direct: 77337, best: 69376, pct: "-10,3 %", label: "Cycle13 R3 v6 PE" },
  },
  {
    id: "sample_wasm",
    url: "/8zC/samples/sample_module.wasm",
    filename: "sample_module.wasm",
    badge: "WASM",
    chip_sl: "WASM (121 KB)",
    chip_en: "WASM (121 KB)",
    sha256: "b3b38d82ff4c4cdf9c8bb4490ebcd236d0966c41ce80688afed729979383ea6d",
    title_sl: "sample_module.wasm (WebAssembly · WASM_SPLIT_7)",
    title_en: "sample_module.wasm (WebAssembly · WASM_SPLIT_7)",
    raw_B: 120920,
    zip:  { direct: 51714, best: 44409, pct: "-14,1 %", label: "Cycle13 R3 v6 WASM" },
    sz7z: { direct: 44536, best: 42578, pct: "-4,4 %",  label: "Cycle13 R3 v6 WASM" },
  },
  {
    id: "sample_csv",
    url: "/8zC/samples/sample_telemetry.csv",
    filename: "sample_telemetry.csv",
    badge: "CSV",
    chip_sl: "CSV (447 KB → 471 B!)",
    chip_en: "CSV (447 KB → 471 B!)",
    sha256: "c85e819abaa6d09227e81a9cba186578fde33cb548668340d33e4874d0475fbf",
    title_sl: "sample_telemetry.csv (TABULAR_V3 · periodična napoved + rstrip0)",
    title_en: "sample_telemetry.csv (TABULAR_V3 · seasonal predictor + rstrip0)",
    raw_B: 446980,
    zip:  { direct: 49944, best: 471,   pct: "-99,1 %", label: "Cycle13 R3 v6 Tabular" },
    sz7z: { direct: 22942, best: 428,   pct: "-98,1 %", label: "Cycle13 R3 v6 Tabular" },
  },
  {
    id: "sample_jsonl",
    url: "/8zC/samples/sample_events.jsonl",
    filename: "sample_events.jsonl",
    badge: "JSONL",
    chip_sl: "JSONL (610 KB → 498 B!)",
    chip_en: "JSONL (610 KB → 498 B!)",
    sha256: "0e81136425d74fa21d47612a2bf17fe34fb6900ce819e80d0a25bd4d6bd6bb85",
    title_sl: "sample_events.jsonl (Strukturirani dnevniki JSONL · TABULAR_V3)",
    title_en: "sample_events.jsonl (Structured JSONL logs · TABULAR_V3)",
    raw_B: 610000,
    zip:  { direct: 28016, best: 498,   pct: "-98,2 %", label: "Cycle13 R3 v6 JSONL" },
    sz7z: { direct: 7754,  best: 456,   pct: "-94,1 %", label: "Cycle13 R3 v6 JSONL" },
  },
  {
    id: "sample_wav",
    url: "/8zC/samples/sample_stereo_pcm16.wav",
    filename: "sample_stereo_pcm16.wav",
    badge: "WAV",
    chip_sl: "WAV PCM16 (32 KB → 2,6 KB!)",
    chip_en: "WAV PCM16 (32 KB → 2.6 KB!)",
    sha256: "34272b7c3e240f31802a9f54290bc752c5648d45e64bc7aeb857f2590e29344b",
    title_sl: "sample_stereo_pcm16.wav (Stereo 16-bit PCM zvok · WAV_V2 LPC-12 + uvarint)",
    title_en: "sample_stereo_pcm16.wav (Stereo 16-bit PCM audio · WAV_V2 LPC-12 + uvarint)",
    raw_B: 32044,
    zip:  { direct: 26932, best: 2669,  pct: "-90,1 %", label: "Cycle13 R3 v6 WAV_V2" },
    sz7z: { direct: 21233, best: 2563,  pct: "-87,9 %", label: "Cycle13 R3 v6 WAV_V2" },
  },
  {
    id: "sample_bmp",
    url: "/8zC/samples/sample_image.bmp",
    filename: "sample_image.bmp",
    badge: "BMP",
    chip_sl: "BMP 24-bit (590 KB → 1.373 B!)",
    chip_en: "BMP 24-bit (590 KB → 1,373 B!)",
    sha256: "e7ba9ed8f3e47113a3b68b004b208c1effc7743d13246f130d82d99eba78e9f5",
    title_sl: "sample_image.bmp (512×384 · IMAGE_V3 LinearGrad + DiagLag4 + rstrip0)",
    title_en: "sample_image.bmp (512×384 · IMAGE_V3 LinearGrad + DiagLag4 + rstrip0)",
    raw_B: 589878,
    zip:  { direct: 513897, best: 1373,  pct: "-99,73 %", label: "Cycle13 R3 v6 IMAGE_V3" },
    sz7z: { direct: 271080, best: 1229,  pct: "-99,55 %", label: "Cycle13 R3 v6 IMAGE_V3" },
  },
  {
    id: "sample_autodcc",
    url: "/8zC/samples/sample_autodcc_sensor.bin",
    filename: "sample_autodcc_sensor.bin",
    badge: "DCC",
    chip_sl: "Auto-DCC .bin (34 KB → 209 B!)",
    chip_en: "Auto-DCC .bin (34 KB → 209 B!)",
    sha256: "0813b93584595df23327f63b22f036768793207efdf02310fcbea9f78441d36c",
    title_sl: "sample_autodcc_sensor.bin (FMT_AUTO_DCC · samodejni korak + delta)",
    title_en: "sample_autodcc_sensor.bin (FMT_AUTO_DCC · auto-stride + delta)",
    raw_B: 33808,
    zip:  { direct: 12017, best: 209,   pct: "-98,3 %", label: "Cycle13 R3 v6 Auto-DCC" },
    sz7z: { direct: 6927,  best: 224,   pct: "-96,8 %", label: "Cycle13 R3 v6 Auto-DCC" },
  },
];

const ELF_BENCHMARK_SAMPLES = [
  {
    id: "00_data_endian",
    filename: "00_data_endian.elf",
    sha256: "7a08d5a9e1e9b2b3556c866df883e58ddbf1879fd7859a5e33845f6560476bcc",
    title_sl: "00_data_endian.elf (Haskell / GHC)",
    title_en: "00_data_endian.elf (Haskell / GHC)",
    raw_B: 80264,
    zip:  { direct: 15976, z8c_r3: 10484, z8c_v5: 10169, pct_v5: "-36,4 %" },
    sz7z: { direct: 13555, z8c_r3: 9525,  z8c_v5: 9389,  pct_v5: "-30,7 %" },
    paq:  { direct: 9001,  z8c: 6492,  pct: "-27,9 % (-3)" },
    cmix: null,
  },
  {
    id: "02_calf_so",
    filename: "02_calf_so.elf",
    sha256: "a931f96cf3904a6f88063b77483c5cbd95a35b8fd1e1547ae8056ccf05fd3244",
    title_sl: "02_calf_so.elf (C++ / GCC avdio vtičnik)",
    title_en: "02_calf_so.elf (C++ / GCC audio plugin)",
    raw_B: 1182672,
    zip:  { direct: 297204, z8c_r3: 207569, z8c_v5: 188435, pct_v5: "-36,6 %" },
    sz7z: { direct: 239015, z8c_r3: 174354, z8c_v5: 160003, pct_v5: "-33,1 %" },
    paq:  { direct: 145887, z8c: 123729, pct: "-15,2 % (-10LE)" },
    cmix: { direct: 145654, z8c: 111456, pct: "-23,5 % (R3+cmix)" },
  },
  {
    id: "03_yesod_form_so",
    filename: "03_yesod_form_so.elf",
    sha256: "f99dd3b0ba100ce989d703e54013005e3df08409076cbc03cd981d8fc61f50a1",
    title_sl: "03_yesod_form_so.elf (Haskell / GHC knjižnica)",
    title_en: "03_yesod_form_so.elf (Haskell / GHC library)",
    raw_B: 1472320,
    zip:  { direct: 283835, z8c_r3: 186015, z8c_v5: 171784, pct_v5: "-39,5 %" },
    sz7z: { direct: 210821, z8c_r3: 140758, z8c_v5: 132735, pct_v5: "-37,0 %" },
    paq:  { direct: 117163, z8c: 99514,  pct: "-15,1 % (-10LE)" },
    cmix: { direct: 114899, z8c: 98691,  pct: "-14,1 %" },
  },
  {
    id: "01_jwtui",
    filename: "01_jwtui.elf",
    sha256: "16721ac90c7bb4c756c24180186471dd6f7da37a85c41a963df4b0bd03eb0b3f",
    title_sl: "01_jwtui.elf (Rust / LLVM izvršljivi program)",
    title_en: "01_jwtui.elf (Rust / LLVM executable)",
    raw_B: 2726704,
    zip:  { direct: 1290629, z8c_r3: 1000231, z8c_v5: 961771, pct_v5: "-25,5 %" },
    sz7z: { direct: 1047223, z8c_r3: 779900,  z8c_v5: 743969, pct_v5: "-29,0 %" },
    paq:  { direct: 704961,  z8c: 522419,  pct: "-25,9 % (-10LE)" },
    cmix: { direct: 683352,  z8c: 501302,  pct: "-26,6 %" },
  },
  {
    id: "04_geany",
    filename: "04_geany.elf",
    sha256: "a1b028e26532d49ff660aa737e4ae0287abdd4ca46f32be92ef9b227bec806ec",
    title_sl: "04_geany.elf (C / C++ urejevalnik · 3,92 MB)",
    title_en: "04_geany.elf (C / C++ IDE executable · 3.92 MB)",
    raw_B: 3922032,
    zip:  { direct: 1733761, z8c_r3: 1495837, z8c_v5: 1406766, pct_v5: "-18,9 %" },
    sz7z: { direct: 1412165, z8c_r3: 1230998, z8c_v5: 1140037, pct_v5: "-19,3 %" },
    paq:  null,
    cmix: null,
  },
];

const translations = {
  "Rezultati 8zC": "8zC results",
  "Kodek 8zC": "8zC codec",
  "Stisnite datoteko (ELF64, Windows EXE/DLL, WebAssembly .wasm, CSV/TSV/JSONL, WAV, BMP/PPM ali strukturirano binarno datoteko Auto-DCC) ali iz arhiva 8zC obnovite izvirnik. Vse teče lokalno v vašem brskalniku (Rust + WebAssembly).":
    "Compress a file (ELF64, Windows EXE/DLL, WebAssembly .wasm, CSV/TSV/JSONL, WAV, BMP/PPM or structured binary via Auto-DCC) or restore the original from an 8zC archive. Everything runs locally in your browser (Rust + WebAssembly).",
  "Izberite postopek": "Choose an operation",
  "Stisni datoteko": "Compress file",
  "Obnovi izvirnik": "Restore original",
  "Vhodna datoteka (6 družin formatov)": "Input file (6 format families)",
  "Vhodni arhiv 8zC ZIP": "8zC ZIP input archive",
  "1-klik vzorci:": "1-click samples:",
  "Izberite poljubno datoteko": "Choose any file",
  "Izberite arhiv ZIP": "Choose a ZIP archive",
  "ali jo povlecite sem (ali kliknite vzorec zgoraj: ELF, DLL, WASM, CSV, JSONL, WAV, BMP, Auto-DCC)":
    "or drop it here (or click a sample chip above: ELF, DLL, WASM, CSV, JSONL, WAV, BMP, Auto-DCC)",
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
  "Shrani izvirnik": "Save original",
  "Licence knjižnic": "Library licenses",
  "Izberite samo eno datoteko.": "Choose one file.",
  "Datoteka je prazna.": "The file is empty.",
  "Datoteka presega dovoljeno velikost.": "The file exceeds the size limit.",
  "Postopek je preklican.": "Operation cancelled.",
  "Arhiv je pripravljen za shranjevanje.": "Your archive is ready to save.",
  "Izvirna datoteka je pripravljena za shranjevanje.": "Your restored file is ready to save.",
  "Stiskanje poteka …": "Compressing …",
  "Obnova poteka …": "Restoring …",
  "Primerjava kompresij v brskalniku poteka …": "Running browser compression comparison …",
  "Opravila ni bilo mogoče dokončati. Preverite, ali so datoteke spletnega kodeka dostopne.":
    "The operation failed. Check that the codec files are available.",
  "Brskalnik ni mogel zagnati opravila. Odprite aplikacijo prek lokalnega spletnega strežnika.":
    "The browser could not start the operation.",
  "Primerjava kompresij (Čisti kodek proti 8zC)": "Compression comparison (Raw codec vs. 8zC)",
  "Živi večformatni preizkus v brskalniku (Rust + WebAssembly Cycle 13 R3 v6) in preverjene referenčne matrike s 100 % bitno točno obnovo SHA-256.":
    "Live multi-format browser benchmark (Rust + WebAssembly Cycle 13 R3 v6) and verified reference matrices with 100% byte-exact SHA-256 restoration.",
  "Živi izid v vašem brskalniku": "Live result in your browser",
  "Kodek / stopnja": "Codec / stage",
  "Surovo": "Raw",
  "Čisti kodek": "Direct codec",
  "8zC + kodek": "8zC + codec",
  "Prihranek": "Savings",
  "Cycle 13 R3 (v6) · 7 večformatnih vzorcev (PE64 · WASM · CSV · JSONL · WAV · BMP · Auto-DCC)":
    "Cycle 13 R3 (v6) · 7 multi-format samples (PE64 · WASM · CSV · JSONL · WAV · BMP · Auto-DCC)",
  "Vzorec in družina formata": "Sample and format family",
  "Čisti ZIP → 8zC v6 + ZIP": "Direct ZIP → 8zC v6 + ZIP",
  "Čisti 7z → 8zC v6 + 7z": "Direct 7z → 8zC v6 + 7z",
  "Živi preizkus": "Live test",
  "Preizkusi v živo →": "Test live →",
  "Cycle 13 R3 (v6) · Referenčna matrika 5 datotek ELF64 (.zip · .7z · .paq · .cmix)":
    "Cycle 13 R3 (v6) · Reference matrix of 5 ELF64 binaries (.zip · .7z · .paq · .cmix)",
  "Zaženi 00_data_endian.elf v živo →": "Run 00_data_endian.elf live →",
  "Vzorčni ELF (prevajalnik)": "Sample ELF (compiler)",
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

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const modes = byId("modes");
const fileInput = byId("file");
const choose = byId("choose");
const start = byId("start");
const cancel = byId("cancel");
const sampleChips = byId("sample-chips");
const compareBtn = byId("compare-btn");
const runSampleLiveBtn = byId("run-sample-live");
const statusLine = byId("status");
const download = byId("download");

let mode = "encode";
let selected = null;
let activeSampleId = null;
let worker = null;
let objectUrl = null;
let lastCompareData = null;

function inferBadge(name) {
  if (!name) return "8zC";
  const lower = name.toLowerCase();
  if (lower.endsWith(".elf") || lower.endsWith(".so")) return "ELF";
  if (lower.endsWith(".dll") || lower.endsWith(".exe")) return "PE64";
  if (lower.endsWith(".wasm")) return "WASM";
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return "CSV";
  if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) return "JSON";
  if (lower.endsWith(".wav")) return "WAV";
  if (lower.endsWith(".bmp") || lower.endsWith(".ppm")) return "BMP";
  if (lower.endsWith(".bin") || lower.endsWith(".dat")) return "DCC";
  if (lower.endsWith(".zip")) return "ZIP";
  return "8zC";
}

function renderSampleChips() {
  sampleChips.textContent = "";
  for (const s of QUICK_SAMPLES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-btn" + (activeSampleId === s.id ? " active" : "");
    btn.textContent = language === "en" ? s.chip_en : s.chip_sl;
    btn.disabled = Boolean(worker);
    btn.addEventListener("click", () => loadSampleById(s.id, false));
    sampleChips.appendChild(btn);
  }
}

function renderV4Matrix() {
  const tbody = byId("v4-matrix-body");
  tbody.textContent = "";
  for (const s of QUICK_SAMPLES.slice(1)) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = language === "en" ? s.title_en : s.title_sl;
    tr.appendChild(th);

    const tdRaw = document.createElement("td");
    tdRaw.textContent = fmtB(s.raw_B);
    tr.appendChild(tdRaw);

    const tdZip = document.createElement("td");
    tdZip.innerHTML = `<span>${fmtB(s.zip.direct)}</span> → <strong>${fmtB(s.zip.best)}</strong> <span class="badge">${s.zip.pct}</span>`;
    tr.appendChild(tdZip);

    const td7z = document.createElement("td");
    td7z.innerHTML = `<span>${fmtB(s.sz7z.direct)}</span> → <strong>${fmtB(s.sz7z.best)}</strong> <span class="badge">${s.sz7z.pct}</span>`;
    tr.appendChild(td7z);

    const tdTry = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-btn mini-btn";
    btn.textContent = t("Preizkusi v živo →");
    btn.disabled = Boolean(worker);
    btn.addEventListener("click", () => loadSampleById(s.id, true));
    tdTry.appendChild(btn);
    tr.appendChild(tdTry);

    tbody.appendChild(tr);
  }
}

function renderElfMatrix() {
  const tbody = byId("matrix-body");
  tbody.textContent = "";
  for (const s of ELF_BENCHMARK_SAMPLES) {
    const tr = document.createElement("tr");
    const tdTitle = document.createElement("th");
    tdTitle.scope = "row";
    tdTitle.textContent = language === "en" ? s.title_en : s.title_sl;
    tr.appendChild(tdTitle);

    const tdRaw = document.createElement("td");
    tdRaw.textContent = fmtB(s.raw_B);
    tr.appendChild(tdRaw);

    const tdZip = document.createElement("td");
    tdZip.innerHTML = `<span>${fmtB(s.zip.direct)}</span> → <strong>${fmtB(s.zip.z8c_v5)}</strong> <span class="badge">${s.zip.pct_v5}</span>`;
    tr.appendChild(tdZip);

    const td7z = document.createElement("td");
    td7z.innerHTML = `<span>${fmtB(s.sz7z.direct)}</span> → <strong>${fmtB(s.sz7z.z8c_v5)}</strong> <span class="badge">${s.sz7z.pct_v5}</span>`;
    tr.appendChild(td7z);

    const tdPaq = document.createElement("td");
    if (s.paq) {
      tdPaq.innerHTML = `<span>${fmtB(s.paq.direct)}</span> → <strong>${fmtB(s.paq.z8c)}</strong> <span class="badge">${s.paq.pct}</span>`;
    } else {
      tdPaq.textContent = "—";
    }
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

  const matchedQuick = QUICK_SAMPLES.find(
    (s) => (data.inputDigest && s.sha256 === data.inputDigest) || (selected && s.filename === selected.name && s.raw_B === data.inputBytes)
  );
  const matchedElf = ELF_BENCHMARK_SAMPLES.find(
    (s) => (data.inputDigest && s.sha256 === data.inputDigest) || (selected && s.filename === selected.name && s.raw_B === data.inputBytes)
  );

  byId("live-compare-title").textContent =
    (language === "en" ? "Live result in your browser: " : "Živi izid v vašem brskalniku: ") +
    (selected ? selected.name : "00_data_endian.elf");

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

  const baseZip = matchedQuick ? matchedQuick.zip.direct : matchedElf ? matchedElf.zip.direct : data.browserZipBytes;
  addRow(
    language === "en"
      ? "Browser WASM: Direct ZIP vs. 8zC Cycle 13 R3 v6 (live)"
      : "Brskalnik WASM: Čisti ZIP proti 8zC Cycle 13 R3 v6 (v živo)",
    data.inputBytes,
    baseZip,
    data.z8cZipBytes,
    `${data.encodeMs} ms enc / ${data.decodeMs} ms dec`
  );

  if (matchedQuick) {
    addRow(
      language === "en" ? "8zC v6 + 7-Zip Deflate (-mx=9)" : "8zC v6 + 7-Zip Deflate (-mx=9)",
      matchedQuick.raw_B,
      matchedQuick.zip.direct,
      matchedQuick.zip.best,
      matchedQuick.zip.label
    );
    addRow(
      language === "en" ? "8zC v6 + 7-Zip LZMA (-mx=9)" : "8zC v6 + 7-Zip LZMA (-mx=9)",
      matchedQuick.raw_B,
      matchedQuick.sz7z.direct,
      matchedQuick.sz7z.best,
      matchedQuick.sz7z.label
    );
  }
  if (matchedElf && matchedElf.paq) {
    addRow(
      "8zC + PAQ8PX v217",
      matchedElf.raw_B,
      matchedElf.paq.direct,
      matchedElf.paq.z8c,
      matchedElf.paq.pct
    );
    if (matchedElf.cmix) {
      addRow(
        "8zC + cmix v21",
        matchedElf.raw_B,
        matchedElf.cmix.direct,
        matchedElf.cmix.z8c,
        matchedElf.cmix.pct
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
    "Stisnite datoteko (ELF64, Windows EXE/DLL, WebAssembly .wasm, CSV/TSV/JSONL, WAV, BMP/PPM ali strukturirano binarno datoteko Auto-DCC) ali iz arhiva 8zC obnovite izvirnik. Vse teče lokalno v vašem brskalniku (Rust + WebAssembly)."
  );
  document.querySelector("#modes legend").textContent = t("Izberite postopek");
  const modeSpans = document.querySelectorAll("#modes label span");
  if (modeSpans[0]) modeSpans[0].textContent = t("Stisni datoteko");
  if (modeSpans[1]) modeSpans[1].textContent = t("Obnovi izvirnik");

  const encoding = mode === "encode";
  byId("input-heading").textContent = t(encoding ? "Vhodna datoteka (6 družin formatov)" : "Vhodni arhiv 8zC ZIP");
  byId("samples-caption").textContent = t("1-klik vzorci:");
  byId("limits").textContent = t(encoding ? "1 datoteka · do 16 MiB" : "1 arhiv · do 16 MiB + 1 KiB");
  byId("compare-label").textContent = t("Primerjaj kompresije");
  byId("start-label").textContent = t(encoding ? "Stisni" : "Obnovi");
  cancel.textContent = t("Prekliči");
  byId("licenses-link").textContent = t("Licence knjižnic");

  byId("compare-heading").textContent = t("Primerjava kompresij (Čisti kodek proti 8zC)");
  byId("compare-sub").textContent = t(
    "Živi večformatni preizkus v brskalniku (Rust + WebAssembly Cycle 13 R3 v6) in preverjene referenčne matrike s 100 % bitno točno obnovo SHA-256."
  );
  byId("th-live-codec").textContent = t("Kodek / stopnja");
  byId("th-live-raw").textContent = t("Surovo");
  byId("th-live-base").textContent = t("Čisti kodek");
  byId("th-live-8zc").textContent = t("8zC + kodek");
  byId("th-live-save").textContent = t("Prihranek");

  byId("v4-matrix-title").textContent = t(
    "Cycle 13 R3 (v6) · 7 večformatnih vzorcev (PE64 · WASM · CSV · JSONL · WAV · BMP · Auto-DCC)"
  );
  byId("th-v4-file").textContent = t("Vzorec in družina formata");
  byId("th-v4-raw").textContent = t("Surovo");
  byId("th-v4-zip").textContent = t("Čisti ZIP → 8zC v6 + ZIP");
  byId("th-v4-7z").textContent = t("Čisti 7z → 8zC v6 + 7z");
  byId("th-v4-try").textContent = t("Živi preizkus");

  byId("matrix-title").textContent = t(
    "Cycle 13 R3 (v6) · Referenčna matrika 5 datotek ELF64 (.zip · .7z · .paq · .cmix)"
  );
  runSampleLiveBtn.textContent = t("Zaženi 00_data_endian.elf v živo →");
  byId("th-m-file").textContent = t("Vzorčni ELF (prevajalnik)");
  byId("th-m-raw").textContent = t("Surovo");
  byId("th-m-zip").textContent = t("Čisti ZIP → 8zC v6 + ZIP");
  byId("th-m-7z").textContent = t("Čisti 7z → 8zC v6 + 7z");
  byId("th-m-paq").textContent = t("Čisti PAQ8PX → 8zC + PAQ");
  byId("th-m-cmix").textContent = t("Čisti cmix v21 → 8zC + cmix");

  if (!selected) {
    byId("filename").textContent = t(encoding ? "Izberite poljubno datoteko" : "Izberite arhiv ZIP");
    byId("filehint").textContent = t(
      encoding
        ? "ali jo povlecite sem (ali kliknite vzorec zgoraj: ELF, DLL, WASM, CSV, JSONL, WAV, BMP, Auto-DCC)"
        : "ali ga povlecite sem"
    );
  } else {
    byId("filehint").textContent =
      selected.size.toLocaleString(language === "en" ? "en-US" : "sl-SI") +
      (language === "en" ? " B · Click to replace" : " B · Kliknite za zamenjavo");
  }
  if (!byId("result").hidden) {
    byId("result-heading").textContent = t(encoding ? "Arhiv 8zC ZIP" : "Obnovljena datoteka");
    byId("save-label").textContent = t(encoding ? "Shrani ZIP" : "Shrani izvirnik");
  }
  renderSampleChips();
  renderV4Matrix();
  renderElfMatrix();
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

function selectFile(file, sampleId = null) {
  const encoding = mode === "encode";
  selected = file;
  activeSampleId = sampleId;
  start.disabled = !file;
  clearResult();
  status("");
  byId("file-icon").textContent = file ? inferBadge(file.name) : encoding ? "8zC" : "ZIP";
  byId("filename").textContent = file
    ? file.name
    : t(encoding ? "Izberite poljubno datoteko" : "Izberite arhiv ZIP");
  byId("filehint").textContent = file
    ? file.size.toLocaleString(language === "en" ? "en-US" : "sl-SI") +
      (language === "en" ? " B · Click to replace" : " B · Kliknite za zamenjavo")
    : t(
        encoding
          ? "ali jo povlecite sem (ali kliknite vzorec zgoraj: ELF, DLL, WASM, CSV, JSONL, WAV, BMP, Auto-DCC)"
          : "ali ga povlecite sem"
      );
  renderSampleChips();
}

function acceptFiles(files) {
  if (!files.length || worker) return;
  const file = files[0];
  const maxBytes = MAX_INPUT_BYTES + (mode === "decode" ? 1024 : 0);
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
  selectFile(file, null);
  status((language === "en" ? "Selected file: " : "Izbrana datoteka: ") + file.name);
}

function switchMode() {
  mode = modes.querySelector("input:checked").value;
  const encoding = mode === "encode";
  fileInput.accept = encoding ? "" : ".zip,application/zip";
  fileInput.value = "";
  sampleChips.hidden = !encoding;
  byId("samples-caption").hidden = !encoding;
  compareBtn.hidden = !encoding;
  byId("input-heading").textContent = t(encoding ? "Vhodna datoteka (6 družin formatov)" : "Vhodni arhiv 8zC ZIP");
  byId("file-icon").textContent = encoding ? "8zC" : "ZIP";
  byId("limits").textContent = t(encoding ? "1 datoteka · do 16 MiB" : "1 arhiv · do 16 MiB + 1 KiB");
  byId("start-label").textContent = t(encoding ? "Stisni" : "Obnovi");
  selectFile(null);
}

function busy(active) {
  modes.disabled = active;
  choose.disabled = active;
  compareBtn.disabled = active;
  runSampleLiveBtn.disabled = active;
  start.hidden = active;
  cancel.hidden = !active;
  renderSampleChips();
  renderV4Matrix();
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
  let name;
  if (encoding) {
    name = (selected ? selected.name : "archive") + ".8zc.zip";
  } else {
    const rawName = selected ? selected.name : "restored.bin";
    if (/\.8zc\.zip$/i.test(rawName)) {
      name = rawName.replace(/\.8zc\.zip$/i, "");
    } else if (/\.zip$/i.test(rawName)) {
      const stripped = rawName.replace(/\.zip$/i, "");
      name = stripped.includes(".") ? stripped : stripped + ".bin";
    } else {
      name = rawName + ".restored";
    }
  }
  objectUrl = URL.createObjectURL(
    new Blob([bytes], {
      type: encoding ? "application/zip" : "application/octet-stream",
    })
  );
  download.href = objectUrl;
  download.download = name;
  byId("result-heading").textContent = t(encoding ? "Arhiv 8zC ZIP" : "Obnovljena datoteka");
  byId("save-label").textContent = t(encoding ? "Shrani ZIP" : "Shrani izvirnik");
  byId("output-name").textContent =
    name + " · " + bytes.byteLength.toLocaleString(language === "en" ? "en-US" : "sl-SI") + " B";
  byId("digest").textContent = digest || "";
  byId("digest-row").hidden = !digest;
  byId("result").hidden = false;
  status(
    t(encoding ? "Arhiv je pripravljen za shranjevanje." : "Izvirna datoteka je pripravljena za shranjevanje.")
  );
}

async function loadSampleById(sampleId, autoCompare = false) {
  if (worker) return;
  const s = QUICK_SAMPLES.find((x) => x.id === sampleId) || QUICK_SAMPLES[0];
  if (mode !== "encode") {
    modes.querySelector('input[value="encode"]').checked = true;
    switchMode();
  }
  try {
    status((language === "en" ? "Loading sample " : "Nalagam vzorec ") + s.filename + " …");
    const resp = await fetch(s.url);
    if (!resp.ok) throw new Error((language === "en" ? "Could not load " : "Ni mogoče naložiti ") + s.filename);
    const blob = await resp.blob();
    const file = new File([blob], s.filename, { type: "application/octet-stream" });
    selectFile(file, s.id);
    status((language === "en" ? "Loaded sample: " : "Naložen vzorec: ") + file.name);
    if (autoCompare) {
      runWorker("compare");
    }
  } catch (err) {
    status(err.message || "Error loading sample", true);
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
      status(
        t("Opravila ni bilo mogoče dokončati. Preverite, ali so datoteke spletnega kodeka dostopne."),
        true
      );
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
    status(
      t("Brskalnik ni mogel zagnati opravila. Odprite aplikacijo prek lokalnega spletnega strežnika."),
      true
    );
    start.focus();
  }
}

async function handleCompareClick() {
  if (worker) return;
  byId("compare-panel").hidden = false;
  if (!selected) {
    await loadSampleById("00_data_endian", true);
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
runSampleLiveBtn.addEventListener("click", () => loadSampleById("00_data_endian", true));
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
