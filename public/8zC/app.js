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
    title_sl: "00_data_endian.elf (Linux ELF64 · Haskell · BCJ_V9_SPLIT_LRU_STACK)",
    title_en: "00_data_endian.elf (Linux ELF64 · Haskell · BCJ_V9_SPLIT_LRU_STACK)",
    raw_B: 80264,
    zip:  { direct: 15976, best: 9915,  pct: "-37,9 %", label: "Cycle13 R6 v9 ELF" },
    sz7z: { direct: 13555, best: 9281,  pct: "-31,5 %", label: "Cycle13 R6 v9 ELF" },
    nat:  { bytes: 8933,   pct7z: "-34,1 %" },
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
    title_sl: "sample_pe64_win32.dll (Windows PE32+ x64 · BCJ_V9_STACK_SPLIT + PE_RELOC_V2 + T4_V9)",
    title_en: "sample_pe64_win32.dll (Windows PE32+ x64 · BCJ_V9_STACK_SPLIT + PE_RELOC_V2 + T4_V9)",
    raw_B: 234896,
    zip:  { direct: 87017, best: 75273, pct: "-13,5 %", label: "Cycle13 R6 v9 PE" },
    sz7z: { direct: 77337, best: 69386, pct: "-10,3 %", label: "Cycle13 R6 v9 PE" },
    nat:  { bytes: 67274,  pct7z: "-13,0 % vs 7z" },
  },
  {
    id: "sample_wasm",
    url: "/8zC/samples/sample_module.wasm",
    filename: "sample_module.wasm",
    badge: "WASM",
    chip_sl: "WASM (121 KB)",
    chip_en: "WASM (121 KB)",
    sha256: "b3b38d82ff4c4cdf9c8bb4490ebcd236d0966c41ce80688afed729979383ea6d",
    title_sl: "sample_module.wasm (WebAssembly · FMT_WASM_V10 14-pasovni razcep + T4_V9)",
    title_en: "sample_module.wasm (WebAssembly · FMT_WASM_V10 14-lane split + T4_V9)",
    raw_B: 120920,
    zip:  { direct: 51714, best: 43659, pct: "-15,6 %", label: "Cycle13 R6 v9 WASM" },
    sz7z: { direct: 44536, best: 42300, pct: "-5,0 %",  label: "Cycle13 R6 v9 WASM" },
    nat:  { bytes: 37683,  pct7z: "-15,4 % vs 7z" },
  },
  {
    id: "sample_csv",
    url: "/8zC/samples/sample_telemetry.csv",
    filename: "sample_telemetry.csv",
    badge: "CSV",
    chip_sl: "CSV (447 KB)",
    chip_en: "CSV (447 KB)",
    sha256: "c85e819abaa6d09227e81a9cba186578fde33cb548668340d33e4874d0475fbf",
    title_sl: "sample_telemetry.csv (TABULAR_V6 · 2-stopenjska sezonska napoved + HEX_PACK_DEDUP + BASENAME)",
    title_en: "sample_telemetry.csv (TABULAR_V6 · 2-stage seasonal predictor + HEX_PACK_DEDUP + BASENAME)",
    raw_B: 446980,
    zip:  { direct: 49944, best: 437,   pct: "-99,13 %", label: "Cycle13 R6 v9 Tabular" },
    sz7z: { direct: 22942, best: 392,   pct: "-98,29 %", label: "Cycle13 R6 v9 Tabular" },
    nat:  { bytes: 270,    pct7z: "-98,82 % vs 7z" },
  },
  {
    id: "sample_jsonl",
    url: "/8zC/samples/sample_events.jsonl",
    filename: "sample_events.jsonl",
    badge: "JSONL",
    chip_sl: "JSONL (610 KB)",
    chip_en: "JSONL (610 KB)",
    sha256: "0e81136425d74fa21d47612a2bf17fe34fb6900ce819e80d0a25bd4d6bd6bb85",
    title_sl: "sample_events.jsonl (Strukturirani dnevniki JSONL · TABULAR_V6)",
    title_en: "sample_events.jsonl (Structured JSONL logs · TABULAR_V6)",
    raw_B: 610000,
    zip:  { direct: 28016, best: 495,   pct: "-98,23 %", label: "Cycle13 R6 v9 JSONL" },
    sz7z: { direct: 7754,  best: 448,   pct: "-94,22 %", label: "Cycle13 R6 v9 JSONL" },
    nat:  { bytes: 321,    pct7z: "-95,86 % vs 7z" },
  },
  {
    id: "sample_wav",
    url: "/8zC/samples/sample_stereo_pcm16.wav",
    filename: "sample_stereo_pcm16.wav",
    badge: "WAV",
    chip_sl: "WAV PCM16 (32 KB)",
    chip_en: "WAV PCM16 (32 KB)",
    sha256: "34272b7c3e240f31802a9f54290bc752c5648d45e64bc7aeb857f2590e29344b",
    title_sl: "sample_stereo_pcm16.wav (Stereo 16-bit PCM zvok · WAV_V4 4-načinski stereo + LPC-32)",
    title_en: "sample_stereo_pcm16.wav (Stereo 16-bit PCM audio · WAV_V4 4-mode stereo + LPC-32)",
    raw_B: 32044,
    zip:  { direct: 26932, best: 1964,  pct: "-92,7 %", label: "Cycle13 R6 v9 WAV_V4" },
    sz7z: { direct: 21233, best: 1884,  pct: "-91,1 %", label: "Cycle13 R6 v9 WAV_V4" },
    nat:  { bytes: 1675,   pct7z: "-92,1 % vs 7z" },
  },
  {
    id: "sample_bmp",
    url: "/8zC/samples/sample_image.bmp",
    filename: "sample_image.bmp",
    badge: "BMP",
    chip_sl: "BMP 24-bit (590 KB)",
    chip_en: "BMP 24-bit (590 KB)",
    sha256: "e7ba9ed8f3e47113a3b68b004b208c1effc7743d13246f130d82d99eba78e9f5",
    title_sl: "sample_image.bmp (512×384 · IMAGE_V4 Raw/YCoCg-R per-channel + DiagLag4 + rstrip0)",
    title_en: "sample_image.bmp (512×384 · IMAGE_V4 Raw/YCoCg-R per-channel + DiagLag4 + rstrip0)",
    raw_B: 589878,
    zip:  { direct: 513897, best: 503,   pct: "-99,90 %", label: "Cycle13 R6 v9 IMAGE_V4" },
    sz7z: { direct: 271080, best: 487,   pct: "-99,82 %", label: "Cycle13 R6 v9 IMAGE_V4" },
    nat:  { bytes: 349,    pct7z: "-99,87 % vs 7z" },
  },
  {
    id: "sample_autodcc",
    url: "/8zC/samples/sample_autodcc_sensor.bin",
    filename: "sample_autodcc_sensor.bin",
    badge: "DCC",
    chip_sl: "Auto-DCC .bin (34 KB)",
    chip_en: "Auto-DCC .bin (34 KB)",
    sha256: "0813b93584595df23327f63b22f036768793207efdf02310fcbea9f78441d36c",
    title_sl: "sample_autodcc_sensor.bin (FMT_AUTO_DCC · samodejni korak + delta O1/O2)",
    title_en: "sample_autodcc_sensor.bin (FMT_AUTO_DCC · auto-stride + delta O1/O2)",
    raw_B: 33808,
    zip:  { direct: 12017, best: 246,   pct: "-98,0 %", label: "Cycle13 R6 v9 Auto-DCC" },
    sz7z: { direct: 6927,  best: 224,   pct: "-96,8 %", label: "Cycle13 R6 v9 Auto-DCC" },
    nat:  { bytes: 81,     pct7z: "-98,8 % vs 7z" },
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
    zip:  { direct: 15976, z8c_r3: 10484, z8c_v9: 9915,  pct_v9: "-37,9 %" },
    sz7z: { direct: 13555, z8c_r3: 9525,  z8c_v9: 9281,  pct_v9: "-31,5 %" },
    nat:  { bytes: 8933,   pct7z: "-34,1 % vs 7z" },
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
    zip:  { direct: 297204, z8c_r3: 207569, z8c_v9: 184690, pct_v9: "-37,9 %" },
    sz7z: { direct: 239015, z8c_r3: 174354, z8c_v9: 158990, pct_v9: "-33,5 %" },
    nat:  null,
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
    zip:  { direct: 283835, z8c_r3: 186015, z8c_v9: 158107, pct_v9: "-44,3 %" },
    sz7z: { direct: 210821, z8c_r3: 140758, z8c_v9: 131135, pct_v9: "-37,8 %" },
    nat:  { bytes: 124998, pct7z: "-40,7 % vs 7z" },
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
    zip:  { direct: 1290629, z8c_r3: 1000231, z8c_v9: 937814, pct_v9: "-27,3 %" },
    sz7z: { direct: 1047223, z8c_r3: 779900,  z8c_v9: 743482, pct_v9: "-29,0 %" },
    nat:  { bytes: 714117, pct7z: "-31,8 % vs 7z" },
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
    zip:  { direct: 1733761, z8c_r3: 1495837, z8c_v9: 1374082, pct_v9: "-20,7 %" },
    sz7z: { direct: 1412165, z8c_r3: 1230998, z8c_v9: 1140037, pct_v9: "-19,3 %" },
    nat:  null,
    paq:  null,
    cmix: null,
  },
];

