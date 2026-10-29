"use strict";
// Offline behaviour checks for the public site's shared script, site/site.js. The real script runs
// in node:vm against a minimal fake DOM, with the real exported evidence; no browser or network.
// Layout, real pointer events and rendered geometry are checked in a browser instead (TESTING.md).
// Usage: node tests/ui/site_contract.js <case> [path/to/site.js]
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const SITE_JS = process.argv[3] || path.join(ROOT, "site", "site.js");
const EVIDENCE = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "data", "evidence.json"), "utf8"));
const STAGES = ["setup", "source_only", "leak", "cleanup", "verify"];

class FakeNode {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.parent = null; this.attrs = {}; this.style = {};
    this.listeners = {}; this.hidden = false; this.ownText = "";
    const classes = new Set();
    this.classes = classes;
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, on) => ((on ?? !classes.has(name)) ? (classes.add(name), true) : (classes.delete(name), false)),
      contains: (name) => classes.has(name),
    };
  }
  set className(value) { this.classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach((name) => this.classes.add(name)); }
  get className() { return [...this.classes].join(" "); }
  set textContent(value) { this.children = []; this.ownText = String(value); }
  get textContent() { return this.ownText + this.children.map((child) => child.textContent).join(""); }
  get firstChild() { return this.children[0] || null; }
  setAttribute(key, value) { if (key === "class") this.className = value; else this.attrs[key] = String(value); }
  getAttribute(key) { return key === "class" ? this.className : this.attrs[key] ?? null; }
  removeAttribute(key) { delete this.attrs[key]; }
  append(...nodes) {
    for (const node of nodes) {
      const child = typeof node === "string" ? textNode(node) : node;
      child.parent = this;
      this.children.push(child);
    }
  }
  removeChild(node) { this.children = this.children.filter((child) => child !== node); }
  after(node) { if (this.parent) this.parent.append(node); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  fire(type, event) { for (const fn of this.listeners[type] || []) fn(event); }
  // Every descendant (depth first) whose class list includes the name.
  findAll(name) {
    const found = [];
    const walk = (node) => { for (const child of node.children) { if (child.classes.has(name)) found.push(child); walk(child); } };
    walk(this);
    return found;
  }
}
function textNode(value) { const node = new FakeNode("#text"); node.ownText = String(value); return node; }

function load() {
  const document = {
    readyState: "complete", createElement: (tag) => new FakeNode(tag), createElementNS: (ns, tag) => new FakeNode(tag),
    createTextNode: textNode, createDocumentFragment: () => new FakeNode("#fragment"),
    querySelectorAll: () => [], addEventListener() {}, getElementById: () => null,
  };
  const window = {};
  const context = vm.createContext({document, window, console, setTimeout: () => 0, clearTimeout() {}});
  vm.runInContext(fs.readFileSync(SITE_JS, "utf8"), context, {filename: "site.js"});
  assert.ok(window.GC, "site.js defines window.GC");
  return window.GC;
}

function rebuiltIds(run) {
  return run.stages.cleaned_audit.active_ids.filter((id) => !run.stages.initial_audit.active_ids.includes(id));
}

// Values made inside the vm context have that realm's prototypes; compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

function lastPoint(d) {
  const match = /(-?[\d.]+) (-?[\d.]+)$/.exec(d);
  assert.ok(match, `no end point in ${d}`);
  return {x: Number(match[1]), y: Number(match[2])};
}

