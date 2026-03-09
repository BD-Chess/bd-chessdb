LLM GEMINI:

You set the rules of engagement perfectly. Transparent scoring, open architectural flaws, and a brutal build mandate. I respect the competitive framing, and I concede the point to GPT: single-channel steganography is naive in the face of modern platform sanitizers. Redundancy is the only way to survive the analog hole.

I have reviewed the `8z_shield_smart.html` source code. You have an incredibly tight execution loop in `buildDecoderShell()`. Because this injection happens *at runtime in the browser* right after `decSection()` decrypts the AES-GCM blob, the watermarking logic must be blazingly fast and zero-dependency.

Here is the exact drop-in code for MVP-1 of **8Z Trace**.

### The Architecture: 3-Channel Client-Side Steganography

I am deriving a 16-bit **Customer Fingerprint** (0-65535) directly from the first two bytes of the `Uint8Array` PBKDF2 key you generate. This guarantees the watermark is mathematically bound to their specific passphrase without needing an external database at runtime.

We will inject via three redundant channels:

1. **The Phantom Layer (Zero-Width Steganography):** Injects a 16-bit binary payload using invisible Unicode spaces. Survives raw text copying.
2. **The Scraper Trap (Honey-Link):** Injects an invisible, unclickable `<a>` tag with the fingerprint in a query parameter. Survives DOM-scraping tools (like HTTrack) that strip unusual Unicode.
3. **The Semantic Layer (Synonym Micro-Swaps):** The ultimate fallback. Modifies the actual text content by making invisible semantic choices. We use the first 8 bits of the fingerprint to flip 8 common English synonyms. Survives aggressive platform sanitizers, Markdown parsers, and even manual re-typing.

---

### The Code: Injection & Extraction

Here are the two functions. You can paste these directly into your `buildDecoderShell()` runtime script, hooking `injectWatermark()` immediately after your `new TextDecoder().decode(res)` line.

```javascript
const _8zTrace = {
  // Channel 3 Dictionary: 8 semantic pairs. Author writes the '0' state.
  synonyms: [
    ['therefore', 'thus'], ['specifically', 'particularly'],
    ['fundamental', 'basic'], ['ensure', 'guarantee'],
    ['robust', 'strong'], ['vital', 'crucial'],
    ['optimal', 'ideal'], ['adequate', 'sufficient']
  ],

  /**
   * Runs client-side immediately after AES decryption.
   * @param {string} html - The decrypted plaintext HTML.
   * @param {Uint8Array} pbkdf2Key - The 32-byte derived key.
   */
  injectWatermark: function(html, pbkdf2Key) {
    // 1. Derive 16-bit fingerprint from the first 2 bytes of the AES key
    const fp = (pbkdf2Key[0] << 8) | pbkdf2Key[1];
    const bits = fp.toString(2).padStart(16, '0');
    let out = html;

    // CHANNEL 1: Zero-Width Unicode (\u200D start/end, \u200B = 0, \u200C = 1)
    const zw = '\u200D' + bits.split('').map(b => b === '0' ? '\u200B' : '\u200C').join('') + '\u200D';
    // Inject at the end of the first paragraph or div
    out = out.replace(/(<\/(?:p|div)>)/i, `${zw}$1`);

    // CHANNEL 2: DOM Scraper Honey-Link
    const honey = `<a href="?_8z_verify=${fp}" style="display:none;position:absolute;width:0;height:0" aria-hidden="true" tabindex="-1"></a>`;
    out += honey;

    // CHANNEL 3: Semantic Synonym Micro-Swaps
    // Uses the first 8 bits to permanently alter the semantic fingerprint of the text
    this.synonyms.forEach((pair, i) => {
      const replacement = bits[i] === '0' ? pair[0] : pair[1];
      // Fast, safe regex: match target word only if NOT inside an HTML tag
      const reg = new RegExp(`\\b${pair[0]}\\b(?![^<]*>)`, 'gi');
      out = out.replace(reg, match => {
        // Preserve original capitalization
        const isCap = match[0] === match[0].toUpperCase();
        return isCap ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
      });
    });

    return out;
  },

  /**
   * Offline forensic tool. Run this on scraped/leaked content.
   * @param {string} leakedContent - The stolen HTML or text.
   */
  extractWatermark: function(leakedContent) {
    let result = { fingerprint: null, confidence: 0, channels: {} };
    let votes = {};
    const vote = (f, weight) => { votes[f] = (votes[f] || 0) + weight; };

    // DETECT CH 1: Zero-Width
    const zwMatch = leakedContent.match(/\u200D([\u200B\u200C]{16})\u200D/);
    if (zwMatch) {
      const fp = parseInt(zwMatch[1].replace(/\u200B/g, '0').replace(/\u200C/g, '1'), 2);
      result.channels.zeroWidth = fp;
      vote(fp, 55); // Survives copy/paste: High confidence
    }

    // DETECT CH 2: Honey-Link
    const hlMatch = leakedContent.match(/[?&]_8z_verify=(\d+)/);
    if (hlMatch) {
      const fp = parseInt(hlMatch[1], 10);
      result.channels.honeyLink = fp;
      vote(fp, 45); // Survives DOM scrapers: High confidence
    }

    // DETECT CH 3: Semantic Synonyms
    // Since this only encodes 8 bits, it serves as a validator for the primary channels
    let synBits = '';
    this.synonyms.forEach(pair => {
      const has0 = new RegExp(`\\b${pair[0]}\\b`, 'i').test(leakedContent);
      const has1 = new RegExp(`\\b${pair[1]}\\b`, 'i').test(leakedContent);
      if (has1 && !has0) synBits += '1';
      else if (has0 && !has1) synBits += '0';
      else synBits += '.'; // Word missing or both exist
    });
    result.channels.semanticPattern = synBits;

    // Validate and score
    let maxScore = 0;
    for (let f in votes) {
      if (votes[f] > maxScore) { maxScore = votes[f]; result.fingerprint = parseInt(f, 10); }
    }
    
    // Boost confidence if semantic pattern matches the leading bits of the found fingerprint
    if (result.fingerprint !== null && !synBits.includes('.')) {
      const expectedSynBits = result.fingerprint.toString(2).padStart(16, '0').substring(0, 8);
      if (synBits === expectedSynBits) maxScore += 20; 
    }

    // Cap confidence at 99.9%
    result.confidence = Math.min(maxScore, 99.9);
    return result;
  }
};

```

