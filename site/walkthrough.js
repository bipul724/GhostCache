"use strict";
// Static, read-only walkthrough of recorded GhostCache evaluations.
// Loads data/evidence.json from this site and nothing else: no /api calls, no model, no storage.

const DATA_URL = "data/evidence.json";

const STEPS = [
  {key: "setup", button: "View the setup", eyebrow: "STAGE 1 · SEEDED MEMORY", title: "One secret, many copies.",
   text: (r) => `The run seeded five fictional documents. The withdrawn source, ${r.source_id}, holds the marker ${r.marker}. One search chunk, three model-written summaries and one saved answer were derived from it, directly or through each other. ${r.stages.initial_audit.matched_canary} stored items held the marker.`},
  {key: "source_only", button: "View source-only result", eyebrow: "STAGE 2 · SOURCE-ONLY DELETION", title: "Delete the document, keep its echoes.",
   text: (r) => `Deleting only ${r.source_id} is the deliberately incomplete control. ${r.stages.source_only_audit.stale_descendants} derived items still depended on the deleted source, and ${r.stages.source_only_audit.matched_canary} of them still held the marker.`},
  {key: "leak", button: "View the leaked answer", eyebrow: "STAGE 3 · THE GHOST ANSWERS", title: "The model repeats a deleted secret.",
   text: () => "After the source-only deletion, the evaluation asked the question in different words. Retrieval supplied the surviving copies as context, and Gemma repeated the marker."},
  {key: "cleanup", button: "View cleanup result", eyebrow: "STAGE 4 · PROVENANCE-AWARE CLEANUP", title: "Follow the trail, clear every copy.",
   text: (r) => `Cascade cleanup followed provenance from the source to every descendant: ${r.stages.cleaned_audit.invalidated_artifacts} derived items were purged, and a fresh summary was rebuilt only from surviving original documents. ${r.stages.cleaned_audit.matched_canary} stored items hold the marker afterwards.`},
  {key: "verify", button: "View verification", eyebrow: "STAGE 5 · RECORDED VERIFICATION", title: "Gone, and nothing else lost.",
   text: (r) => `The recorded checks: ${r.checks.filter((c) => c.passed).length} of ${r.checks.length} passed. The secret questions no longer return the marker, while the unrelated garden schedule and the independently sourced shared fact stay answerable.`},
];

const ANSWER_LABELS = {
  before: "Before deletion · secret question",
  source_only: "After source-only deletion · reworded question",
  secret: "After cleanup · secret question",
  paraphrase: "After cleanup · reworded question",
  retained: "After cleanup · unrelated fact",
  shared: "After cleanup · shared fact",
};

const KIND_GROUPS = [
  {prefix: "d-", title: "Original documents"},
  {prefix: "c-", title: "Search chunks"},
  {prefix: "s-", title: "Model-written summaries"},
  {prefix: "conversation-", title: "Saved answer"},
];

const state = {data: null, run: null, step: "setup", answer: "source_only"};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

function shortId(id) {
  return id.startsWith("conversation-") ? `conversation-${id.slice(13, 21)}…` : id;
}

