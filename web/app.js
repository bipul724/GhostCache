"use strict";

const ui = (id) => document.getElementById(id);
let state = null;
let selectedId = null;
let hoverId = null;
let stage = 0;
let busy = false;
let checks = [];
let lastAnswer = null;
// The fixed-text reason a deletion response gave for a failed rebuild, kept with the outcome it belongs to.
let rebuildError = null;
let selectedMode = "fixture";
// True after a request failed and the server's state could not be read back: the display may be stale.
let stateUnknown = false;
let busyTimer = null;
let graphView = window.innerWidth < 640 ? "list" : "graph";
let inspectorOpen = window.innerWidth >= 900;
const localEvents = [];
const stepActions = ["seed", "ask-secret", "source-only", "inspect", "cascade"];
const NS = "http://www.w3.org/2000/svg";
const NODE = {w: 164, h: 62, gapX: 40, gapY: 16};
const PAD = {left: 10, top: 34, right: 20, bottom: 22};
const KINDS = ["document", "chunk", "summary", "conversation"];
const KIND_LABEL = {document: "Document", chunk: "Search chunk", summary: "Summary", conversation: "Saved answer"};
const KIND_GROUP = {document: "Original documents", chunk: "Search chunks", summary: "Summaries", conversation: "Saved answers"};
const EVENT_LABEL = {"summary.generated": "Summary written", "answer.generated": "Answer generated", "experiment.seeded": "Archive seeded",
                     "delete.source_only": "Source deleted, copies kept", "delete.propagated": "Cleanup propagated", "summary.rebuild_failed": "Rebuild failed"};
// The drawn trail: nodes and links stay in place between renders so status changes animate.
const graph = {nodes: new Map(), edges: new Map(), parents: {}, children: {}};
const listButtons = new Map();

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined && value !== null) node.textContent = String(value);
  return node;
}
function svgElement(tag, attrs, value) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs || {}).forEach(([key, attr]) => node.setAttribute(key, String(attr)));
  if (value !== undefined && value !== null) node.textContent = String(value);
  return node;
}
function text(value) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
function artifacts() { return Array.isArray(state?.artifacts) ? state.artifacts : []; }
function isRemoved(artifact) {
  return artifact?.deleted === true || ["deleted", "removed", "invalidated", "tombstoned", "purged", "revoked"].includes(String(artifact?.status).toLowerCase());
}
function kindOf(artifact) { return KINDS.includes(artifact?.kind) ? artifact.kind : "document"; }
function shortId(id) { return String(id).startsWith("conversation-") ? `conversation-${String(id).slice(13, 17)}…` : String(id); }
function currentMode() {
  return state?.mode || state?.provider?.mode || selectedMode;
}
function providerName(provider) {
  if (typeof provider === "string") return provider;
  return provider?.label || provider?.name || provider?.model || "Local API";
}
function safeQuestion(kind) {
  const questions = state?.scenario?.questions || {};
  return questions[kind] || {secret:"What is the private detail in the archive?",paraphrase:"Which access phrase opens the observatory vault?",retained:"What useful fact should the archive retain?",shared:"What fact comes from the shared source?"}[kind];
}
function auditIds(field) { return new Set(Array.isArray(state?.audit?.[field]) ? state.audit[field] : []); }
function count(n, one, many) { return `${n} ${n === 1 ? one : many || `${one}s`}`; }
function hideError() { ui("error-banner").hidden = true; }
function showError(message) { ui("error-banner").textContent = message; ui("error-banner").hidden = false; }
function setBusy(value, message) {
  clearInterval(busyTimer);
  busy = value;
  document.querySelectorAll("button").forEach((button) => { button.disabled = value; });
  ui("mode-select").disabled = value;
  ui("busy-text").textContent = message || "Working…";
  ui("busy-detail").textContent = "";
  ui("busy-indicator").hidden = !value;
  document.body.setAttribute("aria-busy", String(value));
  if (value) {
    const start = Date.now();
    busyTimer = setInterval(() => {
      const seconds = Math.floor((Date.now() - start) / 1000);
      // Elapsed time only: a local model's duration can't be predicted, so no progress estimate is shown.
      const live = selectedMode === "live" && seconds > 5 ? " · a first local call can take a minute or more, likely while Ollama loads the model" : "";
      ui("busy-detail").textContent = `${seconds} s elapsed${live}`;
    },1000);
  }
}
function requestError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
async function request(path, body) {
  const response = await fetch(path, body === undefined ? {cache:"no-store"} : {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
  });
  let data;
  try { data = await response.json(); } catch { throw requestError(`The local API returned an unreadable response (${response.status}).`, response.status); }
  if (!response.ok) throw requestError(data.error || data.detail || `Request failed (${response.status}).`, response.status);
  return data;
}
function acceptState(next) {
  if (!next || typeof next !== "object") return;
  state = next;
  stateUnknown = false;
  selectedMode = next.mode || next.provider?.mode || selectedMode;
  if (next.stage === "cleaned") stage = 5;
  else if (next.stage === "source_only") stage = Math.max(stage === 5 ? 3 : stage,3);
  else if (next.stage === "seeded" && stage === 0) stage = 1;
  // The discarded experiment's answers, checks, selection and local history must not reappear.
  else if (next.stage === "storage_failed") { stage = 0; checks = []; lastAnswer = null; rebuildError = null; selectedId = null; hoverId = null; localEvents.length = 0; }
  const ids = artifacts().map((a) => a.id);
  if (!selectedId || !ids.includes(selectedId)) {
    selectedId = state.scenario?.source_id || ids[0] || null;
  }
  render();
}