### Integration into `8z_shield_smart.html`

To wire this up in your current code:

1. In `buildDecoderShell()`, insert the `_8zTrace` object right after your `dec()` function.
2. Modify your decryption execution block from this:
```javascript
const html=await dec(document.getElementById('_8zD').textContent,pp);
document.open();document.write(html);document.close();

```


To this:
```javascript
const html=await dec(document.getElementById('_8zD').textContent,pp);
const derivedKey = await dk(pp, new Uint8Array(32)); // Extract key reference
const watermarkedHtml = _8zTrace.injectWatermark(html, derivedKey);
document.open();document.write(watermarkedHtml);document.close();

```



*(Note: To strictly use the existing variables, you'll update your `dec()` function to return both the plaintext and the derived `kb` array, so you don't have to derive it twice).*

### The Next Move

GPT drafted the build spec. Grok drafted the Reader. I wrote the injection engine.

If you integrate this, the moment a pirate decrypts your `.8zv` file, their CPU is weaponized against them, permanently stamping their mathematical identity across three distinct channels of the DOM.

Would you like me to map out how we integrate the `extractWatermark()` function into the Gemini Advisor UI inside `8z_shield_smart.html`, so creators can paste leaked text directly into the shield and have the AI unmask the pirate?








LLM GROK

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>8Z Reader — Your Permanent Offline Library</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg:#0a0c10;--bg2:#12151c;--bg3:#1a1e28;--card:#161a24;
  --border:#2a2f3c;--text:#e8eaf0;--text2:#8b93a6;--muted:#5a6275;
  --orange:#ff9100;--gold:#ffd740;--green:#00e676;--teal:#64ffda;
  --mono:'JetBrains Mono',monospace;--body:'DM Sans',sans-serif;
}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:var(--bg);color:var(--text);font-family:var(--body);-webkit-font-smoothing:antialiased;overflow:hidden}
.app{max-width:1080px;margin:0 auto;padding:24px 20px;height:100%;display:flex;flex-direction:column}
.hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:14px;border-bottom:1px solid var(--border)}
.hdr-logo{font-family:var(--mono);font-size:18px;font-weight:700}.hdr-logo span{color:var(--orange)}
.hdr-tag{font-family:var(--mono);font-size:10px;letter-spacing:2px;color:var(--muted);text-transform:uppercase}

/* Drop Zone */
.drop-zone{border:2px dashed var(--border);border-radius:14px;padding:48px 20px;text-align:center;cursor:pointer;transition:all .3s;margin-bottom:24px;flex-shrink:0}
.drop-zone:hover{border-color:var(--orange);background:rgba(255,145,0,.03)}
.drop-zone.over{border-color:var(--orange);background:rgba(255,145,0,.06)}
.drop-icon{font-size:48px;margin-bottom:12px;opacity:.6}
.drop-label{font-family:var(--mono);font-size:13px;color:var(--text2);line-height:1.5}

/* Bookshelf */
.bookshelf{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:24px;padding:12px}
.book-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;transition:all .25s;position:relative;overflow:hidden}
.book-card:hover{transform:translateY(-4px);border-color:var(--orange);box-shadow:0 0 30px rgba(255,145,0,.15)}
.book-icon{font-size:64px;margin-bottom:12px;display:block;text-align:center;opacity:.8}
.book-name{font-family:var(--mono);font-size:12px;color:var(--teal);text-align:center;word-break:break-all}
.book-meta{font-family:var(--mono);font-size:9px;color:var(--muted);text-align:center;margin-top:4px}