const translations = {
  "Ideje, raziskovalne povezave in arhitektura · Bojan Dobrečevič (BD). Skupni razvoj in preverjanje · BD × AI Lab.":
    "Ideas, research connections and architecture · Bojan Dobrečevič (BD). Collaborative development and verification · BD × AI Lab.",
  "Izvor in celotna zgodba BD × AI Lab": "Origin and full story of BD × AI Lab",
  "Prva vrstica meri trenutno datoteko v brskalniku; velikost neposrednega ZIP je ocenjena iz brskalniškega Deflate in ovojnice ZIP. Druge vrstice so zabeležene meritve zunanjih kodekov za isti SHA-256. Referenčni matriki spodaj prikazujeta te zunanje meritve.":
    "The first row measures the current file in your browser; the direct ZIP size is estimated from browser Deflate plus a ZIP wrapper. Other rows are recorded external-codec measurements for the same SHA-256. The reference matrices below show those external measurements.",
  "Rezultati 8zC": "8zC results",
  "Kodek 8zC": "8zC codec",
  "Stisnite eno ali več datotek hkrati v naš 100 % suvereni večravninski format .8zc (8ZCN\\x05 z vzvratnim branjem v1..v4, dolžino in CRC-32, brez zunanjih knjižnic, 33-datotečni korpus 1,854 MB · 14/33 proti paq8px -8) ali v .8zc.zip ter samodejno obnovite izvirnike. Vse teče 100 % lokalno v vašem brskalniku (Rust + WebAssembly).":
    "Compress one or multiple files at once into our 100% sovereign multi-plane .8zc format (8ZCN\\x05 backward-compatible with v1..v4, length and CRC-32, zero external libraries, 33-file corpus at 1.854 MB · 14/33 wins/ties vs. paq8px -8) or .8zc.zip, and automatically restore originals. Everything runs 100% locally in your browser (Rust + WebAssembly).",
  "Izberite postopek": "Choose an operation",
  "Format izhoda": "Output format",
  "Format .8zc (suveren)": "Format .8zc (sovereign)",
  "Format .8zc.zip": "Format .8zc.zip",
  "Stopnja stiskanja .8zc": ".8zc compression level",
  "Ultra (v1.4.1 <1,855 MB)": "Ultra (v1.4.1 <1.855 MB)",
  "Max (v1.5 Optimal)": "Max (v1.5 Optimal)",
  "Hitro (Fast)": "Fast (Hitro)",
  "Stisni datoteke": "Compress files",
  "Obnovi izvirnike": "Restore originals",
  "Vhodne datoteke (6 družin formatov)": "Input files (6 format families)",
  "Vhodni arhivi .8zc / 8zC ZIP": ".8zc / 8zC ZIP input archives",
  "1-klik vzorci:": "1-click samples:",
  "Izberite eno ali več datotek": "Choose one or more files",
  "Izberite enega ali več arhivov .8zc / ZIP": "Choose one or more .8zc / ZIP archives",
  "ali jih povlecite sem (lahko tudi mešano: navadne datoteke ter arhive *.8zc in *.8zc.zip hkrati!)":
    "or drop them here (you can even drop mixed raw files with *.8zc and *.8zc.zip archives together!)",
  "ali jih povlecite sem": "or drop them here",
  "1–100 datotek · do 256 MiB / datoteko (1 GiB skupaj)": "1–100 files · up to 256 MiB / file (1 GiB batch)",
  "1–100 arhivov · do 256 MiB / arhiv (1 GiB skupaj)": "1–100 archives · up to 256 MiB / archive (1 GiB batch)",
  "Primerjaj kompresije": "Compare compressions",
  "Stisni": "Compress",
  "Stisni vse": "Compress all",
  "Obnovi": "Restore",
  "Obnovi vse": "Restore all",
  "Obdelaj vse": "Process all",
  "Prekliči": "Cancel",
  "Obnovljena datoteka": "Restored file",
  "Arhiv 8zC (.8zc)": "8zC Sovereign Archive (.8zc)",
  "Arhiv 8zC ZIP": "8zC ZIP archive",
  "Shrani .8zc": "Save .8zc",
  "Shrani ZIP": "Save ZIP",
  "Shrani izvirnik": "Save original",
  "Shrani vse (.zip)": "Save all (.zip)",
  "Paketna obdelava zaključena": "Batch processing complete",
  "Datoteka": "File",
  "Postopek": "Operation",
  "Vhod": "Input",
  "Čisti ZIP": "Direct ZIP",
  "Izhod 8zC": "8zC Output",
  "Prihranek / SHA-256": "Savings / SHA-256",
  "Prenos": "Download",
  "Licence knjižnic": "Library licenses",
  "Izberite največ 100 datotek hkrati.": "Choose up to 100 files at once.",
  "Ena od izbranih datotek je prazna.": "One of the selected files is empty.",
  "Datoteka presega dovoljeno velikost (256 MiB).": "A file exceeds the 256 MiB limit.",
  "Skupna velikost paketa presega 1 GiB.": "Total batch size exceeds 1 GiB.",
  "Postopek je preklican.": "Operation cancelled.",
  "Arhiv je pripravljen za shranjevanje.": "Your archive is ready to save.",
  "Izvirna datoteka je pripravljena za shranjevanje.": "Your restored file is ready to save.",
  "Paketna obdelava je zaključena — posamezne datoteke ali skupni ZIP so pripravljeni za prenos.":
    "Batch complete — individual files or combined ZIP are ready to download.",
  "Stiskanje poteka …": "Compressing …",
  "Obnova poteka …": "Restoring …",
  "Primerjava kompresij v brskalniku poteka …": "Running browser compression comparison …",
  "Opravila ni bilo mogoče dokončati. Preverite, ali so datoteke spletnega kodeka dostopne.":
    "The operation failed. Check that the codec files are available.",
  "Brskalnik ni mogel zagnati opravila. Odprite aplikacijo prek lokalnega spletnega strežnika.":
    "The browser could not start the operation.",
  "Primerjava kompresij (Čisti kodek proti 8zC)": "Compression comparison (Raw codec vs. 8zC)",
  "Živi večformatni preizkus v brskalniku (Rust + WebAssembly Cycle 13 R6 v9) in preverjene referenčne matrike s 100 % bitno točno obnovo SHA-256.":
    "Live multi-format browser benchmark (Rust + WebAssembly Cycle 13 R6 v9) and verified reference matrices with 100% byte-exact SHA-256 restoration.",
  "Živi izid v vašem brskalniku": "Live result in your browser",
  "Kodek / stopnja": "Codec / stage",
  "Surovo": "Raw",
  "Čisti kodek": "Direct codec",
  "8zC + kodek": "8zC + codec",
  "Prihranek": "Savings",
  "Cycle 13 R6 (v9) · 7 večformatnih vzorcev (PE64 · WASM · CSV · JSONL · WAV · BMP · Auto-DCC)":
    "Cycle 13 R6 (v9) · 7 multi-format samples (PE64 · WASM · CSV · JSONL · WAV · BMP · Auto-DCC)",
  "Vzorec in družina formata": "Sample and format family",
  "Čisti ZIP → 8zC v9 + ZIP": "Direct ZIP → 8zC v9 + ZIP",
  "Čisti 7z → 8zC v9 + 7z": "Direct 7z → 8zC v9 + 7z",
  "Suvereni .8zc (v1.4.1)": "Sovereign .8zc (v1.4.1)",
  "Živi preizkus": "Live test",
  "Preizkusi v živo →": "Test live →",
  "Cycle 13 R6 (v9) + v1.4.1 Native · Referenčna matrika 5 datotek ELF64 (.zip · .7z · .8zc · .paq · .cmix)":
    "Cycle 13 R6 (v9) + v1.4.1 Native · Reference matrix of 5 ELF64 binaries (.zip · .7z · .8zc · .paq · .cmix)",
  "Zaženi 00_data_endian.elf v živo →": "Run 00_data_endian.elf live →",
  "Vzorčni ELF (prevajalnik)": "Sample ELF (compiler)",
  "Čisti PAQ8PX → 8zC + PAQ": "Direct PAQ8PX → 8zC + PAQ",
  "Čisti cmix v21 → 8zC + cmix": "Direct cmix v21 → 8zC + cmix",
};

function safeGetStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}

let language = safeGetStorage("8zc-language") === "en" ? "en" : "sl";
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

// 256 MiB per file, 1 GiB per multi-file batch, up to 100 files
const MAX_INPUT_BYTES = 256 * 1024 * 1024;
const MAX_BATCH_BYTES = 1024 * 1024 * 1024;
const MAX_BATCH_FILES = 100;

const modes = byId("modes");
const encFormats = byId("enc-formats");
const encLevels = byId("enc-levels");
const fileInput = byId("file");
const choose = byId("choose");
const start = byId("start");
const cancel = byId("cancel");
const sampleChips = byId("sample-chips");
const compareBtn = byId("compare-btn");
const runSampleLiveBtn = byId("run-sample-live");
const statusLine = byId("status");
const download = byId("download");
const downloadAll = byId("download-all");

let mode = "encode";
let encodeFormat = "native";
let encodeLevel = "ultra";
let selectedFiles = [];
let activeSampleId = null;
let worker = null;
let objectUrls = [];
let lastCompareData = null;

// --- Minimal zero-dependency IEEE 802.3 CRC-32 + STORE .zip builder for "Save all (.zip)" ---
const CRC32_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function buildStoreZip(entries) {
  const enc = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const usedNames = new Set();

  for (const e of entries) {
    let safeName = (e.name || "file.bin").replace(/[\\/]+/g, "_");
    if (usedNames.has(safeName)) {
      let idx = 2;
      const dot = safeName.indexOf(".");
      const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
      const ext = dot > 0 ? safeName.slice(dot) : "";
      while (usedNames.has(`${stem}_${idx}${ext}`)) idx++;
      safeName = `${stem}_${idx}${ext}`;
    }
    usedNames.add(safeName);

    const nameBytes = enc.encode(safeName);
    const data = e.bytes instanceof Uint8Array ? e.bytes : new Uint8Array(e.bytes);
    const crc = crc32(data);
    const len = data.byteLength;

    const lhdr = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(lhdr);
    lv.setUint32(0, 0x04034B50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true);      // STORE (already compressed or exact restored binary)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5778, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, len, true);
    lv.setUint32(22, len, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    new Uint8Array(lhdr, 30).set(nameBytes);

    const chdr = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(chdr);
    cv.setUint32(0, 0x02014B50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5778, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, len, true);
    cv.setUint32(24, len, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    new Uint8Array(chdr, 46).set(nameBytes);

    localParts.push(new Uint8Array(lhdr), data);
    centralParts.push(new Uint8Array(chdr));
    offset += lhdr.byteLength + len;
  }

  let centralLen = 0;
  for (const cp of centralParts) centralLen += cp.byteLength;
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054B50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralLen, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, new Uint8Array(eocd)], { type: "application/zip" });
}

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
  if (lower.endsWith(".8zc")) return "8ZC";
  if (lower.endsWith(".zip")) return "ZIP";
  return "8zC";
}

