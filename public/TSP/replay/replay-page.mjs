// The public replay page of mdlxdcc.org/tsp/replay/ (BD × AI Lab, 16 Nov 2026): two recorded runs of 8zTSP's browser demo,
// played back with 8zTSP-web's own player (replay-player.mjs, replay-data.mjs, replay-copy.mjs, distance-format.mjs,
// unchanged from its public package d68e2cdd…). Nothing is computed here. A recording is fetched only when the visitor
// opens it, so the page itself stays small on a phone.
import { mountReplay } from './replay-player.mjs';
import { parseRecording, REPLAY_LIMITS } from './replay-data.mjs';
import { REPLAY_COPY } from './replay-copy.mjs';
const root = document.getElementById('publicReplay'), message = document.getElementById('recordingMessage');
const player = mountReplay(root);
const lang = () => ((document.documentElement.dataset.lang || document.documentElement.lang || 'en').startsWith('sl') ? 'sl' : 'en');
const label = () => root.setAttribute('aria-label', REPLAY_COPY[lang()].heading);
label(); new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
let request = 0;
async function open(path, button) {
  const token = ++request;
  player.clear(); message.textContent = ''; root.hidden = false;
  for (const b of document.querySelectorAll('[data-recording]')) b.setAttribute('aria-pressed', String(b === button));
  message.textContent = lang() === 'sl' ? 'Nalagam posnetek …' : 'Loading the recording …';
  try {
    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) throw Error(String(response.status));
    const text = await response.text();
    if (new TextEncoder().encode(text).length > REPLAY_LIMITS.fileBytes) throw Error('too large');
    const data = parseRecording(text);
    if (token !== request) return;
    message.textContent = '';
    player.setRecording(data);
    // below the site's sticky top bar, whatever its height (on a phone its links take several rows)
    const bar = document.querySelector('.top')?.getBoundingClientRect().bottom || 0;
    scrollTo({ top: scrollY + root.getBoundingClientRect().top - bar - 12, behavior: 'smooth' });
    document.getElementById('replayPlay')?.click();
  } catch { if (token === request) message.textContent = REPLAY_COPY[lang()].invalid; }
}
for (const b of document.querySelectorAll('[data-recording]')) b.addEventListener('click', () => open(b.dataset.recording, b));
window.tsp8zPublicReplay = { player, open };