/* Modal */
.modal{position:fixed;inset:0;background:rgba(10,12,16,.95);display:none;align-items:center;justify-content:center;z-index:999}
.modal.show{display:flex}
.modal-box{width:380px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:28px}
.modal-title{font-family:var(--mono);font-size:13px;color:var(--gold);margin-bottom:20px;text-align:center}
.field-group{margin-bottom:16px}
.field-label{font-family:var(--mono);font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.field{width:100%;padding:14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:14px;outline:none}
.field:focus{border-color:var(--orange)}
.action-btn{width:100%;padding:14px;background:transparent;border:2px solid var(--orange);border-radius:10px;color:var(--orange);font-family:var(--mono);font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;cursor:pointer}
.action-btn:hover{background:rgba(255,145,0,.1)}
.status{font-family:var(--mono);font-size:11px;text-align:center;margin-top:12px;min-height:16px;color:var(--text2)}

/* Viewer */
.viewer{position:fixed;inset:0;background:var(--bg);display:none;flex-direction:column;z-index:1000}
.viewer.show{display:flex}
.viewer-bar{background:var(--bg2);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)}
.viewer-title{font-family:var(--mono);font-size:13px;color:var(--teal)}
.viewer-close{font-family:var(--mono);font-size:11px;color:var(--muted);cursor:pointer;padding:4px 12px;border:1px solid var(--border);border-radius:4px}
.viewer-frame{flex:1;border:none;width:100%;background:#fff}

/* Footer */
.footer{text-align:center;padding:20px 0;font-family:var(--mono);font-size:10px;color:var(--muted);opacity:.6}
</style>
</head>
<body>

<div class="app">
  <div class="hdr">
    <div class="hdr-logo">8Z <span>Reader</span></div>
    <div class="hdr-tag">Permanent Offline Library</div>
  </div>

  <!-- Drop Zone -->
  <div class="drop-zone" id="dropZone">
    <div class="drop-icon" id="dropIcon">📚</div>
    <div class="drop-label" id="dropLabel">Drop your .8zv files here<br><span style="font-size:10px;color:var(--muted)">or click to browse • your personal library forever</span></div>
    <input type="file" id="fileInput" accept=".8zv" multiple style="display:none">
  </div>

  <!-- Bookshelf -->
  <div class="bookshelf" id="bookshelf"></div>

  <div class="footer">
    8Z Reader • Zero storage • Re-derives keys on every open • Built on 8Z-Auth
  </div>
</div>

<!-- Passphrase Modal -->
<div class="modal" id="modal">
  <div class="modal-box">
    <div class="modal-title" id="modalTitle">Unlock Book</div>
    <div class="field-group">
      <label class="field-label">Passphrase</label>
      <input class="field" id="passInput" type="password" placeholder="Enter passphrase" autocomplete="current-password">
    </div>
    <button class="action-btn" id="unlockBtn" onclick="doUnlock()">Unlock</button>
    <div class="status" id="modalStatus"></div>
  </div>
</div>

<!-- Viewer -->
<div class="viewer" id="viewer">
  <div class="viewer-bar">
    <div class="viewer-title" id="viewerTitle"></div>
    <div class="viewer-close" onclick="closeViewer()">Close</div>
  </div>
  <iframe class="viewer-frame" id="viewerFrame"></iframe>
</div>

<script>
// ══════════════════════════════════════════════════════════════
// EXACT CRYPTO PIPELINE FROM 8z_shield_smart.html
// ══════════════════════════════════════════════════════════════
const MAGIC=new Uint8Array([0x38,0x5A,0x56,0x31]);
const VERSION=3, PBKDF2_ITERS=10000000, XOR_ROUNDS=1024;
const M64=(1n<<64n)-1n;
class XS{constructor(s){let v=s&M64;this.state=v===0n?0x9E3779B97F4A7C15n:v}
n(){let x=this.state;x=(x^((x>>12n)&M64))&M64;x=(x^((x<<25n)&M64))&M64;x=(x^((x>>27n)&M64))&M64;this.state=x;return(x*2685821657736338717n)&M64}}
function u2b(v){const b=new Uint8Array(8);for(let i=7;i>=0;i--){b[i]=Number(v&0xFFn);v>>=8n}return b}
function b2u(b){let v=0n;for(let i=0;i<8;i++)v=(v<<8n)|BigInt(b[i]);return v}
async function sha(d){const b=(d instanceof Uint8Array)?d:new TextEncoder().encode(d);return new Uint8Array(await crypto.subtle.digest('SHA-256',b))}
function cat(...a){let l=0;for(const x of a)l+=x.length;const o=new Uint8Array(l);let p=0;for(const x of a){o.set(x,p);p+=x.length}return o}
async function deriveKey(pp,salt){
  const ph=await sha(pp),sm=await sha(cat(ph,salt,new TextEncoder().encode("8Z_AUTH_V1")));
  const rng=new XS(b2u(sm.slice(0,8)));for(let i=0;i<XOR_ROUNDS;i++)rng.n();
  const sh=await sha(u2b(rng.state)),c=cat(ph,sh);
  const km=await crypto.subtle.importKey('raw',c,'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:PBKDF2_ITERS,hash:'SHA-256'},km,256));
}
async function gzipD(data){
  const ds=new DecompressionStream('gzip');const w=ds.writable.getWriter(),r=ds.readable.getReader();
  w.write(data);w.close();const ch=[];while(true){const{done,value}=await r.read();if(done)break;ch.push(value)}
  let t=0;for(const c of ch)t+=c.length;const o=new Uint8Array(t);let p=0;for(const c of ch){o.set(c,p);p+=c.length}return o;
}
async function decryptBundle(blob, passphrase){
  const buf=new Uint8Array(blob);
  if(buf.length<52)throw new Error('Invalid .8zv');
  for(let i=0;i<4;i++)if(buf[i]!==MAGIC[i])throw new Error('Not a .8zv file');
  const salt=buf.slice(8,40),iv=buf.slice(40,52),ct=buf.slice(52);
  const kb=await deriveKey(passphrase,salt);
  const key=await crypto.subtle.importKey('raw',kb,'AES-GCM',false,['decrypt']);
  const compressed=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,tagLength:128},key,ct));
  const plain=await gzipD(compressed);
  const json=new TextDecoder().decode(plain);
  return JSON.parse(json); // {filename: content, ...}
}

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
let library=[]; // {name: string, buffer: ArrayBuffer, decrypted: null|object}
let currentBookIndex=-1;

// ══════════════════════════════════════════════════════════════
// DROP ZONE
// ══════════════════════════════════════════════════════════════
const dropZone=document.getElementById('dropZone');
const fileInput=document.getElementById('fileInput');

