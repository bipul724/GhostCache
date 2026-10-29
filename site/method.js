"use strict";
// Methodology page: tables and timings read from data/evidence.json (loaded by site.js).
// Every number here comes from the recorded reports; nothing is computed from a model.

(function () {
  const GC = window.GC;
  const {el, clear, ms} = GC;

  const PROBES = [
    {key: "before", label: "Before deletion · secret question", need: "Must reveal the marker: the baseline",
     verdict: (a) => (a.contains_marker ? ["leak", "◆ Revealed"] : ["fail", "✕ Not revealed"])},
    {key: "source_only", label: "After source-only deletion · reworded", need: "Must reveal it: the failure is real",
     verdict: (a) => (a.contains_marker ? ["leak", "◆ Revealed"] : ["fail", "✕ Not revealed"])},
    {key: "secret", label: "After cleanup · secret question", need: "Must not reveal it",
     verdict: (a) => (a.contains_marker ? ["fail", "✕ Revealed"] : ["clean", "✓ No marker"])},
    {key: "paraphrase", label: "After cleanup · reworded", need: "Must not reveal it",
     verdict: (a) => (a.contains_marker ? ["fail", "✕ Revealed"] : ["clean", "✓ No marker"])},
    {key: "retained", label: "After cleanup · garden time", need: "Must still answer 07:40",
     verdict: (a) => (a.answer.includes("07:40") ? ["ok", "✓ 07:40"] : ["fail", "✕ Missing"])},
    {key: "shared", label: "After cleanup · reading room", need: "Must still answer Lantern Hall",
     verdict: (a) => (a.answer.includes("Lantern Hall") ? ["ok", "✓ Lantern Hall"] : ["fail", "✕ Missing"])},
  ];

  function runName(run) {
    return (GC.SHORT_RUN[run.id] || [run.label])[0];
  }

  function table(headings, rows) {
    const t = el("table", "table");
    const head = el("tr");
    for (const [text, cls] of headings) head.append(el("th", cls || null, text));
    const thead = el("thead");
    thead.append(head);
    const tbody = el("tbody");
    for (const cells of rows) {
      const tr = el("tr");
      for (const [content, cls] of cells) {
        const td = el("td", cls || null);
        td.append(content);
        tr.append(td);
      }
      tbody.append(tr);
    }
    t.append(thead, tbody);
    return t;
  }

  function renderResults(data) {
    const rows = data.runs.map((run) => {
      const s = run.stages;
      const calls = GC.modelCalls(run);
      const passed = run.checks.filter((c) => c.passed).length;
      const name = el("span");
      name.append(el("strong", null, runName(run)), el("br"), el("span", "fine", run.date));
      const verdict = el("span", `verdict verdict--${run.passed ? "ok" : "fail"}`, `${run.passed ? "✓" : "✕"} ${passed}/${run.checks.length}`);
      return [[name], [verdict],
              [`${s.initial_audit.total_artifacts} / ${s.initial_audit.matched_canary}`, "num"],
              [`${s.source_only_audit.active_artifacts} / ${s.source_only_audit.stale_descendants} / ${s.source_only_audit.matched_canary}`, "num"],
              [`${s.cleaned_audit.active_artifacts} / ${s.cleaned_audit.invalidated_artifacts} / ${s.cleaned_audit.matched_canary}`, "num"],
              [String(calls.length), "num"], [ms(run.model_call_total_ms), "num"], [ms(calls[0].duration_ms), "num"]];
    });
    const box = clear(document.getElementById("results-table"));
    box.append(table([["Run"], ["Checks"], ["Seeded: stored / marker", "num"], ["Source-only: active / stale / marker", "num"],
                      ["Cleaned: active / purged / marker", "num"], ["Model calls", "num"], ["Summed call time", "num"], ["First call", "num"]], rows));
  }

  function renderBalance(data) {
    const rows = PROBES.map((probe) => {
      const cells = [[el("span", null, probe.label)], [el("span", "fine", probe.need)]];
      for (const run of data.runs) {
        const [tone, text] = probe.verdict(run.answers[probe.key]);
        cells.push([el("span", `verdict verdict--${tone}`, text)]);
      }
      return cells;
    });
    const box = clear(document.getElementById("balance-matrix"));
    const t = table([["Recorded question"], ["What the check needs"], ...data.runs.map((run) => [runName(run)])], rows);
    t.classList.add("matrix");
    box.append(t);
    const run = data.runs.find((r) => r.id === "cold") || data.runs[0];
    const quotes = clear(document.getElementById("balance-quotes"));
    for (const key of ["retained", "shared"]) {
      const a = run.answers[key];
      const card = el("figure", "answer-card");
      card.append(el("p", "answer-card__q", `“${a.question}”`), el("p", "answer-card__a", a.answer));
      const cap = el("figcaption", "fine", `Recorded ${a.mode} answer from ${a.provider}, ${runName(run).toLowerCase()} run · cited ${a.citations.map(GC.shortId).join(", ") || "nothing"}`);
      card.append(cap);
      quotes.append(card);
    }
  }

  function renderIcons() {
    for (const slot of document.querySelectorAll(".kicon-slot")) slot.replaceWith(GC.kindIcon(slot.getAttribute("data-kind")));
  }

  function fail() {
    for (const id of ["results-table", "balance-matrix", "method-timing"]) {
      clear(document.getElementById(id)).append(el("p", "notice notice--error", "The recorded evidence (data/evidence.json) could not be loaded, so this table is unavailable. The saved reports are linked below."));
    }
  }

  GC.onReady(() => {
    renderIcons();
    GC.loadEvidence().then((data) => {
      renderResults(data);
      renderBalance(data);
      const order = ["cold", "warm", "oct27"];
      const runs = [...data.runs].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      GC.renderTiming(document.getElementById("method-timing"), runs);
    }, fail);
  });
})();
