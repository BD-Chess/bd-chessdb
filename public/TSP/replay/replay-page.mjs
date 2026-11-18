// The public replay page of mdlxdcc.org/tsp/replay/ (BD × AI Lab, 16 Nov 2026): two recorded runs of 8zTSP's browser demo,
// played back with 8zTSP-web's own player (replay-player.mjs, replay-data.mjs, replay-copy.mjs, distance-format.mjs,
// unchanged from its public package d68e2cdd… apart from one addition of 18 Nov 2026 in the player: a recording's east-west
// scale, applied when drawing). Nothing is computed here. A recording is fetched only when the visitor
// opens it, so the page itself stays small on a phone.
// R53 B (18 Nov 2026): a recording of a map stored as latitude, longitude (nu3496: the University of Waterloo's file, west as
// positive numbers) is turned north-up, east to the right. A turn keeps every recorded length exact, so the player's own check of
// them passes; the east-west scale, cos(mean latitude) as in the demo, goes to the player as xScale and is applied when drawing.
// The map is known by the SHA-256 of its file.
import { mountReplay } from './replay-player.mjs';
import { parseRecording, REPLAY_LIMITS } from './replay-data.mjs';
import { REPLAY_COPY } from './replay-copy.mjs';
const root = document.getElementById('publicReplay'), message = document.getElementById('recordingMessage');
const player = mountReplay(root);
const lang = () => ((document.documentElement.dataset.lang || document.documentElement.lang || 'en').startsWith('sl') ? 'sl' : 'en');
const label = () => root.setAttribute('aria-label', REPLAY_COPY[lang()].heading);
label(); new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
const DISPLAY = { '95aebc8fd9907b94ef644a7e9bd0662e24644cfc58963bc121abbe6696c96e74': { north: 1, east: -1, xScale: 0.975783 } };   // nu3496
function northUp(data) {
  const d = DISPLAY[data.inputSha256]; if (!d || data.sampled) return data;
  const p = data.points; for (let i = 0; i < p.length; i += 2) { const lat = p[i], lon = p[i + 1]; p[i] = d.east * lon; p[i + 1] = d.north * lat; }
  data.xScale = d.xScale; return data;
}
// R53 D (18 Nov 2026): under the player the demo's reference line (R53 B), built as the demo builds it, from the demo's own map list
// and distance format (/8zTSP/, fetched only when a recording opens), so it follows the demo's references without an edit here.
const refBox = document.getElementById('replayRef');
const REF = {
  en: { opt: v => `Optimum ${v} (proved)`, bound: (v, s) => `Lower bound ${v}${s ? ` (${s})` : ''}`, best: (v, s) => `Best known tour ${v}${s ? ` (${s})` : ''}`,
    hk: (v, est) => `${est ? 'Held–Karp estimate' : 'Held–Karp bound'} ${v}`, none: 'No reference length yet', waterloo: 'University of Waterloo' },
  sl: { opt: v => `Optimum ${v} (dokazan)`, bound: (v, s) => `Spodnja meja ${v}${s ? ` (${s})` : ''}`, best: (v, s) => `Najboljša znana pot ${v}${s ? ` (${s})` : ''}`,
    hk: (v, est) => `${est ? 'Ocena Held–Karp' : 'Meja Held–Karp'} ${v}`, none: 'Referenčne dolžine še ni', waterloo: 'Univerza Waterloo' } };
async function refLine(sha) {
  const [{ examples, gapDisplay }, { formatDistance }] = await Promise.all([import('/8zTSP/examples.mjs'), import('/8zTSP/distance-format.mjs')]);
  const m = examples.find(e => e.sha256 === sha); if (!m) return null;
  const line = L => {
    const T = REF[L], d = v => formatDistance(v, m.unit ?? null, L), sl = L === 'sl';
    const day = iso => { if (!iso) return ''; const [y, mo, da] = iso.split('-').map(Number); return sl ? `${da}. ${mo}. ${y}` : new Date(Date.UTC(y, mo - 1, da)).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}); };
    const src = [m.credit?.includes('University of Waterloo') ? T.waterloo : m.bestTourKind === 'challenge-2002' ? 'DIMACS 2002' : '', day(m.referenceDate)].filter(Boolean).join(', ');
    if (m.optimum) return T.opt(d(m.optimum));
    const parts = [];
    if (m.gapStatus) {
      const g = gapDisplay(m.gapStatus, L);
      if (m.gapStatus.lowerBound) parts.push(T.bound(d(m.gapStatus.lowerBound), [m.gapStatus.boundSource, g.boundAsOf].filter(Boolean).join(', ')));
      if (m.gapStatus.tourLength) parts.push(T.best(d(m.gapStatus.tourLength), [m.gapStatus.tourSource, g.tourDate].filter(Boolean).join(', ')));
    } else {
      if (m.bound) parts.push(m.boundKind === 'certified' ? T.bound(d(m.bound), src) : T.hk(d(Math.round(m.bound)), m.boundKind === 'estimate'));
      if (m.bestKnownTour) parts.push(T.best(d(m.bestKnownTour), [m.bestKnownBy?.[L], src].filter(Boolean).join(', ')));
    }
    return parts.length ? parts.join(' · ') : T.none;
  };
  return { en: line('en'), sl: line('sl') };
}
async function showRef(sha, token) {
  let r = null; try { r = await refLine(sha); } catch { r = null; }
  if (!r || token !== request) return;
  refBox.replaceChildren(...['en', 'sl'].map(L => Object.assign(document.createElement('span'), { className: `l-${L}`, lang: L, textContent: r[L] })));
  refBox.hidden = false;
}
let request = 0;
async function open(path, button) {
  const token = ++request;
  player.clear(); message.textContent = ''; root.hidden = false; refBox.hidden = true; refBox.replaceChildren();
  for (const b of document.querySelectorAll('[data-recording]')) b.setAttribute('aria-pressed', String(b === button));
  message.textContent = lang() === 'sl' ? 'Nalagam posnetek …' : 'Loading the recording …';
  try {
    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) throw Error(String(response.status));
    const text = await response.text();
    if (new TextEncoder().encode(text).length > REPLAY_LIMITS.fileBytes) throw Error('too large');
    const data = northUp(parseRecording(text));
    if (token !== request) return;
    message.textContent = '';
    player.setRecording(data); showRef(data.inputSha256, token);
    // below the site's sticky top bar, whatever its height (on a phone its links take several rows)
    const bar = document.querySelector('.top')?.getBoundingClientRect().bottom || 0;
    scrollTo({ top: scrollY + root.getBoundingClientRect().top - bar - 12, behavior: 'smooth' });
    document.getElementById('replayPlay')?.click();
  } catch { if (token === request) message.textContent = REPLAY_COPY[lang()].invalid; }
}
for (const b of document.querySelectorAll('[data-recording]')) b.addEventListener('click', () => open(b.dataset.recording, b));
window.tsp8zPublicReplay = { player, open, northUp, refLine };