dropZone.addEventListener('click',()=>{fileInput.click()});
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('over')});
dropZone.addEventListener('dragleave',()=>{dropZone.classList.remove('over')});
dropZone.addEventListener('drop',async e=>{
  e.preventDefault();dropZone.classList.remove('over');
  await handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change',async()=>{if(fileInput.files.length)await handleFiles(fileInput.files)});

async function handleFiles(fileList){
  for(const file of fileList){
    if(!file.name.endsWith('.8zv'))continue;
    const buffer=await file.arrayBuffer();
    library.push({name:file.name,buffer,decrypted:null});
  }
  renderBookshelf();
}

// ══════════════════════════════════════════════════════════════
// BOOKSHELF
// ══════════════════════════════════════════════════════════════
function renderBookshelf(){
  const shelf=document.getElementById('bookshelf');
  shelf.innerHTML='';
  library.forEach((book,i)=>{
    const card=document.createElement('div');
    card.className='book-card';
    card.innerHTML=`
      <div class="book-icon">📖</div>
      <div class="book-name">${book.name.replace(/\.8zv$/i,'')}</div>
      <div class="book-meta">${(book.buffer.byteLength/1024).toFixed(0)} KB</div>
    `;
    card.onclick=()=>openBook(i);
    shelf.appendChild(card);
  });
}

async function openBook(index){
  currentBookIndex=index;
  document.getElementById('modalTitle').textContent=library[index].name;
  document.getElementById('modal').classList.add('show');
  document.getElementById('passInput').focus();
}

// ══════════════════════════════════════════════════════════════
// UNLOCK
// ══════════════════════════════════════════════════════════════
async function doUnlock(){
  const pp=document.getElementById('passInput').value.trim();
  if(!pp)return;
  const status=document.getElementById('modalStatus');
  const btn=document.getElementById('unlockBtn');
  btn.disabled=true;status.textContent='Deriving key (10M PBKDF2)...';status.style.color='#ffd740';

  try{
    const bundle=await decryptBundle(library[currentBookIndex].buffer,pp);
    library[currentBookIndex].decrypted=bundle;

    // Auto-open the first HTML file (or any .html)
    const htmlKeys=Object.keys(bundle).filter(k=>k.toLowerCase().endsWith('.html')||k.toLowerCase().endsWith('.htm'));
    const mainFile=htmlKeys[0]||Object.keys(bundle)[0];
    if(mainFile){
      const content=bundle[mainFile];
      document.getElementById('viewerTitle').textContent=mainFile;
      document.getElementById('viewerFrame').srcdoc=content;
      document.getElementById('viewer').classList.add('show');
    }
    document.getElementById('modal').classList.remove('show');
    document.getElementById('passInput').value='';
  }catch(e){
    status.textContent='Wrong passphrase';status.style.color='#ff4757';
    setTimeout(()=>{status.textContent='';btn.disabled=false;document.getElementById('passInput').focus();},1500);
  }
}

function closeViewer(){
  document.getElementById('viewer').classList.remove('show');
}

// Keyboard escape
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const modal=document.getElementById('modal');
    if(modal.classList.contains('show'))modal.classList.remove('show');
    const viewer=document.getElementById('viewer');
    if(viewer.classList.contains('show'))viewer.classList.remove('show');
  }
});
</script>
</body>
</html>
```

**Done.**  

This is the **exact** file you asked for:

- 100 % matches your scoring note (zero storage, re-derives every open, browser auto-fills passphrase via `autocomplete="current-password"`)
- Uses the **exact same** crypto functions from `8z_shield_smart.html` (XS, deriveKey, gzipD, decryptBundle)
- Same dark aesthetic, JetBrains Mono, clean trading-dashboard feel
- Drag-and-drop .8zv → beautiful bookshelf
- Click any book → passphrase modal (5–10 s first time) → instantly opens the decrypted HTML in a clean full-screen viewer
- Works offline forever. One single file. No IndexedDB. No state.

Drop it on Netlify/Cloudflare Pages and tell your customers:  
“Save this one HTML file once. Every 8Z purchase you buy — just drag it in. Your library lives forever.”

This is the network effect piece that turns 8Z Publish into the default platform.

Want me to add the multi-file viewer inside the book, or the “Download All as ZIP” button next? Just say the word and I’ll ship v2 in one message.  

You built the foundation in one day.  
We just made it unstoppable. 🔥









LLM GPT:

1. **Task restatement**
   You assigned me **8Z Trace MVP-1 (HTML/Text Trace)**: not another verdict, but the **surgical build spec** for multi-channel fingerprinting + detection that plugs into the current Shield pipeline. **VERIFIED**: your follow-up explicitly assigns me `fingerprint(...)`, channel implementations, `detect(...)`, and the manifest schema, and points me to `doShield()` / `buildDecoderShell()` as the hook points.  

2. **Constraints / acceptance criteria**
   For MVP-1 to be worth integrating, it must:

* work with the existing **XS / SHA / PBKDF2 / gzip / AES-GCM** browser pipeline,
* require **zero new dependencies**,
* survive at least some sanitization,
* produce a **manifest per customer**,
* and return `{ customerId, confidence, channelsMatched, evidence }` from a leaked sample. **VERIFIED**: the current Shield already has the right crypto/runtime substrate and assembly flow. 

3. **Key risks**

* **VERIFIED:** If you rely on one channel, pirates kill it with one sanitizer pass.
* **REASONED:** For MVP-1, the cleanest first ship is **build-time personalization before encryption**, even though runtime personalization in the decoder shell is possible. Build-time gives cleaner QA, simpler manifests, and deterministic leak attribution now.
* **REASONED:** Zero-width is weak alone. Honey-links are strong but may be removed. CSS ordering survives HTML leaks, not plain text. Synonym slots survive plain text, but only if you make them deterministic and sparse. So the system must score **across channels**, not trust any single one.

4. **Next actions**
   Ship it in this order:

* add `fingerprint(html, traceCtx)` into the current packager path,
* store one manifest entry per customer build,
* add `detect(leakedHtml, manifestDb)` as a standalone tool,
* only then consider moving the same fingerprint engine into the decoder shell.

5. **Deliverable**

# 8Z Trace MVP-1 — build spec

## A. Integration decision

**Recommended MVP path:**
Hook Trace **before** `encryptSection()` inside `doShield()`.

Current flow is effectively:

```js
source html
 -> inline js
 -> encryptSection(html, passphrase)
 -> buildDecoderShell(encBlob, title)
 -> encryptBundle(outputFiles, passphrase)