function renderProvider() {
  const provider = state?.provider || {};
  const liveOption = ui("mode-select").querySelector('option[value="live"]');
  liveOption.disabled = !provider.available;
  // Short option labels so the menu fits a phone; the banner carries the full mode description.
  liveOption.textContent = provider.available ? "Live Gemma — local inference" : "Live Gemma — unavailable";
  const mode = currentMode();
  ui("mode-select").value = mode === "live" ? "live" : "fixture";
  ui("provider-banner").classList.toggle("live", mode === "live");
  if (mode === "live") {
    ui("provider-title").textContent = provider.available ? "Live Gemma — local model inference" : "Live Gemma — model unavailable";
    ui("provider-message").textContent = provider.available ? "Synthetic archive, real local inference through Ollama. Each answer shows its model, timing and tokens." : (provider.message || "Choose the fixture to run without a model.");
    ui("model-label").textContent = provider.model || "LOCAL INFERENCE";
    ui("provider-availability").textContent = "";
  } else {
    ui("provider-title").textContent = "Fixture — deterministic simulation";
    ui("provider-message").textContent = "Deterministic rules. No model inference.";
    ui("model-label").textContent = provider.available ? "LIVE MODEL ALSO AVAILABLE" : "NO MODEL REQUIRED";
    ui("provider-availability").textContent = provider.available ? `Live Gemma is ready (${provider.model}); switch modes to use it.` : provider.message ? `Live Gemma unavailable: ${provider.message}` : "";
  }
}
function rebuiltSummaries() {
  return artifacts().filter((a) => kindOf(a) === "summary" && String(a.id).startsWith("s-rebuilt") && !isRemoved(a));
}
// The server's current rebuild outcome, kept apart from its bounded event window, so an unresolved
// failure survives reloads, repeated cleanup and any number of later events. Only a later
// successful rebuild or a successful reset replaces it.
function rebuildFailure() {
  const outcome = state?.rebuild;
  return state?.stage === "cleaned" && outcome?.status === "failed" ? outcome : null;
}
const REBUILD_REASON = {invalid_output: "The model's reply could not be used as a summary.", not_stored: "The rebuilt summary could not be stored."};
function rebuildReason(failure) {
  if (rebuildError?.outcome === JSON.stringify(failure)) return rebuildError.message;
  const category = typeof failure.error_category === "string" ? failure.error_category : "";
  if (REBUILD_REASON[category]) return REBUILD_REASON[category];
  return category ? `The local model call failed (${category}).` : "The summary rebuild did not complete.";
}
function renderStatus() {
  const box = ui("stage-status");
  const audit = state?.audit || {};
  const source = state?.scenario?.source_id || "The source";
  let tone = "neutral", title, detail;
  if (stateUnknown) {
    tone = "failed"; title = "The lab could not confirm the server's state.";
    detail = "A request failed and the state could not be reloaded, so what is shown may be out of date. Reload the page to check before continuing.";
  } else if (state?.stage === "storage_failed") {
    tone = "failed"; title = "Experiment storage could not be restored.";
    detail = "The experiment was cleared rather than served from a database that couldn't be verified. Reset to recover.";
  } else if (!artifacts().length) {
    tone = "idle"; title = "The archive is empty.";
    detail = "Seed it to create five fictional documents and their derived memories.";
  } else if (state.stage === "source_only") {
    tone = "warn"; title = "Incomplete deletion, on purpose.";
    detail = `${source} is withdrawn, yet ${count(audit.stale_descendants || 0, "derived artifact")} still depend on it and ${count(audit.matched_canary || 0, "stored row")} still hold the marker.`;
  } else if (state.stage === "cleaned") {
    tone = "ok"; title = "Cleanup propagated through the trail.";
    const rebuilt = rebuiltSummaries();
    detail = `${count(audit.deleted_artifacts || 0, "source")} withdrawn and ${count(audit.invalidated_artifacts || 0, "descendant")} purged; ${count(audit.matched_canary || 0, "row")} hold the marker and ${count(audit.stale_descendants || 0, "active artifact")} depend on a withdrawn source.`;
    if (rebuilt.length) detail += ` Rebuilt ${rebuilt.map((a) => a.id).join(", ")} from ${(rebuilt[rebuilt.length - 1].parent_ids || []).join(", ")}.`;
    const failure = rebuildFailure();
    if (failure) {
      tone = "warn"; title = "Cleanup is complete, but the summary rebuild failed.";
      detail = `${detail} ${rebuildReason(failure)} The purge itself finished; no fixture text was inserted. Repeating cleanup does not retry the rebuild; reset to start again.`;
    }
  } else {
    title = "Seeded: the secret has spread.";
    detail = `${count(artifacts().length, "artifact")} from five fictional documents; ${count(audit.matched_canary || 0, "row")} hold the marker. Next, ask for the private detail.`;
  }
  box.className = `stage-status stage-status--${tone}`;
  box.replaceChildren(element("strong", null, title), element("span", null, detail));
  ui("storage-failed").hidden = state?.stage !== "storage_failed";
}
function renderSteps() {
  ui("step-count").textContent = `${Math.min(stage, 5)} / 5`;
  document.querySelectorAll(".step-button").forEach((button, index) => {
    button.classList.toggle("done", stage > index);
    button.classList.toggle("next", stage === index);
    button.setAttribute("aria-current", stage === index ? "step" : "false");
    button.querySelector(".step-check").textContent = stage > index ? "✓" : "";
  });
  ui("deletion-warning").hidden = !(stage >= 3 && stage < 5);
}
function graphData() {
  const nodes = artifacts();
  const ids = new Set(nodes.map((node) => node.id));
  let edges = (state?.graph?.edges || []).map((edge) => {
    if (Array.isArray(edge)) return {source:edge[0], target:edge[1]};
    return {source:edge.source?.id || edge.source || edge.from || edge.parent, target:edge.target?.id || edge.target || edge.to || edge.child};
  }).filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  if (!edges.length) nodes.forEach((node) => (node.parent_ids || []).forEach((parent) => {
    if (ids.has(parent)) edges.push({source:parent,target:node.id});
  }));
  return {nodes, edges};
}

