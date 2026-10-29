"use strict";
// Static, read-only walkthrough of recorded GhostCache evaluations, read from data/evidence.json
// through site.js. Choosing a run or a stage only changes the view: no model, no API, no deletion.

(function () {
  const GC = window.GC;
  const {el, clear, ms, shortId} = GC;

  const count = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;
  const rebuiltIds = (r) => r.stages.cleaned_audit.active_ids.filter((id) => !r.stages.initial_audit.active_ids.includes(id));
  const rebuildEvent = (r) => r.events.find((e) => e.name === "summary.generated" && rebuiltIds(r).includes(e.artifact_id));
  const passedChecks = (r) => r.checks.filter((c) => c.passed).length;

  const STAGES = [
    {key: "setup", tab: "Seeded memory", eyebrow: "Stage 1 · Seeded memory", title: "One secret, many copies.", answer: "before",
     text: (r) => `The run seeded five fictional documents. The source, ${r.source_id}, holds the marker ${r.marker}. A search chunk, three model-written summaries and a saved answer were derived from it, directly or through each other: ${count(r.stages.initial_audit.matched_canary, "stored item")} held the marker.`,
     caption: (r) => `Seeded memory: ${count(r.stages.initial_audit.total_artifacts, "artifact")}, ${r.stages.initial_audit.matched_canary} of them holding the marker (◆). On the right, the recorded answer to the secret question; amber threads show the context retrieval gave it.`},
    {key: "source_only", tab: "Source deleted", eyebrow: "Stage 2 · Source-only deletion", title: "Delete the document, keep its echoes.",
     text: (r) => `Deleting only ${r.source_id} is the deliberately incomplete control. Its body was emptied and its title replaced, but ${count(r.stages.source_only_audit.stale_descendants, "derived item")} still depended on it, and ${r.stages.source_only_audit.matched_canary} of them still held the marker.`,
     caption: (r) => `After source-only deletion: ${r.source_id} is a tombstone (dashed outline); ${GC.joinList(r.stages.source_only_audit.stale_ids.map(shortId))} stay active and stale.`},
    {key: "leak", tab: "The ghost answers", eyebrow: "Stage 3 · The ghost answers", title: "The model repeats a deleted secret.", answer: "source_only",
     text: (r) => {
       const a = r.answers.source_only;
       const stale = a.context_ids.filter((id) => r.stages.source_only_audit.stale_ids.includes(id)).length;
       return `With the source deleted, the evaluation asked in different words: “${a.question}” Retrieval supplied ${count(a.context_ids.length, "artifact")}, ${stale} of them stale copies, and Gemma ${a.contains_marker ? "repeated the marker" : "did not repeat the marker"}.`;
     },
     caption: () => "The recorded leak: amber threads show the context supplied to the answer that revealed the marker. Solid threads were cited by the model; dotted ones were supplied but not cited."},
    {key: "cleanup", tab: "Cleanup", eyebrow: "Stage 4 · Provenance-aware cleanup", title: "Follow the trail, clear every copy.",
     text: (r) => {
       const rebuilt = rebuildEvent(r);
       const from = rebuilt ? ` (${GC.joinList(rebuilt.parent_ids)})` : "";
       return `Cascade cleanup followed provenance from ${r.source_id} to every descendant: ${count(r.stages.cleaned_audit.invalidated_artifacts, "derived item")} purged and a summary rebuilt only from surviving original documents${from}. ${count(r.stages.cleaned_audit.matched_canary, "stored item")} held the marker afterwards.`;
     },
     caption: (r) => `After cleanup: the source and its ${r.stages.cleaned_audit.invalidated_artifacts} descendants are content-free tombstones that keep their IDs and links; ${GC.joinList(rebuiltIds(r))} was rebuilt (teal).`},
    {key: "verify", tab: "Verified", eyebrow: "Stage 5 · Recorded verification", title: "Gone, and nothing else lost.", answer: "secret",
     text: (r) => `${passedChecks(r)} of ${r.checks.length} recorded checks passed. The secret questions no longer return the marker, while the unrelated garden time and the independently sourced reading-room name stay answerable.`,
     caption: () => "After verification: the recorded answer to the secret question. Teal threads show its context, and none of it holds the marker."},
  ];

  const state = {data: null, run: null, stage: "setup", view: "diagram", selected: null, hover: null, trail: null};

  function stageInfo() { return STAGES.find((s) => s.key === state.stage); }
  function probe() {
    const info = stageInfo();
    if (!info.answer) return null;
    const answer = state.run.answers[info.answer];
    return {label: `Recorded answer · stage ${STAGES.indexOf(info) + 1}`, question: answer.question, answer: answer.answer,
            context: answer.context_ids, citations: answer.citations, containsMarker: answer.contains_marker};
  }

  // ---- Run picker ----
  function renderRuns() {
    const box = clear(document.getElementById("run-options"));
    for (const run of state.data.runs) {
      const label = el("label", "run-option");
      const input = el("input", "run-option__input");
      input.type = "radio";
      input.name = "run";
      input.value = run.id;
      input.checked = run === state.run;
      input.addEventListener("change", () => { if (input.checked) chooseRun(run); });
      const card = el("span", "run-option__card");
      const calls = GC.modelCalls(run);
      card.append(el("span", "run-option__title", run.label),
                  el("span", "run-option__meta", `${run.model} · ${passedChecks(run)}/${run.checks.length} checks · ${calls.length} model calls · ${ms(run.model_call_total_ms)}`));
      label.append(input, card);
      box.append(label);
    }
    renderRunSource();
  }

  function renderRunSource() {
    const run = state.run;
    const source = clear(document.getElementById("run-source"));
    source.append("Source report: ");
    const link = el("a", null, run.source_file);
    link.href = `${state.data.repository}/blob/main/${run.source_file}`;
    source.append(link, ` · SHA-256 ${run.source_sha256.slice(0, 12)}… · ${run.passed ? "passed" : "failed"}`);
  }

  function chooseRun(run) {
    state.run = run;
    state.selected = null;
    state.trail.setRun(run, state.data.seed_legend);
    renderRunSource();
    renderStage();
    renderAnswers();
    renderDetails();
    writeHash();
  }

  // ---- Stage tabs ----
  function renderTabs() {
    const box = clear(document.getElementById("stage-tabs"));
    STAGES.forEach((stage, index) => {
      const tab = el("button", "stage-tab");
      tab.type = "button";
      tab.id = `tab-${stage.key}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "stage-panel");
      tab.append(el("span", "stage-tab__num", String(index + 1).padStart(2, "0")), el("span", "stage-tab__label", stage.tab));
      tab.addEventListener("click", () => setStage(stage.key));
      tab.addEventListener("keydown", (event) => {
        const keys = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};
        let next = null;
        if (event.key in keys) next = (index + keys[event.key] + STAGES.length) % STAGES.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = STAGES.length - 1;
        if (next === null) return;
        event.preventDefault();
        setStage(STAGES[next].key);
        document.getElementById(`tab-${STAGES[next].key}`).focus();
      });
      box.append(tab);
    });
    updateTabs();
  }

  function updateTabs() {
    for (const stage of STAGES) {
      const tab = document.getElementById(`tab-${stage.key}`);
      const selected = stage.key === state.stage;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    document.getElementById("stage-panel").setAttribute("aria-labelledby", `tab-${state.stage}`);
    const index = STAGES.findIndex((s) => s.key === state.stage);
    document.getElementById("stage-prev").disabled = index === 0;
    document.getElementById("stage-next").disabled = index === STAGES.length - 1;
  }

  function setStage(key) {
    state.stage = key;
    updateTabs();
    renderStage();
    writeHash();
  }

  // ---- The stage: explanation, counts, trail, evidence ----
  function renderStage() {
    const run = state.run;
    const info = stageInfo();
    const index = STAGES.indexOf(info);
    document.getElementById("stage-eyebrow").textContent = info.eyebrow;
    document.getElementById("stage-title").textContent = info.title;
    document.getElementById("stage-text").textContent = info.text(run);
    renderCounts();
    document.getElementById("fig-num").textContent = `Fig. ${index + 1}`;
    document.getElementById("fig-name").textContent = `The memory trail · ${info.tab.toLowerCase()}`;
    document.getElementById("trail-caption").textContent = info.caption(run);
    state.trail.setStage(info.key, probe());
    state.selected = state.trail.selected;
    renderList();
    renderDetail();
    renderEvidence();
  }

  function renderCounts() {
    const audit = state.run.stages[{setup: "initial_audit", source_only: "source_only_audit", leak: "source_only_audit"}[state.stage] || "cleaned_audit"];
    const after = !["setup"].includes(state.stage);
    const rows = [
      ["Stored items", audit.total_artifacts, ""],
      ["Active", audit.active_artifacts, ""],
      ["Hold the marker", audit.matched_canary, audit.matched_canary ? "is-warn" : after ? "is-ok" : ""],
      ["Stale descendants", audit.stale_descendants, audit.stale_descendants ? "is-warn" : after ? "is-ok" : ""],
      ["Withdrawn sources", audit.deleted_artifacts, audit.deleted_artifacts ? "is-removed" : ""],
      ["Purged descendants", audit.invalidated_artifacts, ""],
    ];
    const box = clear(document.getElementById("stage-counts"));
    for (const [label, value, cls] of rows) {
      const item = el("div", cls);
      item.append(el("dt", null, label), el("dd", null, value));
      box.append(item);
    }
  }

  function renderList() {
    const p = probe();
    const list = document.getElementById("trail-list");
    const hadFocus = list.contains(document.activeElement);
    GC.renderTrailList(list, state.run, state.data.seed_legend, state.stage, {
      selected: state.selected, context: p ? p.context : [], cited: p ? p.citations : [], clean: Boolean(p && !p.containsMarker),
      onSelect: (id) => { state.trail.select(id); },
    });
    if (hadFocus) {
      const button = [...list.querySelectorAll("button")].find((b) => b.getAttribute("data-id") === state.selected);
      if (button) button.focus();
    }
  }

  function renderDetail() {
    const id = state.hover || state.selected || state.run.source_id;
    const box = clear(document.getElementById("artifact-detail"));
    const d = GC.describe(state.run, state.data.seed_legend, state.stage, id);
    const head = el("div", "artifact-detail__head");
    head.append(GC.kindIcon(d.kind), el("span", "artifact-detail__id", d.id));
    if (d.status) head.append(el("span", `chip ${GC.chipClass(d.status)}`, d.status === "active" ? "Active" : GC.STATUS[d.status].chip));
    const source = state.stage === "setup" ? "The source document" : "The withdrawn source";
    const mode = state.hover && state.hover !== state.selected ? "Previewing" : state.selected ? "Selected" : `${source} · select any artifact to inspect it`;
    head.append(el("span", "fine", mode));
    const kindText = d.title ? `${GC.KINDS[d.kind].label} · ${d.title}` : GC.KINDS[d.kind].label;
    box.append(head, el("p", "artifact-detail__desc", `${kindText}. ${d.statusLabel}.`));
    const facts = el("dl", "artifact-detail__facts");
    const fact = (label, content) => { const wrap = el("div"); wrap.append(el("dt", null, label)); const dd = el("dd"); dd.append(content); wrap.append(dd); facts.append(wrap); };
    const ids = (list, empty) => {
      if (!list.length) return document.createTextNode(empty);
      const row = el("span", "id-list");
      for (const item of list) row.append(el("code", "id-chip", shortId(item)));
      return row;
    };
    const how = {"seed design": "seed design: one chunk per document in GhostCache's seeding code",
                 recorded: "recorded: the summary event in this report", inferred: "inferred from the order of recorded events"}[d.how];
    const from = el("span");
    from.append(ids(d.parents, !d.status ? "Not created yet at this stage" : d.kind === "document" ? "An original document" : "No recorded parents"));
    if (how && d.parents.length) from.append(el("span", "fine", ` ${how}`));
    fact("Derived from", from);
    fact("Fed into", ids(d.children, "Nothing in the recorded trail at this stage"));
    const marker = el("ul", "marker-history");
    for (const m of d.marker) {
      const item = el("li");
      item.append(el("span", null, m.label), el("b", m.held ? "is-held" : m.existed ? null : "is-none", m.held ? "◆ YES" : m.existed ? "NO" : "NOT CREATED"));
      marker.append(item);
    }
    fact("Held the marker", marker);
    box.append(facts);
  }

  function answerCard(key, options) {
    const run = state.run;
    const a = run.answers[key];
    const card = el("article", "answer-card");
    const top = el("div", "answer-card__top");
    top.append(el("span", "eyebrow", GC.ANSWER_LABELS[key]),
               el("span", a.contains_marker ? "chip chip--marker" : "chip chip--ok", a.contains_marker ? "◆ Marker revealed" : "✓ No marker"));
    const question = el("p", "answer-card__q", `“${a.question}”`);
    const answer = el("p", "answer-card__a");
    answer.append(GC.markText(a.answer, run.marker));
    const meta = el("dl", "answer-card__meta");
    const row = (label, content) => { meta.append(el("dt", null, label)); const dd = el("dd"); dd.append(content); meta.append(dd); };
    const ctx = el("span", "id-list");
    for (const id of a.context_ids) {
      const chip = el("code", a.citations.includes(id) ? "id-chip is-cited" : "id-chip is-uncited", shortId(id));
      chip.title = a.citations.includes(id) ? "Supplied and cited" : "Supplied, not cited";
      ctx.append(chip);
    }
    row("Context", ctx);
    row("Cited", document.createTextNode(a.citations.length ? `${a.citations.length} of ${a.context_ids.length} supplied artifacts (solid outline; dashed were supplied, not cited)` : "Nothing; every supplied artifact has a dashed outline"));
    row("Recorded", document.createTextNode(`${a.mode} answer from ${a.provider} · ${ms(a.duration_ms)}${a.input_tokens !== null ? ` · ${a.input_tokens} in / ${a.output_tokens} out tokens` : ""}`));
    if (options && options.heading === false) top.firstChild.remove();
    card.append(top, question, answer, meta);
    return card;
  }

  function renderEvidence() {
    const run = state.run;
    const box = clear(document.getElementById("stage-evidence"));
    const info = stageInfo();
    if (info.key === "setup" || info.key === "leak") { box.append(answerCard(info.answer)); return; }
    if (info.key === "source_only") {
      const card = el("div", "notice notice--warn");
      card.append(el("strong", null, "Incomplete, on purpose. "),
                  document.createTextNode(`After ${run.source_id} was deleted, the audit still found ${count(run.stages.source_only_audit.stale_ids.length, "active descendant")} depending on it: `));
      const ids = el("span", "id-list");
      for (const id of run.stages.source_only_audit.stale_ids) ids.append(el("code", "id-chip", shortId(id)));
      card.append(ids);
      box.append(card);
      return;
    }
    if (info.key === "cleanup") {
      const card = el("div", "notice notice--ok");
      const purged = (run.events.find((e) => e.name === "delete.propagated") || {}).affected_ids || [];
      const rebuilt = rebuildEvent(run);
      card.append(el("strong", null, "Cleanup recorded. "),
                  document.createTextNode(`The cascade changed ${count(purged.length, "descendant")} (`));
      card.append(GC.joinList(purged.map(shortId)), `), left ${count(run.stages.cleaned_audit.stale_descendants, "stale artifact")}`);
      if (rebuilt) card.append(`, and rebuilt ${rebuilt.artifact_id} from ${GC.joinList(rebuilt.parent_ids)} (recorded parents)`);
      card.append(`. ${count(run.stages.cleaned_audit.active_artifacts, "artifact")} stay active.`);
      box.append(card);
      return;
    }
    box.append(checksList(run.checks), answerCard("secret"));
  }

  function checksList(checks) {
    const groups = [
      ["The failure was real", (name) => /Source-only control|Pre-deletion/.test(name)],
      ["Nothing else was lost", (name) => /Unrelated roof garden|Shared fact/.test(name)],
      ["The secret is gone", () => true],
    ];
    const box = el("div", "checks");
    const used = new Set();
    for (const [title, match] of groups) {
      const members = checks.filter((check) => !used.has(check) && match(check.name));
      if (!members.length) continue;
      members.forEach((check) => used.add(check));
      const group = el("section", "checks__group");
      group.append(el("h3", null, `${title} · ${members.filter((c) => c.passed).length}/${members.length}`));
      const list = el("ul");
      for (const check of members) {
        const item = el("li", check.passed ? "check" : "check is-failed");
        const icon = el("span", "check__icon", check.passed ? "✓" : "✕");
        icon.setAttribute("aria-hidden", "true");
        const body = el("div");
        const name = el("div", "check__name", check.name);
        name.append(el("span", "check__verdict", check.passed ? "PASS" : "FAIL"));
        body.append(name, el("div", "check__detail", check.detail));
        item.append(icon, body);
        list.append(item);
      }
      group.append(list);
      box.append(group);
    }
    return box;
  }

  // ---- Recorded questions ----
  function renderAnswers() {
    const box = clear(document.getElementById("answers"));
    const groups = [["Before deletion", ["before"]], ["After source-only deletion", ["source_only"]],
                    ["After cleanup", ["secret", "paraphrase", "retained", "shared"]]];
    for (const [title, keys] of groups) {
      const group = el("section", "answers__group");
      group.append(el("h3", null, title));
      const list = el("ul", "answers__list");
      for (const key of keys) {
        const a = state.run.answers[key];
        const item = el("li");
        const details = el("details", "qa");
        if (key === "source_only") details.open = true;
        const summary = el("summary");
        summary.append(el("span", "qa__q", `“${a.question}”`),
                       el("span", a.contains_marker ? "chip chip--marker" : "chip chip--ok", a.contains_marker ? "◆ Marker" : "✓ No marker"),
                       el("span", "qa__a", `${GC.ANSWER_LABELS[key].split(" · ")[1]} · ${a.answer.length > 70 ? `${a.answer.slice(0, 68)}…` : a.answer}`));
        const body = el("div", "qa__body");
        body.append(answerCard(key, {heading: false}));
        details.append(summary, body);
        item.append(details);
        list.append(item);
      }
      group.append(list);
      box.append(group);
    }
  }

  // ---- Timing and technical details ----
  function renderTiming() {
    const cold = state.data.runs.find((r) => r.id === "cold");
    const warm = state.data.runs.find((r) => r.id === "warm");
    const box = document.getElementById("timing");
    if (!cold || !warm) {
      clear(box).append(el("p", "notice", "The cold and warm reports are not both in the evidence file, so there is no timing comparison to show."));
      return;
    }
    GC.renderTiming(box, [cold, warm]);
    const c = GC.modelCalls(cold), w = GC.modelCalls(warm);
    const later = [...c.slice(1), ...w.slice(1)].map((e) => e.duration_ms);
    const oct27 = state.data.runs.find((r) => r.id === "oct27");
    const oct27First = oct27 && GC.modelCalls(oct27)[0];
    document.getElementById("timing-dek").textContent =
      `The two October 28 runs used the same model on the same laptop, one straight after the other. The first call took ${ms(c[0].duration_ms)} cold and ${ms(w[0].duration_ms)} warm: ${ms(c[0].duration_ms - w[0].duration_ms)} of the ${ms(cold.model_call_total_ms - warm.model_call_total_ms)} difference in summed model-call time. Every later call took between ${ms(Math.min(...later))} and ${ms(Math.max(...later))}.` +
      (oct27First ? ` The October 27 run has the same shape: its first call took ${ms(oct27First.duration_ms)}.` : "") +
      " The slow first call is consistent with Ollama loading the model after a server start, but the reports don't record load time, so that cause is inferred, not measured.";
  }

  function disclosure(title, subtitle, content, open) {
    const details = el("details", "disclosure");
    if (open) details.open = true;
    const summary = el("summary");
    const label = el("span", null, title);
    label.append(el("small", null, subtitle));
    summary.append(label);
    const body = el("div", "disclosure__body");
    body.append(content);
    details.append(summary, body);
    return details;
  }

  function renderDetails() {
    const run = state.run;
    const box = clear(document.getElementById("details"));
    const kv = el("dl", "kv");
    const add = (k, v) => { kv.append(el("dt", null, k)); const dd = el("dd"); dd.append(v); kv.append(dd); };
    const link = el("a", null, run.source_file);
    link.href = `${state.data.repository}/blob/main/${run.source_file}`;
    add("Run", document.createTextNode(run.label));
    add("Date", document.createTextNode(`${run.date} (from ${run.date_source}; the report stores times of day only)`));
    add("Model and mode", document.createTextNode(`${run.model} · ${run.mode} · ${run.kind}`));
    add("Report", link);
    add("Report SHA-256", el("code", null, run.source_sha256));
    add("Result", document.createTextNode(`${run.passed ? "Passed" : "Failed"}: ${passedChecks(run)} of ${run.checks.length} checks`));
    add("Model calls", document.createTextNode(`${run.model_call_count} calls, ${ms(run.model_call_total_ms)} summed`));
    if (run.sentry_trace) add("Sentry trace", el("code", null, run.sentry_trace));
    if (run.scope) add("Recorded scope", document.createTextNode(run.scope));
    box.append(disclosure("Run metadata", "Where this run's evidence comes from", kv, true));

    const table = el("table", "table");
    const head = el("tr");
    for (const h of ["#", "Time", "Event", "Artifacts", "Parents", "Duration", "Tokens in / out"]) head.append(el("th", h === "#" || h === "Duration" ? "num" : null, h));
    const thead = el("thead"); thead.append(head);
    const tbody = el("tbody");
    run.events.forEach((e, i) => {
      const tr = el("tr");
      const artifacts = e.artifact_id ? shortId(e.artifact_id) : e.affected_ids ? e.affected_ids.map(shortId).join(", ") : e.answer_key ? `answer: ${e.answer_key}` : "";
      tr.append(el("td", "num", i + 1), el("td", "num", e.time), el("td", null, e.name), el("td", null, artifacts),
                el("td", null, (e.parent_ids || []).map(shortId).join(", ")), el("td", "num", "duration_ms" in e ? ms(e.duration_ms) : ""),
                el("td", "num", "input_tokens" in e && e.input_tokens !== null ? `${e.input_tokens} / ${e.output_tokens}` : ""));
      tbody.append(tr);
    });
    table.append(thead, tbody);
    const wrap = el("div", "table-wrap"); wrap.append(table);
    box.append(disclosure("Recorded event log", `${run.events.length} events, times of day as recorded`, wrap, false));

    const audits = el("table", "table");
    const ah = el("tr");
    for (const h of ["Stage", "Active IDs", "Stale IDs", "IDs holding the marker"]) ah.append(el("th", null, h));
    const athead = el("thead"); athead.append(ah);
    const atbody = el("tbody");
    for (const [label, key] of [["Seeded", "initial_audit"], ["After source-only deletion", "source_only_audit"], ["After cleanup", "cleaned_audit"]]) {
      const a = run.stages[key];
      const tr = el("tr");
      tr.append(el("td", null, label), el("td", null, a.active_ids.map(shortId).join(", ")), el("td", null, a.stale_ids.map(shortId).join(", ") || "none"),
                el("td", null, a.matched_canary_ids.map(shortId).join(", ") || "none"));
      atbody.append(tr);
    }
    audits.append(athead, atbody);
    const awrap = el("div", "table-wrap"); awrap.append(audits);
    box.append(disclosure("Audit IDs by stage", "The audits every status in the trail is read from", awrap, false));
  }

  // ---- View toggle, deep links, start ----
  function setView(view) {
    state.view = view;
    document.getElementById("trail").hidden = view !== "diagram";
    document.getElementById("trail-list").hidden = view !== "list";
    document.getElementById("trail-legend").hidden = view !== "diagram";
    for (const button of document.querySelectorAll("#trail-view button")) button.setAttribute("aria-pressed", String(button.getAttribute("data-view") === view));
    // Labels are fitted by measuring them, which only works while the diagram is displayed.
    if (view === "diagram") state.trail.setStage(state.stage, probe());
  }

  function readHash() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const run = state.data.runs.find((r) => r.id === params.get("run"));
    if (run) state.run = run;
    if (STAGES.some((s) => s.key === params.get("stage"))) state.stage = params.get("stage");
  }

  // A link to another run or stage on this page (for example from the home page) re-renders the view.
  function followHash() {
    const before = state.run;
    readHash();
    for (const input of document.querySelectorAll("#run-options input")) input.checked = input.value === state.run.id;
    updateTabs();
    if (state.run !== before) chooseRun(state.run);
    else renderStage();
  }

  function writeHash() {
    if (window.history && window.history.replaceState) window.history.replaceState(null, "", `#run=${state.run.id}&stage=${state.stage}`);
  }

  function init(data) {
    state.data = data;
    state.run = data.runs[0];
    readHash();
    state.trail = GC.createTrail(document.getElementById("trail"), {
      interactive: true, probe: true, label: "Recorded memory trail. Each artifact is a button; select one to see its provenance.",
      onSelect: (id) => { state.selected = id; state.hover = null; renderDetail(); renderList(); },
      onHover: (id) => { state.hover = id; renderDetail(); },
    });
    GC.renderLegend(document.getElementById("trail-legend"), true);
    renderRuns();
    renderTabs();
    state.trail.setRun(state.run, data.seed_legend);
    renderStage();
    renderAnswers();
    renderTiming();
    renderDetails();
    for (const button of document.querySelectorAll("#trail-view button")) button.addEventListener("click", () => setView(button.getAttribute("data-view")));
    setView(window.matchMedia && window.matchMedia("(max-width: 640px)").matches ? "list" : "diagram");
    document.getElementById("stage-prev").addEventListener("click", () => { const i = STAGES.findIndex((s) => s.key === state.stage); if (i > 0) setStage(STAGES[i - 1].key); });
    document.getElementById("stage-next").addEventListener("click", () => { const i = STAGES.findIndex((s) => s.key === state.stage); if (i < STAGES.length - 1) setStage(STAGES[i + 1].key); });
    document.getElementById("footer-source").textContent = `Static site · recorded evidence only · data: ${data.runs.map((r) => r.source_file).join(", ")}`;
    window.addEventListener("hashchange", followHash);
  }

  function fail() {
    document.getElementById("load-error").hidden = false;
    for (const id of ["run-options", "trail"]) {
      const box = document.getElementById(id);
      if (box) clear(box).append(el("p", "trail-frame__status", "Recorded evidence unavailable."));
    }
    document.getElementById("stage-title").textContent = "Recorded evidence unavailable";
  }

  GC.onReady(() => { GC.loadEvidence().then(init, fail); });
})();
