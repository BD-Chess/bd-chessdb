/* Pure view helpers. Raw native evidence stays unchanged in the JSON archive. */
(() => {
  "use strict";
  function parts(result = {}) {
    try {
      const value = JSON.parse(result.response_original_text || "{}"), message = value.choices?.[0]?.message || {};
      return { final: typeof message.content === "string" ? message.content : result.partial_text || result.text || "",
        reasoning: [message.reasoning_content, message.reasoning, message.thinking].find(v => typeof v === "string") || "" };
    } catch (_) { return { final: result.partial_text || result.text || "", reasoning: "" }; }
  }
  function outcome(record) {
    if (record.kind === "interruption") return "incomplete";
    if (record.kind !== "model") return "human";
    if (record.result?.finish_reason === "length") return "incomplete";
    return "complete";
  }
  function markdown(run) {
    const lines = ["# HMAL", "", run.config.seed, "", `Run: ${run.id}`, `State: ${run.state}`, ""];
    for (const record of run.records || []) {
      if (!["model", "human", "interruption"].includes(record.kind)) continue;
      lines.push(`## ${record.author} · ${record.phase || record.kind}`, "");
      if (outcome(record) === "incomplete") lines.push("[INCOMPLETE / PREKINJENO]", "");
      lines.push(record.text || "", "");
      if (record.kind === "interruption" && parts(record.result).final) lines.push(parts(record.result).final, "");
      lines.push(`Record: ${record.id} · SHA256: ${record.sha256 || "unknown"}`, "");
    }
    return lines.join("\n");
  }
  window.HMALQuality = Object.freeze({ parts, outcome, markdown });
})();

