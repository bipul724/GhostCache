"use strict";

const ui = (id) => document.getElementById(id);
let state = null;
let selectedId = null;
let stage = 0;
let busy = false;
let checks = [];
let lastAnswer = null;
let selectedMode = "fixture";
let busyTimer = null;
const localEvents = [];
const stepActions = ["seed", "ask-secret", "source-only", "inspect", "cascade"];

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
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
function hideError() { ui("error-banner").hidden = true; }
function showError(message) { ui("error-banner").textContent = message; ui("error-banner").hidden = false; }
function setBusy(value, message) {
  clearInterval(busyTimer);
  busy = value;
  document.querySelectorAll("button").forEach((button) => { button.disabled = value; });
  ui("mode-select").disabled = value;
  ui("busy-text").textContent = message || "Working…";
  ui("busy-indicator").hidden = !value;
  document.body.setAttribute("aria-busy", String(value));
  if (value) {
    const start = Date.now();
    busyTimer = setInterval(() => {
      const seconds = Math.floor((Date.now() - start) / 1000);
      ui("busy-text").textContent = `${message || "Working…"} ${seconds}s${selectedMode === "live" && seconds > 7 ? " · local inference may take a minute" : ""}`;
    },1000);
  }
}
async function request(path, body) {
  const response = await fetch(path, body === undefined ? {cache:"no-store"} : {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
  });
  let data;
  try { data = await response.json(); } catch { throw new Error(`The local API returned an unreadable response (${response.status}).`); }
  if (!response.ok) throw new Error(data.error || data.detail || `Request failed (${response.status}).`);
  return data;
}
function acceptState(next) {
  if (!next || typeof next !== "object") return;
  state = next;
  selectedMode = next.mode || next.provider?.mode || selectedMode;
  if (next.stage === "cleaned") stage = 5;
  else if (next.stage === "source_only") stage = Math.max(stage === 5 ? 3 : stage,3);
  else if (next.stage === "seeded" && stage === 0) stage = 1;
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
  liveOption.textContent = provider.available ? `Live Gemma${provider.model ? ` · ${provider.model}` : ""}` : "Live Gemma · unavailable";
  const mode = currentMode();
  ui("mode-select").value = mode === "live" ? "live" : "fixture";
  ui("provider-banner").classList.toggle("live", mode === "live");
  if (mode === "live") {
    ui("provider-title").textContent = provider.available ? "Live local Gemma mode" : "Live mode · model unavailable";
    ui("provider-message").textContent = provider.available ? "Synthetic archive, real local inference. Inspect each query’s provider and trace below." : (provider.message || "Choose the controlled fixture to run without a model.");
    ui("model-label").textContent = provider.model || "LOCAL INFERENCE";
  } else {
    ui("provider-title").textContent = "Controlled fixture · deterministic simulation";
    ui("provider-message").textContent = "Deterministic rules. No model inference.";
    ui("model-label").textContent = provider.available ? "LIVE MODEL ALSO AVAILABLE" : "NO MODEL REQUIRED";
  }
}
function renderSteps() {
  ui("step-count").textContent = `${Math.min(stage, 5)} / 5`;
  document.querySelectorAll(".step-button").forEach((button, index) => {
    button.classList.toggle("done", stage > index);
    button.classList.toggle("next", stage === index);
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
function renderGraph() {
  const {nodes, edges} = graphData();
  const holder = ui("graph-nodes");
  const svg = ui("graph-edges");
  holder.replaceChildren(); svg.replaceChildren();
  ui("graph-empty").hidden = nodes.length > 0;
  ui("artifact-count").textContent = `${nodes.length} artifact${nodes.length === 1 ? "" : "s"}`;
  const removed = nodes.filter(isRemoved).length;
  ui("graph-summary").textContent = nodes.length ? `${nodes.length - removed} active · ${removed} removed · ${edges.length} provenance links` : "Sources → derived memories → cached answers";
  if (!nodes.length) return;
  const levels = new Map(nodes.map((node) => [node.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    edges.forEach((edge) => {
      const proposed = Math.min(nodes.length - 1, levels.get(edge.source) + 1);
      if (levels.get(edge.target) < proposed) { levels.set(edge.target, proposed); changed = true; }
    });
    if (!changed) break;
  }
  const groups = [];
  nodes.forEach((node) => { const level = levels.get(node.id); (groups[level] ||= []).push(node); });
  const nodeWidth = window.innerWidth >= 1500 ? 178 : 162;
  const gapX = 32, gapY = 17, padX = 18, padY = 43, nodeHeight = 88;
  const maxRows = Math.max(...groups.filter(Boolean).map((group) => group.length));
  const width = Math.max(ui("graph-viewport").clientWidth, padX * 2 + groups.length * nodeWidth + (groups.length - 1) * gapX);
  const height = Math.max(310, padY + maxRows * nodeHeight + (maxRows - 1) * gapY + 22);
  ui("graph-canvas").style.width = `${width}px`;
  ui("graph-canvas").style.height = `${height}px`;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const NS = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(NS, "defs");
  const marker = document.createElementNS(NS, "marker");
  marker.setAttribute("id","arrowhead"); marker.setAttribute("viewBox","0 0 8 8"); marker.setAttribute("refX","7"); marker.setAttribute("refY","4"); marker.setAttribute("markerWidth","5"); marker.setAttribute("markerHeight","5"); marker.setAttribute("orient","auto");
  const triangle = document.createElementNS(NS,"path"); triangle.setAttribute("d","M0 0 L8 4 L0 8 Z"); triangle.setAttribute("fill","#7b8e79"); marker.append(triangle); defs.append(marker); svg.append(defs);
  const positions = new Map();
  const graphWidth = padX * 2 + groups.length * nodeWidth + (groups.length - 1) * gapX;
  const offsetX = Math.max(padX, (width - graphWidth) / 2 + padX);
  groups.forEach((group, column) => {
    if (!group) return;
    const label = element("span", "graph-level-label", column === 0 ? "ORIGINALS" : column === groups.length - 1 ? "DERIVED / CACHED" : "DERIVED MEMORY");
    label.style.left = `${offsetX + column * (nodeWidth + gapX)}px`; holder.append(label);
    group.forEach((artifact, row) => {
      const x = offsetX + column * (nodeWidth + gapX);
      const groupHeight = group.length * nodeHeight + (group.length - 1) * gapY;
      const y = padY + (height - padY - 22 - groupHeight) / 2 + row * (nodeHeight + gapY);
      positions.set(artifact.id, {x,y});
      const node = element("button", `graph-node${isRemoved(artifact) ? " removed" : ""}${artifact.id === selectedId ? " selected" : ""}`);
      node.type = "button"; node.style.left = `${x}px`; node.style.top = `${y}px`; node.setAttribute("aria-label", `${artifact.title || artifact.id}, ${artifact.status || "active"}`); node.setAttribute("aria-pressed", String(artifact.id === selectedId));
      const top = element("span", "node-topline"); top.append(element("span", "node-kind", artifact.kind || "artifact"), element("i","node-dot"));
      node.append(top, element("strong","node-title",artifact.title || artifact.id),element("span","node-id",artifact.id));
      node.addEventListener("click", () => selectArtifact(artifact.id)); holder.append(node);
    });
  });
  edges.forEach((edge) => {
    const from = positions.get(edge.source), to = positions.get(edge.target);
    if (!from || !to) return;
    const x1 = from.x + nodeWidth, y1 = from.y + nodeHeight / 2, x2 = to.x - 2, y2 = to.y + nodeHeight / 2;
    const path = document.createElementNS(NS, "path");
    const delta = Math.max(18, (x2 - x1) / 2);
    path.setAttribute("d",`M ${x1} ${y1} C ${x1 + delta} ${y1}, ${x2 - delta} ${y2}, ${x2} ${y2}`);
    const source = nodes.find((node) => node.id === edge.source), target = nodes.find((node) => node.id === edge.target);
    path.setAttribute("class", `graph-edge${isRemoved(source) || isRemoved(target) ? " removed" : ""}`); path.setAttribute("marker-end","url(#arrowhead)"); svg.append(path);
  });
}
function selectArtifact(id) {
  selectedId = id;
  renderGraph(); renderInspector();
}
function artifactLinks(holder, ids, emptyLabel) {
  holder.replaceChildren();
  if (!ids?.length) { holder.append(element("span","no-links",emptyLabel)); return; }
  ids.forEach((value) => {
    const id = typeof value === "object" ? value.id : value;
    const button = element("button", "artifact-link", id);
    button.type = "button"; button.addEventListener("click", () => selectArtifact(id)); holder.append(button);
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
  ui("inspector-empty").hidden = !!artifact;
  ui("inspector-content").hidden = !artifact;
  if (!artifact) return;
  ui("inspector-kind").textContent = String(artifact.kind || "artifact").toUpperCase();
  ui("inspector-status").textContent = artifact.status || "active";
  ui("inspector-status").classList.toggle("removed",isRemoved(artifact));
  ui("inspector-title").textContent = artifact.title || artifact.id;
  ui("inspector-id").textContent = artifact.id;
  ui("inspector-body").textContent = text(artifact.body) || (isRemoved(artifact) ? "This artifact has been removed." : "No body stored.");
  artifactLinks(ui("inspector-parents"),artifact.parent_ids,"Original artifact");
  artifactLinks(ui("inspector-sources"),artifact.source_ids,"No source identifiers recorded");
}
function renderAnswer() {
  ui("answer-empty").hidden = !!lastAnswer;
  ui("answer-content").hidden = !lastAnswer;
  if (!lastAnswer) { ui("answer-provider").textContent = "NO QUERY YET"; return; }
  const mode = lastAnswer.mode || currentMode();
  ui("answer-provider").textContent = mode === "fixture" ? "DETERMINISTIC FIXTURE" : providerName(lastAnswer.provider).toUpperCase();
  ui("answer-question").textContent = lastAnswer.question;
  ui("answer-text").textContent = text(lastAnswer.answer);
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
  if (!checks.length) {
    ui("checks-score").textContent = "NOT RUN";
    holder.append(element("p","checks-empty","Run verification after cleanup to check what was removed and what remains.")); return;
  }
  const passed = checks.filter((check) => check.passed).length;
  ui("checks-score").textContent = `${passed} / ${checks.length} PASS`;
  checks.forEach((check) => {
    const row = element("div",`check-item${check.passed ? "" : " failed"}`);
    const description = element("div"); description.append(element("div","check-name",check.name),element("div","check-detail",text(check.detail)));
    row.append(element("span","check-icon",check.passed ? "✓" : "×"),description); holder.append(row);
  });
}
function renderLedger() {
  const source = Array.isArray(state?.events) && state.events.length ? state.events : localEvents;
  const events = source.slice(-12);
  ui("ledger-count").textContent = `${source.length} EVENT${source.length === 1 ? "" : "S"}`;
  const holder = ui("event-list"); holder.replaceChildren();
  if (!events.length) { holder.append(element("p","ledger-empty","Every operation leaves a trace here.")); return; }
  events.forEach((event, index) => {
    if (typeof event === "string") event = {message:event};
    const item = element("div","event-item");
    item.append(element("span","event-order",String(source.length - events.length + index + 1).padStart(2,"0")),element("div","event-name",event.title || event.action || event.type || event.name || "Operation"));
    const detail = event.detail || event.message || event.description;
    if (detail) item.append(element("div","event-detail",text(detail)));
    const timing = [];
    const elapsed = event.duration_ms ?? event.elapsed_ms ?? event.latency_ms;
    if (elapsed !== undefined) timing.push(`${Number(elapsed).toFixed(0)} ms`);
    const stamp = event.timestamp || event.time || event.at;
    if (stamp) {
      const date = new Date(stamp);
      timing.push(Number.isNaN(date.getTime()) ? String(stamp) : date.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}));
    }
    if (timing.length) item.append(element("div","event-time",timing.join(" · ")));
    holder.append(item);
  });
}
function render() {
  renderProvider(); renderSteps(); renderGraph(); renderInspector(); renderAnswer(); renderChecks(); renderLedger();
  if (!ui("question-input").value) ui("question-input").value = safeQuestion("secret");
}

async function perform(action, question) {
  if (busy) return;
  hideError();
  const labels = {seed:"Seeding the archive…",reset:"Resetting the experiment…","ask-secret":"Querying the private detail…","ask-retained":"Checking the retained fact…","ask-shared":"Checking the shared source…","source-only":"Removing the original source…",inspect:"Looking for the residual echo…",cascade:"Propagating cleanup…",verify:"Verifying the archive…",ask:"Querying the archive…"};
  setBusy(true,labels[action]);
  const started = performance.now();
  try {
    if (action === "seed" || action === "reset") {
      const next = await request("/api/reset",{mode:selectedMode});
      stage = action === "reset" ? 0 : 1; checks = []; lastAnswer = null; selectedId = null; localEvents.length = 0;
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
      acceptState(next);
    } else if (action === "verify") {
      const data = await request("/api/verify",{});
      checks = Array.isArray(data.checks) ? data.checks : [];
      if (data.state) acceptState(data.state); else renderChecks();
    }
    localEvents.push({title:labels[action]?.replace(/…$/,"") || action,detail:currentMode() === "fixture" ? "Controlled fixture" : "Live mode",duration_ms:performance.now() - started,timestamp:new Date().toISOString()});
    renderLedger();
  } catch (error) {
    showError(error.message || String(error));
  } finally {
    setBusy(false);
  }
}

document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click",() => perform(button.dataset.action)));
ui("question-form").addEventListener("submit",(event) => {event.preventDefault(); const question = ui("question-input").value.trim(); if (question) perform("ask",question);});
ui("mode-select").addEventListener("change",() => { selectedMode = ui("mode-select").value; perform("seed"); });
ui("artifact-select").addEventListener("change",() => selectArtifact(ui("artifact-select").value));
let resizeTimer;
window.addEventListener("resize",() => {clearTimeout(resizeTimer); resizeTimer = setTimeout(renderGraph,100);});
async function initialize() {
  setBusy(true,"Opening the local archive…");
  try {
    const initial = await request("/api/state");
    selectedMode = initial.mode || initial.provider?.mode || "fixture";
    acceptState(initial);
  } catch (error) {
    ui("provider-title").textContent = "The local lab is not connected";
    ui("provider-message").textContent = "Start the GhostCache server, then reload this page.";
    showError(error.message || String(error));
  } finally { setBusy(false); }
}
initialize();