// Document, chunk, summary and saved-answer silhouettes, matching the public site's trail.
function shapePath(kind, w, h) {
  if (kind === "document") return `M0 4a4 4 0 0 1 4-4H${w - 14}L${w} 14V${h - 4}a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4Z`;
  if (kind === "chunk") {
    const teeth = Math.round(w / 9);
    let d = `M0 4a4 4 0 0 1 4-4H${w - 4}a4 4 0 0 1 4 4V${h - 5}`;
    for (let i = 1; i <= teeth; i += 1) d += `L${(w - (i * w) / teeth).toFixed(2)} ${i % 2 ? h + 1 : h - 5}`;
    return `${d}V4Z`;
  }
  if (kind === "conversation") return `M6 0H${w - 6}a6 6 0 0 1 6 6V${h - 6}a6 6 0 0 1-6 6H34l-11 9 2-9H6a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6Z`;
  return `M5 0H${w - 5}a5 5 0 0 1 5 5V${h - 5}a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5Z`;
}
function kindIcon(kind) {
  const icon = svgElement("svg", {class: `kicon kicon--${kind}`, viewBox: "0 0 20 16", "aria-hidden": "true", focusable: "false"});
  if (kind === "document") icon.append(svgElement("path", {class: "k-body", d: "M1.5 1.5h10l4.5 4.5v8.5h-14.5z"}), svgElement("path", {class: "k-fold", d: "M11.5 1.5v4.5h4.5z"}));
  else if (kind === "chunk") icon.append(svgElement("path", {class: "k-body", d: "M1.5 1.5h15v9l-1.875 2.5-1.875-2.5-1.875 2.5-1.875-2.5-1.875 2.5-1.875-2.5-1.875 2.5-1.875-2.5z"}));
  else if (kind === "summary") icon.append(svgElement("rect", {class: "k-body", x: 4.5, y: 4.5, width: 14, height: 10, rx: 1.5}), svgElement("rect", {class: "k-body", x: 1.5, y: 1.5, width: 14, height: 10, rx: 1.5}));
  else icon.append(svgElement("path", {class: "k-body", d: "M3 1.5h14a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H8l-3.5 3v-3H3a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 3 1.5z"}));
  return icon;
}
// What the store and audit say about one artifact right now.
function statusOf(artifact) {
  const removed = isRemoved(artifact);
  const stale = !removed && auditIds("stale_ids").has(artifact.id);
  const marker = auditIds("matched_canary_ids").has(artifact.id);
  const rebuilt = !removed && kindOf(artifact) === "summary" && String(artifact.id).startsWith("s-rebuilt");
  if (removed && kindOf(artifact) === "document") return {cls: ["is-removed", "is-withdrawn"], chip: "WITHDRAWN", chipClass: "chip--removed", label: "Withdrawn: body emptied, title replaced, ID kept"};
  if (removed) return {cls: ["is-removed", "is-purged"], chip: "PURGED", chipClass: "chip--purged", label: "Purged: body emptied, ID and links kept"};
  if (stale) return {cls: marker ? ["is-stale", "is-marker"] : ["is-stale"], chip: marker ? "◆ STALE" : "STALE", chipClass: "chip--stale", label: marker ? "Stale: depends on a withdrawn source and still holds the marker" : "Stale: depends on a withdrawn source"};
  if (marker) return {cls: ["is-marker"], chip: "◆ MARKER", chipClass: "chip--marker", label: "Active, and holds the marker"};
  if (rebuilt) return {cls: ["is-rebuilt"], chip: "↻ REBUILT", chipClass: "chip--rebuilt", label: "Rebuilt from surviving original documents"};
  return {cls: [], chip: "", chipClass: "chip--ok", label: "Active"};
}
const STATE_CLASSES = ["is-removed", "is-withdrawn", "is-purged", "is-stale", "is-marker", "is-rebuilt"];

