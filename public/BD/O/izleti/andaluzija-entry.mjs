// The public demo selects its runtime before any owner data, auth or store loads.
const demo = new URLSearchParams(location.search).get('demo') === 'glance';
if (demo) {
  document.body.replaceChildren();
  await import('./andaluzija-demo.mjs');
} else {
  for (const path of ['./andaluzija-2027-data.js?v=20261021-shield2', './andaluzija-2027.js?v=20261021-portrait2', '../../../Trip/new/road-matrix.js', './andaluzija-shield-core.js']) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = new URL(path, import.meta.url); script.onload = resolve; script.onerror = reject; document.head.append(script);
    });
  }
  await import('./andaluzija-planner.mjs?v=20261021-map1');
  await import('./andaluzija-ai.mjs?v=20261021-map1');
  await import('../../../shared/dualframe-album.mjs?v=20261021-fullscreen4');
}