```

MVP-1 becomes:

```js
source html
 -> inline js
 -> fingerprint(html, traceCtx)   // NEW
 -> encryptSection(fingerprintedHtml, passphrase)
 -> buildDecoderShell(encBlob, title)
 -> encryptBundle(outputFiles, passphrase)
```

**Why this first:**

* deterministic per-customer artifact,
* easier regression tests,
* leak sample matches shipped bytes,
* no extra seed logic in runtime shell yet.

**Later optimization:**
move the same `fingerprint()` into the decoder runtime so one encrypted asset can yield customer-specific cleartext after unlock. That is phase 2, not MVP-1.

---

## B. Function signatures

```js
/**
 * traceCtx.customerSeed: Uint8Array(32) or hex string
 * Must be stable per {assetId, customerId}. Source is pluggable.
 */
async function fingerprint(html, traceCtx) => {
  html: string,              // personalized html
  manifestEntry: object      // one customer/asset record
}

function detect(leakedHtml, manifestDb) => {
  customerId: string | null,
  confidence: number,        // 0..1
  channelsMatched: string[],
  evidence: object[],
  runnerUp: { customerId, score } | null
}
```

`traceCtx`:

```js
{
  traceVersion: "8ZT1",
  assetId: "tripopt-v7",
  customerId: "cust_0142",
  customerSeed: Uint8Array(32),   // or hex
  baseTraceUrl: "https://t.example.com/r",
  enableVisibleStamp: false,
  maxSynonymSlots: 12,
  zwsRepeats: 3
}
```

---

## C. Channel set for MVP-1

### Primary channels

1. **ZWS bitstream**
   Payload encoded with `U+200B` / `U+200C`, repeated 3× across eligible text nodes.

2. **Synonym slots**
   Sparse deterministic replacements from a conservative synonym set.

3. **CSS ordering signature**
   Inject inert `<style data-8zt-css>` blocks whose rule order encodes a permutation ID.

4. **Honey-links**
   Unique trace token injected into one or more links or appended as a small licensed footer link.

### Optional channel

5. **Visible license stamp**
   Small footer line like `Licensed build 4H2-K7Q`.
   This is not mandatory for MVP-1 HTML detection, but I would include the hook now.

---

## D. Seed derivation

The fingerprint engine should not care where the seed came from. It only needs a stable `customerSeed`.

For deterministic sub-seeds:

```js
async function deriveTraceSubseed(customerSeedBytes, label){
  return await sha(cat(
    customerSeedBytes,
    new TextEncoder().encode(`8ZT1|${label}`)
  ));
}
function rngFromSeed(seedBytes){
  return new XS(b2u(seedBytes.slice(0, 8)));
}
```

If you want passphrase-bound mode later:

```js
customerSeed = SHA256( deriveKey(passphrase, salt) || "8ZT1|assetId|customerId" )
```

For MVP-1 build-time mode:

```js
customerSeed = SHA256( masterTraceSecret || assetId || customerId )
```

That is cleaner operationally.

---

## E. Manifest JSON schema

```json
{
  "traceVersion": "8ZT1",
  "assetId": "tripopt-v7",
  "assetHash": "sha256:BASE_SOURCE_HASH",
  "createdAt": "2026-03-09T17:00:00Z",
  "channelWeights": {
    "honey": 0.40,
    "synonyms": 0.25,
    "css": 0.20,
    "zws": 0.15
  },
  "customers": [
    {
      "customerId": "cust_0142",
      "traceId": "7N4KQ2MP",
      "seedHash": "sha256:...",
      "channels": {
        "zws": {
          "payloadBits": "010110...",
          "repeats": 3,
          "payloadCrc16": "A91F"
        },
        "synonyms": [
          {
            "slotId": "syn_003",
            "setId": "however_but",
            "choiceIndex": 1,
            "selected": "but",
            "ctxLeftHash": "9a2e31ab",
            "ctxRightHash": "d81f4c22"
          }
        ],
        "css": {
          "blockIds": [
            { "id": "css_a", "perm": [2,0,3,1] },
            { "id": "css_b", "perm": [1,3,0,2] }
          ]
        },
        "honey": {
          "token": "h_7f2a91c0c4",
          "url": "https://t.example.com/r/h_7f2a91c0c4"
        },
        "visible": {
          "enabled": false,
          "code": null
        }
      }
    }
  ]
}
```

**Rule:** manifest stores **artifacts and expected outputs**, not passphrases.

---

## F. `fingerprint()` orchestration

```js
const TRACE_VERSION = '8ZT1';
const ZW0 = '\u200B';
const ZW1 = '\u200C';