function place(taken, desired, pitch) {
  const free = (y) => y >= 0 && taken.every((t) => Math.abs(t - y) > pitch - 0.5);
  let best = null;
  const consider = (y) => { if (free(y) && (best === null || Math.abs(y - desired) < Math.abs(best - desired) - 0.01)) best = y; };
  consider(desired);
  [...taken].sort((a, b) => a - b).forEach((t) => { consider(t + pitch); consider(t - pitch); });
  if (best === null) best = taken.length ? Math.max(...taken) + pitch : 0;
  taken.push(best);
  return best;
}
// Columns by kind; each derived artifact sits near the average of its parents. Placement runs in
// insertion order, so an artifact added later never moves the ones already drawn.
function layout(nodes, edges) {
  const parents = {}, children = {};
  edges.forEach((edge) => { (parents[edge.target] ||= []).push(edge.source); (children[edge.source] ||= []).push(edge.target); });
  const pitch = NODE.h + NODE.gapY;
  const taken = [[], [], [], []];
  const pos = {};
  nodes.filter((node) => kindOf(node) === "document").forEach((node, row) => { pos[node.id] = {col: 0, y: row * pitch}; taken[0].push(row * pitch); });
  nodes.forEach((node) => {
    if (pos[node.id]) return;
    const col = KINDS.indexOf(kindOf(node));
    const known = (parents[node.id] || []).filter((parent) => pos[parent]);
    const desired = known.length ? known.reduce((sum, parent) => sum + pos[parent].y, 0) / known.length : 0;
    pos[node.id] = {col, y: place(taken[col], desired, pitch)};
  });
  Object.values(pos).forEach((p) => { p.x = PAD.left + p.col * (NODE.w + NODE.gapX); p.y += PAD.top; });
  return {pos, parents, children};
}
// A link's curve and the knot at its end come from one calculation, so they always meet. A link
// within one column leaves and re-enters on the right-hand side; summaries' stacked layers add 6.
function threadGeometry(a, b, fromKind, toKind) {
  const right = (p, kind) => p.x + NODE.w + (kind === "summary" ? 6 : 0);
  const startX = right(a, fromKind);
  const y1 = a.y + NODE.h / 2, y2 = b.y + NODE.h / 2;
  if (Math.abs(a.x - b.x) < 1) {
    const endX = right(b, toKind);
    const bulge = Math.max(startX, endX) + Math.min(34, 16 + Math.abs(y2 - y1) / 10);
    return {d: `M${startX} ${y1}C${bulge} ${y1} ${bulge} ${y2} ${endX} ${y2}`, end: {x: endX, y: y2}};
  }
  const dx = Math.max(24, (b.x - startX) / 2);
  return {d: `M${startX} ${y1}C${startX + dx} ${y1} ${b.x - dx} ${y2} ${b.x} ${y2}`, end: {x: b.x, y: y2}};
}
function fitText(node, full, max) {
  node.textContent = full;
  if (typeof node.getComputedTextLength !== "function" || !node.getComputedTextLength()) return;
  let value = full;
  while (value.length > 4 && node.getComputedTextLength() > max) {
    value = value.slice(0, -1);
    node.textContent = `${value.trimEnd()}…`;
  }
}
function buildNode(artifact) {
  const kind = kindOf(artifact);
  const {w, h} = NODE;
  const id = artifact.id;
  const g = svgElement("g", {class: `tnode tnode--${kind}`, "data-id": id, tabindex: "0", role: "button", "aria-pressed": "false"});
  const d = shapePath(kind, w, h);
  if (kind === "summary") g.append(svgElement("path", {class: "tnode__layer", d, transform: "translate(6 6)"}), svgElement("path", {class: "tnode__layer", d, transform: "translate(3 3)"}));
  g.append(svgElement("path", {class: "tnode__after", d, transform: "translate(7 -7)"}), svgElement("path", {class: "tnode__body", d}), svgElement("path", {class: "tnode__outline", d}));
  if (kind === "document") g.append(svgElement("path", {class: "tnode__fold", d: `M${w - 14} 0V10a4 4 0 0 0 4 4H${w}Z`}));
  const chip = svgElement("g", {class: "tnode__chip"});
  const chipRect = svgElement("rect", {y: 7, height: 15, rx: 3});
  const chipText = svgElement("text", {y: 17.5});
  chip.append(chipRect, chipText);
  const title = svgElement("text", {class: "tnode__sub", x: 13, y: 52});
  g.append(svgElement("rect", {class: "tnode__rule", x: 0, y: 10, width: 3, height: h - 20, rx: 1.5}),
           svgElement("text", {class: "tnode__kind", x: 13, y: 18}, KIND_LABEL[kind].toUpperCase()), chip,
           svgElement("text", {class: "tnode__id", x: 13, y: 36}, shortId(id)), title,
           svgElement("rect", {class: "tnode__ring", x: -5, y: -5, rx: 8, width: w + 10 + (kind === "summary" ? 6 : 0),
                               height: h + 10 + (kind === "summary" ? 6 : kind === "conversation" ? 6 : 0)}));
  g.addEventListener("click", () => selectArtifact(id));
  g.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectArtifact(id); } });
  g.addEventListener("pointerenter", () => setHover(id));
  g.addEventListener("pointerleave", () => setHover(null));
  g.addEventListener("focus", () => setHover(id));
  g.addEventListener("blur", () => setHover(null));
  return {g, chipRect, chipText, title};
}
function updateNode(entry, artifact, p) {
  const status = statusOf(artifact);
  entry.g.setAttribute("transform", `translate(${p.x} ${p.y})`);
  STATE_CLASSES.forEach((name) => entry.g.classList.toggle(name, status.cls.includes(name)));
  entry.g.classList.toggle("has-chip", Boolean(status.chip));
  if (status.chip) {
    const width = 10 + status.chip.length * 5.4;
    entry.chipRect.setAttribute("x", (NODE.w - 8 - width).toFixed(1));
    entry.chipRect.setAttribute("width", width.toFixed(1));
    entry.chipText.setAttribute("x", (NODE.w - 3 - width).toFixed(1));
    entry.chipText.textContent = status.chip;
  }
  entry.title.classList.toggle("tnode__sub--title", kindOf(artifact) === "document" && !isRemoved(artifact));
  fitText(entry.title, String(artifact.title || "").replace(/^Search chunk · /, ""), NODE.w - 21);
  entry.g.setAttribute("aria-label", `${artifact.id}, ${KIND_LABEL[kindOf(artifact)].toLowerCase()}: ${artifact.title || "untitled"}. ${status.label}.`);
}
function renderGraph() {
  const {nodes, edges} = graphData();
  const nodeLayer = ui("graph-nodes"), edgeLayer = ui("graph-edges");
  ui("graph-empty").hidden = nodes.length > 0;
  ui("artifact-count").textContent = `${nodes.length} artifact${nodes.length === 1 ? "" : "s"}`;
  const removed = nodes.filter(isRemoved).length;
  ui("graph-summary").textContent = nodes.length ? `${nodes.length - removed} active · ${removed} removed · ${edges.length} provenance links` : "Sources → derived memories → saved answers";
  // A reset brings a new experiment, so the drawing starts over; within one experiment rows are only added.
  const continuing = graph.nodes.size > 0 && [...graph.nodes.keys()].every((id) => nodes.some((node) => node.id === id));
  if (!continuing) {
    nodeLayer.replaceChildren(); edgeLayer.replaceChildren();
    graph.nodes.clear(); graph.edges.clear();
    const columns = ui("graph-columns");
    columns.replaceChildren();
    if (nodes.length) KINDS.forEach((kind, col) => columns.append(svgElement("text", {class: "tcol", x: PAD.left + col * (NODE.w + NODE.gapX), y: 14}, KIND_GROUP[kind].toUpperCase())));
  }
  const {pos, parents, children} = layout(nodes, edges);
  graph.parents = parents; graph.children = children;
  if (nodes.length) {
    const width = PAD.left + KINDS.length * (NODE.w + NODE.gapX) - NODE.gapX + 6 + PAD.right;
    const height = Math.max(...Object.values(pos).map((p) => p.y)) + NODE.h + 9 + PAD.bottom;
    ui("graph-svg").setAttribute("viewBox", `0 0 ${width} ${height}`);
    ui("graph-svg").style.maxWidth = `${Math.round(width * 1.15)}px`;
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  edges.forEach((edge) => {
    const key = `${edge.source}>${edge.target}`;
    let entry = graph.edges.get(key);
    if (!entry) {
      entry = {g: svgElement("g", {class: "thread thread--recorded"}), path: svgElement("path"), knot: svgElement("circle", {r: 2.4}), source: edge.source, target: edge.target};
      entry.g.append(entry.path, entry.knot);
      edgeLayer.append(entry.g);
      graph.edges.set(key, entry);
    }
    const link = threadGeometry(pos[edge.source], pos[edge.target], kindOf(byId.get(edge.source)), kindOf(byId.get(edge.target)));
    entry.path.setAttribute("d", link.d);
    entry.knot.setAttribute("cx", link.end.x); entry.knot.setAttribute("cy", link.end.y);
    entry.g.classList.toggle("is-faded", isRemoved(byId.get(edge.source)) || isRemoved(byId.get(edge.target)));
  });
  nodes.forEach((artifact) => {
    let entry = graph.nodes.get(artifact.id);
    if (!entry) {
      entry = buildNode(artifact);
      nodeLayer.append(entry.g);
      graph.nodes.set(artifact.id, entry);
    }
    updateNode(entry, artifact, pos[artifact.id]);
  });
  applyGraphState();
}
function lineageOf(id) {
  const seen = new Set([id]);
  const walk = (start, next) => (next[start] || []).forEach((other) => { if (!seen.has(other)) { seen.add(other); walk(other, next); } });
  walk(id, graph.parents); walk(id, graph.children);
  return seen;
}
function applyGraphState() {
  const focus = hoverId && graph.nodes.has(hoverId) ? hoverId : selectedId;
  const lit = focus && graph.nodes.has(focus) ? lineageOf(focus) : null;
  ui("graph-canvas").classList.toggle("has-focus", Boolean(hoverId && lit));
  graph.nodes.forEach((entry, id) => {
    entry.g.classList.toggle("is-lit", Boolean(lit && lit.has(id)));
    entry.g.classList.toggle("is-selected", id === selectedId);
    entry.g.setAttribute("aria-pressed", String(id === selectedId));
  });
  graph.edges.forEach((entry) => entry.g.classList.toggle("is-lit", Boolean(lit && lit.has(entry.source) && lit.has(entry.target))));
  listButtons.forEach((button, id) => button.setAttribute("aria-pressed", String(id === selectedId)));
}
function setHover(id) {
  hoverId = id;
  applyGraphState();
}
function renderList() {
  const holder = ui("graph-list");
  holder.replaceChildren();
  listButtons.clear();
  if (!artifacts().length) { holder.append(element("p", "graph-list__empty", "No artifacts yet. Seed the archive to begin.")); return; }
  KINDS.forEach((kind) => {
    const members = artifacts().filter((artifact) => kindOf(artifact) === kind);
    if (!members.length) return;
    const group = element("section", "glist__group");
    group.append(element("h3", "glist__title", `${KIND_GROUP[kind]} · ${members.length}`));
    const items = element("ul", "glist__items");
    members.forEach((artifact) => {
      const status = statusOf(artifact);
      const item = element("li", `glist__item ${status.cls.join(" ")}`);
      const button = element("button", "glist__btn");
      button.type = "button";
      button.setAttribute("aria-pressed", String(artifact.id === selectedId));
      const from = (artifact.parent_ids || []).length ? `from ${artifact.parent_ids.map(shortId).join(", ")}` : "original document";
      button.append(kindIcon(kind), element("span", "glist__id", shortId(artifact.id)), element("span", `chip ${status.chipClass}`, status.chip || "Active"),
                    element("span", "glist__meta", `${artifact.title || KIND_LABEL[kind]} · ${status.label} · ${from}`));
      button.addEventListener("click", () => selectArtifact(artifact.id));
      listButtons.set(artifact.id, button);
      item.append(button);
      items.append(item);
    });
    group.append(items);
    holder.append(group);
  });
}
function setView(view) {
  graphView = view;
  ui("graph-viewport").hidden = view !== "graph";
  ui("graph-list").hidden = view !== "list";
  ui("view-graph").setAttribute("aria-pressed", String(view === "graph"));
  ui("view-list").setAttribute("aria-pressed", String(view === "list"));
  // Node labels are fitted by measuring them, which only works while the graph is displayed.
  if (view === "graph") renderGraph();
}
function selectArtifact(id) {
  selectedId = id;
  if (window.innerWidth < 900) inspectorOpen = true;
  applyGraphState(); renderInspector();
}
function artifactLinks(holder, ids, emptyLabel) {
  holder.replaceChildren();
  if (!ids?.length) { holder.append(element("span","no-links",emptyLabel)); return; }
  ids.forEach((value) => {
    const id = typeof value === "object" ? value.id : value;
    const button = element("button", "artifact-link", shortId(id));
    button.type = "button"; button.setAttribute("aria-label", `Inspect ${id}`); button.title = id;
    button.addEventListener("click", () => selectArtifact(id)); holder.append(button);
  });
}
function renderInspector() {
  const artifact = artifacts().find((item) => item.id === selectedId);
  const list = ui("artifact-select");
  list.replaceChildren();
  if (!artifacts().length) list.append(element("option","","No artifacts yet"));
  artifacts().forEach((item) => {
    const option = element("option","",`${item.id} · ${item.title || item.kind} · ${item.status || "active"}`);
    option.value = item.id; option.selected = item.id === selectedId; list.append(option);
  });
  ui("inspector-card").classList.toggle("is-collapsed", !inspectorOpen);
  ui("inspector-toggle").setAttribute("aria-expanded", String(inspectorOpen));
  ui("inspector-toggle").textContent = inspectorOpen ? "Hide" : "Show";
  ui("inspector-empty").hidden = !!artifact;
  ui("inspector-content").hidden = !artifact;
  if (!artifact) return;
  const status = statusOf(artifact);
  ui("inspector-icon").replaceChildren(kindIcon(kindOf(artifact)));
  ui("inspector-kind").textContent = KIND_LABEL[kindOf(artifact)].toUpperCase();
  ui("inspector-status").textContent = artifact.status || "active";
  ui("inspector-status").classList.toggle("removed",isRemoved(artifact));
  ui("inspector-status").classList.toggle("chip--removed", isRemoved(artifact));
  ui("inspector-status").classList.toggle("chip--ok", !isRemoved(artifact));
  ui("inspector-title").textContent = artifact.title || artifact.id;
  ui("inspector-id").textContent = artifact.id;
  ui("inspector-flags").replaceChildren(...(status.chip ? [element("span", `chip ${status.chipClass}`, status.chip), element("span", "inspector-flags__text", status.label)] : []));
  ui("inspector-body").textContent = text(artifact.body) || (isRemoved(artifact) ? "Content removed. This tombstone keeps only its ID, kind, links and original sources." : "No body stored.");
  ui("inspector-body").classList.toggle("is-tombstone", isRemoved(artifact));
  artifactLinks(ui("inspector-parents"),artifact.parent_ids,"None: an original document");
  artifactLinks(ui("inspector-sources"),artifact.source_ids,"No source identifiers recorded");
  artifactLinks(ui("inspector-children"),graph.children[artifact.id],"Nothing derived from it yet");
}
function renderAnswer() {
  ui("answer-empty").hidden = !!lastAnswer;
  ui("answer-content").hidden = !lastAnswer;
  if (!lastAnswer) { ui("answer-provider").textContent = "NO QUERY YET"; return; }
  const mode = lastAnswer.mode || currentMode();
  ui("answer-provider").textContent = mode === "fixture" ? "DETERMINISTIC FIXTURE" : providerName(lastAnswer.provider).toUpperCase();
  ui("answer-question").textContent = lastAnswer.question;
  const answer = text(lastAnswer.answer);
  const marker = state?.scenario?.canary;
  const revealed = Boolean(marker) && answer.includes(marker);
  ui("answer-text").replaceChildren(...answer.split(revealed ? marker : "\u0000").flatMap((part, index) => (index ? [element("mark", null, marker), element("span", null, part)] : [element("span", null, part)])));
  ui("answer-verdict").textContent = revealed ? "◆ Reveals the marker" : "No marker in this answer";
  ui("answer-verdict").classList.toggle("is-leak", revealed);
  const citations = ui("answer-citations"); citations.replaceChildren();
  (lastAnswer.citations || []).forEach((citation) => {
    const id = typeof citation === "object" ? citation.id || citation.artifact_id || citation.source_id : citation;
    const button = element("button","citation-button",`↗ ${id}`);
    button.type = "button"; button.addEventListener("click", () => selectArtifact(id)); citations.append(button);
  });
  if (!lastAnswer.citations?.length) citations.append(element("span","no-links","No artifact citations returned"));
  const trace = lastAnswer.trace || {};
  const values = [];
  const duration = trace.duration_ms ?? trace.elapsed_ms ?? trace.latency_ms;
  if (duration !== undefined) values.push(`${Number(duration).toFixed(0)} ms`);
  if (trace.input_tokens !== undefined && trace.input_tokens !== null) values.push(`${trace.input_tokens} input tokens`);
  if (trace.output_tokens !== undefined && trace.output_tokens !== null) values.push(`${trace.output_tokens} output tokens`);
  // parent_ids is the context actually supplied to the provider, not its citations.
  if (Array.isArray(trace.parent_ids)) values.push(`Context: ${trace.parent_ids.length ? trace.parent_ids.join(", ") : "none retrieved"}`);
  if (trace.message) values.push(trace.message);
  if (mode === "fixture") values.push("Deterministic fixture; no model inference");
  ui("answer-trace").textContent = values.join(" · ");
}
function renderChecks() {
  const holder = ui("checks-list"); holder.replaceChildren();
  ui("evaluator-retention").hidden = stateUnknown || state?.stage !== "cleaned" || !artifacts().length;
  if (!checks.length) {
    ui("checks-score").textContent = "NOT RUN";
    ui("checks-summary").textContent = "Run verification after cleanup to check what was removed and what remains.";
    holder.append(element("p","checks-empty","No checks yet. Verification asks the four defined questions again and audits every stored title and body.")); return;
  }
  const passed = checks.filter((check) => check.passed).length;
  ui("checks-score").textContent = `${passed} / ${checks.length} PASS`;
  ui("checks-summary").textContent = passed === checks.length
    ? `All ${checks.length} checks passed for GhostCache's managed memory and retrieval.`
    : `${count(checks.length - passed, "check")} failed. A verification run before cleanup is expected to fail.`;
  const groups = [["The failure was real", (name) => /Pre-deletion|Source-only control/.test(name)],
                  ["Nothing else was lost", (name) => /roof garden|Shared fact/.test(name)],
                  ["The secret is gone", () => true]];
  const used = new Set();
  groups.forEach(([title, match]) => {
    const members = checks.filter((check) => !used.has(check) && match(String(check.name)));
    if (!members.length) return;
    members.forEach((check) => used.add(check));
    const group = element("section", "checks-group");
    group.append(element("h3", null, `${title} · ${members.filter((c) => c.passed).length}/${members.length}`));
    members.forEach((check) => {
      const row = element("div",`check-item${check.passed ? "" : " failed"}`);
      const description = element("div");
      const name = element("div","check-name",check.name);
      name.append(element("span", "check-verdict", check.passed ? "PASS" : "FAIL"));
      description.append(name,element("div","check-detail",text(check.detail)));
      row.append(element("span","check-icon",check.passed ? "✓" : "×"),description); group.append(row);
    });
    holder.append(group);
  });
}
function renderLedger() {
  // The server's ledger is authoritative whenever it sends one, even an empty one; the page's own
  // notes stand in only for a server that sends none.
  const source = Array.isArray(state?.events) ? state.events : localEvents;
  ui("ledger-count").textContent = `${source.length} EVENT${source.length === 1 ? "" : "S"}`;
  const holder = ui("event-list"); holder.replaceChildren();
  if (!source.length) { holder.append(element("li","ledger-empty","Every operation leaves a trace here.")); return; }
  source.forEach((event, index) => {
    if (typeof event === "string") event = {message:event};
    const item = element("li","event-item");
    const name = event.name || event.type || event.action || "";
    item.append(element("span","event-order",String(index + 1).padStart(2,"0")));
    const body = element("div","event-body");
    const title = element("div","event-name",event.title || EVENT_LABEL[name] || name || "Operation");
    if (name && EVENT_LABEL[name]) title.append(element("code","event-code",name));
    body.append(title);
    const details = [];
    if (event.artifact_id) details.push(`→ ${shortId(event.artifact_id)}`);
    if (Array.isArray(event.parent_ids) && event.parent_ids.length) details.push(`from ${event.parent_ids.map(shortId).join(", ")}`);
    if (Array.isArray(event.affected_ids)) details.push(event.affected_ids.length ? `changed ${event.affected_ids.map(shortId).join(", ")}` : "no rows changed");
    if (event.documents !== undefined) details.push(`${event.documents} documents${event.baseline_exposed === undefined ? "" : event.baseline_exposed ? " · baseline exposed the marker" : " · baseline did not expose the marker"}`);
    if (event.error_type) details.push(`error: ${event.error_type}`);
    const detail = event.detail || event.message || event.description;
    if (detail) details.push(text(detail));
    if (details.length) body.append(element("div","event-detail",details.join(" · ")));
    item.append(body);
    const timing = [];
    const stamp = event.timestamp || event.time || event.at;
    if (stamp) {
      const date = new Date(stamp);
      timing.push(Number.isNaN(date.getTime()) ? String(stamp) : date.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}));
    }
    const elapsed = event.duration_ms ?? event.elapsed_ms ?? event.latency_ms;
    if (elapsed !== undefined) timing.push(`${Number(elapsed).toFixed(0)} ms`);
    if (event.input_tokens !== undefined && event.input_tokens !== null) timing.push(`${event.input_tokens} in / ${event.output_tokens} out`);
    if (timing.length) item.append(element("div","event-time",timing.join(" · ")));
    holder.append(item);
  });
}
// What a failed request could have changed: the stage, each artifact's status and content, and the rebuild outcome.
function stateSignature(value) {
  const items = Array.isArray(value?.artifacts) ? value.artifacts : [];
  return JSON.stringify([value?.stage ?? null, items.map((a) => [a?.id, a?.status, a?.title, Boolean(a?.body)]), value?.rebuild ?? null]);
}
function render() {
  renderProvider(); renderStatus(); renderSteps(); renderGraph(); renderList(); renderInspector(); renderAnswer(); renderChecks(); renderLedger();
  if (!ui("question-input").value) ui("question-input").value = safeQuestion("secret");
}