function outputFileNameFor(origName, op) {
  if (op === "encode_native") return origName + ".8zc";
  if (op === "encode") return origName + ".8zc.zip";
  if (/\.8zc\.zip$/i.test(origName)) return origName.replace(/\.8zc\.zip$/i, "");
  if (/\.8zc$/i.test(origName)) return origName.replace(/\.8zc$/i, "");
  if (/\.zip$/i.test(origName)) {
    const stripped = origName.replace(/\.zip$/i, "");
    return stripped.includes(".") ? stripped : stripped + ".bin";
  }
  return origName + ".restored";
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

    const tdNat = document.createElement("td");
    if (s.nat) {
      tdNat.innerHTML = `<strong>${fmtB(s.nat.bytes)}</strong> <span class="badge">${s.nat.pct7z}</span>`;
    } else {
      tdNat.textContent = "—";
    }
    tr.appendChild(tdNat);

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
    tdZip.innerHTML = `<span>${fmtB(s.zip.direct)}</span> → <strong>${fmtB(s.zip.z8c_v9)}</strong> <span class="badge">${s.zip.pct_v9}</span>`;
    tr.appendChild(tdZip);

    const td7z = document.createElement("td");
    td7z.innerHTML = `<span>${fmtB(s.sz7z.direct)}</span> → <strong>${fmtB(s.sz7z.z8c_v9)}</strong> <span class="badge">${s.sz7z.pct_v9}</span>`;
    tr.appendChild(td7z);

    const tdNat = document.createElement("td");
    if (s.nat) {
      tdNat.innerHTML = `<strong>${fmtB(s.nat.bytes)}</strong> <span class="badge">${s.nat.pct7z}</span>`;
    } else {
      tdNat.textContent = "—";
    }
    tr.appendChild(tdNat);

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
    (s) => s.sha256 === data.inputDigest && s.raw_B === data.inputBytes
  );
  const matchedElf = ELF_BENCHMARK_SAMPLES.find(
    (s) => s.sha256 === data.inputDigest && s.raw_B === data.inputBytes
  );

  const singleFile = selectedFiles[0];
  byId("live-compare-title").textContent =
    (language === "en" ? "Live result in your browser: " : "Živi izid v vašem brskalniku: ") +
    (singleFile ? singleFile.name : "00_data_endian.elf");

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

  if (typeof data.z8cNativeUltraBytes === "number") {
    addRow(
      language === "en"
        ? "Browser Deflate ZIP vs. Sovereign 8zC v1.4.1 Ultra (.8zc 8ZCN\\x05 · MIX7+B1B2+WAV_V6+WASM_V10+M03_PAL · live)"
        : "Brskalniški Deflate ZIP proti suverenemu 8zC v1.4.1 Ultra (.8zc 8ZCN\\x05 · MIX7+B1B2+WAV_V6+WASM_V10+M03_PAL · v živo)",
      data.inputBytes,
      data.browserZipBytes,
      data.z8cNativeUltraBytes,
      `${data.encodeNativeUltraMs} ms enc / ${data.decodeNativeMs} ms dec`
    );
  }
  if (typeof data.z8cNativeMaxBytes === "number") {
    addRow(
      language === "en"
        ? "Browser Deflate ZIP vs. Sovereign 8zC v1.5 Max (.8zc 8ZCN\\x02 · Optimal I4.2 Bt4-DP · live)"
        : "Brskalniški Deflate ZIP proti suverenemu 8zC v1.5 Max (.8zc 8ZCN\\x02 · Optimal I4.2 Bt4-DP · v živo)",
      data.inputBytes,
      data.browserZipBytes,
      data.z8cNativeMaxBytes,
      `${data.encodeNativeMaxMs} ms enc`
    );
  }
  if (typeof data.z8cNativeFastBytes === "number") {
    addRow(
      language === "en"
        ? "Browser Deflate ZIP vs. Sovereign 8zC Hitro (.8zc · Fast · live)"
        : "Brskalniški Deflate ZIP proti suverenemu 8zC Hitro (.8zc · v živo)",
      data.inputBytes,
      data.browserZipBytes,
      data.z8cNativeFastBytes,
      `${data.encodeNativeFastMs} ms enc`
    );
  }
  if (
    typeof data.z8cNativeBytes === "number" &&
    typeof data.z8cNativeUltraBytes !== "number" &&
    typeof data.z8cNativeMaxBytes !== "number" &&
    typeof data.z8cNativeFastBytes !== "number"
  ) {
    addRow(
      language === "en"
        ? "Browser Deflate ZIP vs. Sovereign 8zC v1.2.1 (.8zc · live)"
        : "Brskalniški Deflate ZIP proti suverenemu 8zC v1.2.1 (.8zc · v živo)",
      data.inputBytes,
      data.browserZipBytes,
      data.z8cNativeBytes,
      `${data.encodeNativeMs} ms enc / ${data.decodeNativeMs} ms dec`
    );
  }

  addRow(
    language === "en"
      ? "Browser Deflate ZIP vs. 8zC WASM v9 (live)"
      : "Brskalniški Deflate ZIP proti 8zC WASM v9 (v živo)",
    data.inputBytes,
    data.browserZipBytes,
    data.z8cZipBytes,
    `${data.encodeMs} ms enc / ${data.decodeMs} ms dec`
  );

  if (matchedQuick) {
    addRow(
      language === "en" ? "Recorded: 8zC v9 + 7-Zip Deflate (-mx=9)" : "Zabeleženo: 8zC v9 + 7-Zip Deflate (-mx=9)",
      matchedQuick.raw_B,
      matchedQuick.zip.direct,
      matchedQuick.zip.best,
      matchedQuick.zip.label
    );
    addRow(
      language === "en" ? "Recorded: 8zC v9 + 7-Zip LZMA (-mx=9)" : "Zabeleženo: 8zC v9 + 7-Zip LZMA (-mx=9)",
      matchedQuick.raw_B,
      matchedQuick.sz7z.direct,
      matchedQuick.sz7z.best,
      matchedQuick.sz7z.label
    );
  }
  if (matchedElf && matchedElf.paq) {
    addRow(
      language === "en" ? "Recorded: 8zC + PAQ8PX v217" : "Zabeleženo: 8zC + PAQ8PX v217",
      matchedElf.raw_B,
      matchedElf.paq.direct,
      matchedElf.paq.z8c,
      matchedElf.paq.pct
    );
    if (matchedElf.cmix) {
      addRow(
        language === "en" ? "Recorded: 8zC + cmix v21" : "Zabeleženo: 8zC + cmix v21",
        matchedElf.raw_B,
        matchedElf.cmix.direct,
        matchedElf.cmix.z8c,
        matchedElf.cmix.pct
      );
    }
  }

  const hashVerified = data.verified && data.sha256Verified && data.inputDigest === data.restoredDigest;
  byId("live-verify-line").textContent = !data.verified
    ? (language === "en" ? "Restoration verification failed." : "Preverba obnove ni uspela.")
    : hashVerified
      ? (language === "en"
          ? "✓ Byte-exact restoration verified in browser · Original & restored SHA-256: "
          : "✓ Bitno točna obnova preverjena v brskalniku · Izvirni in obnovljeni SHA-256: ") + data.restoredDigest
      : (language === "en"
          ? "✓ All restored bytes match the input · SHA-256 unavailable in this browser."
          : "✓ Vsi obnovljeni bajti se ujemajo z vhodom · SHA-256 v tem brskalniku ni na voljo.");
  box.hidden = false;
  byId("compare-panel").hidden = false;
}