const CASES = {
  // FIX: the inspector listed s-rebuilt-1-9 under d-garden's "Fed into" while showing the seeded memory.
  inspector_relationships_follow_the_stage() {
    const GC = load();
    const legend = EVIDENCE.seed_legend;
    assert.strictEqual(EVIDENCE.runs.length, 3);
    for (const run of EVIDENCE.runs) {
      const rebuilt = rebuiltIds(run);
      assert.ok(rebuilt.length > 0, `${run.id} has a rebuilt summary`);
      for (const stage of STAGES) {
        const after = stage === "cleanup" || stage === "verify";
        for (const id of GC.trailIds(run)) {
          const d = GC.describe(run, legend, stage, id);
          const where = `${run.id}/${stage}/${id}`;
          if (!d.status) {
            assert.deepStrictEqual(plain([d.parents, d.children]), [[], []], `${where}: an artifact not created yet has no relationships`);
            continue;
          }
          for (const other of [...d.parents, ...d.children]) {
            assert.ok(GC.statusFor(run, stage, other), `${where} names ${other}, which does not exist at this stage`);
          }
        }
        for (const id of GC.trailIds(run)) {
          // The marker history covers the stages reached so far, and never calls a missing artifact "NO".
          const d = GC.describe(run, legend, stage, id);
          assert.strictEqual(d.marker.length, stage === "setup" ? 1 : after ? 3 : 2, `${run.id}/${stage}/${id}`);
          for (const row of d.marker) if (!row.existed) assert.strictEqual(row.held, false, `${run.id}/${stage}/${id}`);
        }
        for (const id of rebuilt) {
          const parents = run.events.find((event) => event.name === "summary.generated" && event.artifact_id === id).parent_ids;
          for (const parent of parents) {
            const children = GC.describe(run, legend, stage, parent).children;
            assert.strictEqual(children.includes(id), after, `${run.id}/${stage}: ${parent} → ${id}`);
          }
          const d = GC.describe(run, legend, stage, id);
          assert.strictEqual(d.status, after ? "rebuilt" : null, `${run.id}/${stage}/${id}`);
          if (after) {
            assert.deepStrictEqual(plain(d.parents), parents);
            assert.deepStrictEqual(plain(d.marker.map((row) => row.existed)), [false, false, true], "not created yet is not the same as emptied");
          }
        }
      }
      // Tombstones still exist after cleanup, so their links stay inspectable.
      const source = GC.describe(run, legend, "cleanup", run.source_id);
      assert.strictEqual(source.status, "withdrawn");
      assert.ok(source.children.includes(`c-${run.source_id.slice(2)}`), source.children.join());
      const chunk = GC.describe(run, legend, "verify", "c-garden");
      assert.ok(chunk.children.includes("s-mixed"), chunk.children.join());
      assert.strictEqual(GC.statusFor(run, "verify", "s-mixed"), "purged");
      const mixed = GC.describe(run, legend, "cleanup", "s-mixed");
      assert.deepStrictEqual(plain(mixed.parents), ["s-vault", "c-garden"]);
      assert.ok(mixed.children.includes("s-handoff"), mixed.children.join());
      // The withdrawn source keeps its links at the source-only stage too.
      assert.ok(GC.describe(run, legend, "source_only", run.source_id).children.length > 0);
    }
  },

  // FIX: the tooltip was positioned against the wrong box and could leave the chart.
  timing_tooltip_stays_inside_the_chart() {
    const GC = load();
    // A segment places the tooltip from the pointer, measured from the chart's padding box (inside its border).
    const container = new FakeNode("div");
    const runs = ["cold", "warm"].map((id) => EVIDENCE.runs.find((run) => run.id === id));
    GC.renderTiming(container, runs);
    const chart = container.children[0];
    assert.ok(chart.classes.has("timing"));
    Object.assign(chart, {clientLeft: 1, clientTop: 1, clientWidth: 598, getBoundingClientRect: () => ({left: 40, top: 7200, width: 600, height: 400})});
    const [shown] = chart.findAll("timing__tip");
    Object.assign(shown, {offsetWidth: 220, offsetHeight: 52});
    const segments = chart.findAll("timing__seg");
    assert.strictEqual(segments.length, GC.modelCalls(runs[0]).length + GC.modelCalls(runs[1]).length);
    assert.strictEqual(shown.hidden, true);
    segments[0].fire("pointermove", {clientX: 300, clientY: 7300});
    assert.strictEqual(shown.hidden, false);
    assert.deepStrictEqual([shown.style.left, shown.style.top], ["273px", "35px"]);
    assert.ok(shown.textContent.includes(GC.ms(GC.modelCalls(runs[0])[0].duration_ms)), shown.textContent);
    segments[segments.length - 1].fire("pointermove", {clientX: 637, clientY: 7206});
    assert.deepStrictEqual([shown.style.left, shown.style.top], ["370px", "25px"]);
    segments[0].fire("pointerleave", {});
    assert.strictEqual(shown.hidden, true);
    // Placement at both edges, near the top and in a narrow chart.
    const place = (pointer, box, tip) => GC.tipPlacement(pointer, box, tip);
    const box = {left: 41, top: 7201, width: 598};
    const tip = {width: 220, height: 52};
    const inside = (at, b = box, t = tip) => {
      assert.ok(at.left >= 8 && at.left + t.width <= b.width - 8 + 1e-9, `left ${at.left} with width ${t.width} in ${b.width}`);
      assert.ok(at.top >= 0, `top ${at.top}`);
    };
    const mid = place({x: 300, y: 7300}, box, tip);
    assert.deepStrictEqual(plain(mid), {left: 273, top: 35}, "beside the pointer, in the box's own coordinates");
    inside(mid);
    inside(place({x: 42, y: 7300}, box, tip));
    const right = place({x: 638, y: 7300}, box, tip);
    inside(right);
    assert.strictEqual(right.left, box.width - tip.width - 8);
    const top = place({x: 300, y: 7210}, box, tip);
    assert.strictEqual(top.top, 29, "flips below the pointer near the top edge");
    const narrow = {left: 17, top: 900, width: 260};
    inside(place({x: 250, y: 1000}, narrow, {width: 244, height: 70}), narrow, {width: 244, height: 70});
    // The table alternative lists every call of both runs, plus the total.
    const rows = chart.findAll("table")[0].children[1].children;
    assert.strictEqual(rows.length, GC.modelCalls(runs[0]).length + 1);
  },

  // FIX: a link inside one column ended on the target's right edge while its knot sat on the left.
  thread_ends_meet_their_knots() {
    const GC = load();
    for (const run of EVIDENCE.runs) {
      const frame = new FakeNode("div");
      GC.createTrail(frame, {interactive: true, probe: true}).setRun(run, EVIDENCE.seed_legend);
      const nodes = new Map(frame.findAll("tnode").map((node) => {
        const [, x, y] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(node.attrs.transform);
        return [node.attrs["data-id"], {x: Number(x), y: Number(y)}];
      }));
      const threads = frame.findAll("thread");
      let sameColumn = 0;
      for (const thread of threads) {
        const [pathNode, knot] = thread.children;
        const end = lastPoint(pathNode.attrs.d);
        assert.deepStrictEqual([Number(knot.attrs.cx), Number(knot.attrs.cy)], [end.x, end.y], `${run.id}: ${pathNode.attrs.d}`);
        const target = [...nodes.values()].find((p) => Math.abs(p.y + 33 - end.y) < 1e-6 && (Math.abs(p.x - end.x) < 1e-6 || Math.abs(p.x + 174 - end.x) < 1e-6));
        assert.ok(target, `${run.id}: the knot at ${end.x},${end.y} sits on a node edge`);
        const start = /^M(-?[\d.]+) /.exec(pathNode.attrs.d);
        if (Math.abs(Number(start[1]) - end.x) < 1e-6) sameColumn += 1;
      }
      // s-vault → s-mixed and s-mixed → s-handoff are summary-to-summary links in one column.
      assert.strictEqual(sameColumn, 2, `${run.id}: same-column links`);
      const mixed = nodes.get("s-mixed");
      const knots = threads.map((thread) => thread.children[1]).filter((knot) => Math.abs(Number(knot.attrs.cy) - (mixed.y + 33)) < 1e-6);
      assert.ok(knots.some((knot) => Math.abs(Number(knot.attrs.cx) - (mixed.x + 174)) < 1e-6), "the same-column knot is on s-mixed's right edge");
    }
  },
};

const name = process.argv[2];
if (!CASES[name]) {
  console.error(`Unknown case ${JSON.stringify(name)}. Cases: ${Object.keys(CASES).join(", ")}`);
  process.exit(2);
}
try {
  CASES[name]();
  console.log(`ok ${name}`);
} catch (error) {
  console.error(`FAIL ${name}: ${error.message}`);
  process.exit(1);
}