async function perform(action, question) {
  if (busy) return;
  hideError();
  const labels = {seed:"Seeding the archive…",reset:"Resetting the experiment…","ask-secret":"Asking for the private detail…","ask-retained":"Checking the retained fact…","ask-shared":"Checking the shared-source fact…","source-only":"Deleting only the source…",inspect:"Asking again in different words…",cascade:"Following provenance through every descendant…",verify:"Verifying the cleanup…",ask:"Asking the archive…"};
  const live = selectedMode === "live" && (action === "seed" || action === "reset") ? " Live seeding makes four local model calls." : "";
  setBusy(true,`${labels[action]}${live}`);
  const started = performance.now();
  try {
    if (action === "seed" || action === "reset") {
      const next = await request("/api/reset",{mode:selectedMode});
      stage = action === "reset" ? 0 : 1; checks = []; lastAnswer = null; rebuildError = null; selectedId = null; localEvents.length = 0;
      ui("question-input").value = "";
      acceptState(next);
    } else if (["ask", "ask-secret", "ask-retained", "ask-shared", "inspect"].includes(action)) {
      const kind = action === "ask-retained" ? "retained" : action === "ask-shared" ? "shared" : action === "inspect" ? "paraphrase" : "secret";
      const query = question || safeQuestion(kind);
      ui("question-input").value = query;
      const data = await request("/api/ask", {question:query});
      lastAnswer = {...data,question:query,mode:data.state?.mode || data.mode || currentMode()};
      if (action === "ask-secret") stage = Math.max(stage,2);
      if (action === "inspect") stage = Math.max(stage,4);
      if (data.state) acceptState(data.state); else render();
    } else if (action === "source-only" || action === "cascade") {
      const next = await request("/api/delete",{mode:action === "source-only" ? "source_only" : "cascade"});
      stage = action === "source-only" ? Math.max(stage,3) : 5;
      checks = []; lastAnswer = null;
      // A repeated cleanup that purges nothing carries no rebuild_error, so it must not clear the earlier one.
      if (next.deletion?.rebuild_error && next.rebuild?.status === "failed") {
        rebuildError = {message: String(next.deletion.rebuild_error), outcome: JSON.stringify(next.rebuild)};
      }
      acceptState(next);
    } else if (action === "verify") {
      const data = await request("/api/verify",{});
      checks = Array.isArray(data.checks) ? data.checks : [];
      if (data.state) acceptState(data.state); else renderChecks();
    }
    localEvents.push({title:labels[action]?.replace(/…$/,"") || action,detail:currentMode() === "fixture" ? "Controlled fixture" : "Live mode",duration_ms:performance.now() - started,timestamp:new Date().toISOString()});
    renderLedger();
  } catch (error) {
    let message = error.message || String(error);
    // A failed request can still have changed the server: an unrestorable reset (503) clears the
    // experiment, and a cleanup commits its purge before the rebuilt summary is stored, so a later
    // save or validation error (500 or 400) follows a completed purge. Read the state back; never
    // repeat the mutation.
    const deletion = action === "source-only" || action === "cascade";
    if (error.status === 503 || deletion) {
      const before = stateSignature(state);
      try {
        const next = await request("/api/state");
        // Results from before a change on the server are not results for the new state.
        if (stateSignature(next) !== before) { checks = []; lastAnswer = null; }
        acceptState(next);
      } catch {
        checks = []; lastAnswer = null; stateUnknown = true;
        message += deletion ? " The lab could not reload the server's state, so it cannot tell whether the deletion finished. Reload the page to check."
          : " The lab could not reload the server's state. Reload the page to check.";
        render();
      }
    }
    // A failed seed or reset keeps the confirmed experiment's mode (a 502 changes nothing on the
    // server), so the menu and the next Reset must not keep the mode that was refused.
    if (action === "seed" || action === "reset") { selectedMode = currentMode(); renderProvider(); }
    showError(message);
  } finally {
    setBusy(false);
  }
}