function updateSelectionLabels() {
  const encoding = mode === "encode";
  if (!selectedFiles.length) {
    byId("file-icon").textContent = encoding ? (encodeFormat === "zip" ? "ZIP" : "8zC") : "ARC";
    byId("filename").textContent = t(
      encoding ? "Izberite eno ali več datotek" : "Izberite enega ali več arhivov .8zc / ZIP"
    );
    byId("filehint").textContent = t(
      encoding
        ? "ali jih povlecite sem (lahko tudi mešano: navadne datoteke ter arhive *.8zc in *.8zc.zip hkrati!)"
        : "ali jih povlecite sem"
    );
    byId("start-label").textContent = t(encoding ? "Stisni" : "Obnovi");
    compareBtn.hidden = !encoding;
    return;
  }

  if (selectedFiles.length === 1) {
    const f = selectedFiles[0];
    byId("file-icon").textContent = inferBadge(f.name);
    byId("filename").textContent = f.name;
    byId("filehint").textContent =
      f.size.toLocaleString(language === "en" ? "en-US" : "sl-SI") +
      (language === "en" ? " B · Click or drop to replace" : " B · Kliknite ali povlecite za zamenjavo");
    byId("start-label").textContent = t(encoding ? "Stisni" : "Obnovi");
    compareBtn.hidden = !encoding;
  } else {
    const totBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    const hasArc = selectedFiles.some((f) => /\.(8zc|8zc\.zip)$/i.test(f.name));
    const hasRaw = selectedFiles.some((f) => !/\.(8zc|8zc\.zip)$/i.test(f.name));
    byId("file-icon").textContent = `${selectedFiles.length}×`;
    byId("filename").textContent =
      language === "en"
        ? `${selectedFiles.length} files selected (${fmtB(totBytes)})`
        : `Izbranih ${selectedFiles.length} datotek (${fmtB(totBytes)})`;
    byId("filehint").textContent = selectedFiles
      .slice(0, 4)
      .map((f) => f.name)
      .join(", ") + (selectedFiles.length > 4 ? " …" : "");
    byId("start-label").textContent =
      hasArc && hasRaw ? t("Obdelaj vse") : t(encoding ? "Stisni vse" : "Obnovi vse");
    compareBtn.hidden = true;
  }
}

