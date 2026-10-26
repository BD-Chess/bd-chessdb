import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Static, escaped HTML keeps the editorial snapshot readable without JavaScript.
const root = new URL('../public/news/', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/news-20261024.json', root), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const date = new Intl.DateTimeFormat('sl-SI', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${data.date}T00:00:00Z`));
const external = (url, label) => {
  if (new URL(url).protocol !== 'https:') throw new Error('News sources must use HTTPS');
  return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} <span aria-hidden="true">↗</span></a>`;
};

for (const [section, label, symbol, other, otherLabel] of [
  ['world', 'World News', 'W10', 'slovenia', 'Slovenian News'],
  ['slovenia', 'Slovenian News', 'SI', 'world', 'World News']
]) {
  const items = data[section];
  if (items.length !== 10 || items.some((item, i) => item.rank !== i + 1)) throw new Error('Expected ten ranked stories');
  const sourceCount = items.reduce((count, item) => count + item.sources.length, 0);
  const cards = items.map(item => `<article class="story" id="news-${item.rank}" aria-labelledby="title-${item.rank}">
      <div class="story-heading"><span class="rank" aria-label="Mesto ${item.rank}">${String(item.rank).padStart(2, '0')}</span><div><p class="topic">${escape(item.topic)}</p><h2 id="title-${item.rank}">${escape(item.title)}</h2><ul class="regions" aria-label="Regije">${item.regions.map(region => `<li>${escape(region)}</li>`).join('')}</ul></div><a class="permalink" href="#news-${item.rank}" aria-label="Povezava na novico ${item.rank}">#</a></div>
      <p class="summary">${escape(item.summary)}</p>
      <div class="story-context"><section><h3>Zakaj je pomembno</h3><p>${escape(item.why)}</p></section><section><h3>Kako poročajo različni</h3><p>${escape(item.perspectives)}</p></section></div>
      <section class="uncertainty"><h3><span aria-hidden="true">◌</span> Negotovo</h3><p>${escape(item.uncertainty)}</p></section>
      <div class="sources"><h3>Viri <span>${item.sources.length}</span></h3><ul>${item.sources.map(source => `<li>${external(source.url, source.outlet)}<small>${escape(source.country)}</small></li>`).join('')}</ul></div>
    </article>`).join('\n');
  const html = `<!doctype html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta name="theme-color" content="#0a111c">
  <meta name="description" content="Top 10 ${label}: uredniški izbor dveh modelov, posnetek ${date}. Povzetki, različni pogledi, negotovosti in viri.">
  <title>Top 10 ${label} · ${date} · AI8</title>
  <link rel="canonical" href="https://www.mdlxdcc.org/news/${section}">
  <link rel="stylesheet" href="/news/news.css?v=20261024-r1">
  <script src="/news/news.js?v=20261024-r1" defer></script>
</head>
<body>
  <a class="skip" href="#novice">Na novice</a>
  <div class="shell">
    <header class="site-header"><a class="brand" href="/Start/"><span class="brand-mark" aria-hidden="true">↔</span><span>AI8 <b>News</b></span></a><nav aria-label="Glavna navigacija"><a href="/Start/">Start ↗</a><a href="https://www.mdlxdcc.org/ai8/cli-loops">CLI Loops ↗</a><button id="theme-toggle" type="button" hidden aria-pressed="false">Svetli način</button></nav></header>
    <main>
      <section class="hero" aria-labelledby="page-title"><div><p class="eyebrow">DVA POGLEDA · EN UREDNIŠKI IZBOR</p><h1 id="page-title"><span>Top 10</span><br>${label}</h1><p class="intro">Kaj se dogaja. Zakaj šteje.<br>In kaj še ostaja odprto.</p></div><aside class="snapshot"><span class="snapshot-symbol" aria-hidden="true">${symbol}</span><p>DATUM POSNETKA</p><time datetime="${escape(data.date)}">${date}</time><span>10 novic · ${sourceCount} povezav na vire</span><small>Arhivski izbor · brez sprotnega osveževanja</small></aside></section>
      <nav class="editions" aria-label="Izbor novic"><a href="/news/world.html" ${section === 'world' ? 'aria-current="page"' : ''}>W10 <span>World News</span></a><a href="/news/slovenia.html" ${section === 'slovenia' ? 'aria-current="page"' : ''}>SI <span>Slovenian News</span></a></nav>
      <section class="method" aria-labelledby="method-title"><div><p class="eyebrow">KAKO JE NASTAL IZBOR</p><h2 id="method-title">Dva slepa zbiralca.<br>Debata dveh modelov.</h2></div><div><p>Codex in Claude sta neodvisno zbrala kandidate, nato sta GPT in Claude v debati prek 8zListener LOOP CLI uskladila izbor. Cilj je uravnoteženost po državah, medijih in političnem spektru; nesoglasja so ohranjena.</p><details><summary>Metoda in omejitve izbora</summary><p>${escape(data.method_note)}</p></details></div></section>
      <section id="novice" aria-label="Deset izbranih novic"><div class="section-heading"><p class="eyebrow">${section === 'world' ? 'SVET' : 'SLOVENIJA'} / 24. 10. 2026</p><span>01 — 10</span></div>${cards}</section>
      <aside class="dissent" aria-labelledby="dissent-title"><p class="eyebrow">OHRANJENO NESOGLASJE</p><h2 id="dissent-title">Izbor ne izbriše drugih pogledov.</h2><p>${escape(data.dissent)}</p></aside>
    </main>
    <footer><p class="editorial-note"><strong>Uredniški izbor modelov iz povzetkov virov.</strong> Izvirni članki niso bili ponovno preverjeni. Izbor ni popoln pregled dogajanja; več povzetkov iste agencije ne pomeni več neodvisnih potrditev.</p><div class="footer-links"><span>AI8 · BD × GPT × Claude</span><a href="/news/${other}.html">Top 10 ${otherLabel} ↗</a><a href="/news/data/news-20261024.json">Podatkovni posnetek ↗</a><a href="/Start/">Start ↗</a></div></footer>
  </div>
</body>
</html>
`;
  writeFileSync(new URL(`${section}.html`, root), html);
  console.log(`Built ${fileURLToPath(new URL(`${section}.html`, root))}`);
}