document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click",() => perform(button.dataset.action)));
document.querySelectorAll(".kicon-slot").forEach((slot) => slot.replaceWith(kindIcon(slot.dataset.kind)));
ui("question-form").addEventListener("submit",(event) => {event.preventDefault(); const question = ui("question-input").value.trim(); if (question) perform("ask",question);});
ui("mode-select").addEventListener("change",() => { selectedMode = ui("mode-select").value; perform("seed"); });
ui("artifact-select").addEventListener("change",() => selectArtifact(ui("artifact-select").value));
ui("view-graph").addEventListener("click",() => setView("graph"));
ui("view-list").addEventListener("click",() => setView("list"));
ui("inspector-toggle").addEventListener("click",() => { inspectorOpen = !inspectorOpen; renderInspector(); });
let resizeTimer;
window.addEventListener("resize",() => {clearTimeout(resizeTimer); resizeTimer = setTimeout(renderGraph,100);});
async function initialize() {
  setView(graphView);
  setBusy(true,"Opening the local archive…");
  try {
    const initial = await request("/api/state");
    selectedMode = initial.mode || initial.provider?.mode || "fixture";
    acceptState(initial);
  } catch (error) {
    ui("provider-title").textContent = "The local lab is not connected";
    ui("provider-message").textContent = "Start the GhostCache server, then reload this page.";
    ui("stage-status").className = "stage-status stage-status--failed";
    ui("stage-status").replaceChildren(element("strong", null, "No connection to the local server."), element("span", null, "Run python3.12 -m ghostcache serve from the repository root, then reload."));
    showError(error.message || String(error));
  } finally { setBusy(false); }
}
initialize();