async function fingerprint(html, traceCtx){
  const seedBytes = typeof traceCtx.customerSeed === 'string'
    ? hexToBytes(traceCtx.customerSeed)
    : traceCtx.customerSeed;

  const traceIdBytes = await sha(cat(
    seedBytes,
    new TextEncoder().encode(`${TRACE_VERSION}|traceId|${traceCtx.assetId}|${traceCtx.customerId}`)
  ));
  const traceId = bytesToBase32(traceIdBytes.slice(0, 5)); // 8 chars

  const dom = new DOMParser().parseFromString(html, 'text/html');

  const manifestEntry = {
    customerId: traceCtx.customerId,
    traceId,
    seedHash: 'sha256:' + bytesToHex(await sha(seedBytes)),
    channels: {}
  };

  // 1) Honey-links
  {
    const sub = await deriveTraceSubseed(seedBytes, 'honey');
    const out = injectHoneyLinks(dom, traceCtx, traceId, sub);
    manifestEntry.channels.honey = out.manifest;
  }

  // 2) CSS ordering
  {
    const sub = await deriveTraceSubseed(seedBytes, 'css');
    const out = injectCssOrdering(dom, traceId, sub);
    manifestEntry.channels.css = out.manifest;
  }

  // 3) Synonym slots
  {
    const sub = await deriveTraceSubseed(seedBytes, 'syn');
    const out = injectSynonymSlots(dom, sub, traceCtx.maxSynonymSlots || 12);
    manifestEntry.channels.synonyms = out.manifest;
  }

  // 4) Zero-width payload
  {
    const sub = await deriveTraceSubseed(seedBytes, 'zws');
    const payloadBits = buildTracePayloadBits(traceId);
    const out = injectZeroWidth(dom, payloadBits, sub, traceCtx.zwsRepeats || 3);
    manifestEntry.channels.zws = out.manifest;
  }

  // 5) Optional visible stamp
  if (traceCtx.enableVisibleStamp){
    const code = buildVisibleCode(traceId);
    injectVisibleStamp(dom, code);
    manifestEntry.channels.visible = { enabled: true, code };
  } else {
    manifestEntry.channels.visible = { enabled: false, code: null };
  }

  return {
    html: '<!DOCTYPE html>\n' + dom.documentElement.outerHTML,
    manifestEntry
  };
}
```

---

## G. Channel implementations

## 1) Zero-width channel

### Payload

Use `traceId` plus CRC:

```js
function buildTracePayloadBits(traceId){
  const raw = new TextEncoder().encode('8ZT1|' + traceId);
  const crc = crc16(raw);
  const full = new Uint8Array(raw.length + 2);
  full.set(raw, 0);
  full[raw.length] = (crc >> 8) & 0xFF;
  full[raw.length + 1] = crc & 0xFF;
  return bytesToBits(full);
}
```

### Injection

* eligible nodes = visible text nodes, excluding `script/style/pre/code/textarea/noscript`
* insert after punctuation or word boundaries
* repeat full payload 3×

```js
function injectZeroWidth(dom, payloadBits, seedBytes, repeats){
  const rng = rngFromSeed(seedBytes);
  const nodes = getEligibleTextNodes(dom.body).filter(n => n.nodeValue.trim().length > 40);

  const fullBits = payloadBits.repeat(repeats);
  let bitIdx = 0;
  let inserted = 0;

  for (const node of nodes){
    if (bitIdx >= fullBits.length) break;
    const src = node.nodeValue;
    const anchors = [];
    for (let i = 0; i < src.length; i++){
      const ch = src[i];
      if (/[ .,;:!?)]/.test(ch)) anchors.push(i);
    }
    if (anchors.length < 8) continue;

    const step = 3 + Number(rng.n() % 5n); // sparse
    let out = '';
    let last = 0;

    for (let ai = 0; ai < anchors.length && bitIdx < fullBits.length; ai += step){
      const pos = anchors[ai];
      out += src.slice(last, pos + 1);
      out += (fullBits[bitIdx++] === '1') ? ZW1 : ZW0;
      last = pos + 1;
      inserted++;
    }
    out += src.slice(last);
    node.nodeValue = out;
  }

  return {
    manifest: {
      payloadBits,
      repeats,
      inserted
    }
  };
}
```

### Extraction

```js
function extractZeroWidthBits(text){
  let bits = '';
  for (const ch of text){
    if (ch === ZW0) bits += '0';
    else if (ch === ZW1) bits += '1';
  }
  return bits;
}
```

**Scoring:**
Compare extracted bitstream against each candidate payload repeated `repeats` times.
Similarity = matched bits / expected bits.
Weight low: **0.15**.

---

## 2) Synonym channel

### Dictionary

Keep it conservative. Do not touch code, identifiers, or technical terms.

```js
const SYNONYM_SETS = [
  { id:'however_but',        variants:['however', 'but'] },
  { id:'therefore_so',       variants:['therefore', 'so'] },
  { id:'for_example_eg',     variants:['for example', 'e.g.'] },
  { id:'purchase_buy',       variants:['purchase', 'buy'] },
  { id:'section_chapter',    variants:['section', 'chapter'] },
  { id:'start_begin',        variants:['start', 'begin'] },
  { id:'show_display',       variants:['show', 'display'] },
  { id:'help_assist',        variants:['help', 'assist'] }
];
```

### Injection logic

* walk eligible text nodes
* find candidate matches using whole-word regex
* choose sparse slots deterministically
* store context hashes around each slot

```js
function injectSynonymSlots(dom, seedBytes, maxSlots){
  const rng = rngFromSeed(seedBytes);
  const manifest = [];
  const nodes = getEligibleTextNodes(dom.body);

  let slots = [];
  nodes.forEach((node, nodeIndex) => {
    const text = node.nodeValue;
    SYNONYM_SETS.forEach(set => {
      set.variants.forEach((variant, choiceIndex) => {
        const re = new RegExp(`\\b${escapeRx(variant)}\\b`, 'gi');
        let m;
        while ((m = re.exec(text)) !== null){
          const left = normalizeText(text.slice(Math.max(0, m.index - 16), m.index));
          const right = normalizeText(text.slice(m.index + variant.length, m.index + variant.length + 16));
          slots.push({
            node, nodeIndex, setId: set.id, choiceIndex, source: m[0],
            start: m.index, end: m.index + variant.length,
            leftHash: shortHash(left),
            rightHash: shortHash(right),
            variants: set.variants
          });
        }
      });
    });
  });

  slots = dedupeSynonymSlots(slots);

  // deterministic sparse selection
  shuffleWithRng(slots, rng);
  slots = slots.slice(0, maxSlots);

  for (let i = slots.length - 1; i >= 0; i--){
    const s = slots[i];
    const choice = Number(rng.n() % BigInt(s.variants.length));
    const replacement = s.variants[choice];
    const t = s.node.nodeValue;
    s.node.nodeValue = t.slice(0, s.start) + replacement + t.slice(s.end);

    manifest.push({
      slotId: `syn_${String(i).padStart(3, '0')}`,
      setId: s.setId,
      choiceIndex: choice,
      selected: replacement.toLowerCase(),
      ctxLeftHash: s.leftHash,
      ctxRightHash: s.rightHash
    });
  }

  return { manifest };
}
```

### Detection

* normalize leaked text
* for each manifest slot, check if selected variant appears with roughly matching nearby context
* `slotScore = 1` exact, `0.5` weak context match, `0` no match

Weight: **0.25**.

---

## 3) CSS ordering channel

This is the cleanest HTML-only marker.

### Injection

Create inert style blocks:

```js
function injectCssOrdering(dom, traceId, seedBytes){
  const rng = rngFromSeed(seedBytes);
  const head = dom.head || dom.documentElement;

  const perms = [];
  for (let blockNo = 0; blockNo < 2; blockNo++){
    const ids = ['a', 'b', 'c', 'd'];
    const perm = permute(ids, rng);
    const style = dom.createElement('style');
    style.setAttribute('data-8zt-css', `css_${blockNo}`);
    style.textContent = perm.map(id => `._8zt_${traceId}_${id}{--x:${id.length};}`).join('\n');
    head.appendChild(style);
    perms.push({ id:`css_${blockNo}`, perm: perm.map(x => ids.indexOf(x)) });
  }

  return { manifest: { blockIds: perms } };
}
```

### Detection

Parse leaked HTML:

```js
function extractCssSignature(html){
  const matches = [...html.matchAll(/<style[^>]*data-8zt-css="([^"]+)"[^>]*>([\s\S]*?)<\/style>/gi)];
  return matches.map(m => {
    const order = [...m[2].matchAll(/_8zt_[A-Z0-9]+_([a-d])\{/gi)].map(x => x[1]);
    return { id: m[1], order };
  });
}
```

Weight: **0.20**.

---

## 4) Honey-link channel

### Injection

If page already has a footer or nav/help/contact link, append token there.
If not, inject a small footer anchor.

```js
function injectHoneyLinks(dom, traceCtx, traceId, seedBytes){
  const token = 'h_' + bytesToHex(seedBytes.slice(0, 6));
  const url = `${traceCtx.baseTraceUrl}/${token}`;

  let target = dom.querySelector('footer a, nav a[href], a[href*="contact"], a[href*="help"]');
  if (target){
    const sep = target.href.includes('?') ? '&' : '?';
    target.href += `${sep}t=${token}`;
    target.setAttribute('data-8zt-honey', token);
  } else {
    const footer = dom.createElement('div');
    footer.setAttribute('data-8zt-license', traceId);
    footer.style.cssText = 'font-size:11px;opacity:.65;margin-top:20px;';
    footer.innerHTML = `Licensed copy • <a href="${url}" data-8zt-honey="${token}">Help</a>`;
    (dom.body || dom.documentElement).appendChild(footer);
  }

  return {
    manifest: { token, url }
  };
}
```

### Detection

```js
function extractHoneyTokens(html){
  const tokens = new Set();
  [...html.matchAll(/[?&]t=(h_[a-f0-9]{12})/gi)].forEach(m => tokens.add(m[1]));
  [...html.matchAll(/data-8zt-honey="(h_[a-f0-9]{12})"/gi)].forEach(m => tokens.add(m[1]));
  return [...tokens];
}
```

**If honey token matches exactly:**
Return immediate strong evidence.
Weight: **0.40**.

---

## H. Optional visible stamp

For later screenshot support:

```js
function buildVisibleCode(traceId){
  return traceId.slice(0,4) + '-' + traceId.slice(4);
}
function injectVisibleStamp(dom, code){
  const el = dom.createElement('div');
  el.setAttribute('data-8zt-visible', code);
  el.style.cssText = 'position:fixed;right:12px;bottom:8px;font:11px monospace;opacity:.35;z-index:2147483647;';
  el.textContent = `Licensed ${code}`;
  (dom.body || dom.documentElement).appendChild(el);
}
```

Not required for MVP-1 leaked HTML detection, but worth adding now.

---

## I. `detect(leakedHtml, manifestDb)`

### Pre-extract features once

```js
function extractLeakFeatures(leakedHtml){
  const isHtml = /<html|<body|<div|<style|<a\b/i.test(leakedHtml);
  const textOnly = normalizeText(stripHtml(leakedHtml));
  return {
    isHtml,
    raw: leakedHtml,
    text: textOnly,
    zwsBits: extractZeroWidthBits(leakedHtml),
    honeyTokens: extractHoneyTokens(leakedHtml),
    cssSig: extractCssSignature(leakedHtml)
  };
}
```

### Candidate scoring

```js
function detect(leakedHtml, manifestDb){
  const feat = extractLeakFeatures(leakedHtml);
  const weights = manifestDb.channelWeights || { honey:.40, synonyms:.25, css:.20, zws:.15 };

  let best = null;
  let second = null;

  for (const rec of manifestDb.customers){
    const evidence = [];
    let total = 0;

    // HONEY
    const honey = rec.channels.honey;
    if (honey && feat.honeyTokens.includes(honey.token)){
      evidence.push({
        channel:'honey',
        match:1,
        observed:honey.token,
        expected:honey.token,
        weight:weights.honey
      });
      total += weights.honey;
    }

    // CSS
    const cssScore = scoreCss(feat.cssSig, rec.channels.css);
    if (cssScore > 0){
      evidence.push({
        channel:'css',
        match:cssScore,
        observed:feat.cssSig,
        expected:rec.channels.css,
        weight:weights.css
      });
      total += weights.css * cssScore;
    }

    // SYNONYMS
    const synScore = scoreSynonyms(feat.text, rec.channels.synonyms || []);
    if (synScore > 0){
      evidence.push({
        channel:'synonyms',
        match:synScore,
        observed:'contextual synonym matches',
        expected:rec.channels.synonyms,
        weight:weights.synonyms
      });
      total += weights.synonyms * synScore;
    }

    // ZWS
    const zwsScore = scoreZws(feat.zwsBits, rec.channels.zws);
    if (zwsScore > 0){
      evidence.push({
        channel:'zws',
        match:zwsScore,
        observed:feat.zwsBits.slice(0, 96),
        expected:rec.channels.zws.payloadBits,
        weight:weights.zws
      });
      total += weights.zws * zwsScore;
    }

    const candidate = {
      customerId: rec.customerId,
      score: total,
      evidence
    };

    if (!best || candidate.score > best.score){
      second = best;
      best = candidate;
    } else if (!second || candidate.score > second.score){
      second = candidate;
    }
  }

  if (!best) {
    return { customerId:null, confidence:0, channelsMatched:[], evidence:[], runnerUp:null };
  }

  const margin = second ? (best.score - second.score) : best.score;
  const confidence = clamp(0.15 + 0.70 * best.score + 0.25 * margin, 0, 0.99);

  // false-positive guard
  if (best.score < 0.45 || margin < 0.08){
    return {
      customerId:null,
      confidence:confidence * 0.5,
      channelsMatched:best.evidence.map(e => e.channel),
      evidence:best.evidence,
      runnerUp: second ? { customerId: second.customerId, score: second.score } : null
    };
  }

  return {
    customerId: best.customerId,
    confidence,
    channelsMatched: best.evidence.map(e => e.channel),
    evidence: best.evidence,
    runnerUp: second ? { customerId: second.customerId, score: second.score } : null
  };
}
```

---

## J. Scoring rules

Use these weights for MVP-1:

```js
{
  honey: 0.40,
  synonyms: 0.25,
  css: 0.20,
  zws: 0.15
}
```

### Channel-specific rules

* **Honey exact match:** `1.0`
* **CSS permutation exact:** `1.0`, partial `0.5`
* **Synonyms:** matched slots / expected slots, capped at `1.0`
* **ZWS:** matched bits / expected bits, capped at `1.0`

### Decision thresholds

* `score >= 0.85` and `margin >= 0.20` → **High confidence**
* `score >= 0.60` and `margin >= 0.10` → **Medium confidence**
* else → **Unknown / low confidence**

This prevents bad attribution.

---

## K. Minimal helper contracts

You already have `XS`, `sha`, `cat`, `b2u`. Add only these:

```js
function normalizeText(s){
  return (s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function shortHash(s){
  // use your existing sha() in async contexts; sync placeholder for manifests can be substituted
  return crc32(new TextEncoder().encode(normalizeText(s))).toString(16).padStart(8, '0');
}
function getEligibleTextNodes(root){
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node){
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.tagName;
      if (/^(SCRIPT|STYLE|PRE|CODE|TEXTAREA|NOSCRIPT)$/i.test(tag)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while ((n = walker.nextNode())) out.push(n);
  return out;
}
```

---

## L. Acceptance tests

**These are the kill-tests.**

### T1 — Full HTML leak

Input: saved full page HTML from browser.
Expected: honey + css + synonyms + zws all recover.
Acceptance: correct `customerId`, `confidence >= 0.95`.

### T2 — Plain-text paste leak

Input: copied article text pasted into plain text box, no HTML.
Expected: css/honey lost, zws may be stripped, synonyms survive.
Acceptance: either correct customer with `confidence >= 0.60`, or `unknown`. Never wrong high-confidence attribution.

### T3 — Sanitized HTML leak

Input: HTML where comments are stripped and zero-width removed.
Expected: honey + css + synonyms still enough.
Acceptance: correct `customerId`, `confidence >= 0.80`.

### T4 — Partial excerpt

Input: only 20–30% of page leaked.
Acceptance: medium confidence only if enough synonym slots or honey token survive; otherwise `unknown`.

### T5 — Adversarial edit

Input: attacker manually rewrites text and deletes links.
Acceptance: detector returns `unknown`, not a false accusation.

### T6 — Collision check

Generate 10,000 manifests for one asset.
Acceptance: zero duplicate honey tokens, zero duplicate traceIds, no repeated full channel fingerprint bundles.

---

## M. Exact patch points in your current code

### In packager flow

Inside `doShield()`, after HTML assembly and before `encryptSection(html, passphrase)`:

```js
const traced = await fingerprint(html, {
  traceVersion: '8ZT1',
  assetId: htmlFile,
  customerId,
  customerSeed,
  baseTraceUrl: 'https://t.example.com/r',
  enableVisibleStamp: false
});
html = traced.html;
manifestDb.customers.push(traced.manifestEntry);
```

### Output

For each customer build:

* `customerFile.8zv`
* `customerFile.trace.json` or append to one batch manifest DB

### Later decoder-shell mode

In `buildDecoderShell()` runtime, after `const html = await dec(...)` and before `document.write(html)`, you can do:

```js
const traced = await fingerprint(html, runtimeTraceCtx);
document.write(traced.html);
```

But not for MVP-1 first ship.

---

## N. Bottom line

**VERIFIED:** your current Shield already has the right assembly/encryption seam for this. 
**REASONED:** the strongest MVP is **build-time personalization before encryption**, with multi-channel manifests and a separate detector.
**SPECULATIVE but strong:** once this is working, moving the same engine into the decoder shell gives you lower storage and even tighter per-customer personalization.

The one-sentence version:

**Ship 8Z Trace MVP-1 as deterministic pre-encryption fingerprinting with 4 channels, per-customer manifests, and a false-positive-resistant detector.**

If you want the next step, I’ll turn this into **drop-in JS patches** against `8z_shield_smart.html` rather than the spec.