function setLanguage(lang) {
  language = lang;
  safeSetStorage("8zc-language", lang);
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-lang]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang))
  );

  byId("results-link").textContent = t("Rezultati 8zC");
  byId("results-link").href = "/8zc-results/?lang=" + lang;
  byId("author-credit").textContent = t("Ideje, raziskovalne povezave in arhitektura · Bojan Dobrečevič (BD). Skupni razvoj in preverjanje · BD × AI Lab.");
  byId("origin-link").textContent = t("Izvor in celotna zgodba BD × AI Lab");
  byId("origin-link").href = "/8zc-story/?lang=" + lang;
  byId("reference-note").textContent = t("Prva vrstica meri trenutno datoteko v brskalniku; velikost neposrednega ZIP je ocenjena iz brskalniškega Deflate in ovojnice ZIP. Druge vrstice so zabeležene meritve zunanjih kodekov za isti SHA-256. Referenčni matriki spodaj prikazujeta te zunanje meritve.");
  document.querySelector("h1").textContent = t("Kodek 8zC");
  document.querySelector(".intro").textContent = t(
    "Stisnite eno ali več datotek hkrati v naš 100 % suvereni večravninski format .8zc (8ZCN\\x05 z vzvratnim branjem v1..v4, dolžino in CRC-32, brez zunanjih knjižnic, 33-datotečni korpus 1,860 MB · 14/33 proti paq8px -8) ali v .8zc.zip ter samodejno obnovite izvirnike. Vse teče 100 % lokalno v vašem brskalniku (Rust + WebAssembly)."
  );
  document.querySelector("#modes legend").textContent = t("Izberite postopek");
  const modeSpans = document.querySelectorAll("#modes label span");
  if (modeSpans[0]) modeSpans[0].textContent = t("Stisni datoteke");
  if (modeSpans[1]) modeSpans[1].textContent = t("Obnovi izvirnike");
  const fmtLegend = document.querySelector("#enc-formats legend");
  if (fmtLegend) fmtLegend.textContent = t("Format izhoda");
  const fmtSpans = document.querySelectorAll("#enc-formats label span");
  if (fmtSpans[0]) fmtSpans[0].textContent = t("Format .8zc (suveren)");
  if (fmtSpans[1]) fmtSpans[1].textContent = t("Format .8zc.zip");
  const lvlLegend = document.querySelector("#enc-levels legend");
  if (lvlLegend) lvlLegend.textContent = t("Stopnja stiskanja .8zc");
  const lvlSpans = document.querySelectorAll("#enc-levels label span");
  if (lvlSpans[0]) lvlSpans[0].textContent = t("Ultra (v1.4.1 <1,855 MB)");
  if (lvlSpans[1]) lvlSpans[1].textContent = t("Max (v1.5 Optimal)");
  if (lvlSpans[2]) lvlSpans[2].textContent = t("Hitro (Fast)");

  const encoding = mode === "encode";
  byId("input-heading").textContent = t(encoding ? "Vhodne datoteke (6 družin formatov)" : "Vhodni arhivi .8zc / 8zC ZIP");
  byId("samples-caption").textContent = t("1-klik vzorci:");
  byId("limits").textContent = t(
    encoding
      ? "1–100 datotek · do 256 MiB / datoteko (1 GiB skupaj)"
      : "1–100 arhivov · do 256 MiB / arhiv (1 GiB skupaj)"
  );
  byId("compare-label").textContent = t("Primerjaj kompresije");
  cancel.textContent = t("Prekliči");
  byId("licenses-link").textContent = t("Licence knjižnic");

  byId("batch-heading").textContent = t("Paketna obdelava zaključena");
  byId("save-all-label").textContent = t("Shrani vse (.zip)");
  byId("th-b-file").textContent = t("Datoteka");
  byId("th-b-op").textContent = t("Postopek");
  byId("th-b-in").textContent = t("Vhod");
  byId("th-b-base").textContent = t("Čisti ZIP");
  byId("th-b-out").textContent = t("Izhod 8zC");
  byId("th-b-save").textContent = t("Prihranek / SHA-256");
  byId("th-b-dl").textContent = t("Prenos");

  byId("compare-heading").textContent = t("Primerjava kompresij (Čisti kodek proti 8zC)");
  byId("compare-sub").textContent = t(
    "Živi večformatni preizkus v brskalniku (Rust + WebAssembly Cycle 13 R6 v9) in preverjene referenčne matrike s 100 % bitno točno obnovo SHA-256."
  );
  byId("th-live-codec").textContent = t("Kodek / stopnja");
  byId("th-live-raw").textContent = t("Surovo");
  byId("th-live-base").textContent = t("Čisti kodek");
  byId("th-live-8zc").textContent = t("8zC + kodek");
  byId("th-live-save").textContent = t("Prihranek");

  byId("v4-matrix-title").textContent = t(
    "Cycle 13 R6 (v9) · 7 večformatnih vzorcev (PE64 · WASM · CSV · JSONL · WAV · BMP · Auto-DCC)"
  );
  byId("th-v4-file").textContent = t("Vzorec in družina formata");
  byId("th-v4-raw").textContent = t("Surovo");
  byId("th-v4-zip").textContent = t("Čisti ZIP → 8zC v9 + ZIP");
  byId("th-v4-7z").textContent = t("Čisti 7z → 8zC v9 + 7z");
  if (byId("th-v4-nat")) byId("th-v4-nat").textContent = t("Suvereni .8zc (v1.4.1)");
  byId("th-v4-try").textContent = t("Živi preizkus");

  byId("matrix-title").textContent = t(
    "Cycle 13 R6 (v9) + v1.4.1 Native · Referenčna matrika 5 datotek ELF64 (.zip · .7z · .8zc · .paq · .cmix)"
  );
  runSampleLiveBtn.textContent = t("Zaženi 00_data_endian.elf v živo →");
  byId("th-m-file").textContent = t("Vzorčni ELF (prevajalnik)");
  byId("th-m-raw").textContent = t("Surovo");
  byId("th-m-zip").textContent = t("Čisti ZIP → 8zC v9 + ZIP");
  byId("th-m-7z").textContent = t("Čisti 7z → 8zC v9 + 7z");
  if (byId("th-m-nat")) byId("th-m-nat").textContent = t("Suvereni .8zc (v1.4.1)");
  byId("th-m-paq").textContent = t("Čisti PAQ8PX → 8zC + PAQ");
  byId("th-m-cmix").textContent = t("Čisti cmix v21 → 8zC + cmix");

  updateSelectionLabels();
  if (!byId("result").hidden) {
    const outOp = encoding ? (encodeFormat === "zip" ? "encode" : "encode_native") : "decode";
    byId("result-heading").textContent = t(
      outOp === "encode_native" ? "Arhiv 8zC (.8zc)" : outOp === "encode" ? "Arhiv 8zC ZIP" : "Obnovljena datoteka"
    );
    byId("save-label").textContent = t(
      outOp === "encode_native" ? "Shrani .8zc" : outOp === "encode" ? "Shrani ZIP" : "Shrani izvirnik"
    );
  }
  renderSampleChips();
  renderV4Matrix();
  renderElfMatrix();
  if (lastCompareData) renderLiveCompare(lastCompareData);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  safeSetStorage("8zc-theme", theme);
  byId("theme").textContent = theme === "dark" ? "☀ Light" : "☾ Dark";
}

function clearResult() {
  byId("result").hidden = true;
  byId("digest-row").hidden = true;
  byId("batch-result").hidden = true;
  byId("batch-body").textContent = "";
  download.removeAttribute("href");
  downloadAll.removeAttribute("href");
  for (const u of objectUrls) URL.revokeObjectURL(u);
  objectUrls = [];
}

function status(message, error = false) {
  statusLine.textContent = message;
  statusLine.toggleAttribute("data-error", error);
}

function selectFiles(filesList, sampleId = null) {
  selectedFiles = filesList ? Array.from(filesList) : [];
  activeSampleId = sampleId;
  start.disabled = selectedFiles.length === 0;
  clearResult();
  status("");
  updateSelectionLabels();
  renderSampleChips();
}

function acceptFiles(rawFileList) {
  if (!rawFileList || !rawFileList.length || worker) return;
  const arr = Array.from(rawFileList);

  if (arr.length > MAX_BATCH_FILES) {
    selectFiles(null);
    status(t("Izberite največ 100 datotek hkrati."), true);
    return;
  }

  let totalBytes = 0;
  const perFileLimit = MAX_INPUT_BYTES + 65536;
  for (const f of arr) {
    if (!f.size) {
      selectFiles(null);
      status(t("Ena od izbranih datotek je prazna."), true);
      return;
    }
    if (f.size > perFileLimit) {
      selectFiles(null);
      status(t("Datoteka presega dovoljeno velikost (256 MiB)."), true);
      return;
    }
    totalBytes += f.size;
  }

  if (totalBytes > MAX_BATCH_BYTES) {
    selectFiles(null);
    status(t("Skupna velikost paketa presega 1 GiB."), true);
    return;
  }

  // Convenience: if user drops 1 file ending in .8zc or .8zc.zip while in encode mode, switch to decode automatically
  if (arr.length === 1) {
    const nm = arr[0].name.toLowerCase();
    if ((nm.endsWith(".8zc") || nm.endsWith(".8zc.zip")) && mode !== "decode") {
      modes.querySelector('input[value="decode"]').checked = true;
      mode = "decode";
      encFormats.hidden = true;
      if (encLevels) encLevels.hidden = true;
      setLanguage(language);
    } else if (!nm.endsWith(".zip") && !nm.endsWith(".8zc") && mode === "decode") {
      modes.querySelector('input[value="encode"]').checked = true;
      mode = "encode";
      encFormats.hidden = false;
      if (encLevels) encLevels.hidden = encodeFormat !== "native";
      setLanguage(language);
    }
  }

  selectFiles(arr, null);
  if (arr.length === 1) {
    status((language === "en" ? "Selected file: " : "Izbrana datoteka: ") + arr[0].name);
  } else {
    status(
      language === "en"
        ? `Selected ${arr.length} files (${fmtB(totalBytes)}) — click "${byId("start-label").textContent}" to run.`
        : `Izbranih ${arr.length} datotek (${fmtB(totalBytes)}) — kliknite »${byId("start-label").textContent}« za zagon.`
    );
  }
}