(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const tr = text => window.HMALLocale?.text(text) || text;
  const locale = () => document.documentElement.lang === "en" ? "en-GB" : "sl-SI";
  const make = (tag, cls = "", text = "") => { const el = document.createElement(tag); el.className = cls; el.textContent = text; return el; };
  const states = { PAUSED: "Premor", PAUSING: "Premor po tej potezi", RUNNING: "V teku", STOPPING: "Ustavljam", STOPPED: "Ustavljeno", COMPLETED: "Končano", INTERRUPTED: "Prekinjeno · potreben pregled", WAITING_FOR_DRIVE: "Čakam na Drive", LOADING: "Nalagam model", UNKNOWN: "Stanje ni znano", UNAVAILABLE: "Ni povezave" };
  const phases = { question_opening: "Odpiranje vprašanj", question_map: "Zemljevid vprašanj", independent: "Ločen začetni predlog", discussion: "Razprava", direct: "Odgovor", reframe: "Ponovni okvir", crystallize: "Kristalizacija", empiricist: "Načrt preverjanja", genome: "Spoznanja za nadaljevanje", synthesis: "Sinteza" };
  const names = { "gpt-oss": "GPT-OSS 20B", "qwen3.8": "Qwen3.8 27B", "gemma4": "Gemma 4 · Q6", "gemma4-q5": "Gemma 4 · Q5", "ministral3": "Ministral 3 14B", "magistral": "Magistral 24B", "mellum2.1": "Mellum 2.1", "lfm2.5": "LFM 2.5" };
  const saved = (key, fallback) => { try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } };
  const pending = new Map(saved("hmal.pending-actions.v1", []));
  const persistActions = () => sessionStorage.setItem("hmal.pending-actions.v1", JSON.stringify([...pending]));
  let submitting = false;
  let csrf = "", catalogue = [], selected = [], runId = "", current = null, activeRun = null, timer = null, refreshing = false;
  let catalogueSignature = "", messageSignature = "", createId = null;
  const reasoningChoices = saved("hmal.reasoning.v1", {});
  let latestStatus = null, cleanupId = saved("hmal.pending-memory.v1", null);
  let connectionFailed = false;
  let latestSmoke = null;
  const draftKey = () => "hmal.draft.v2." + (runId || "new");
  const saveDraft = () => { try { sessionStorage.setItem(draftKey(), $("prompt").value); } catch (_) {} };
  const restoreDraft = () => { try { $("prompt").value = sessionStorage.getItem(draftKey()) || ""; } catch (_) {} };
  function notify(text) { $("notice").textContent = tr(text); $("notice").hidden = !text; }
  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.method === "POST") { headers.set("Content-Type", "application/json"); headers.set("X-CSRF-Token", csrf); }
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
    if (response.status === 401) { location.assign("/?next=hmal"); throw new Error("Najprej se prijavi."); }
    const value = await response.json();
    if (!response.ok) throw new Error(value.error?.message || `Napaka ${response.status}`);
    return value;
  }
  function mode() { return document.querySelector('input[name="mode"]:checked').value; }
  function busy() { return !!current && ["RUNNING", "PAUSING", "STOPPING"].includes(current.state); }
  function estimate() {
    const n = selected.length, rounds = mode() === "loop" ? Math.max(1, Number($("rounds").value)) : 1;
    let count = mode() === "chat" ? 1 : n * rounds;
    if ($("rhp").checked) { count += 4; if ($("question-opening").checked) count += n + 1; }
    else if ($("synthesis").checked && mode() !== "chat") count++;
    if (runId && current?.plan) count = current.plan.length;
    $("turn-estimate").textContent = n ? `${n} ${tr(n === 1 ? "model" : "izbranih modelov")} · ${count} ${tr("predvidenih odgovorov")}` : tr("Izberi model.");
    $("rounds-field").hidden = mode() !== "loop";
    $("rounds").disabled = mode() !== "loop" || !!runId;
    $("rhp-options").hidden = !$("rhp").checked;
    $("mode-description").textContent = tr(({ chat: "Preprost pogovor z enim modelom.", hmal: "Vsak model pripravi neodvisen začetni predlog.", loop: "Modeli pišejo zaporedno po tvojem vrstnem redu." })[mode()]);
    const reserve = $("completion-policy").value === "reserve_final";
    $("answer-reserve-field").hidden = !reserve; $("reserve-hint").hidden = !reserve;
    renderQuality();
  }
  function renderQuality() {
    const box = $("quality-models"); box.replaceChildren();
    for (const key of selected) {
      const model = catalogue.find(m => m.key === key);
      box.append(make("p", "", `${names[key] || key} · ${tr("Nastavljeni kontekst")}: ${model?.context ?? tr("neznano")} ${tr("tokenov")}`));
    }
    if (!selected.length) box.textContent = tr("Izberi model.");
    else box.append(make("p", "", tr("V ta prostor morajo priti vprašanje, zgodovina, razmišljanje in odgovor. Dejanski prostor se preveri pred vsako potezo.")));
  }
  function renderProgress(status) {
    const panel = $("progress-panel"), p = status?.generation_progress;
    panel.hidden = !p || status.active_run !== runId;
    if (panel.hidden) return;
    const phase = { PREPARING: "Priprava", LOADING: "Nalagam model", PREFILL_AND_GENERATION: "Obdelava vprašanja in odgovor" }[p.phase] || p.phase;
    const elapsed = Number.isFinite(p.elapsed_seconds) ? `${Math.floor(p.elapsed_seconds / 60)}:${String(Math.floor(p.elapsed_seconds % 60)).padStart(2, "0")}` : "—";
    panel.replaceChildren(make("strong", "", `${tr(phase)} · ${elapsed}`));
    if (Number.isFinite(p.effective_context)) panel.append(make("span", "", `${tr("Dejanski kontekst")}: ${p.effective_context} · ${tr("Vhod")}: ${p.input_tokens} · ${tr("Prostor za generiranje")}: ${p.effective_max_tokens}`));
    panel.append(make("small", "", tr("Živo število ustvarjenih tokenov in ETA nista na voljo. Stop ostane na voljo.")));
  }
  function renderSmoke(value) {
    latestSmoke = value;
    const report = value?.state === "AVAILABLE" ? value.report : null;
    $("smoke-report").hidden = !report; $("smoke-unavailable").hidden = !!report;
    if (!report) { $("smoke-summary").textContent = tr("Poročilo ni naloženo"); $("smoke-unavailable").textContent = tr("Shranjeno poročilo še ni na voljo. Pogovor deluje neodvisno od tega razdelka."); return; }
    $("smoke-summary").textContent = `${report.summary.pass}/${report.summary.cases} PASS · ${report.summary.fail} FAIL`;
    $("smoke-date").textContent = `${tr("Arhiv meritev")} · ${new Date(report.finished_utc).toLocaleString(locale(), { timeZone: "Europe/Ljubljana" })}. ${tr("Shranjene meritve; trenutno stanje je prikazano pri modelih.")}`;
    const duration = seconds => {
      if (seconds >= 180) { const n = Math.round(seconds); return `${Math.floor(n / 60)} min ${n % 60} s`; }
      return `${Number(seconds).toLocaleString(locale(), { maximumFractionDigits: 1 })} s`;
    };
    $("smoke-rows").replaceChildren();
    for (const row of report.rows) {
      const line = make("tr"), name = make("th", "", names[row.model] || row.model); name.scope = "row"; line.append(name);
      for (const key of ["off", "on"]) {
        const item = row[key]; let text = "—";
        if (item) {
          text = (item.verdict === "FAIL" ? "FAIL · " : "") + duration(item.seconds);
          if (item.level !== "off" && item.level !== "on") text += ` · ${item.level === "low_not_off" ? tr("low (ni OFF)") : item.level === "on_low" ? "low" : item.level === "native_only" ? "native" : item.level}`;
        }
        line.append(make("td", item?.verdict === "FAIL" ? "smoke-fail-cell" : "", text));
      }
      $("smoke-rows").append(line);
    }
    const fail = report.failure;
    $("smoke-failure").hidden = !fail;
    if (fail) $("smoke-failure").textContent = `${names[fail.model] || fail.model}: ${tr("razmišljanje je zapolnilo kontekst brez končnega odgovora")}. ${fail.input_tokens} + ${fail.output_tokens} = ${fail.input_tokens + fail.output_tokens} / ${fail.context_tokens} ${tr("tokenov")}. ${tr("Odprto za popravek.")}`;
    $("smoke-method").textContent = `${tr("Ponovitve")}: ${report.repeated_cases}; ${tr("prevzeti prejšnji PASS")}: ${report.reused_passes}. ${tr("Potrjeno čiščenje RAM pred/po ponovitvah")}: ${report.cleanup_pass}/${report.cleanup_total} PASS. ${tr("Noben ponovljeni test ni dosegel enournega timeouta. Krmilnik je bil ob koncu meritev prost.")}`;
    $("smoke-links").replaceChildren();
    for (const item of report.sources || []) {
      try {
        const url = new URL(item.url);
        if (url.protocol !== "https:" || url.hostname !== "drive.google.com") continue;
        const link = make("a", "", tr(item.label)); link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer"; $("smoke-links").append(link);
      } catch (_) { /* Invalid evidence links never become active content. */ }
    }
  }
  function renderReasoning() {
    $("reasoning-controls").replaceChildren();
    for (const key of selected) {
      const capability = catalogue.find(m => m.key === key)?.reasoning;
      const options = capability?.options || [{ value: "default", label: "Privzeto (profil)" }];
      const label = make("label", "field", names[key] || key), select = make("select");
      select.dataset.model = key; select.setAttribute("aria-label", `${tr("Razmišljanje")} · ${names[key] || key}`);
      for (const option of options) { const el = make("option", "", tr(option.label)); el.value = option.value; select.append(el); }
      const value = runId ? current?.config?.reasoning?.[key] || "default" : reasoningChoices[key] || "default";
      select.value = options.some(option => option.value === value) ? value : "default";
      select.disabled = !!runId || options.length === 1;
      select.addEventListener("change", () => { reasoningChoices[key] = select.value; sessionStorage.setItem("hmal.reasoning.v1", JSON.stringify(reasoningChoices)); });
      label.append(select); $("reasoning-controls").append(label, make("p", "hint", tr(capability?.hint || "Privzeta nastavitev modela.")));
    }
  }
  function renderModels() {
    $("models").replaceChildren();
    const ordered = [...selected, ...catalogue.map(m => m.key).filter(k => !selected.includes(k))];
    for (const key of ordered) {
      const model = catalogue.find(m => m.key === key); if (!model) continue;
      const row = make("div", `model${selected.includes(key) ? " selected" : ""}`);
      row.draggable = !runId; row.dataset.key = key;
      const check = document.createElement("input"); check.type = "checkbox"; check.checked = selected.includes(key); check.disabled = !!runId;
      check.setAttribute("aria-label", `${tr("Izberi")} ${names[key] || key}`);
      check.addEventListener("change", () => { selected = check.checked ? (mode() === "chat" ? [key] : [...selected, key]) : selected.filter(k => k !== key); renderModels(); renderRoles(); estimate(); });
      const label = make("label"); check.id = "model-" + key; label.htmlFor = check.id;
      label.append(make("span", "model-name", names[key] || model.name.split("/").pop()), make("small", "", `${model.quantization || "—"} · ${tr(model.installed ? "na disku" : "pot ni potrjena")}`));
      row.append(check, label);
      for (const [symbol, delta, description] of [["↑", -1, "Višje"], ["↓", 1, "Nižje"]]) {
        const button = make("button", "", symbol); button.type = "button"; button.disabled = !!runId || !selected.includes(key); button.setAttribute("aria-label", `${tr(description)}: ${names[key] || key}`);
        button.addEventListener("click", () => { const at = selected.indexOf(key), to = at + delta; if (to < 0 || to >= selected.length) return; [selected[at], selected[to]] = [selected[to], selected[at]]; renderModels(); estimate(); }); row.append(button);
      }
      row.addEventListener("dragstart", event => { if (runId) return; event.dataTransfer.setData("text/plain", key); });
      row.addEventListener("dragover", event => event.preventDefault());
      row.addEventListener("drop", event => { event.preventDefault(); if (runId) return; const from = event.dataTransfer.getData("text/plain"); if (!selected.includes(from) || !selected.includes(key)) return; selected = selected.filter(k => k !== from); selected.splice(selected.indexOf(key), 0, from); renderModels(); estimate(); });
      $("models").append(row);
    }
    $("model-count").textContent = String(catalogue.length);
    renderReasoning();
  }
  function renderRoles() {
    const old = Object.fromEntries([...$("roles").querySelectorAll("textarea")].map(el => [el.dataset.model, el.value]));
    $("roles").replaceChildren();
    for (const key of selected) { const label = make("label", "field", `${tr("Vloga")} · ${names[key] || key}`); const text = document.createElement("textarea"); text.rows = 2; text.maxLength = 1500; text.dataset.model = key; text.value = old[key] || current?.config?.roles?.[key] || ""; text.disabled = !!runId; label.append(text); $("roles").append(label); }
  }
  function freezeSettings(value) {
    document.querySelectorAll('.settings input,.settings select,.settings textarea').forEach(el => el.disabled = value);
    renderModels(); renderRoles(); estimate();
  }
  async function act(action, text = "") {
    if (!runId) return;
    const key = JSON.stringify([runId, action, text]);
    const operation = pending.get(key) || { operation_id: crypto.randomUUID(), run_id: runId, action, ...(text ? { text } : {}) };
    pending.set(key, operation); persistActions();
    const value = await api("/api/hmal/control", { method: "POST", body: JSON.stringify(operation) });
    pending.delete(key); persistActions(); renderRun(value); await refresh();
  }
  function renderRun(value) {
    current = value; runId = value.id;
    $("conversation-title").textContent = value.config.seed.slice(0,95);
    $("run-strip").hidden = false;
    $("run-state").textContent = tr(states[value.state] || value.state);
    const step = value.plan[value.next_step];
    $("round-state").textContent = step ? `${value.next_step}/${value.plan.length} · ${tr("na vrsti")} ${names[step.model] || step.model} · ${tr(phases[step.phase] || step.phase)}` : `${value.next_step}/${value.plan.length} ${tr("odgovorov")}`;
    $("archive-state").textContent = value.drive_pending ? `Disk ✓ · Drive: ${value.drive_pending} ${tr("Drive čaka")}` : "Disk ✓ · Drive ✓";
    $("skip").hidden = value.state !== "INTERRUPTED";
    $("recover").hidden = value.state !== "INTERRUPTED";
    $("export").disabled = false;
    $("export-md").disabled = false;
    $("generation-policy").textContent = value.config.completion_policy === "reserve_final" ? `${tr("Izbirna rezerva za končni odgovor")}: ${value.config.answer_reserve_tokens} ${tr("tokenov")}.` : tr(value.config.max_tokens === 0 && value.config.timeout_seconds === 0 ? "Brez umetne omejitve odgovora ali časovne meje. Velja prosti kontekst modela. Ustaviš z gumbom Stop." : "Ta starejši pogovor ohranja prvotne omejitve. Za odgovor brez umetnih omejitev izberi + Nov.");
    const reasons = { AI8_BUSY_OTHER_RUN: "Domači krmilnik je zaseden z drugo nalogo. Ko bo prost, izberi Nadaljuj.", DRIVE_ARCHIVE_PENDING: "Odgovori so lokalno shranjeni. Drive še ni potrdil vseh zapisov. Uporabi Shrani na Drive; pogovor lahko nadaljuješ.", SERVICE_RESTART_NO_REPLAY: "Storitev je bila prekinjena. Preglej zadnjo potezo; modelnega klica ne ponavljamo samodejno.", CONTEXT_LIMIT_REDUCE_INPUT_OR_OUTPUT: "Kontekst presega profil modela. Začni nov pogovor z manj gradiva ali krajšim odgovorom." };
    const extraReasons = { AI8_CAMPAIGN_ACTIVE: "Domače testiranje še poteka ali čaka v vrsti. HMAL ohranja njegov vrstni red.", MEMORY_CLEANUP_PENDING: "Odgovor je shranjen. Pred naslednjo potezo mora lokalni skrbnik potrditi čiščenje pomnilnika." };
    Object.assign(extraReasons, {
      REASONING_BUDGET_EXHAUSTED_NO_ANSWER: "Razmišljanje je zapolnilo prostor brez končnega odgovora. Zapis je ohranjen. Preveri dejanski kontekst in nativno predlogo; izbirno preizkusi rezervacijo prostora. Klica ne ponavljamo samodejno.",
      REASONING_ONLY_NO_ANSWER: "Prejeto je samo razmišljanje. Končni odgovor manjka; izvirni odziv je ohranjen za pregled.",
      RESPONSE_TRUNCATED: "Odgovor je prekinjen zaradi omejitve tokenov. Delno besedilo je ohranjeno in ni označeno kot dokončano.",
      RESPONSE_FINISH_UNVERIFIED: "Zaključek odgovora ni potrjen. Izvirni odziv je ohranjen za pregled.",
      EFFECTIVE_CONTEXT_UNVERIFIED: "Dejanskega konteksta ni bilo mogoče potrditi. Modelni klic ni bil poslan.",
      ANSWER_RESERVE_EXCEEDS_AVAILABLE_CONTEXT: "Za izbrano rezervo ni dovolj prostora. Zmanjšaj gradivo ali rezervo oziroma preveri večji kontekst.",
      OUTPUT_LIMIT_NO_ANSWER: "Model je dosegel omejitev tokenov brez končnega odgovora.",
      RESPONSE_MODEL_IDENTITY_INVALID: "Odgovor vsebuje drugo identiteto modela; shranjen je za pregled.",
      RESPONSE_TOOL_CALLS_UNSUPPORTED: "Model je zahteval orodje, ki v tem pogovoru ni omogočeno.",
      RESPONSE_EMPTY: "Model je vrnil prazen končni odgovor; izvirni odziv je shranjen za pregled.",
      RESPONSE_IDENTITY_OR_CONTENT_INVALID: "Stari adapter je zavrnil identiteto ali vsebino odgovora. Možen je izčrpan obseg razmišljanja; podrobnosti naj pregleda lokalni skrbnik. Poziva ne ponavljamo samodejno."
    });
    if (!connectionFailed) notify(extraReasons[value.reason] || reasons[value.reason] || (value.reason && !["ONE_STEP_COMPLETED", "GAP_EXPLICITLY_SKIPPED"].includes(value.reason) ? value.reason : ""));
    $("send").textContent = tr(value.config.mode === "chat" && value.state === "COMPLETED" ? "Pošlji vprašanje ↗" : "Dodaj komentar ↗");
    $("composer-help").textContent = tr("BD-jevo sporočilo bo vidno pri naslednji potezi.");
    const signature = JSON.stringify([value.updated, value.records.length, value.drive_pending, value.state]);
    if (signature !== messageSignature) {
      const pane = $("messages"), follow = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 90;
      pane.replaceChildren();
      for (const record of value.records.filter(r => ["model", "human", "interruption"].includes(r.kind))) {
        const card = make("article", `message ${record.kind === "model" ? "model-reply" : record.kind}`), head = make("div", "message-head");
        head.append(make("strong", "", record.author === "BD" ? "BD" : names[record.author] || record.author), make("span", "", tr(phases[record.phase] || record.kind === "interruption" && "Prekinitev" || "Sporočilo")), make("span", "", new Date(record.utc).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })), make("span", "", record.drive_state === "VERIFIED" ? "Drive ✓" : tr("Drive čaka")));
        const body = make("div", "message-body", record.text || ""); card.append(head, body);
        const nativeParts = window.HMALQuality.parts(record.result), outcome = window.HMALQuality.outcome(record);
        if (outcome === "incomplete") {
          head.append(make("strong", "incomplete-badge", tr("NEPOPOLN ODGOVOR")));
          if (record.kind === "interruption" && nativeParts.final) card.append(make("p", "hint", tr("Delni končni odgovor")), make("div", "message-body", nativeParts.final));
        }
        const copyText = record.kind === "interruption" ? nativeParts.final : record.text;
        if (copyText) {
          const copy = make("button", "copy-answer quiet", tr("Kopiraj")); copy.type = "button";
          copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(copyText); copy.textContent = tr("Kopirano"); } catch (_) { notify("Kopiranje ni na voljo. Uporabi izvoz."); } }); card.append(copy);
        }
        if (nativeParts.reasoning) {
          const thinking = make("details", "reasoning-view"); thinking.append(make("summary", "", `${tr("Razmišljanje modela")} · ${nativeParts.reasoning.length} ${tr("znakov")}`), make("pre", "", nativeParts.reasoning)); card.append(thinking);
        }
        const result = record.result || {};
        if (result.context_tokens || result.usage) card.append(make("p", "hint turn-metrics", `${tr("Kontekst")}: ${result.context_tokens ?? "—"} · ${tr("Vhod")}: ${result.input_tokens ?? result.usage?.prompt_tokens ?? "—"} · ${tr("Izhod")}: ${result.usage?.completion_tokens ?? "—"} · ${tr("Zaključek")}: ${result.finish_reason || "—"}`));
        const details = document.createElement("details"); details.append(make("summary", "", tr("Podrobnosti poteze")), make("pre", "", JSON.stringify({ id: record.id, state: record.state, sha256: record.sha256, exposure: record.exposure, reasoning: value.config.reasoning?.[record.author] || "default", finish_reason: record.result?.finish_reason, output_policy: record.result?.hmal_output_policy, effective_max_tokens: record.result?.effective_max_tokens, seconds: record.result?.seconds, load_seconds: record.result?.load_seconds }, null, 2))); card.append(details); pane.append(card);
      }
      if (!pane.childElementCount) pane.append(make("p", "hint", value.config.seed));
      if (busy()) pane.append(make("div", "pending", tr("Model pripravlja odgovor. Celotno besedilo bo prikazano po zaključku; stanje in Stop ostajata na voljo.")));
      if (follow) pane.scrollTop = pane.scrollHeight;
      messageSignature = signature;
    }
    document.querySelectorAll("[data-action]").forEach(button => { const a = button.dataset.action; button.disabled = a === "sync" ? latestStatus?.drive_sync?.state === "RUNNING" : ["start", "resume", "step"].includes(a) ? !!activeRun || ["STOPPED", "INTERRUPTED", "COMPLETED"].includes(value.state) : a === "pause" ? !busy() : a === "stop" ? ["STOPPED", "COMPLETED"].includes(value.state) : false; });
  }
  async function openRun(id) {
    const value = await api("/api/hmal/run?id=" + encodeURIComponent(id));
    runId = id; sessionStorage.setItem("hmal.current-run", id); current = value; selected = [...value.config.models];
    document.querySelector(`input[name="mode"][value="${value.config.mode}"]`).checked = true;
    for (const [id, key] of [["rounds", "rounds"], ["sources", "sources"], ["context", "context"]]) $(id).value = value.config[key];
    $("rhp").checked = value.config.rhp; $("question-opening").checked = value.config.question_opening; $("synthesis").checked = value.config.synthesis;
    $("completion-policy").value = value.config.completion_policy || "native"; $("answer-reserve").value = value.config.answer_reserve_tokens || 1024;
    restoreDraft();
    messageSignature = ""; freezeSettings(true); renderRun(value);
  }
  function renderCleanup(status) {
    const value = status.memory_cleanup || { state: "NOT_RUN" }, native = status.native || {};
    $("memory-clean").disabled = !status.enabled || !!status.active_run || native.status !== "STOPPED" || !!native.controller_busy || value.state === "RUNNING";
    const messages = { RUNNING: "Čiščenje poteka …", COMPLETED: "Čiščenje potrjeno.", UNKNOWN: "Čiščenje ni potrjeno. Ne ponavljamo samodejno; potreben je lokalni pregled." };
    let message = tr(messages[value.state] || "Ročno čiščenje RAM-a; samo ko je krmilnik prost. Modelov ne zažene.");
    if (value.state === "COMPLETED" && value.proof?.before && value.proof?.after) {
      const gib = n => (n / 1024 ** 3).toLocaleString(locale(), { maximumFractionDigits: 2 });
      message += ` ${tr("RAM prosto")}: ${gib(value.proof.before.available_ram_bytes)} → ${gib(value.proof.after.available_ram_bytes)} GiB.`;
    }
    $("memory-clean-status").textContent = message;
    if (["COMPLETED", "UNKNOWN"].includes(value.state) && value.operation_id === cleanupId) { cleanupId = null; sessionStorage.removeItem("hmal.pending-memory.v1"); }
  }
  $("memory-clean").addEventListener("click", async () => {
    $("memory-clean").disabled = true;
    cleanupId ||= crypto.randomUUID(); sessionStorage.setItem("hmal.pending-memory.v1", JSON.stringify(cleanupId));
    try { await api("/api/hmal/memory-clean", { method: "POST", body: JSON.stringify({ operation_id: cleanupId }) }); await refresh(); }
    catch (error) { notify(error.message); if (latestStatus) renderCleanup(latestStatus); }
  });
  async function refresh() {
    if (refreshing) return; refreshing = true;
    try {
      const status = await api("/api/hmal/status"); connectionFailed = false; activeRun = status.active_run; latestStatus = status; renderCleanup(status);
      $("connection").textContent = tr(status.evidence === "MOCK" ? "MOCK · PREIZKUS" : status.enabled ? "DOMA · POVEZANO" : "PRIKLOP ČAKA");
      $("build").textContent = status.build;
      catalogue = status.catalogue.models || [];
      const signature = JSON.stringify(catalogue);
      if (signature !== catalogueSignature) { catalogueSignature = signature; renderModels(); renderRoles(); }
      const native = status.native || {}; $("native-state").textContent = `${native.key ? (names[native.key] || native.key) + " · " : ""}${tr(native.phase === "PREFILL_AND_GENERATION" ? "Odgovarja" : states[native.status] || native.status || "Ni podatkov")}`;
      const mem = native.last_memory, gib = n => Number.isFinite(n) ? `${(n / 1024 ** 3).toLocaleString(locale(), { maximumFractionDigits: 1 })} GiB` : tr("neznano");
      $("resources").textContent = mem ? `${tr("RAM prosto")} ${gib(mem.available_ram_bytes)} · VRAM ${mem.free_vram_mib ?? tr("neznano")} MiB · ${native.utc ? new Date(native.utc).toLocaleTimeString(locale()) : tr("čas ni znan")}` : tr("Čakam na meritve domačega krmilnika …");
      $("history").replaceChildren();
      for (const row of status.runs.filter(row => row.title.toLocaleLowerCase().includes($("history-search").value.toLocaleLowerCase()))) { const button = make("button", row.id === runId ? "current" : "", row.title); button.type = "button"; button.append(make("small", "", `${row.mode.toUpperCase()} · ${tr(states[row.state] || row.state)}`)); button.addEventListener("click", () => { saveDraft(); openRun(row.id).catch(error => notify(error.message)); }); $("history").append(button); }
      if (runId) renderRun(await api("/api/hmal/run?id=" + encodeURIComponent(runId)));
      else if (!status.enabled) notify("Priklop čaka na prost krmilnik in nativno preverjanje. Tekoče testiranje ostaja ohranjeno.");
      if (!runId) document.querySelectorAll("[data-action]").forEach(button => button.disabled = true);
      $("send").disabled = !status.enabled;
      estimate();
      renderProgress(status);
    } catch (error) { connectionFailed = true; $("connection").textContent = tr("Ni povezave · prikaz je lahko zastarel"); notify(error.message); } finally { refreshing = false; }
  }
  $("composer").addEventListener("submit", async event => {
    event.preventDefault(); if (submitting) return; const text = $("prompt").value.trim(); if (!text) return;
    submitting = true;
    $("send").disabled = true;
    try {
      if (runId) { await act(current.config.mode === "chat" && current.state === "COMPLETED" ? "continue_chat" : "comment", text); }
      else {
        createId ||= crypto.randomUUID();
        const roles = Object.fromEntries([...$("roles").querySelectorAll("textarea")].map(el => [el.dataset.model, el.value]));
        const reasoning = Object.fromEntries([...$("reasoning-controls").querySelectorAll("select")].map(el => [el.dataset.model, el.value]));
        const request = saved("hmal.pending-create.v1", null) || { request_id: createId, seed: text, mode: mode(), models: selected, rounds: mode() === "loop" ? Number($("rounds").value) : 1, reasoning, max_tokens: 0, timeout_seconds: 0, chat_projection: "HMAL_NATIVE_CHAT_R2", completion_policy: $("completion-policy").value, answer_reserve_tokens: Number($("answer-reserve").value), rhp: $("rhp").checked, question_opening: $("question-opening").checked, synthesis: $("synthesis").checked, context: $("context").value, sources: $("sources").value, roles };
        sessionStorage.setItem("hmal.pending-create.v1", JSON.stringify(request));
        const value = await api("/api/hmal/create", { method: "POST", body: JSON.stringify(request) });
        runId = value.run.id; sessionStorage.setItem("hmal.current-run", runId); sessionStorage.removeItem("hmal.pending-create.v1"); current = value.run; createId = null; freezeSettings(true); await act("start");
      }
      $("prompt").value = "";
      try { sessionStorage.removeItem(draftKey()); sessionStorage.removeItem("hmal.draft.v2.new"); } catch (_) {}
    } catch (error) { notify(error.message); } finally { submitting = false; $("send").disabled = false; }
  });
  document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => { button.disabled = true; act(button.dataset.action).catch(error => { notify(error.message); button.disabled = false; }); }));
  document.querySelectorAll('input[name="mode"]').forEach(el => el.addEventListener("change", () => { if (mode() === "chat") selected = selected.slice(0, 1); $("context").value = mode() === "chat" ? "full" : "recent"; renderModels(); renderRoles(); estimate(); }));
  for (const id of ["rounds", "rhp", "question-opening", "synthesis", "completion-policy"]) $(id).addEventListener("change", estimate);
  $("new").addEventListener("click", () => { saveDraft(); runId = ""; sessionStorage.removeItem("hmal.current-run"); sessionStorage.removeItem("hmal.pending-create.v1"); current = null; createId = null; messageSignature = ""; $("generation-policy").textContent = tr("Brez umetne omejitve odgovora ali časovne meje. Velja prosti kontekst modela. Ustaviš z gumbom Stop."); restoreDraft(); $("completion-policy").value = "native"; $("context").value = "full"; freezeSettings(false); $("run-strip").hidden = true; $("progress-panel").hidden = true; $("conversation-title").textContent = tr("Nov pogovor"); $("messages").replaceChildren(make("p", "hint", tr("Vpiši vprašanje in izberi udeležence."))); $("send").textContent = tr("Začni pogovor ↗"); $("export").disabled = true; $("export-md").disabled = true; notify(""); });
  $("source-file").addEventListener("change", async event => { const file = event.target.files[0]; if (!file) return; if (file.size > 65536) { notify("Izberi krajšo besedilno datoteko."); return; } const text = await file.text(); if (text.length > 18000 || text.includes("\u0000")) { notify("Gradivo je predolgo ali ni besedilno."); return; } $("sources").value = text; });
  $("export").addEventListener("click", async () => { if (!runId) return; try { const value = await api("/api/hmal/export?id=" + encodeURIComponent(runId)), blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), link = make("a"); link.href = url; link.download = `HMAL_${runId}.json`; link.click(); URL.revokeObjectURL(url); } catch (error) { notify(error.message); } });
  $("export-md").addEventListener("click", async () => { if (!runId) return; try { const value = await api("/api/hmal/export?id=" + encodeURIComponent(runId)), blob = new Blob([window.HMALQuality.markdown(value)], { type: "text/markdown;charset=utf-8" }), url = URL.createObjectURL(blob), link = make("a"); link.href = url; link.download = `HMAL_${runId}.md`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (error) { notify(error.message); } });
  $("prompt").addEventListener("input", saveDraft);
  $("prompt").addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); if (!$("send").disabled) $("composer").requestSubmit(); } });
  $("history-search").addEventListener("input", () => refresh());
  $("logout").addEventListener("click", async () => { try { await api("/api/logout", { method: "POST", body: "{}" }); } finally { location.assign("/"); } });
  async function init() { try {
    const session = await api("/api/session"); csrf = session.csrf;
    api("/api/hmal/smoke-results").then(renderSmoke).catch(() => renderSmoke(null));
    await refresh();
    const awaiting = saved("hmal.pending-create.v1", null);
    if (awaiting) {
      const value = await api("/api/hmal/create", { method: "POST", body: JSON.stringify(awaiting) });
      sessionStorage.setItem("hmal.current-run", value.run.id); sessionStorage.removeItem("hmal.pending-create.v1");
    }
    const previous = sessionStorage.getItem("hmal.current-run"); if (previous) await openRun(previous); else restoreDraft();
    clearInterval(timer); timer = setInterval(refresh, 2000);
  } catch (error) { notify(error.message); } }
  addEventListener("hmal:language", () => { renderModels(); renderRoles(); estimate(); renderSmoke(latestSmoke); messageSignature = ""; if (current) renderRun(current); if (latestStatus) { renderCleanup(latestStatus); renderProgress(latestStatus); } });
  addEventListener("pagehide", () => { saveDraft(); clearInterval(timer); });
  addEventListener("pageshow", event => { if (event.persisted) { clearInterval(timer); refresh(); timer = setInterval(refresh, 2000); } }); init();
})();
