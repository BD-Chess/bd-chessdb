/* GODS10 R2: render frozen data; no scoring, model calls or telemetry. */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'sl';
  const tr = (sl, en) => lang() === 'en' ? en : sl;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v, n = 2) => v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString(lang(), {minimumFractionDigits:n, maximumFractionDigits:n});
  const pct = v => v === null || v === undefined ? '—' : num(100 * v, 1) + '%';
  const criteria = ['insight', 'coherence', 'originality', 'clarity', 'credibility'];
  const criteriaSL = ['Uvid', 'Skladnost', 'Izvirnost', 'Jasnost', 'Verodostojnost'];
  let data;
  const author = id => data.display.authors[id] || data.authors[id] || id;
  const shortJudge = id => id.replace(/^web_/, '').replace(/_/g, ' ');
  const option = (value, label) => '<option value="' + esc(value) + '">' + esc(label) + '</option>';
  const interval = (a, b, n = 2) => num(a, n) + ' … ' + num(b, n);
  function table(id, headers, rows) {
    byId(id).innerHTML = '<thead><tr>' + headers.map(h => '<th scope="col">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody>';
  }
  function row(cells) {
    return '<tr>' + cells.map((s, i) => i === 0 ? '<th scope="row">' + s + '</th>' : '<td>' + s + '</td>').join('') + '</tr>';
  }
  function panel() { return data.panels[byId('r2-panel').value + '_' + byId('r2-universe').value]; }
  function variant() { return panel().variants.find(v => v.name === byId('r2-variant').value); }
  function decision(v) {
    if (!v.ranked) return tr('Samo opisno: pravilo najmanj 5 sodnikov in 3 družin ni izpolnjeno za vse nize.', 'Descriptive only: not every set meets the minimum of 5 judges and 3 families.');
    if (v.decision.winner) return tr('Zmagovalec v izbrani analizi: ', 'Winner in the selected analysis: ') + author(v.decision.winner) + ' · P(1) = ' + pct(v.decision.p_rank1);
    return tr('Brez razglašenega zmagovalca. Vodilna skupina: ', 'No declared winner. Leading group: ') + (v.decision.leading_group || []).map(author).join(' · ');
  }
  function renderRankings() {
    const p = panel(), v = variant();
    if (!v.family_bootstrap) byId('r2-bootstrap').value = 'model';
    const fam = byId('r2-bootstrap').value === 'family';
    byId('r2-decision').textContent = decision(v);
    const a = data.panels.baseline_all36.variants.find(x => x.name === 'all');
    const b = data.panels.recovered_all36.variants.find(x => x.name === 'all');
    byId('r2-comparison').textContent = tr('Prvi po točkovni oceni z: prvotnih 13 → ', 'Point leader by mean z: original 13 → ') + author(a.order[0]) + '; ' + tr('dopolnjenih 15 → ', 'recovered 15 → ') + author(b.order[0]) + '. ' + tr('Prvo mesto po oceni samo po sebi še ne pomeni razglašenega zmagovalca.', 'A point lead alone is not a declared winner.');
    table('r2-ranking', [tr('Mesto / avtor','Place / author'),'z',tr('95% interval z','95% z interval'),tr('95% interval mesta','95% rank interval'),'P(1)',tr('Sodniki / družine','Judges / families'),tr('Surova vsota · povp.','Raw total · mean'),'Borda'], v.table.map(r => row([
      (v.ranked ? esc(r.place) : '—') + ' · ' + esc(author(r.set)), num(r.primary_mean_z), interval(r.ci_lo,r.ci_hi), interval(r.rank_lo,r.rank_hi,0), pct(r.p_rank1), r.n_judges_z + ' / ' + r.n_families_z, num(r.raw_mean_total),num(r.borda_mean)
    ])));
    const c = byId('r2-criterion').value;
    const sorted = [...v.table].sort((a,b) => (b.criteria[c].z_mean ?? -Infinity) - (a.criteria[c].z_mean ?? -Infinity) || a.set.localeCompare(b.set));
    const familyRows = new Map((v.family_bootstrap?.rows || []).map(r => [r.set,r]));
    table('r2-criteria', [tr('Avtor','Author'),tr('Merilo · surovo povp.','Criterion · raw mean'),tr('Merilo · vsota','Criterion · sum'),tr('Merilo · z','Criterion · z'),tr('Mediana z','Median z'),tr('Obrezano povp. z','Trimmed mean z'),tr('Celotni z · 95% interval','Whole-set z · 95% interval'),tr('Interval mesta','Rank interval'),'P(1)'], sorted.map(r => {
      const boot = fam ? familyRows.get(r.set) : r, cr = r.criteria[c];
      return row([esc(author(r.set)),num(cr.raw_mean),num(cr.raw_sum,0),num(cr.z_mean),num(r.median_z),num(r.trimmed_mean_z),boot ? interval(boot.ci_lo,boot.ci_hi) : '—',boot ? interval(boot.rank_lo,boot.rank_hi,0) : '—',boot ? pct(boot.p_rank1) : '—']);
    }));
    byId('r2-bootstrap').querySelector('[value="family"]').disabled = !v.family_bootstrap;
    byId('r2-diagnostics').textContent = JSON.stringify({agreement:p.agreement,self_preference_exploratory_uncorrected:p.self_preference,position_FULL_only:p.position_effect_FULL_only || data.panels.baseline_all36.position_effect_FULL_only,two_letter_label_FULL_only:p.two_letter_label_effect_FULL_only || data.panels.baseline_all36.two_letter_label_effect_FULL_only,notes:p.notes},null,2);
  }
  function renderAnswers() {
    const a = byId('r2-author-a').value, b = byId('r2-author-b').value;
    const q = data.display.questions[lang()];
    byId('r2-answers').innerHTML = q.map((text, i) => '<article><h4>' + (i+1) + '. ' + esc(text) + '</h4><div class="r2-answer-pair">' + [a,b].map(s => '<div class="r2-answer"><strong>' + esc(author(s)) + '</strong><p lang="en">' + esc(data.sets[s].normalized[i]) + '</p></div>').join('') + '</div></article>').join('');
  }
  function renderVotes() {
    const votes = panel().best_per_question[byId('r2-vote-mode').value];
    byId('r2-votes').innerHTML = votes.questions.map(q => '<p><strong>Q' + q.q + '</strong> · n = ' + q.n_votes + ' · ' + tr('Zmagovalec: ','Winner: ') + esc(q.winner ? author(q.winner) : tr('ni','none')) + '<br>' + q.counts.map(c => esc(author(c.set)) + ': ' + c.votes + ' (' + pct(c.share) + ')').join(' · ') + '</p>').join('');
    // Local choices retain packet codes; the original key resolves each code.
    byId('r2-split').textContent = JSON.stringify(data.split_local_votes,null,2);
  }
  function renderMatrix() {
    const p = panel(), v = variant(), m = p.matrix, metric = byId('r2-matrix-metric').value;
    const selected = new Set(v.judges_selected), ranked = new Map(v.table.map((r,i) => [r.set,i]));
    const sets = [...m.sets].sort((a,b) => ranked.get(a)-ranked.get(b));
    table('r2-matrix', [tr('Avtor','Author'),...m.judges.map(shortJudge)], sets.map(s => {
      const k = m.sets.indexOf(s);
      const cells = m.judges.map((j,i) => {
        const own = v.own_level === 3 ? m.own_l3[i][k] : (v.own_level === 1 || v.own_level === 2) && (s === j || data.authors[s] === j.replace(/^web_/,'free_'));
        const omitted = !selected.has(j) || own;
        const value = metric === 'total' ? m.totals[i][k] : metric === 'z' ? m.z[i][k] : m.criteria[i][k][Number(metric)];
        const partial = !m.score_valid[i];
        const suffix = value === null ? '' : partial ? '*' : omitted ? ' ×' : '';
        return '<td' + (partial || omitted ? ' class="r2-excluded"' : '') + '>' + num(value,metric==='z'?2:0) + suffix + '</td>';
      });
      return '<tr><th scope="row">' + esc(author(s)) + '</th>' + cells.join('') + '</tr>';
    }));
  }
  function labels() {
    const previous = byId('r2-variant').value || 'all';
    const names = {
      all:tr('Vse ocene','All scores'),own_l3:tr('Brez lastnih družin','Exclude own families'),
      own_l2:tr('Brez lastnega modela','Exclude own model'),own_l1:tr('Brez lastnega niza','Exclude exact own set'),
      family_weighted:tr('Enaka teža družin','Equal family weight'),no_incoherent:tr('Brez neskladnih sodnikov','Exclude incoherent judges'),
      no_claude_gpt:tr('Brez Anthropic / OpenAI','Exclude Anthropic / OpenAI')
    };
    byId('r2-variant').innerHTML = panel().variants.map(v => option(v.name,names[v.name] || v.name)).join('');
    byId('r2-variant').value = previous;
    const previousCriterion = byId('r2-criterion').value || 'insight';
    byId('r2-criterion').innerHTML = criteria.map((c,i) => option(c,tr(criteriaSL[i],c))).join('');
    byId('r2-criterion').value = previousCriterion;
  }
  function render() { if (!data) return; byId('r2-load').textContent=tr('Podatki R2 naloženi.','R2 data loaded.');labels();renderRankings();renderAnswers();renderVotes();renderMatrix(); }
  async function start() {
    try {
      const response = await fetch('data/GODS10_RESULTS_R2.json');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      data = await response.json();
      if (data.schema !== 'gods10.extension.results.v1' || !data.display || !data.panels.recovered_all36 || Object.keys(data.authors).length !== 36) throw new Error('Invalid R2 data');
      const authors = Object.keys(data.authors).sort((a,b) => author(a).localeCompare(author(b)));
      ['r2-author-a','r2-author-b'].forEach(id => {byId(id).innerHTML = authors.map(s => option(s,author(s))).join('');});
      byId('r2-author-a').value = data.panels.recovered_all36.variants.find(v=>v.name==='all').order[0];
      byId('r2-author-b').value = authors.find(s => data.authors[s] === 'BD') || authors[1];
      byId('r2-app').hidden = false;
      byId('r2-load').textContent = tr('Podatki R2 naloženi.','R2 data loaded.');
      byId('r2-app').addEventListener('change',render);
      new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
      render();
    } catch (e) {
      byId('r2-load').textContent = tr('Podatkov ni mogoče naložiti; uporabi spodnji JSON in izvirnike. ','Data could not be loaded; use the JSON and originals below. ') + e.message;
    }
  }
  start();
})();