function ms(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value} ms`;
}

function eventsNamed(run, name) {
  return run.events.filter((e) => e.name === name);
}

// Where each artifact came from, labelled by how we know it.
function origins(run, legend) {
  const map = {};
  for (const id of Object.keys(legend.documents)) map[id] = {parents: [], how: "original document"};
  for (const id of Object.keys(legend.documents)) map[`c-${id.slice(2)}`] = {parents: [id], how: "seed design"};
  for (const event of eventsNamed(run, "summary.generated")) {
    map[event.artifact_id] = {parents: event.parent_ids || [], how: "recorded"};
  }
  const seeded = run.events.find((e) => e.answer_key === "seeded_conversation");
  const conversation = run.stages.initial_audit.active_ids.find((id) => id.startsWith("conversation-"));
  if (seeded && conversation) map[conversation] = {parents: seeded.parent_ids || [], how: "inferred"};
  return map;
}

function statusFor(run, step, id) {
  const s = run.stages;
  const removedSource = s.initial_audit.active_ids.filter((x) => !s.source_only_audit.active_ids.includes(x));
  const purged = (eventsNamed(run, "delete.propagated")[0] || {}).affected_ids || [];
  if (step === "setup") {
    if (!s.initial_audit.active_ids.includes(id)) return null;
    return s.initial_audit.matched_canary_ids.includes(id) ? "marker" : "active";
  }
  if (step === "source_only" || step === "leak") {
    if (!s.initial_audit.active_ids.includes(id)) return null;
    if (removedSource.includes(id)) return "removed";
    if (s.source_only_audit.stale_ids.includes(id)) {
      return s.source_only_audit.matched_canary_ids.includes(id) ? "stale-marker" : "stale";
    }
    return s.source_only_audit.matched_canary_ids.includes(id) ? "marker" : "active";
  }
  if (s.cleaned_audit.active_ids.includes(id)) {
    return s.initial_audit.active_ids.includes(id) ? "active" : "rebuilt";
  }
  if (removedSource.includes(id)) return "removed";
  return purged.includes(id) ? "removed-purged" : null;
}

const STATUS_TEXT = {active: "Active", marker: "Holds marker", stale: "Stale", "stale-marker": "Stale · holds marker",
                     removed: "Deleted", "removed-purged": "Purged · content emptied", rebuilt: "Rebuilt"};

function renderRuns() {
  const box = clear(document.getElementById("run-buttons"));
  for (const run of state.data.runs) {
    const button = el("button", "run-button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(run === state.run));
    button.append(el("strong", null, run.label), el("small", null, `${run.model} · ${run.mode} · ${run.passed ? "passed" : "failed"}`));
    button.addEventListener("click", () => { state.run = run; renderAll(); });
    box.append(button);
  }
  const run = state.run;
  document.getElementById("run-result").textContent =
    `${run.checks.filter((c) => c.passed).length} / ${run.checks.length} CHECKS PASSED`;
  const source = clear(document.getElementById("run-source"));
  source.append("Source: ");
  const link = el("a", null, run.source_file);
  link.href = `${state.data.repository}/blob/main/${run.source_file}`;
  source.append(link, ` · SHA-256 ${run.source_sha256.slice(0, 16)}… · ${run.model_call_count} model calls, ${ms(run.model_call_total_ms)} in total · date from ${run.date_source}`);
  if (run.sentry_trace) source.append(` · Sentry trace ${run.sentry_trace.slice(0, 12)}…`);
}

function renderSteps() {
  const box = clear(document.getElementById("step-buttons"));
  STEPS.forEach((step, index) => {
    const button = el("button", "step-button");
    button.type = "button";
    button.dataset.step = step.key;
    button.setAttribute("aria-pressed", String(step.key === state.step));
    button.append(el("span", "step-number", String(index + 1).padStart(2, "0")), el("span", null, step.button));
    button.addEventListener("click", () => { state.step = step.key; renderStage(); renderSteps(); });
    box.append(button);
  });
}

function counts(stage) {
  return [["Stored items", stage.total_artifacts], ["Active", stage.active_artifacts],
          ["Hold the marker", stage.matched_canary], ["Stale descendants", stage.stale_descendants],
          ["Deleted sources", stage.deleted_artifacts], ["Purged", stage.invalidated_artifacts]];
}

function renderAnswer(container, run, key) {
  const answer = run.answers[key];
  clear(container).hidden = false;
  const top = el("div", "answer-top");
  top.append(el("span", "tiny-label", ANSWER_LABELS[key]),
             el("span", answer.contains_marker ? "badge leak" : "badge clean",
                answer.contains_marker ? "Marker revealed" : "No marker"));
  container.append(top, el("p", "answer-question", `Q: ${answer.question}`), el("p", "answer-text", answer.answer));
  const meta = el("p", "answer-meta",
    `Recorded ${answer.mode} answer from ${answer.provider} · ${ms(answer.duration_ms)}` +
    (answer.input_tokens !== null ? ` · ${answer.input_tokens} in / ${answer.output_tokens} out tokens` : ""));
  const ctx = el("div", "id-row");
  ctx.append(el("span", "id-label", "Context supplied"));
  for (const id of answer.context_ids) ctx.append(el("code", answer.citations.includes(id) ? "id-chip cited" : "id-chip", shortId(id)));
  container.append(meta, ctx, el("p", "id-hint", answer.citations.length
    ? "Highlighted IDs were cited by the model." : "The model cited nothing."));
}

function renderStage() {
  const run = state.run;
  const step = STEPS.find((s) => s.key === state.step);
  document.getElementById("stage-eyebrow").textContent = step.eyebrow;
  document.getElementById("stage-tag").textContent = "RECORDED · NOT A LIVE ACTION";
  document.getElementById("stage-title").textContent = step.title;
  document.getElementById("stage-text").textContent = step.text(run);
  const stageKey = {setup: "initial_audit", source_only: "source_only_audit", leak: "source_only_audit"}[step.key] || "cleaned_audit";
  const box = clear(document.getElementById("stage-counts"));
  for (const [label, value] of counts(run.stages[stageKey])) {
    const item = el("div", "count");
    item.append(el("strong", null, value), el("span", null, label));
    box.append(item);
  }
  const answer = document.getElementById("stage-answer");
  if (step.key === "leak") renderAnswer(answer, run, "source_only");
  else if (step.key === "setup") renderAnswer(answer, run, "before");
  else answer.hidden = true;
  const checks = clear(document.getElementById("stage-checks"));
  checks.hidden = step.key !== "verify";
  if (step.key === "verify") {
    for (const check of run.checks) {
      const row = el("div", check.passed ? "check" : "check failed");
      row.append(el("span", "check-icon", check.passed ? "✓" : "✕"));
      const body = el("div");
      body.append(el("div", "check-name", check.name), el("div", "check-detail", check.detail));
      row.append(body);
      checks.append(row);
    }
  }
  renderTrail();
}

function renderTrail() {
  const run = state.run;
  const legend = state.data.seed_legend;
  const from = origins(run, legend);
  const all = [...new Set([...run.stages.initial_audit.active_ids, ...run.stages.cleaned_audit.active_ids])];
  const highlight = state.step === "leak" ? run.answers.source_only.context_ids : [];
  const trail = clear(document.getElementById("trail"));
  let shown = 0;
  for (const group of KIND_GROUPS) {
    const ids = all.filter((id) => id.startsWith(group.prefix));
    const column = el("div", "trail-group");
    column.append(el("p", "eyebrow", group.title.toUpperCase()));
    for (const id of ids) {
      const status = statusFor(run, state.step, id);
      if (!status) continue;
      shown += 1;
      const node = el("div", `node ${status.split("-")[0]}${highlight.includes(id) ? " context" : ""}`);
      const top = el("div", "node-top");
      top.append(el("code", "node-id", shortId(id)), el("span", "node-status", STATUS_TEXT[status]));
      node.append(top);
      if (legend.documents[id]) node.append(el("div", "node-title", legend.documents[id]));
      const origin = from[id];
      if (origin && origin.parents.length) {
        node.append(el("div", "node-from", `from ${origin.parents.map(shortId).join(", ")} · ${origin.how}`));
      }
      if (highlight.includes(id)) node.append(el("div", "node-flag", "Supplied to the model for the leaked answer"));
      column.append(node);
    }
    trail.append(column);
  }
  document.getElementById("trail-count").textContent = `${shown} ITEMS SHOWN`;
}

function renderQuestions() {
  const box = clear(document.getElementById("question-buttons"));
  for (const key of Object.keys(ANSWER_LABELS)) {
    const button = el("button", "question-button", ANSWER_LABELS[key]);
    button.type = "button";
    button.setAttribute("aria-pressed", String(key === state.answer));
    button.addEventListener("click", () => { state.answer = key; renderQuestions(); });
    box.append(button);
  }
  renderAnswer(document.getElementById("question-answer"), state.run, state.answer);
}

function callLabel(event) {
  if (event.name === "summary.generated") {
    return event.artifact_id.startsWith("s-rebuilt") ? `Rebuild summary ${event.artifact_id}` : `Summarize into ${event.artifact_id}`;
  }
  if (event.answer_key === "seeded_conversation") return "Seeding answer (saved to memory)";
  return `Answer · ${ANSWER_LABELS[event.answer_key] || event.answer_key}`;
}

function renderTiming() {
  const runs = state.data.runs;
  const cold = runs.find((r) => r.id === "cold");
  const warm = runs.find((r) => r.id === "warm");
  const table = clear(document.getElementById("timing-table"));
  if (!cold || !warm) return;
  const coldCalls = cold.events.filter((e) => "duration_ms" in e);
  const warmCalls = warm.events.filter((e) => "duration_ms" in e);
  const max = Math.max(...coldCalls.map((e) => e.duration_ms), ...warmCalls.map((e) => e.duration_ms));
  const head = el("tr");
  head.append(el("th", null, "Model call (in recorded order)"), el("th", null, "Cold"), el("th", null, "Warm"));
  table.append(head);
  coldCalls.forEach((event, index) => {
    const other = warmCalls[index];
    const row = el("tr");
    row.append(el("td", null, callLabel(event)));
    for (const call of [event, other]) {
      const cell = el("td");
      if (call) {
        const wrap = el("div", "bar-cell");
        const track = el("span", "bar-track");
        const bar = el("span", "bar");
        bar.style.width = `${Math.max(3, (call.duration_ms / max) * 100)}%`;
        track.append(bar);
        wrap.append(el("span", "bar-value", ms(call.duration_ms)), track);
        cell.append(wrap);
      }
      row.append(cell);
    }
    table.append(row);
  });
  const total = el("tr", "total");
  total.append(el("td", null, `Total across ${coldCalls.length} calls`), el("td", null, ms(cold.model_call_total_ms)), el("td", null, ms(warm.model_call_total_ms)));
  table.append(total);
  const first = coldCalls[0].duration_ms - warmCalls[0].duration_ms;
  const diff = cold.model_call_total_ms - warm.model_call_total_ms;
  const oct27 = runs.find((r) => r.id === "oct27");
  const oct27First = oct27 && oct27.events.find((e) => "duration_ms" in e);
  document.getElementById("timing-text").textContent =
    `The two October 28 runs used the same model on the same laptop, one after the other. The first call took ${ms(coldCalls[0].duration_ms)} cold and ${ms(warmCalls[0].duration_ms)} warm: ${ms(first)} of the ${ms(diff)} difference in total model time. Every later call took about 1–3 s in both.` +
    (oct27First ? ` The October 27 run shows the same shape: its first call took ${ms(oct27First.duration_ms)}.` : "");
}

function renderAll() {
  renderRuns();
  renderSteps();
  renderStage();
  renderQuestions();
  document.getElementById("marker-inline").textContent = state.run.marker;
  document.getElementById("footer-source").textContent = `Data: ${state.data.runs.map((r) => r.source_file).join(", ")}`;
}

async function start() {
  try {
    const response = await fetch(DATA_URL, {cache: "no-cache"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.runs) || !data.runs.length) throw new Error("no runs");
    state.data = data;
    state.run = data.runs[0];
    renderAll();
    renderTiming();
  } catch (error) {
    document.getElementById("load-error").hidden = false;
  }
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", start);
