/* Read-only public evidence view. No inference, API keys or runtime routing. */
"use strict";
(() => {
  const homeChart = document.getElementById("home-chart");
  const homeDetails = document.getElementById("home-details");
  const cloudDetails = document.getElementById("cloud-details");
  const slaifChart = document.getElementById("slaif-chart");
  const slaifDetails = document.getElementById("slaif-details");
  const sourceList = document.getElementById("source-list");
  if (![homeChart, homeDetails, cloudDetails, slaifChart, slaifDetails, sourceList].every(Boolean)) return;
  const plusBox = document.getElementById("home-plus");
  const plusBody = document.getElementById("home-plus-body");
  let data = null, lastLang = "";
  // Dated timestamps only: ISO-8601 UTC (Z or +00:00).
  const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/;
  const utcMs = (value) => typeof value === "string" && ISO_UTC.test(value) ? Date.parse(value) : NaN;
  // Availability is fail-closed: UNKNOWN is always allowed; AVAILABLE/UNAVAILABLE only with a dated,
  // non-future observation from a test result. Any other value is rejected.
  function datedAvailability(value, observed) {
    if (value === "UNKNOWN") return observed === undefined || observed === null || Number.isFinite(utcMs(observed));
    if (value !== "AVAILABLE" && value !== "UNAVAILABLE") return false;
    const at = utcMs(observed);
    return Number.isFinite(at) && at >= Date.UTC(2026, 0, 1) && at <= Date.now() + 10 * 60e3;
  }
  const language = () => document.documentElement.lang === "en" ? "en" : "sl";
  const say = (sl, en) => language() === "en" ? en : sl;
  const el = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  };
  const time = (seconds) => seconds === null || seconds === undefined ? "—" :
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  function clear(node) { node.replaceChildren(); }
  function line(name, score, total, kind) {
    const row = el("div", "bar-line");
    row.append(el("span", "", name));
    const track = el("div", "track");
    if (score === null) {
      track.setAttribute("aria-label", say("Ni primerljive ocene", "No comparable score"));
    } else {
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `${name}: ${score}/${total}`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", String(total));
      track.setAttribute("aria-valuenow", String(score));
      const fill = el("span", `fill${kind === "rhp" ? " rhp" : ""}`);
      fill.style.setProperty("--width", `${score * 100 / total}%`);
      track.append(fill);
    }
    row.append(track, el("span", "bar-value", score === null ? "—" : `${score}/${total}`));
    return row;
  }
  function detail(title, paragraphs) {
    const item = el("details");
    item.append(el("summary", "", title));
    const body = el("div", "detail-body");
    paragraphs.forEach((paragraph) => body.append(el("p", "", paragraph)));
    item.append(body);
    return item;
  }
  function validate(catalog, evidence) {
    if (catalog?.schema !== "ai8.model-catalog-public.v1" || evidence?.schema !== "ai8.model-results-evidence.v1" ||
        evidence.catalog_schema !== catalog.schema) throw Error("schema");
    if (evidence.home?.scores?.length !== 8 || evidence.cloud?.advisory_observations?.length !== 4 ||
        evidence.slaif?.length !== 3 || catalog.items?.length !== 21) throw Error("counts");
    if (evidence.home.scores.some((row) => !Number.isInteger(row.basic_pass) || row.basic_pass < 0 || row.basic_pass > 10 ||
      (row.rhp_pass !== null && (!Number.isInteger(row.rhp_pass) || row.rhp_pass < 0 || row.rhp_pass > 10)))) throw Error("home scores");
    if (evidence.slaif.some((row) => !Number.isInteger(row.pass) || !Number.isInteger(row.total) || row.pass > row.total)) throw Error("slaif scores");
    const ids = new Map(catalog.items.map((row) => [row.id, row]));
    if (ids.size !== 21) throw Error("duplicate catalog IDs");
    if (catalog.items.some((row) => !datedAvailability(row.current_availability, row.availability_observed_utc))) throw Error("availability");
    const name = (id, group) => {
      const row = ids.get(id);
      if (!row || row.deployment !== group) throw Error("unmatched catalog ID");
      return row.name;
    };
    const observations = new Map(evidence.cloud.advisory_observations.map((row) => [row.id, row]));
    if (observations.size !== 4) throw Error("duplicate advisory ID");
    if (catalog.items.filter((row) => row.deployment === "CLOUD_MAL").length !== 10 ||
        evidence.cloud.advisory_observations.some((row) => !ids.has(row.id) ||
          row.exact_profile_match !== (ids.get(row.id).evidence_state === "TESTED"))) throw Error("cloud evidence mismatch");
    return {
      home: { configurations: evidence.home.scores.map((row) => ({...row, name: name(row.id, "HOME_LOCAL")})) },
      cloud: { providers: catalog.items.filter((row) => row.deployment === "CLOUD_MAL").map((row) => ({
        id: row.id, name: row.name, observed_advisory: observations.has(row.id),
        exact_profile_match: observations.get(row.id)?.exact_profile_match === true,
      })) },
      slaif: evidence.slaif.map((row) => ({...row, name: name(row.id, "SLAIF_REMOTE_HISTORICAL")})),
      source_reports: evidence.source_reports,
    };
  }
  function renderHome() {
    clear(homeChart); clear(homeDetails);
    const notes = {
      "home-qwen3.8-q6": ["Trije RHP odgovori so ostali nepopolni pri omejitvi izhoda.", "Three RHP answers were incomplete at the output limit."],
      "home-magistral-q6": ["RHP: sedem FAIL in tri prekinitve zaradi virov; ta niz ni primerljiva vsebinska ocena.", "RHP: seven FAIL and three resource interruptions; this is not a comparable content score."],
      "home-gemma4-q5": ["RHP: deset prekinitev zaradi virov; vsebinske ocene ni.", "RHP: ten resource interruptions; no content score."],
      "home-gemma4-q6": ["RHP: deset nalog je bilo zadržanih pred generiranjem; vsebinske ocene ni.", "RHP: ten tasks were held before generation; no content score."],
      "home-ministral3-q8": ["Ločen HMAL preizkus je porabil kontekst 4096 brez končnega odgovora.", "A separate HMAL check used the 4096-token context without a final answer."],
    };
    data.home.configurations.forEach((row) => {
      const wrapper = el("div", "model-row");
      wrapper.append(el("div", "model-name", row.name));
      const pair = el("div", "bar-pair");
      pair.append(line(say("Osn.", "Basic"), row.basic_pass, 10, "basic"));
      pair.append(line("RHP", row.rhp_pass, 10, "rhp"));
      wrapper.append(pair, el("div", "time", `${time(row.basic_median_seconds)} / ${time(row.rhp_median_seconds)}`));
      homeChart.append(wrapper);
      const note = notes[row.id];
      homeDetails.append(detail(row.name, [
        `${say("Osnovni PASS", "Basic PASS")}: ${row.basic_pass}/10; RHP: ${row.rhp_pass === null ? say("brez primerljive ocene", "no comparable score") : `${row.rhp_pass}/10`}.`,
        `${say("Mediana odgovora", "Response median")}: ${time(row.basic_median_seconds)} / ${time(row.rhp_median_seconds)} (min:s).`,
        note ? say(note[0], note[1]) : say("Izid velja za ta niz desetih nalog, ne za splošno kakovost modela.", "The result covers these ten tasks, not general model quality."),
      ]));
    });
  }
  function renderCloud() {
    clear(cloudDetails);
    const names = data.cloud.providers.map((row) => {
      const state = row.observed_advisory ? (row.exact_profile_match ?
        say("opažen izhod in natančno ujemanje ID-ja", "observed output with exact ID match") :
        say("opažen izhod, vendar drugačen ID modela", "observed output, but a different model ID")) :
        say("v pregledanih virih ni ustreznega izida", "no qualifying output in reviewed sources");
      return `${row.name}: ${state}.`;
    });
    cloudDetails.append(detail(say("Vseh deset ponudnikov", "All ten providers"), names));
    cloudDetails.append(detail("MAL T001–T010 · PREPARED_OFFLINE", [
      say("Zamrznjeni testi, ocenjevalnik in predaja so bili pripravljeni. V pregledanih dokazilih ni potrjenega končnega enotnega teka desetih oblačnih modelov, zato ni številčnih kakovostnih ocen ali razvrstitve.",
        "Frozen cases, scoring code and a handoff were prepared. The reviewed evidence contains no verified completed uniform run of ten cloud models, so there are no numerical quality scores or ranking."),
      say("Prijavljena razpoložljivost v registru ni dokaz delujočega dostopa danes.", "Declared registry availability is not proof of working access today."),
    ]));
  }
  function renderSlaif() {
    clear(slaifChart); clear(slaifDetails);
    const byId = Object.fromEntries(data.slaif.map((row) => [row.id, row]));
    const items = [byId["slaif-qwen3.8-q8"], byId["slaif-gams3-12b-q8"], byId["slaif-gemma4-26b-q8"]];
    const labels = ["T001–T007", "T001–T010", say("strogi format/funkcija", "strict format/function")];
    items.forEach((row, index) => {
      const wrapper = el("div", "slaif-row");
      const name = el("div", "model-name", row.name);
      name.append(el("small", "", labels[index]));
      const track = el("div", "track");
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `${row.name}: ${row.pass}/${row.total} ${labels[index]}`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", String(row.total));
      track.setAttribute("aria-valuenow", String(row.pass));
      const fill = el("span", "fill");
      fill.style.setProperty("--width", `${row.pass * 100 / row.total}%`);
      track.append(fill);
      wrapper.append(name, track, el("span", "bar-value", `${row.pass}/${row.total}`));
      slaifChart.append(wrapper);
    });
    slaifDetails.append(detail("Qwen3.8 27B Q8", [
      say("Zgodovinski zamrznjeni T001–T007: 7/7 PASS; T008–T010 niso bili izvedeni za ta rezultat.", "Historical frozen T001–T007: 7/7 PASS; T008–T010 were not run for this result."),
      say("V ločenih raziskovalnih pilotih je bilo 18/18 tehnično uspešnih API klicev. Stabilna korist proti močnim običajnim kontrolam ni potrjena.", "Separate research pilots had 18/18 technically successful API calls. Stable benefit over strong conventional controls is unconfirmed."),
    ]));
    slaifDetails.append(detail("GaMS3 12B Instruct Q8", [
      say("Zamrznjeni T001–T010: 7 PASS, 3 FAIL; deset dejanskih zahtev, brez ponovitev.", "Frozen T001–T010: 7 PASS, 3 FAIL; ten actual requests with no retries."),
      say("To je isti niz T001–T007 kot Qwenov zgodovinski podnabor, vendar ne ista dolžina celotnega niza.", "T001–T007 overlap with Qwen's historical subset, but the full series length differs."),
    ]));
    slaifDetails.append(detail("Gemma4 26B-A4B IT Q8", [
      say("Konsolidiranih je 27 API zahtev (26 HTTP 200, en HTTP 400). V ciljnem strogem formatu/funkciji je uspelo 2/10; to ni splošna ocena.", "The consolidated session has 27 API requests (26 HTTP 200, one HTTP 400). A targeted strict format/function set passed 2/10; this is not a general score."),
      say("V ločeni ujemajoči primerjavi razporejanja z Qwenom so bili trije izbrani Gemmini izidi slabši za 1,60 %, 0,40 % in 8,13 %. Gre za majhen soroden testni nabor, ne za splošno rangiranje.", "In a separate matched scheduling comparison with Qwen, three selected Gemma outcomes were worse by 1.60%, 0.40% and 8.13%. This is a small related test set, not a general ranking."),
    ]));
  }
  function renderSources() {
    clear(sourceList);
    data.source_reports.forEach((name) => sourceList.append(el("li", "", name)));
  }
  function render() {
    if (!data || lastLang === language()) return;
    lastLang = language();
    renderHome(); renderCloud(); renderSlaif(); renderSources();
  }
  /* ---- HOME supplementary snapshot (model-results-home.json) + accepted inbox results ---- */
  const VERDICTS = new Set(["PASS", "FAIL", "TIMEOUT", "INCOMPLETE", "INCOMPLETE_RESOURCE_ABORT", "HELD_RESOURCE", "HELD_SOURCE", "HELD_DEPENDENCY"]);
  const BASE_CAMPAIGNS = ["HOME_ALL_LLMS_T001_T010_20261022_R1", "HOME_TIMEOUT_1H_RETEST_FOUR_20261022_R1", "HOME_ALL_LLMS_RHP_T001_T010_20261022_R1"];
  const CAMPAIGNS = {
    HOME_ALL_LLMS_T001_T010_20261022_R1: ["orig", "Izvirni osnovni niz", "Original basic series"],
    HOME_TIMEOUT_1H_RETEST_FOUR_20261022_R1: ["retry", "Enourne ponovitve štirih TIMEOUT", "One-hour retries of four TIMEOUTs"],
    HOME_ALL_LLMS_RHP_T001_T010_20261022_R1: ["orig", "Izvirni RHP niz", "Original RHP series"],
    HOME_MISTRAL_PEER_HYBRID_T001_T010_20261022_R1: ["add", "Mistral peer/hibrid", "Mistral peer/hybrid"],
    HOME_MISTRAL_TWO_LOOPS_T001_T010_20261022_R1: ["add", "Mistral dve zanki", "Mistral two loops"],
    HOME_MISTRAL_RESOURCE_SUPPLEMENT_20261025_R1: ["add", "Mistral dopolnitev virov", "Mistral resource supplement"],
    HOME_NON_GEMMA_RESOURCE_RECHECK_20261025_R1: ["add", "Ponovna preverba virov brez Gemme", "Non-Gemma resource recheck"],
    HOME_NIGHT_RESOURCE_SUPPLEMENT_20261026_R1: ["add", "Nočna dopolnitev virov", "Night resource supplement"],
  };
  const GROUPS = [
    ["pass", ["PASS"], "PASS", "PASS"],
    ["fail", ["FAIL"], "FAIL", "FAIL"],
    ["inc", ["TIMEOUT", "INCOMPLETE"], "nepopolno/TIMEOUT", "incomplete/TIMEOUT"],
    ["abort", ["INCOMPLETE_RESOURCE_ABORT"], "prekinjeno zaradi virov", "resource abort"],
    ["held", ["HELD_RESOURCE", "HELD_SOURCE", "HELD_DEPENDENCY"], "zadržano, brez klica", "held, no call"],
  ];
  const VERDICT_TEXT = {
    PASS: ["PASS", "PASS"], FAIL: ["FAIL", "FAIL"], TIMEOUT: ["TIMEOUT", "TIMEOUT"], INCOMPLETE: ["nepopolno", "incomplete"],
    INCOMPLETE_RESOURCE_ABORT: ["prekinjeno zaradi virov", "resource abort"], HELD_RESOURCE: ["zadržano: viri", "held: resources"],
    HELD_SOURCE: ["zadržano: vir", "held: source"], HELD_DEPENDENCY: ["zadržano: odvisnost", "held: dependency"],
  };
  const unsafeText = (s) => /[\\<>`]|\b[A-Za-z]:\/|\b\d{1,3}(\.\d{1,3}){3}\b|localhost|https?:|\bsk-[A-Za-z0-9]|AIza|\bxai-/i.test(s);
  const count = (v) => Number.isInteger(v) && v >= 0;
  const numOrNull = (v) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
  const plainObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  function safeStrings(value, depth = 0) {
    if (depth > 8) throw Error("depth");
    if (typeof value === "string") { if (value.length > 600 || unsafeText(value)) throw Error("unsafe text"); return; }
    if (Array.isArray(value)) { value.forEach((item) => safeStrings(item, depth + 1)); return; }
    if (plainObj(value)) for (const [key, item] of Object.entries(value)) { safeStrings(key, depth + 1); safeStrings(item, depth + 1); }
  }
  function outcomeMap(o) {
    if (!plainObj(o)) throw Error("outcomes");
    for (const [key, value] of Object.entries(o)) if (!VERDICTS.has(key) || !count(value)) throw Error("outcome value");
    return o;
  }
  function sameOutcomes(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => (a[key] || 0) === (b[key] || 0));
  }
  function validateHome(home, catalog, evidence) {
    if (home?.schema !== "ai8.home-model-results.v1" || home.catalog_schema !== catalog.schema) throw Error("home schema");
    safeStrings(home);
    const asOf = utcMs(home.as_of_utc);
    if (!Number.isFinite(asOf) || asOf > Date.now() + 10 * 60e3) throw Error("home date");
    const homeIds = new Set(catalog.items.filter((row) => row.deployment === "HOME_LOCAL").map((row) => row.id));
    if (!Array.isArray(home.campaigns) || home.campaigns.length < 1 || home.campaigns.length > 40) throw Error("campaigns");
    const seen = new Set();
    for (const c of home.campaigns) {
      if (typeof c.campaign !== "string" || !/^HOME_[A-Z0-9_]{1,80}$/.test(c.campaign) || seen.has(c.campaign)) throw Error("campaign id");
      seen.add(c.campaign);
      if (!count(c.planned) || !count(c.recorded) || c.recorded > c.planned || !["COMPLETE", "RUNNING"].includes(c.state) ||
          !Number.isFinite(utcMs(c.checkpoint_utc)) || !Array.isArray(c.records) || c.records.length !== c.recorded ||
          !count(c.new_requests) || !count(c.http_200) || !numOrNull(c.response_seconds_median) || !count(c.response_time_samples)) throw Error("campaign fields");
      const tally = {};
      let requests = 0, ok = 0;
      for (const r of c.records) {
        // Only an imported (not newly requested) record may lack its own timestamp.
        const dated = Number.isFinite(utcMs(r.recorded_utc)) || (r.recorded_utc === null && r.imported === true && r.new_requests === 0);
        if (!homeIds.has(r.model_id) || !VERDICTS.has(r.verdict) || !/^T\d{3}$/.test(r.test_id) || !dated ||
            !count(r.new_requests) || !numOrNull(r.response_seconds) || !(r.http_status === null || Number.isInteger(r.http_status))) throw Error("record");
        if (r.verdict.startsWith("HELD_") && r.new_requests !== 0) throw Error("held with request");
        tally[r.verdict] = (tally[r.verdict] || 0) + 1;
        requests += r.new_requests;
        if (r.http_status === 200) ok += 1;
      }
      if (!sameOutcomes(outcomeMap(c.outcomes), tally) || requests !== c.new_requests || ok !== c.http_200) throw Error("campaign sums");
      if (!plainObj(c.models)) throw Error("models");
      let modelRecorded = 0;
      for (const [id, m] of Object.entries(c.models)) {
        if (!homeIds.has(id) || !count(m.recorded) || !count(m.new_requests) || !count(m.http_200) ||
            !numOrNull(m.response_seconds_median) || !count(m.response_time_samples)) throw Error("model row");
        outcomeMap(m.outcomes);
        if (total(m.outcomes) !== m.recorded) throw Error("model sums");
        modelRecorded += m.recorded;
      }
      if (modelRecorded !== c.recorded) throw Error("model totals");
    }
    const additional = home.campaigns.filter((c) => !BASE_CAMPAIGNS.includes(c.campaign));
    const cov = home.additional_coverage;
    const sum = (key) => additional.reduce((a, c) => a + c[key], 0);
    const merged = {};
    additional.forEach((c) => Object.entries(c.outcomes).forEach(([k, v]) => { merged[k] = (merged[k] || 0) + v; }));
    if (!plainObj(cov) || cov.campaigns !== additional.length || cov.planned_records !== sum("planned") || cov.recorded !== sum("recorded") ||
        cov.new_requests !== sum("new_requests") || cov.http_200 !== sum("http_200") || !sameOutcomes(outcomeMap(cov.outcomes), merged) ||
        !numOrNull(cov.response_seconds_median) || !count(cov.response_time_samples)) throw Error("coverage sums");
    const base = home.baseline_overlay?.outcomes, rhp = home.original_rhp_outcomes, bt = evidence.home.basic_totals, rt = evidence.home.rhp_totals;
    if (!base || base.PASS !== bt.pass || base.FAIL !== bt.fail || base.INCOMPLETE !== bt.incomplete || !rhp || rhp.PASS !== rt.pass ||
        rhp.FAIL !== rt.fail || rhp.INCOMPLETE !== rt.incomplete || rhp.INCOMPLETE_RESOURCE_ABORT !== rt.resource_interruption ||
        rhp.HELD_RESOURCE !== rt.held_resource) throw Error("historical labels changed");
    return { asOf: home.as_of_utc, campaigns: home.campaigns, additional, coverage: cov };
  }
  function validateInbox(inbox, catalog) {
    if (inbox?.schema !== "ai8.model-results-inbox-public.v1" || inbox.source_schema !== "ai8.model_result.v1") throw Error("inbox schema");
    safeStrings(inbox);
    const ids = new Set(catalog.items.filter((row) => row.deployment !== "CLOUD_MAL").map((row) => row.id));
    const n = inbox.counts;
    if (!plainObj(n) || !["received", "accepted", "rejected", "already_in_home_snapshot", "added"].every((k) => count(n[k])) ||
        n.accepted + n.rejected !== n.received || n.already_in_home_snapshot + n.added !== n.accepted) throw Error("inbox counts");
    const entry = (row) => {
      if (!plainObj(row) || !ids.has(row.catalog_id) || !["PASS", "FAIL", "PARTIAL"].includes(row.status) ||
          !Number.isFinite(utcMs(row.observed_utc)) || !datedAvailability(row.availability, row.observed_utc) ||
          !(row.verdict === null || VERDICTS.has(row.verdict))) throw Error("inbox entry");
      return row;
    };
    if (!Array.isArray(inbox.results) || inbox.results.length !== n.added || !Array.isArray(inbox.availability_observations)) throw Error("inbox lists");
    inbox.results.forEach((row) => {
      entry(row);
      if (!plainObj(row.metrics) || !plainObj(row.metric_units) || !(row.test_id === null || /^T\d{3}$/.test(row.test_id))) throw Error("inbox metrics");
      for (const [k, v] of Object.entries(row.metrics)) if (typeof v !== "number" || !Number.isFinite(v) || typeof row.metric_units[k] !== "string") throw Error("inbox metric");
    });
    const obs = new Map();
    inbox.availability_observations.forEach((row) => { entry(row); if (obs.has(row.catalog_id)) throw Error("duplicate observation"); obs.set(row.catalog_id, row); });
    return { counts: n, results: inbox.results, observations: obs };
  }

  const pad2 = (v) => String(v).padStart(2, "0");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function when(iso, withYear = true) {
    const d = new Date(utcMs(iso));
    const hm = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
    return language() === "en" ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}, ${hm}` :
      `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.${withYear ? ` ${d.getUTCFullYear()}` : ""}, ${hm}`;
  }
  const secs = (s) => {
    if (s === null || s === undefined) return "—";
    const r = Math.round(s), h = Math.floor(r / 3600), m = Math.floor((r % 3600) / 60), x = pad2(r % 60);
    return h ? `${h}:${pad2(m)}:${x}` : `${m}:${x}`;
  };
  const grouped = (outcomes) => GROUPS.map(([key, verdicts, sl, en]) => [key, verdicts.reduce((a, v) => a + (outcomes[v] || 0), 0), say(sl, en)]);
  function stack(outcomes, recorded, label) {
    const bar = el("div", "stack");
    bar.setAttribute("role", "img");
    const parts = grouped(outcomes).filter(([, n]) => n > 0);
    bar.setAttribute("aria-label", `${label}: ${parts.map(([, n, text]) => `${text} ${n}`).join(", ")}`);
    parts.forEach(([key, n]) => { const seg = el("span", `v-${key}`); seg.style.width = `${n * 100 / recorded}%`; bar.append(seg); });
    return bar;
  }
  const outcomeText = (outcomes) => grouped(outcomes).filter(([, n]) => n > 0).map(([, n, text]) => `${text} ${n}`).join(" · ");
  function tag(kind) {
    const text = { orig: say("izvirno", "original"), retry: say("ponovitev", "retry"), add: say("dopolnilno", "supplementary"),
      inbox: say("inbox, po posnetku", "inbox, after snapshot"), run: say("v teku ob posnetku", "running at snapshot") }[kind];
    return el("span", `tag ${kind}`, text);
  }
  const campaignInfo = (name) => CAMPAIGNS[name] || [BASE_CAMPAIGNS.includes(name) ? "orig" : "add", name, name];
  let plus = null, plusLang = "", plusPromise = null, baseData = null;
  function renderPlus() {
    if (!plus || !plusBody || plusLang === language()) return;
    plusLang = language();
    const { coverage: cov, additional, campaigns, asOf, inbox } = plus;
    const ordered = [...BASE_CAMPAIGNS.map((name) => campaigns.find((c) => c.campaign === name)).filter(Boolean), ...additional];
    const out = [];
    const head = el("p", "plus-asof");
    head.append(el("strong", "", say("Posnetek HOME testne seje: ", "HOME test-session snapshot: ")), document.createTextNode(`${when(asOf)} · ${say("zgodovinski podatki, ne živ status", "historical data, not live status")}`));
    out.push(head);
    const stats = el("div", "plus-stats");
    const passN = cov.outcomes.PASS || 0;
    [[`${cov.campaigns}`, say("dodatnih sklopov", "additional campaigns")],
      [`${cov.recorded}/${cov.planned_records}`, say("zapisanih mest (vključno z zadržanimi)", "recorded slots (incl. held)")],
      [`${cov.new_requests}`, say("dejanskih novih zahtev modelu", "actual new model requests")],
      [`${cov.http_200}`, say("HTTP 200 (samo prenos)", "HTTP 200 (transport only)")],
      [`${passN}`, say("kakovostni PASS", "quality PASS")],
      [secs(cov.response_seconds_median), say(`mediana odziva, ${cov.response_time_samples} vzorcev, brez nalaganja`, `median response, ${cov.response_time_samples} samples, excl. loading`)],
    ].forEach(([value, text]) => { const box = el("div"); box.append(el("strong", "", value), el("span", "", text)); stats.append(box); });
    if (inbox && inbox.counts.added) { const box = el("div"); box.append(el("strong", "", `+${inbox.counts.added}`), el("span", "", say("poskus iz inboxa po posnetku", "inbox attempt after snapshot"))); stats.append(box); }
    out.push(stats);
    const legend = el("div", "vlegend");
    GROUPS.forEach(([key, , sl, en]) => { const item = el("span"); item.append(el("i", `v-${key}`), document.createTextNode(say(sl, en))); legend.append(item); });
    out.push(legend);
    out.push(el("h4", "plus-sub", say("Sklopi", "Campaigns")));
    const list = el("div", "camp-list");
    ordered.forEach((c) => {
      const [kind, sl, en] = campaignInfo(c.campaign);
      const row = el("div", "camp-row");
      const name = el("div", "camp-name");
      name.append(tag(kind));
      if (c.state === "RUNNING") name.append(tag("run"));
      name.append(el("span", "", say(sl, en)));
      name.append(el("small", "", `${say("kontrolna točka", "checkpoint")} ${when(c.checkpoint_utc)}`));
      const body = el("div", "camp-body");
      body.append(stack(c.outcomes, c.recorded, say(sl, en)));
      body.append(el("div", "camp-meta", outcomeText(c.outcomes)));
      body.append(el("div", "camp-meta", `${say("zapisano", "recorded")} ${c.recorded}/${c.planned} · ${say("novih zahtev", "new requests")} ${c.new_requests} · HTTP 200 ${c.http_200} · ${say("mediana", "median")} ${secs(c.response_seconds_median)} (n=${c.response_time_samples})`));
      row.append(name, body);
      list.append(row);
    });
    out.push(list);
    out.push(el("h4", "plus-sub", say("Po modelih", "Per model")));
    const cards = el("div", "model-cards");
    data.home.configurations.forEach((cfg) => {
      const card = el("article", "model-card");
      card.append(el("h4", "", cfg.name));
      const ob = inbox?.observations.get(cfg.id);
      const obs = el("p", "obs");
      if (ob) {
        obs.append(el("strong", "", ob.availability === "AVAILABLE" ? say("Zadnje opažanje: odgovoril", "Last observation: answered") : say("Zadnje opažanje: brez odgovora", "Last observation: no answer")));
        obs.append(document.createTextNode(` · ${when(ob.observed_utc)} · ${ob.verdict ? say(...VERDICT_TEXT[ob.verdict]) : ob.status} · ${say("velja za ta tek, ne trenutna dostopnost", "for that run only, not current availability")}`));
      } else {
        obs.append(el("strong", "", say("Dostopnost: neznana", "Availability: unknown")), document.createTextNode(` · ${say("brez datiranega opažanja v oddanih rezultatih", "no dated observation in submitted results")}`));
      }
      card.append(obs);
      const attempts = [];
      ordered.forEach((c) => {
        const m = c.models[cfg.id];
        if (!m) return;
        const [kind, sl, en] = campaignInfo(c.campaign);
        const line = el("div", "mc-line");
        const h = el("div", "mc-head");
        h.append(tag(kind), document.createTextNode(say(sl, en)));
        const rows = c.records.filter((r) => r.model_id === cfg.id);
        const times = rows.map((r) => utcMs(r.recorded_utc)).filter(Number.isFinite);
        let span = "—";
        if (times.length) {
          const first = new Date(Math.min(...times)), last = new Date(Math.max(...times));
          span = first.toISOString().slice(0, 10) === last.toISOString().slice(0, 10) ? when(last.toISOString()) :
            `${language() === "en" ? `${first.getUTCDate()} ${MONTHS[first.getUTCMonth()]}` : `${first.getUTCDate()}. ${first.getUTCMonth() + 1}.`} – ${when(last.toISOString())}`;
        }
        line.append(h, stack(m.outcomes, m.recorded, `${cfg.name} · ${say(sl, en)}`));
        line.append(el("div", "mc-text", `${span} · ${outcomeText(m.outcomes)}`));
        line.append(el("div", "mc-text", `${say("novih zahtev", "new requests")} ${m.new_requests} · HTTP 200 ${m.http_200} · ${say("mediana", "median")} ${secs(m.response_seconds_median)} (n=${m.response_time_samples})`));
        card.append(line);
        if (kind === "add") rows.filter((r) => r.new_requests > 0).forEach((r) => attempts.push({ at: r.recorded_utc, test: r.test_id, verdict: r.verdict, http: r.http_status, s: r.response_seconds, inbox: false }));
      });
      (inbox?.results || []).filter((r) => r.catalog_id === cfg.id).forEach((r) => attempts.push({
        at: r.observed_utc, test: r.test_id, verdict: r.verdict, http: r.metrics.http_200 >= 1 ? 200 : null,
        s: typeof r.metrics.latency_s === "number" ? r.metrics.latency_s : null, inbox: true, status: r.status,
      }));
      if (!card.querySelector(".mc-line")) card.append(el("p", "mc-text", say("V posnetku ni zapisov za ta model.", "No records for this model in the snapshot.")));
      if (attempts.length) {
        attempts.sort((a, b) => utcMs(b.at) - utcMs(a.at));
        const box = el("details");
        box.append(el("summary", "", say(`Dopolnilni poskusi z dejanskim klicem (${attempts.length})`, `Supplementary attempts with an actual call (${attempts.length})`)));
        const ul = el("ul", "attempts");
        attempts.forEach((a) => {
          const li = el("li", "", `${when(a.at, false)} · ${a.test || "—"} · ${a.verdict ? say(...VERDICT_TEXT[a.verdict]) : a.status} · ${a.http === 200 ? "HTTP 200" : say("brez HTTP 200", "no HTTP 200")} · ${secs(a.s)}`);
          if (a.inbox) { li.append(document.createTextNode(" ")); li.append(tag("inbox")); }
          ul.append(li);
        });
        box.append(ul);
        card.append(box);
      } else {
        card.append(el("p", "mc-text", say("Brez dopolnilnih poskusov z dejanskim klicem.", "No supplementary attempts with an actual call.")));
      }
      cards.append(card);
    });
    out.push(cards);
    if (plus.inboxError) out.push(el("p", "small", say("Oddani rezultati iz inboxa niso prikazani, ker niso prestali preverjanja.", "Inbox submissions are not shown because they failed validation.")));
    else if (inbox) out.push(el("p", "small", say(
      `Inbox: sprejetih ${inbox.counts.accepted}, zavrnjenih ${inbox.counts.rejected}; ${inbox.counts.already_in_home_snapshot} je že v posnetku (ne štejejo se dvakrat), ${inbox.counts.added} dodan.`,
      `Inbox: ${inbox.counts.accepted} accepted, ${inbox.counts.rejected} rejected; ${inbox.counts.already_in_home_snapshot} already in the snapshot (not double-counted), ${inbox.counts.added} added.`)));
    plusBody.replaceChildren(...out);
    plusBody.classList.remove("loading");
  }
  function plusFailed() {
    if (!plusBody) return;
    plusBody.classList.remove("loading");
    plusBody.replaceChildren(el("p", "small", say("Dopolnilni HOME podatki trenutno niso dosegljivi ali niso prestali preverjanja; izvirni povzetek zgoraj ostaja veljaven.",
      "Supplementary HOME data is unavailable or failed validation; the original summary above remains valid.")));
  }
  function loadPlus() {
    if (plusPromise || !plusBody || !baseData) return;
    const [catalog, evidence] = baseData;
    plusPromise = getJson("../AI8/model-results-home.json")
      .then(async (home) => {
        const checked = validateHome(home, catalog, evidence);
        let inbox = null, inboxError = false;
        try { inbox = validateInbox(await getJson("../AI8/model-results-inbox.json"), catalog); } catch (_) { inboxError = true; }
        plus = { ...checked, inbox, inboxError };
        plusLang = "";
        renderPlus();
      })
      .catch(plusFailed);
  }
  function watchPlus() {
    if (!plusBox) return;
    if (!("IntersectionObserver" in window) || /^#home-plus/.test(location.hash)) { loadPlus(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { io.disconnect(); loadPlus(); }
    }, { rootMargin: "1200px 0px" });
    io.observe(plusBox);
    window.addEventListener("hashchange", () => { if (/^#home-plus/.test(location.hash)) loadPlus(); });
  }

  document.addEventListener("ai8:display", () => { render(); renderPlus(); });
  const getJson = (path) => fetch(path, { cache: "no-cache", credentials: "omit" })
    .then((response) => { if (!response.ok) throw Error(`HTTP ${response.status}`); return response.json(); });
  Promise.all([getJson("../AI8/ai8-model-catalog.json"), getJson("../AI8/model-results-evidence.json")])
    .then(([catalog, evidence]) => { data = validate(catalog, evidence); baseData = [catalog, evidence]; render(); watchPlus(); })
    .catch(() => {
      const message = say("Podrobni podatki trenutno niso dosegljivi; povzetek zgoraj ostaja zgodovinski.",
        "Detailed data is currently unavailable; the summary above remains historical.");
      [homeChart, slaifChart].forEach((node) => { clear(node); node.append(el("p", "small", message)); });
      plusFailed();
    });
})();
