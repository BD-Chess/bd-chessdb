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
  let data = null, lastLang = "";
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
  document.addEventListener("ai8:display", render);
  const getJson = (path) => fetch(path, { cache: "no-cache", credentials: "omit" })
    .then((response) => { if (!response.ok) throw Error(`HTTP ${response.status}`); return response.json(); });
  Promise.all([getJson("../AI8/ai8-model-catalog.json"), getJson("../AI8/model-results-evidence.json")])
    .then(([catalog, evidence]) => { data = validate(catalog, evidence); render(); })
    .catch(() => {
      const message = say("Podrobni podatki trenutno niso dosegljivi; povzetek zgoraj ostaja zgodovinski.",
        "Detailed data is currently unavailable; the summary above remains historical.");
      [homeChart, slaifChart].forEach((node) => { clear(node); node.append(el("p", "small", message)); });
    });
})();