function switchFormat() {
  encodeFormat = encFormats.querySelector("input:checked").value === "zip" ? "zip" : "native";
  if (encLevels) encLevels.hidden = mode !== "encode" || encodeFormat !== "native";
  updateSelectionLabels();
}

function switchLevel() {
  if (encLevels) {
    const val = encLevels.querySelector("input:checked").value;
    encodeLevel = ["fast", "max", "ultra"].includes(val) ? val : "ultra";
  }
}

function switchMode() {
  mode = modes.querySelector("input:checked").value;
  const encoding = mode === "encode";
  encFormats.hidden = !encoding;
  if (encLevels) encLevels.hidden = !encoding || encodeFormat !== "native";
  fileInput.accept = encoding ? "" : ".8zc,.8zc.zip,.zip,application/zip";
  fileInput.value = "";
  sampleChips.hidden = !encoding;
  byId("samples-caption").hidden = !encoding;
  byId("input-heading").textContent = t(encoding ? "Vhodne datoteke (6 družin formatov)" : "Vhodni arhivi .8zc / 8zC ZIP");
  byId("limits").textContent = t(
    encoding
      ? "1–100 datotek · do 256 MiB / datoteko (1 GiB skupaj)"
      : "1–100 arhivov · do 256 MiB / arhiv (1 GiB skupaj)"
  );
  selectFiles(null);
}

