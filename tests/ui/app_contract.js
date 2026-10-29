"use strict";
// Offline contract checks for web/app.js. The real script runs in node:vm against a
// minimal fake DOM and a fake fetch; no browser, server, network or packages.
// Usage: node tests/ui/app_contract.js <case> [path/to/app.js]
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP_JS = process.argv[3] || path.join(__dirname, "..", "..", "web", "app.js");
const QUESTIONS = {
  secret: "What is the observatory vault passphrase?",
  paraphrase: "Which access phrase opens the observatory vault?",
  retained: "When does the roof garden open?",
  shared: "What is the archive reading room called?",
};
const MARKER = "MOTH-0123456789AB";

class FakeNode {
  constructor(id = "") {
    this.id = id; this.children = []; this.textContent = ""; this.hidden = false; this.value = "";
    this.disabled = false; this.style = {}; this.attrs = {}; this.className = ""; this.selectors = new Map();
    const classes = new Set();
    this.classList = {
      toggle: (name, on) => ((on ?? !classes.has(name)) ? classes.add(name) : classes.delete(name)),
      contains: (name) => classes.has(name),
    };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener() {}
  querySelector(selector) {
    if (!this.selectors.has(selector)) this.selectors.set(selector, new FakeNode());
    return this.selectors.get(selector);
  }
  get clientWidth() { return 800; }
}

function makeState(overrides = {}) {
  return {
    mode: "fixture", stage: "seeded",
    provider: {available: false, model: "gemma4:e2b-it-qat", message: "offline", mode: "fixture"},
    artifacts: [
      {id: "d-vault", kind: "document", title: "Vault access note", body: `The passphrase is ${MARKER}.`,
       status: "active", parent_ids: [], source_ids: ["d-vault"]},
      {id: "c-vault", kind: "chunk", title: "Search chunk", body: `The passphrase is ${MARKER}.`,
       status: "active", parent_ids: ["d-vault"], source_ids: ["d-vault"]},
    ],
    graph: {edges: [{source: "d-vault", target: "c-vault"}]}, events: [], seed_checks: [],
    scenario: {source_id: "d-vault", canary: MARKER, questions: {...QUESTIONS}},
    ...overrides,
  };
}

function askReply(state, overrides = {}) {
  return {
    answer: `The vault passphrase is ${MARKER}.`, citations: ["c-vault"],
    provider: "Deterministic fixture — no AI call", mode: state.mode,
    trace: {parent_ids: ["d-vault", "c-vault", "s-mixed"], context_fingerprint: "0123456789abcdef",
            duration_ms: 3, input_tokens: null, output_tokens: null},
    state, ...overrides,
  };
}

async function load(state = makeState()) {
  const nodes = new Map();
  const byId = (id) => { if (!nodes.has(id)) nodes.set(id, new FakeNode(id)); return nodes.get(id); };
  const steps = Array.from({length: 5}, () => new FakeNode());
  const document = {
    getElementById: byId, createElement: () => new FakeNode(), createElementNS: () => new FakeNode(),
    body: new FakeNode(), querySelectorAll: (selector) => (selector === ".step-button" ? steps : []),
  };
  // `fail` fails the next request to one route; `failures` queues several, and `reject: true` makes
  // fetch itself reject, as it does when the server cannot be reached.
  const harness = {byId, sent: [], state, nextAsk: null, nextDelete: null, fail: null, failures: []};
  async function fetch(route, options = {}) {
    const body = options.body ? JSON.parse(options.body) : undefined;
    harness.sent.push({route, body});
    const queued = harness.failures.findIndex((failure) => failure.route === route);
    if (queued >= 0) {
      const {status, reply, reject} = harness.failures.splice(queued, 1)[0];
      if (reject) throw new TypeError("Failed to fetch");
      return {ok: false, status, json: async () => reply};
    }
    if (harness.fail && harness.fail.route === route) {
      const {status, reply} = harness.fail;
      harness.fail = null;
      return {ok: false, status, json: async () => reply};
    }
    let reply = harness.state;
    if (route === "/api/ask") reply = harness.nextAsk || askReply(harness.state);
    if (route === "/api/delete" && harness.nextDelete) reply = harness.nextDelete;
    if (route === "/api/verify") {
      reply = {checks: Array.from({length: 8}, (_, i) => ({name: `Check ${i + 1}`, passed: true, detail: ""})),
               passed: true, state: harness.state};
    }
    return {ok: true, status: 200, json: async () => reply};
  }
  const context = vm.createContext({
    document, window: {innerWidth: 1200, addEventListener() {}}, fetch, performance: {now: () => 0},
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {}, console,
  });
  vm.runInContext(fs.readFileSync(APP_JS, "utf8"), context, {filename: "app.js"});
  await new Promise((resolve) => setImmediate(resolve)); // let initialize() finish
  harness.run = (code) => vm.runInContext(code, context);
  // perform() catches errors and shows them in the banner, so a failed action must fail the case.
  harness.perform = async (...args) => {
    await harness.run(`perform(${args.map((a) => JSON.stringify(a)).join(", ")})`);
    assert.strictEqual(byId("error-banner").hidden, true, `perform(${args[0]}) showed: ${byId("error-banner").textContent}`);
  };
  harness.lastAsk = () => harness.sent.filter((s) => s.route === "/api/ask").pop().body;
  harness.trace = () => byId("answer-trace").textContent;
  harness.node = (id) => byId("graph-nodes").children.find((node) => node.attrs["data-id"] === id);
  return harness;
}

const CONVERSATION = "conversation-0123456789abcdef0123456789abcdef";

// A small lineage: d-vault -> c-vault -> s-vault, a saved answer from both, and an unrelated document.
function lineageState(changes = {}) {
  const doc = (id, title, body) => ({id, kind: "document", title, body, status: "active", parent_ids: [], source_ids: [id]});
  const derived = (id, kind, title, parents) => ({id, kind, title, body: `Copy: ${MARKER}`, status: "active", parent_ids: parents, source_ids: ["d-vault"]});
  const artifacts = [doc("d-vault", "Vault access note", `The passphrase is ${MARKER}.`),
                     derived("c-vault", "chunk", "Search chunk · Vault access note", ["d-vault"]),
                     derived("s-vault", "summary", "Vault digest", ["c-vault"]),
                     derived(CONVERSATION, "conversation", "Saved assistant answer", ["d-vault", "c-vault"]),
                     doc("d-garden", "Roof garden timetable", "The roof garden opens at 07:40.")]
    .map((artifact) => ({...artifact, ...(changes[artifact.id] || {})}));
  const edges = [["d-vault", "c-vault"], ["c-vault", "s-vault"], ["d-vault", CONVERSATION], ["c-vault", CONVERSATION]]
    .map(([source, target]) => ({source, target}));
  return makeState({artifacts, graph: {edges}, stage: changes.stage || "seeded",
                    audit: {matched_canary_ids: changes.marker || ["d-vault", "c-vault", "s-vault", CONVERSATION], stale_ids: changes.stale || []}});
}

// A live experiment's ledger, shaped as ghostcache/app.py writes it.
const LIVE = {available: true, model: "gemma4:e2b-it-qat", mode: "live"};
const at = (time, name, details) => ({name, time, mode: "live", provider: LIVE.model, ...details});
const SEEDED = [at("10:00:01", "summary.generated", {artifact_id: "s-vault", parent_ids: ["c-vault"], duration_ms: 2300}),
                at("10:00:04", "answer.generated", {parent_ids: ["d-vault", "c-vault"], duration_ms: 2100}),
                at("10:00:04", "experiment.seeded", {documents: 5, baseline_exposed: true})];
const PURGED = at("10:05:00", "delete.propagated", {affected_ids: ["d-vault", "c-vault", "s-vault", CONVERSATION]});
const NOTHING_PURGED = at("10:06:00", "delete.propagated", {affected_ids: []});
const REBUILD_FAILED = at("10:05:30", "summary.rebuild_failed", {error_type: "ProviderError"});
const REBUILT = at("10:05:30", "summary.generated", {artifact_id: "s-rebuilt-1-9", parent_ids: ["d-garden"], duration_ms: 2400});
const REBUILT_ARTIFACT = {id: "s-rebuilt-1-9", kind: "summary", title: "Rebuilt from surviving sources", body: "The roof garden opens at 07:40.",
                          status: "active", parent_ids: ["d-garden"], source_ids: ["d-garden"]};

// The server's current rebuild outcome (state.rebuild), kept apart from its 50-event window.
const NOT_ATTEMPTED = {status: "not_attempted"};
const FAILED = {status: "failed", parent_ids: ["d-garden"], error_category: "timed out"};
const SUCCEEDED = {status: "succeeded", artifact_id: "s-rebuilt-1-9", parent_ids: ["d-garden"]};
// The latest 50 events once `count` answers have followed the cleanup: the failure has left the window.
function laterAnswers(count) {
  return Array.from({length: count}, (_, i) => at("10:07:00", "answer.generated", {parent_ids: ["d-garden"], duration_ms: 1000 + i})).slice(-50);
}

function liveSeeded() {
  return {...lineageState(), mode: "live", provider: LIVE, events: [...SEEDED], rebuild: NOT_ATTEMPTED};
}

// After cascade cleanup: the source is withdrawn and its descendants purged; the rebuilt summary
// exists only when the given ledger's rebuild succeeded and `rebuilt` is set.
function liveCleaned(events, rebuilt = false, rebuild = rebuilt ? SUCCEEDED : NOT_ATTEMPTED) {
  const purged = (kind) => ({status: "invalidated", title: `Purged ${kind}`, body: ""});
  const state = lineageState({"d-vault": {status: "deleted", title: "Withdrawn document", body: ""}, "c-vault": purged("chunk"),
                              "s-vault": purged("summary"), [CONVERSATION]: purged("conversation"), stage: "cleaned"});
  if (rebuilt) state.artifacts.push(REBUILT_ARTIFACT);
  return {...state, mode: "live", provider: LIVE, events, rebuild,
          audit: {deleted_artifacts: 1, invalidated_artifacts: 3, matched_canary: 0, stale_descendants: 0, matched_canary_ids: [], stale_ids: []}};
}

function stageStatus(h) {
  const box = h.byId("stage-status");
  return {tone: /stage-status--(\w+)/.exec(box.className)[1], words: box.children.map((part) => part.textContent).join(" ")};
}

function ledgerTitles(h) {
  return h.byId("event-list").children.filter((row) => row.className === "event-item").map((row) => row.children[1].children[0].textContent);
}

// Real controller states written by tests/test_ui.py: {before, after, status, reply}.
function serverStates() {
  assert.ok(process.env.GHOSTCACHE_STATES, "run this case from tests/test_ui.py, which supplies real controller states");
  return JSON.parse(fs.readFileSync(process.env.GHOSTCACHE_STATES, "utf8"));
}

// An answer and 8/8 checks on screen, as a user would have them before cleaning up.
async function withResults(h) {
  await h.perform("ask-secret");
  await h.perform("verify");
  assert.strictEqual(h.byId("answer-content").hidden, false);
  assert.strictEqual(h.byId("checks-score").textContent, "8 / 8 PASS");
}

function assertNotBusy(h) {
  assert.strictEqual(h.run("busy"), false);
  assert.strictEqual(h.byId("busy-indicator").hidden, true);
}

function assertNoNullish(text) {
  assert.ok(!/undefined|null/.test(text), `unexpected undefined/null in ${JSON.stringify(text)}`);
}

const CASES = {
  async context_from_parent_ids() {
    const h = await load();
    h.nextAsk = askReply(h.state, {trace: {parent_ids: ["d-vault", "c-vault", "s-mixed"], duration_ms: 3,
                                           input_tokens: 12, output_tokens: 5}});
    await h.perform("ask-secret");
    const trace = h.trace();
    assert.ok(trace.includes("Context: d-vault, c-vault, s-mixed"), trace);
    for (const part of ["3 ms", "12 input tokens", "5 output tokens"]) assert.ok(trace.includes(part), trace);
    assert.ok(!trace.includes("Retrieved"), trace);
    assert.deepStrictEqual(h.byId("answer-citations").children.map((c) => c.textContent), ["↗ c-vault"]);
    assert.strictEqual(h.byId("answer-content").hidden, false);
  },

  async context_empty_and_missing() {
    const h = await load();
    h.nextAsk = askReply(h.state, {trace: {parent_ids: [], duration_ms: 1}});
    await h.perform("ask-secret");
    assert.ok(h.trace().includes("Context: none retrieved"), h.trace());
    assertNoNullish(h.trace());
    for (const trace of [{duration_ms: 1}, {parent_ids: null, duration_ms: 1}, {parent_ids: "d-vault", duration_ms: 1}]) {
      h.nextAsk = askReply(h.state, {trace});
      await h.perform("ask-secret");
      assert.ok(!h.trace().includes("Context"), h.trace());
      assertNoNullish(h.trace());
    }
  },

  async echo_sends_paraphrase() {
    const custom = "Which access phrase opens the vault? (from state)";
    const state = makeState({scenario: {...makeState().scenario, questions: {...QUESTIONS, paraphrase: custom}}});
    const h = await load(state);
    await h.perform("inspect");
    assert.deepStrictEqual(h.lastAsk(), {question: custom});
    assert.strictEqual(h.byId("question-input").value, custom);
    assert.strictEqual(h.run("lastAnswer.question"), custom);
    assert.strictEqual(h.byId("answer-question").textContent, custom);
    await h.perform("ask-secret");
    assert.deepStrictEqual(h.lastAsk(), {question: QUESTIONS.secret});
    // Without scenario questions, the fallback matches ghostcache/app.py QUESTIONS.
    const bare = await load(makeState({scenario: {}}));
    await bare.perform("inspect");
    assert.deepStrictEqual(bare.lastAsk(), {question: QUESTIONS.paraphrase});
  },

  async fixture_banner_wording() {
    for (const available of [true, false]) {
      const h = await load(makeState({provider: {available, model: "gemma4:e2b-it-qat", mode: "fixture"}}));
      const message = h.byId("provider-message").textContent;
      assert.ok(!/saved|recorded|replay|simulation/i.test(message), message);
      assert.ok(message.includes("No model inference"), message);
      assert.ok(/fixture/i.test(h.byId("provider-title").textContent), h.byId("provider-title").textContent);
      assert.strictEqual(h.byId("model-label").textContent, available ? "LIVE MODEL ALSO AVAILABLE" : "NO MODEL REQUIRED");
      await h.perform("ask-secret");
      assert.strictEqual(h.byId("answer-provider").textContent, "DETERMINISTIC FIXTURE");
      assert.ok(h.trace().includes("Deterministic fixture; no model inference"), h.trace());
      assert.ok(!/simulation/i.test(h.trace()), h.trace());
    }
  },

  async live_mode_label() {
    const state = makeState({mode: "live", provider: {available: true, model: "gemma4:e2b-it-qat", mode: "live"}});
    const h = await load(state);
    assert.strictEqual(h.byId("provider-title").textContent, "Live Gemma — local model inference");
    assert.ok(h.byId("provider-banner").classList.contains("live"));
    assert.strictEqual(h.byId("model-label").textContent, "gemma4:e2b-it-qat");
    h.nextAsk = askReply(state, {provider: "gemma4:e2b-it-qat", mode: "live",
                                 trace: {parent_ids: ["d-vault"], duration_ms: 2400, input_tokens: 300, output_tokens: 40}});
    await h.perform("ask-secret");
    assert.strictEqual(h.byId("answer-provider").textContent, "GEMMA4:E2B-IT-QAT");
    assert.ok(!/deterministic fixture/i.test(h.trace()), h.trace());
    assert.ok(h.trace().includes("Context: d-vault"), h.trace());
  },

  async reset_and_delete_clear_stale_display() {
    const h = await load();
    for (const action of ["reset", "source-only"]) {
      await h.perform("ask-secret");
      await h.perform("verify");
      assert.strictEqual(h.byId("answer-content").hidden, false);
      assert.strictEqual(h.byId("checks-score").textContent, "8 / 8 PASS");
      await h.perform(action);
      assert.strictEqual(h.byId("answer-content").hidden, true, action);
      assert.strictEqual(h.byId("checks-score").textContent, "NOT RUN", action);
    }
  },

  async graph_kinds_lineage_and_tombstones() {
    const h = await load(lineageState());
    const kinds = ["d-vault", "c-vault", "s-vault", CONVERSATION, "d-garden"].map((id) => /tnode--(\w+)/.exec(h.node(id).attrs.class)[1]);
    assert.deepStrictEqual(kinds, ["document", "chunk", "summary", "conversation", "document"]);
    // Selecting the chunk lights its ancestors and descendants, never the unrelated document.
    h.run("selectArtifact('c-vault')");
    for (const id of ["d-vault", "c-vault", "s-vault", CONVERSATION]) assert.ok(h.node(id).classList.contains("is-lit"), id);
    assert.ok(!h.node("d-garden").classList.contains("is-lit"));
    assert.ok(h.node("c-vault").classList.contains("is-selected"));
    assert.strictEqual(h.node("c-vault").attrs["aria-pressed"], "true");
    assert.ok(h.node("c-vault").classList.contains("is-marker"));
    // Source-only deletion: the same drawn nodes stay; the source becomes a tombstone, its copies stay visible and stale.
    const drawn = h.node("c-vault");
    const withdrawn = {status: "deleted", title: "Withdrawn document", body: ""};
    h.nextDelete = lineageState({"d-vault": withdrawn, stage: "source_only", stale: ["c-vault", "s-vault", CONVERSATION],
                                 marker: ["c-vault", "s-vault", CONVERSATION]});
    await h.perform("source-only");
    assert.strictEqual(h.node("c-vault"), drawn, "nodes are reused, so positions and transitions carry over");
    assert.ok(h.node("d-vault").classList.contains("is-removed") && h.node("d-vault").classList.contains("is-withdrawn"));
    assert.ok(h.node("c-vault").classList.contains("is-stale") && !h.node("c-vault").classList.contains("is-removed"));
    // Cascade: every descendant becomes a content-free tombstone; the unrelated document is untouched.
    const purged = (kind) => ({status: "invalidated", title: `Purged ${kind}`, body: ""});
    h.nextDelete = lineageState({"d-vault": withdrawn, "c-vault": purged("chunk"), "s-vault": purged("summary"),
                                 [CONVERSATION]: purged("conversation"), stage: "cleaned", stale: [], marker: []});
    await h.perform("cascade");
    for (const id of ["c-vault", "s-vault", CONVERSATION]) {
      assert.ok(h.node(id).classList.contains("is-purged") && !h.node(id).classList.contains("is-stale"), id);
    }
    assert.ok(!h.node("d-garden").classList.contains("is-removed"));
    h.run("selectArtifact('s-vault')");
    assert.ok(h.byId("inspector-body").textContent.startsWith("Content removed"), h.byId("inspector-body").textContent);
    assert.ok(h.node("s-vault").attrs["aria-label"].includes("Purged: body emptied, ID and links kept"), h.node("s-vault").attrs["aria-label"]);
    assert.ok(h.node("d-vault").attrs["aria-label"].includes("Withdrawn"), h.node("d-vault").attrs["aria-label"]);
  },

  async list_view_alternative() {
    const h = await load(lineageState());
    h.run("setView('list')");
    assert.strictEqual(h.byId("graph-list").hidden, false);
    assert.strictEqual(h.byId("graph-viewport").hidden, true);
    assert.strictEqual(h.byId("view-list").attrs["aria-pressed"], "true");
    const headings = h.byId("graph-list").children.map((group) => group.children[0].textContent);
    assert.deepStrictEqual(headings, ["Original documents · 2", "Search chunks · 1", "Summaries · 1", "Saved answers · 1"]);
    assert.strictEqual(h.run("listButtons.size"), 5);
    h.run("selectArtifact('s-vault')");
    assert.strictEqual(h.run("listButtons.get('s-vault')").attrs["aria-pressed"], "true");
    assert.strictEqual(h.run("listButtons.get('d-vault')").attrs["aria-pressed"], "false");
    h.run("setView('graph')");
    assert.strictEqual(h.byId("graph-list").hidden, true);
  },

  async storage_failed_state() {
    // A server that sends no ledger of its own, so the page's local notes are what the ledger shows.
    const unlogged = () => { const state = makeState(); delete state.events; return state; };
    const h = await load(unlogged());
    await h.perform("ask-secret");
    await h.perform("verify");
    h.run("selectArtifact('c-vault')");
    assert.strictEqual(h.byId("ledger-count").textContent, "2 EVENTS");
    assert.deepStrictEqual(ledgerTitles(h), ["Asking for the private detail", "Verifying the cleanup"]);
    const message = "Experiment storage could not be restored; reset to recover.";
    h.fail = {route: "/api/reset", status: 503, reply: {error: message}};
    h.state = makeState({stage: "storage_failed", artifacts: [], graph: {nodes: [], edges: []}, scenario: {}, events: [], seed_checks: []});
    await h.run('perform("reset")');
    assert.strictEqual(h.byId("error-banner").hidden, false);
    assert.strictEqual(h.byId("error-banner").textContent, message);
    assert.strictEqual(h.sent.filter((s) => s.route === "/api/state").length, 2, "state is reloaded after the 503");
    assert.strictEqual(h.byId("storage-failed").hidden, false);
    assert.strictEqual(h.byId("step-count").textContent, "0 / 5");
    assert.ok(/failed/.test(h.byId("stage-status").className), h.byId("stage-status").className);
    // Nothing from the discarded experiment comes back: the server's empty ledger is authoritative.
    assert.strictEqual(h.byId("ledger-count").textContent, "0 EVENTS");
    assert.deepStrictEqual(h.byId("event-list").children.map((row) => row.className), ["ledger-empty"]);
    assert.strictEqual(h.run("localEvents.length"), 0);
    assert.strictEqual(h.byId("answer-content").hidden, true);
    assert.strictEqual(h.byId("checks-score").textContent, "NOT RUN");
    assert.strictEqual(h.run("selectedId"), null);
    assert.strictEqual(h.byId("inspector-content").hidden, true);
    assert.strictEqual(h.byId("graph-nodes").children.length, 0);
    // A successful reset shows only the new experiment's history.
    h.state = makeState({events: [{name: "experiment.seeded", time: "10:00:00", mode: "fixture", provider: "fixture", documents: 5, baseline_exposed: true}]});
    await h.perform("reset");
    assert.strictEqual(h.byId("storage-failed").hidden, true);
    assert.strictEqual(h.byId("ledger-count").textContent, "1 EVENT");
    assert.deepStrictEqual(ledgerTitles(h), ["Archive seeded"]);
    assert.strictEqual(h.byId("graph-nodes").children.length, 2);
  },

  async rebuild_failure_is_reported() {
    const h = await load(liveSeeded());
    const error = "Local model call failed (timed out). No fixture fallback was used.";
    h.nextDelete = {...liveCleaned([...SEEDED, PURGED, REBUILD_FAILED], false, FAILED),
                    deletion: {source_id: "d-vault", affected_ids: ["d-vault", "c-vault"], retained_root_ids: ["d-garden"], rebuild_error: error}};
    await h.perform("cascade");
    let status = stageStatus(h);
    assert.strictEqual(status.tone, "warn");
    for (const part of ["rebuild failed", error, "no fixture text was inserted", "1 source withdrawn and 3 descendants purged"]) assert.ok(status.words.includes(part), status.words);
    // Cleanup again: nothing is left to purge, so the server neither rebuilds nor reports rebuild_error.
    h.nextDelete = {...liveCleaned([...SEEDED, PURGED, REBUILD_FAILED, NOTHING_PURGED], false, FAILED),
                    deletion: {source_id: "d-vault", affected_ids: [], retained_root_ids: ["d-garden"]}};
    await h.perform("cascade");
    status = stageStatus(h);
    assert.strictEqual(status.tone, "warn", status.words);
    assert.ok(status.words.includes("rebuild failed") && status.words.includes(error), status.words);
    assert.ok(status.words.includes("does not retry the rebuild"), status.words);
    // A successful reset starts a new experiment with no rebuild outcome.
    h.state = liveSeeded();
    await h.perform("reset");
    status = stageStatus(h);
    assert.notStrictEqual(status.tone, "warn", status.words);
    assert.ok(!status.words.includes("rebuild failed"), status.words);
  },

  async rebuild_failure_survives_reload() {
    // A fresh page after 50 later events: the failure event has left the window, and only the
    // server's current outcome says the rebuild is still unresolved.
    const h = await load(liveCleaned(laterAnswers(60), false, FAILED));
    assert.strictEqual(h.byId("ledger-count").textContent, "50 EVENTS");
    assert.ok(!ledgerTitles(h).includes("Rebuild failed"), ledgerTitles(h));
    const {tone, words} = stageStatus(h);
    assert.strictEqual(tone, "warn", words);
    for (const part of ["rebuild failed", "The local model call failed (timed out).", "no fixture text was inserted",
                        "does not retry the rebuild", "3 descendants purged"]) assert.ok(words.includes(part), words);
    assert.ok(!words.includes("Rebuilt "), words);
    assertNoNullish(words);
  },

  async rebuild_warning_survives_thirteen_verifications() {
    const h = await load(liveSeeded());
    h.nextDelete = {...liveCleaned([...SEEDED, PURGED, REBUILD_FAILED], false, FAILED),
                    deletion: {source_id: "d-vault", affected_ids: ["d-vault", "c-vault"], retained_root_ids: ["d-garden"],
                               rebuild_error: "Local model call failed (timed out). No fixture fallback was used."}};
    await h.perform("cascade");
    for (let run = 1; run <= 13; run += 1) {
      // Each verification records four answer events on the server.
      const events = [...SEEDED, PURGED, REBUILD_FAILED, ...laterAnswers(run * 4)].slice(-50);
      h.state = liveCleaned(events, false, FAILED);
      await h.perform("verify");
      const status = stageStatus(h);
      assert.strictEqual(status.tone, "warn", `after verification ${run}: ${status.words}`);
      assert.ok(status.words.includes("rebuild failed"), status.words);
    }
    assert.ok(!ledgerTitles(h).includes("Rebuild failed"), "the failure event has left the window");
    assert.strictEqual(h.byId("checks-score").textContent, "8 / 8 PASS");
  },

  async rebuild_outcome_follows_server_state() {
    const cases = [
      ["a normal cleanup", liveCleaned([...SEEDED, PURGED, REBUILT], true, SUCCEEDED), "ok", "Rebuilt s-rebuilt-1-9 from d-garden"],
      ["an older stored success, then a newer failure", liveCleaned([...SEEDED, REBUILT, PURGED, REBUILD_FAILED], true, FAILED), "warn", "(timed out)"],
      ["the same, after the failure event left the window", liveCleaned(laterAnswers(80), true, FAILED), "warn", "(timed out)"],
      ["a failure event still in the window, resolved by a later success", liveCleaned([...SEEDED, PURGED, REBUILD_FAILED, REBUILT], true, SUCCEEDED), "ok", "Rebuilt s-rebuilt-1-9"],
      ["an unusable model reply", liveCleaned([...SEEDED, PURGED], false, {...FAILED, error_category: "invalid_output"}), "warn", "The model's reply could not be used as a summary."],
      ["no category from the server", liveCleaned([...SEEDED, PURGED], false, {status: "failed"}), "warn", "The summary rebuild did not complete."],
      ["an older server that sends no outcome", (() => { const s = liveCleaned([...SEEDED, PURGED]); delete s.rebuild; return s; })(), "ok", "Cleanup propagated"],
    ];
    for (const [label, state, tone, words] of cases) {
      const h = await load(state);
      const status = stageStatus(h);
      assert.strictEqual(status.tone, tone, `${label}: ${status.words}`);
      assert.ok(status.words.includes(words), `${label}: ${status.words}`);
      assertNoNullish(status.words);
    }
  },

  async storage_failure_discards_the_rebuild_warning() {
    const h = await load(liveCleaned(laterAnswers(60), false, FAILED));
    assert.strictEqual(stageStatus(h).tone, "warn");
    const message = "Experiment storage could not be restored; reset to recover.";
    h.fail = {route: "/api/reset", status: 503, reply: {error: message}};
    h.state = makeState({stage: "storage_failed", artifacts: [], graph: {nodes: [], edges: []}, scenario: {}, events: [], seed_checks: [], rebuild: NOT_ATTEMPTED});
    await h.run('perform("reset")');
    const status = stageStatus(h);
    assert.strictEqual(status.tone, "failed", status.words);
    assert.ok(!status.words.includes("rebuild failed"), status.words);
    assert.strictEqual(h.byId("storage-failed").hidden, false);
  },

  async cleanup_failure_reconciles_with_server_state() {
    // The server purged, then failed to store the rebuilt summary and answered with an error.
    const {before, after, status, reply} = serverStates();
    const h = await load(before);
    await withResults(h);
    h.state = after;
    h.fail = {route: "/api/delete", status, reply};
    const sentBefore = h.sent.length;
    await h.run('perform("cascade")');
    // The original error stays.
    assert.strictEqual(h.byId("error-banner").hidden, false);
    assert.strictEqual(h.byId("error-banner").textContent, reply.error);
    // The display is the server's: stage, counts, warning, tombstones and ledger.
    assert.strictEqual(after.stage, "cleaned");
    assert.deepStrictEqual([after.rebuild.status, after.rebuild.error_category], ["failed", "not_stored"]);
    const {tone, words} = stageStatus(h);
    assert.strictEqual(tone, "warn", words);
    const audit = after.audit;
    for (const part of ["Cleanup is complete, but the summary rebuild failed.", "The rebuilt summary could not be stored.",
                        `${audit.deleted_artifacts} source withdrawn and ${audit.invalidated_artifacts} descendants purged`,
                        `${audit.matched_canary} rows hold the marker and ${audit.stale_descendants} active artifacts depend on a withdrawn source`,
                        "no fixture text was inserted"]) assert.ok(words.includes(part), words);
    assert.deepStrictEqual([audit.matched_canary, audit.stale_descendants], [0, 0]);
    assert.strictEqual(h.byId("step-count").textContent, "5 / 5");
    for (const artifact of after.artifacts) {
      const node = h.node(artifact.id);
      assert.ok(node, artifact.id);
      const removed = ["deleted", "invalidated"].includes(artifact.status);
      assert.strictEqual(node.classList.contains("is-removed"), removed, artifact.id);
      assert.strictEqual(node.classList.contains("is-withdrawn"), artifact.status === "deleted", artifact.id);
      assert.ok(!node.classList.contains("is-stale") && !node.classList.contains("is-marker"), artifact.id);
    }
    assert.strictEqual(h.byId("graph-nodes").children.length, after.artifacts.length);
    assert.strictEqual(h.byId("ledger-count").textContent, `${after.events.length} EVENTS`);
    // The pre-cleanup answer and checks are not presented as results for the cleaned state.
    assert.strictEqual(h.byId("answer-content").hidden, true);
    assert.strictEqual(h.byId("checks-score").textContent, "NOT RUN");
    assert.ok(after.artifacts.some((a) => a.id === h.run("selectedId")));
    assertNotBusy(h);
    assertNoNullish(words);
    // One deletion, then one read of the state: nothing is retried and no model call is made.
    assert.deepStrictEqual(h.sent.slice(sentBefore), [{route: "/api/delete", body: {mode: "cascade"}}, {route: "/api/state", body: undefined}]);
  },

  async failed_reconciliation_keeps_the_original_error() {
    const h = await load(lineageState({stage: "source_only", stale: ["c-vault", "s-vault"]}));
    await withResults(h);
    const original = "Unexpected server error; inspect the local tests.";
    h.failures.push({route: "/api/delete", status: 500, reply: {error: original}}, {route: "/api/state", reject: true});
    const sentBefore = h.sent.length;
    await h.run('perform("cascade")');
    assert.deepStrictEqual(h.sent.slice(sentBefore).map((s) => s.route), ["/api/delete", "/api/state"], "no retry");
    const banner = h.byId("error-banner");
    assert.strictEqual(banner.hidden, false);
    assert.ok(banner.textContent.startsWith(original), banner.textContent);
    assert.ok(banner.textContent.includes("cannot tell whether the deletion finished"), banner.textContent);
    assert.ok(!banner.textContent.includes("Failed to fetch"), "the reconciliation error does not replace the original");
    // Neither the old stage nor a completed cleanup is claimed, and old results are withdrawn.
    const {tone, words} = stageStatus(h);
    assert.strictEqual(tone, "failed", words);
    assert.ok(words.includes("could not confirm the server's state") && !words.includes("Incomplete deletion") && !words.includes("Cleanup"), words);
    assert.strictEqual(h.byId("answer-content").hidden, true);
    assert.strictEqual(h.byId("checks-score").textContent, "NOT RUN");
    assertNotBusy(h);
    // Controls work again: a later successful read replaces the uncertainty with the server's state.
    h.state = lineageState({stage: "source_only", stale: ["c-vault", "s-vault"]});
    await h.perform("ask-retained");
    assert.strictEqual(stageStatus(h).tone, "warn");
    assert.ok(stageStatus(h).words.includes("Incomplete deletion"), stageStatus(h).words);
  },

  async unchanged_state_after_a_failed_deletion_keeps_results() {
    // Rejected before any change (for example, repeating the incomplete deletion after cleanup):
    // the state read back is identical, so the answer and checks on screen stay.
    const h = await load(liveCleaned([...SEEDED, PURGED, REBUILT], true, SUCCEEDED));
    await withResults(h);
    const message = "Reset before repeating the intentionally incomplete deletion.";
    h.fail = {route: "/api/delete", status: 400, reply: {error: message}};
    const sentBefore = h.sent.length;
    await h.run('perform("source-only")');
    assert.deepStrictEqual(h.sent.slice(sentBefore).map((s) => s.route), ["/api/delete", "/api/state"]);
    assert.strictEqual(h.byId("error-banner").textContent, message);
    assert.strictEqual(h.byId("answer-content").hidden, false);
    assert.strictEqual(h.byId("checks-score").textContent, "8 / 8 PASS");
    assert.strictEqual(stageStatus(h).tone, "ok");
    assertNotBusy(h);
  },

  async failed_question_does_not_read_state() {
    // A failed question changes nothing on the server, so the page neither re-reads state nor drops results.
    const h = await load(liveCleaned([...SEEDED, PURGED, REBUILT], true, SUCCEEDED));
    await withResults(h);
    h.fail = {route: "/api/ask", status: 502, reply: {error: "Local model call failed (timed out). No fixture fallback was used.", mode: "live"}};
    const sentBefore = h.sent.length;
    await h.run('perform("ask-retained")');
    assert.deepStrictEqual(h.sent.slice(sentBefore).map((s) => s.route), ["/api/ask"]);
    assert.strictEqual(h.byId("checks-score").textContent, "8 / 8 PASS");
    assert.strictEqual(h.byId("error-banner").hidden, false);
    assertNotBusy(h);
  },

  async thread_ends_meet_their_knots() {
    const state = lineageState();
    state.artifacts.push({id: "s-mixed", kind: "summary", title: "Mixed daily digest", body: `Copy: ${MARKER}`, status: "active",
                          parent_ids: ["s-vault", "d-garden"], source_ids: ["d-vault", "d-garden"]});
    state.graph.edges.push({source: "s-vault", target: "s-mixed"}, {source: "d-garden", target: "s-mixed"});
    const h = await load(state);
    const place = (id) => { const [, x, y] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(h.node(id).attrs.transform); return {x: Number(x), y: Number(y)}; };
    const edges = h.run("[...graph.edges.values()].map((e) => ({source: e.source, target: e.target, d: e.path.attrs.d, cx: e.knot.attrs.cx, cy: e.knot.attrs.cy}))");
    assert.strictEqual(edges.length, 6);
    let sameColumn = 0;
    for (const edge of edges) {
      const label = `${edge.source} > ${edge.target}`;
      const [, x, y] = /(-?[\d.]+) (-?[\d.]+)$/.exec(edge.d);
      assert.deepStrictEqual([Number(edge.cx), Number(edge.cy)], [Number(x), Number(y)], `${label}: the curve ends at its knot`);
      const source = place(edge.source), target = place(edge.target);
      // Within one column the link re-enters on the right edge (a summary's stack adds 6); otherwise on the left.
      const right = target.x + 164 + (edge.target.startsWith("s-") ? 6 : 0);
      if (source.x === target.x) sameColumn += 1;
      assert.strictEqual(Number(edge.cx), source.x === target.x ? right : target.x, label);
      assert.strictEqual(Number(edge.cy), target.y + 31, label);
    }
    assert.strictEqual(sameColumn, 1, "s-vault > s-mixed shares the summaries column");
  },

  async unavailable_model_and_marker_labels() {
    const message = "Ollama is unavailable (connection failed). Fixture mode still works.";
    const h = await load(makeState({provider: {available: false, model: "gemma4:e2b-it-qat", message, mode: "fixture"}}));
    const live = h.byId("mode-select").querySelector('option[value="live"]');
    assert.strictEqual(live.disabled, true);
    assert.strictEqual(live.textContent, "Live Gemma — unavailable");
    assert.ok(h.byId("provider-availability").textContent.includes(message), h.byId("provider-availability").textContent);
    await h.perform("ask-secret");
    assert.strictEqual(h.byId("answer-verdict").textContent, "◆ Reveals the marker");
    assert.ok(h.byId("answer-verdict").classList.contains("is-leak"));
    h.nextAsk = askReply(h.state, {answer: "The roof garden opens at 07:40.", citations: []});
    await h.perform("ask-retained");
    assert.strictEqual(h.byId("answer-verdict").textContent, "No marker in this answer");
    assert.ok(!h.byId("answer-verdict").classList.contains("is-leak"));
  },
};

const name = process.argv[2];
if (!CASES[name]) {
  console.error(`Unknown case ${JSON.stringify(name)}. Cases: ${Object.keys(CASES).join(", ")}`);
  process.exit(2);
}
CASES[name]().then(() => console.log(`ok ${name}`), (error) => {
  console.error(`FAIL ${name}: ${error.message}`);
  process.exit(1);
});
