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
  const harness = {byId, sent: [], state, nextAsk: null};
  async function fetch(route, options = {}) {
    const body = options.body ? JSON.parse(options.body) : undefined;
    harness.sent.push({route, body});
    let reply = harness.state;
    if (route === "/api/ask") reply = harness.nextAsk || askReply(harness.state);
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
  return harness;
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
    assert.strictEqual(h.byId("provider-title").textContent, "Live local Gemma mode");
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