function busy(active) {
  modes.disabled = active;
  encFormats.disabled = active;
  if (encLevels) encLevels.disabled = active;
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

function trackUrl(blob) {
  const u = URL.createObjectURL(blob);
  objectUrls.push(u);
  return u;
}

function showResult({ bytes, digest, outputOp }) {
  const resolvedOp =
    outputOp || (mode === "encode" ? (encodeFormat === "zip" ? "encode" : "encode_native") : "decode");
  const encoding = resolvedOp !== "decode";
  const singleFile = selectedFiles[0];
  const name = outputFileNameFor(singleFile ? singleFile.name : "output", resolvedOp);
  const url = trackUrl(
    new Blob([bytes], {
      type: resolvedOp === "encode" ? "application/zip" : "application/octet-stream",
    })
  );
  download.href = url;
  download.download = name;
  byId("result-heading").textContent = t(
    resolvedOp === "encode_native" ? "Arhiv 8zC (.8zc)" : resolvedOp === "encode" ? "Arhiv 8zC ZIP" : "Obnovljena datoteka"
  );
  byId("save-label").textContent = t(
    resolvedOp === "encode_native" ? "Shrani .8zc" : resolvedOp === "encode" ? "Shrani ZIP" : "Shrani izvirnik"
  );
  byId("output-name").textContent =
    name + " · " + bytes.byteLength.toLocaleString(language === "en" ? "en-US" : "sl-SI") + " B";
  byId("digest").textContent = digest || "";
  byId("digest-row").hidden = !digest;
  byId("result").hidden = false;
  status(
    t(encoding ? "Arhiv je pripravljen za shranjevanje." : "Izvirna datoteka je pripravljena za shranjevanje.")
  );
}

function showBatchResult(items) {
  const tbody = byId("batch-body");
  tbody.textContent = "";
  const zipEntries = [];

  let totIn = 0;
  let totBaseZip = 0;
  let countWithBase = 0;
  let totOut = 0;
  let verifiedCount = 0;
  let errorCount = 0;

  for (const it of items) {
    const outName = outputFileNameFor(it.origName, it.op);
    const hasError = Boolean(it.error || !it.bytes);
    const outUint8 = hasError ? null : new Uint8Array(it.bytes);
    if (!hasError && outUint8) {
      zipEntries.push({ name: outName, bytes: outUint8 });
      totIn += it.inputBytes;
      totOut += it.outputBytes;
      if (it.browserZipBytes) {
        totBaseZip += it.browserZipBytes;
        countWithBase++;
      }
      if (it.verified) verifiedCount++;
    } else {
      errorCount++;
    }

    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = it.origName;
    tr.appendChild(th);

    const tdOp = document.createElement("td");
    tdOp.textContent =
      it.op === "encode_native"
        ? (language === "en" ? "Compress (.8zc)" : "Stiskanje (.8zc)")
        : it.op === "encode"
        ? (language === "en" ? "Compress (.8zc.zip)" : "Stiskanje (.zip)")
        : (language === "en" ? "Restore" : "Obnova");
    tr.appendChild(tdOp);

    const tdIn = document.createElement("td");
    tdIn.textContent = fmtB(it.inputBytes);
    tr.appendChild(tdIn);

    const tdBase = document.createElement("td");
    tdBase.textContent = it.browserZipBytes ? fmtB(it.browserZipBytes) : "—";
    tr.appendChild(tdBase);

    const tdOut = document.createElement("td");
    if (hasError) {
      tdOut.textContent = "—";
    } else {
      const st = document.createElement("strong");
      st.textContent = fmtB(it.outputBytes);
      tdOut.appendChild(st);
    }
    tr.appendChild(tdOut);

    const tdSave = document.createElement("td");
    if (hasError) {
      tdSave.textContent = it.error || (language === "en" ? "Failed" : "Napaka");
    } else if ((it.op === "encode" || it.op === "encode_native") && it.browserZipBytes) {
      const diff = it.outputBytes - it.browserZipBytes;
      const bdg = document.createElement("span");
      bdg.className = "badge";
      const verTag = it.verified
        ? " · ✓ SHA-256"
        : (language === "en" ? " · Not verified" : " · Ni preverjeno");
      bdg.textContent = `${diff.toLocaleString(language === "en" ? "en-US" : "sl-SI")} B (${fmtPct(diff, it.browserZipBytes)})${verTag}`;
      tdSave.appendChild(bdg);
    } else if (it.verified) {
      tdSave.textContent = it.digest ? `✓ SHA-256: ${it.digest.slice(0, 12)}…` : "✓ Preverjeno";
    } else {
      tdSave.textContent = language === "en" ? "Not verified" : "Ni preverjeno";
    }
    tr.appendChild(tdSave);

    const tdDl = document.createElement("td");
    if (!hasError && outUint8) {
      const a = document.createElement("a");
      a.className = "chip-btn mini-btn";
      a.href = trackUrl(new Blob([outUint8], { type: it.op === "encode" ? "application/zip" : "application/octet-stream" }));
      a.download = outName;
      a.textContent = (language === "en" ? "Save ↓" : "Shrani ↓");
      tdDl.appendChild(a);
    } else {
      tdDl.textContent = "—";
    }
    tr.appendChild(tdDl);

    tbody.appendChild(tr);
  }

  const okItemsCount = items.length - errorCount;
  const allVerified = errorCount === 0 && verifiedCount === items.length;

  // Total summary row
  const trTot = document.createElement("tr");
  const thTot = document.createElement("th");
  thTot.scope = "row";
  thTot.innerHTML = `<strong>${language === "en" ? `TOTAL (${okItemsCount}/${items.length} files)` : `SKUPAJ (${okItemsCount}/${items.length} datotek)`}</strong>`;
  trTot.appendChild(thTot);

  const tdOpT = document.createElement("td");
  tdOpT.textContent = "—";
  trTot.appendChild(tdOpT);

  const tdInT = document.createElement("td");
  tdInT.innerHTML = `<strong>${fmtB(totIn)}</strong>`;
  trTot.appendChild(tdInT);

  const tdBaseT = document.createElement("td");
  tdBaseT.textContent = countWithBase === items.length && errorCount === 0 ? fmtB(totBaseZip) : "—";
  trTot.appendChild(tdBaseT);

  const tdOutT = document.createElement("td");
  tdOutT.innerHTML = `<strong>${fmtB(totOut)}</strong>`;
  trTot.appendChild(tdOutT);

  const tdSaveT = document.createElement("td");
  if (allVerified && countWithBase === items.length && totBaseZip > 0) {
    const diffT = totOut - totBaseZip;
    tdSaveT.innerHTML = `<span class="badge">${diffT.toLocaleString(language === "en" ? "en-US" : "sl-SI")} B (${fmtPct(diffT, totBaseZip)}) · ✓ ${verifiedCount}/${items.length} SHA-256</span>`;
  } else if (allVerified) {
    tdSaveT.textContent = `✓ ${verifiedCount}/${items.length} SHA-256`;
  } else {
    tdSaveT.textContent =
      language === "en"
        ? `${verifiedCount}/${items.length} verified${errorCount ? ` (${errorCount} failed)` : ""}`
        : `${verifiedCount}/${items.length} preverjeno${errorCount ? ` (${errorCount} napak)` : ""}`;
  }
  trTot.appendChild(tdSaveT);

  const tdDlT = document.createElement("td");
  tdDlT.textContent = "";
  trTot.appendChild(tdDlT);
  tbody.appendChild(trTot);

  if (zipEntries.length > 0) {
    const bundleBlob = buildStoreZip(zipEntries);
    downloadAll.href = trackUrl(bundleBlob);
    downloadAll.download = `8zC_batch_${zipEntries.length}_files.zip`;
    downloadAll.hidden = false;
    byId("batch-summary").textContent =
      language === "en"
        ? `${okItemsCount}/${items.length} files processed (${fmtB(totIn)} → ${fmtB(totOut)}) · Bundle size: ${fmtB(bundleBlob.size)}`
        : `Obdelanih ${okItemsCount}/${items.length} datotek (${fmtB(totIn)} → ${fmtB(totOut)}) · Skupni paket: ${fmtB(bundleBlob.size)}`;
  } else {
    downloadAll.hidden = true;
    byId("batch-summary").textContent =
      language === "en" ? "No files succeeded in batch." : "Nobena datoteka v paketu ni bila uspešno obdelana.";
  }

  byId("batch-result").hidden = false;
  status(
    errorCount
      ? (language === "en"
          ? `Batch finished with ${errorCount} error(s) (${okItemsCount}/${items.length} succeeded).`
          : `Paketna obdelava končana z opozorili (${okItemsCount}/${items.length} uspešnih, ${errorCount} napak).`)
      : t("Paketna obdelava je zaključena — posamezne datoteke ali skupni ZIP so pripravljeni za prenos."),
    errorCount > 0
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
    selectFiles([file], s.id);
    status((language === "en" ? "Loaded sample: " : "Naložen vzorec: ") + file.name);
    if (autoCompare) {
      runWorker("compare");
    }
  } catch (err) {
    status(err.message || "Error loading sample", true);
  }
}

function runWorker(workerMode) {
  if (!selectedFiles.length || worker) return;
  clearResult();
  const isBatch = selectedFiles.length > 1 && workerMode !== "compare";
  try {
    worker = new Worker("/8zC/worker.js");
    const current = worker;
    worker.onmessage = ({ data }) => {
      if (worker !== current) return;
      if (data.progress) {
        status(
          language === "en"
            ? `[${data.index} / ${data.total}] Processing ${data.filename} …`
            : `[${data.index} / ${data.total}] Obdelujem ${data.filename} …`
        );
        return;
      }
      finish();
      if (data.error) {
        status(data.error, true);
        start.focus();
      } else if (data.batchDone) {
        showBatchResult(data.items);
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
    if (isBatch) {
      status(
        language === "en"
          ? `Starting batch of ${selectedFiles.length} files …`
          : `Zaganjam paketno obdelavo ${selectedFiles.length} datotek …`
      );
      worker.postMessage({ mode: "batch", defaultMode: mode, encodeFormat, encodeLevel, files: selectedFiles });
    } else {
      status(
        workerMode === "compare"
          ? t("Primerjava kompresij v brskalniku poteka …")
          : mode === "encode"
          ? t("Stiskanje poteka …")
          : t("Obnova poteka …")
      );
      worker.postMessage({ mode: workerMode, encodeFormat, encodeLevel, file: selectedFiles[0] });
    }
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
  if (!selectedFiles.length) {
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
encFormats.addEventListener("change", switchFormat);
if (encLevels) encLevels.addEventListener("change", switchLevel);
start.addEventListener("click", () =>
  runWorker(mode === "encode" ? (encodeFormat === "zip" ? "encode" : "encode_native") : "decode")
);
compareBtn.addEventListener("click", handleCompareClick);
runSampleLiveBtn.addEventListener("click", () => loadSampleById("00_data_endian", true));
cancel.addEventListener("click", stop);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && worker) stop();
});
setTheme(safeGetStorage("8zc-theme") === "light" ? "light" : "dark");
byId("theme").addEventListener("click", () =>
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
);
document
  .querySelectorAll("[data-lang]")
  .forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.lang)));
const requestedLang = new URL(location.href).searchParams.get("lang");
switchMode();
setLanguage(requestedLang === "en" || requestedLang === "sl" ? requestedLang : language);
