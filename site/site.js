"use strict";
// Shared code for the public GhostCache pages: static and read-only.
// The site's only data request is data/evidence.json on this origin. It makes no API
// request, calls no model, stores nothing and deletes nothing.

(function () {
  const DATA_URL = "data/evidence.json";
  const SVG_NS = "http://www.w3.org/2000/svg";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function svg(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function ms(value) {
    return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value} ms`;
  }

  function shortId(id) {
    return id.startsWith("conversation-") ? `conversation-${id.slice(13, 17)}…` : id;
  }

  function joinList(items) {
    if (items.length < 2) return items.join("");
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  // Text with every occurrence of the fictional marker wrapped in <mark>, built without innerHTML.
  function markText(text, marker) {
    const fragment = document.createDocumentFragment();
    const parts = marker ? String(text).split(marker) : [String(text)];
    parts.forEach((part, index) => {
      if (index) fragment.append(el("mark", null, marker));
      if (part) fragment.append(document.createTextNode(part));
    });
    return fragment;
  }

  let evidence = null;
  function loadEvidence() {
    if (!evidence) {
      evidence = fetch(DATA_URL, {cache: "no-cache"}).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }).then((data) => {
        if (!data || !Array.isArray(data.runs) || !data.runs.length) throw new Error("no runs");
        return data;
      });
    }
    return evidence;
  }

  // ---- The trail model: what the report lets us say about each artifact ----

  const KINDS = {
    document: {column: 0, label: "Document", group: "Original documents", heading: "ORIGINAL DOCUMENTS"},
    chunk: {column: 1, label: "Search chunk", group: "Search chunks", heading: "SEARCH CHUNKS"},
    summary: {column: 2, label: "Summary", group: "Model-written summaries", heading: "SUMMARIES"},
    conversation: {column: 3, label: "Saved answer", group: "Saved answer", heading: "SAVED ANSWER"},
  };

  function kindOf(id) {
    if (id.startsWith("d-")) return "document";
    if (id.startsWith("c-")) return "chunk";
    if (id.startsWith("s-")) return "summary";
    return "conversation";
  }

  function eventsNamed(run, name) {
    return run.events.filter((event) => event.name === name);
  }

  // Where each artifact came from, labelled by how we know it.
  function origins(run, legend) {
    const map = {};
    for (const id of Object.keys(legend.documents)) map[id] = {parents: [], how: "original"};
    for (const id of Object.keys(legend.documents)) map[`c-${id.slice(2)}`] = {parents: [id], how: "seed design"};
    for (const event of eventsNamed(run, "summary.generated")) {
      map[event.artifact_id] = {parents: event.parent_ids || [], how: "recorded"};
    }
    const seeded = run.events.find((event) => event.answer_key === "seeded_conversation");
    const conversation = run.stages.initial_audit.active_ids.find((id) => id.startsWith("conversation-"));
    if (seeded && conversation) map[conversation] = {parents: seeded.parent_ids || [], how: "inferred"};
    return map;
  }

  function trailIds(run) {
    return [...new Set([...run.stages.initial_audit.active_ids, ...run.stages.cleaned_audit.active_ids])];
  }

  const STAGE_AUDIT = {setup: "initial_audit", source_only: "source_only_audit", leak: "source_only_audit",
                       cleanup: "cleaned_audit", verify: "cleaned_audit"};

  // An artifact's status at a stage, read from that stage's audit. Inactive documents are
  // deleted sources and inactive derived artifacts are purged (GhostCache's store rules).
  function statusFor(run, stage, id) {
    const audit = run.stages[STAGE_AUDIT[stage]];
    const initial = run.stages.initial_audit.active_ids;
    if (audit.active_ids.includes(id)) {
      const marker = audit.matched_canary_ids.includes(id);
      if (audit.stale_ids.includes(id)) return marker ? "stale-marker" : "stale";
      if (marker) return "marker";
      return initial.includes(id) ? "active" : "rebuilt";
    }
    const existed = stage === "cleanup" || stage === "verify" ? trailIds(run) : initial;
    if (!existed.includes(id)) return null;
    return kindOf(id) === "document" ? "withdrawn" : "purged";
  }

  const STATUS = {
    active: {chip: "", label: "Active", cls: []},
    marker: {chip: "◆ MARKER", label: "Active, and holds the marker", cls: ["is-marker"]},
    stale: {chip: "STALE", label: "Stale: depends on a withdrawn source", cls: ["is-stale"]},
    "stale-marker": {chip: "◆ STALE", label: "Stale: depends on a withdrawn source and still holds the marker", cls: ["is-stale", "is-marker"]},
    withdrawn: {chip: "WITHDRAWN", label: "Withdrawn: body emptied, title replaced, ID kept", cls: ["is-removed", "is-withdrawn"]},
    purged: {chip: "PURGED", label: "Purged: body emptied, ID and links kept", cls: ["is-removed", "is-purged"]},
    rebuilt: {chip: "↻ REBUILT", label: "Rebuilt after cleanup from surviving original documents", cls: ["is-rebuilt"]},
  };
  const STATE_CLASSES = ["is-marker", "is-stale", "is-removed", "is-withdrawn", "is-purged", "is-rebuilt", "is-absent",
                         "has-chip", "is-context", "is-context-clean", "is-cited"];

  const ANSWER_LABELS = {
    before: "Before deletion · secret question",
    source_only: "After source-only deletion · reworded question",
    secret: "After cleanup · secret question",
    paraphrase: "After cleanup · reworded question",
    retained: "After cleanup · unrelated fact",
    shared: "After cleanup · shared fact",
  };

  const HISTORY = [["Seeded", "setup"], ["After source-only deletion", "source_only"], ["After cleanup", "cleanup"]];
  const AUDITS = ["initial_audit", "source_only_audit", "cleaned_audit"];

  // What the inspector says about one artifact at one stage. Relationships name only artifacts that
  // exist at that stage: one not created yet is left out, while a tombstone still exists and stays.
  function describe(run, legend, stage, id) {
    const from = origins(run, legend);
    const status = statusFor(run, stage, id);
    const exists = (other) => Boolean(status && statusFor(run, stage, other));
    return {
      id, kind: kindOf(id), title: legend.documents[id] || null, status,
      statusLabel: status ? STATUS[status].label : "Not created yet at this stage",
      parents: ((from[id] || {}).parents || []).filter(exists), how: (from[id] || {}).how || null,
      children: Object.keys(from).filter((other) => from[other].parents.includes(id) && exists(other)),
      // The marker's history up to this stage; "existed" keeps "not created yet" apart from "emptied".
      marker: HISTORY.slice(0, AUDITS.indexOf(STAGE_AUDIT[stage]) + 1).map(([label, at]) => ({
        label, existed: Boolean(statusFor(run, at, id)), held: run.stages[STAGE_AUDIT[at]].matched_canary_ids.includes(id),
      })),
    };
  }

  // ---- Shapes: documents fold, chunks are torn slips, summaries stack, saved answers speak ----

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
    const icon = svg("svg", {class: `kicon kicon--${kind}`, viewBox: "0 0 20 16", "aria-hidden": "true", focusable: "false"});
    if (kind === "document") icon.append(svg("path", {class: "k-body", d: "M1.5 1.5h10l4.5 4.5v8.5h-14.5z"}), svg("path", {class: "k-fold", d: "M11.5 1.5v4.5h4.5z"}));
    else if (kind === "chunk") icon.append(svg("path", {class: "k-body", d: "M1.5 1.5h15v9l-1.875 2.5-1.875-2.5-1.875 2.5-1.875-2.5-1.875 2.5-1.875-2.5-1.875 2.5-1.875-2.5z"}));
    else if (kind === "summary") icon.append(svg("rect", {class: "k-body", x: 4.5, y: 4.5, width: 14, height: 10, rx: 1.5}), svg("rect", {class: "k-body", x: 1.5, y: 1.5, width: 14, height: 10, rx: 1.5}));
    else icon.append(svg("path", {class: "k-body", d: "M3 1.5h14a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H8l-3.5 3v-3H3a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 3 1.5z"}));
    return icon;
  }

  // Shorten an SVG label with an ellipsis until it fits; unmeasurable (hidden) text is left whole.
  function fitText(node, full, max) {
    node.textContent = full;
    if (typeof node.getComputedTextLength !== "function" || !node.getComputedTextLength()) return;
    let text = full;
    while (text.length > 4 && node.getComputedTextLength() > max) {
      text = text.slice(0, -1);
      node.textContent = `${text.trimEnd()}…`;
    }
  }

  function wrapWords(text, width) {
    const lines = [];
    let line = "";
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      if (line && (line.length + 1 + word.length) > width) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---- The trail: one SVG drawn once per run; stages only change classes, so positions hold ----

  const NODE = {w: 168, h: 66, gapX: 38, gapY: 18};
  const PAD = {left: 10, top: 36, right: 18, bottom: 22};
  const PROBE = {w: 206, h: 156};

  function place(taken, desired, pitch) {
    const free = (y) => y >= 0 && taken.every((t) => Math.abs(t - y) > pitch - 0.5);
    let best = null;
    const consider = (y) => { if (free(y) && (best === null || Math.abs(y - desired) < Math.abs(best - desired) - 0.01)) best = y; };
    consider(desired);
    for (const t of [...taken].sort((a, b) => a - b)) { consider(t + pitch); consider(t - pitch); }
    if (best === null) best = taken.length ? Math.max(...taken) + pitch : 0;
    taken.push(best);
    return best;
  }

  function layoutTrail(ids, from) {
    const pitch = NODE.h + NODE.gapY;
    const taken = [[], [], [], []];
    const pos = {};
    ids.filter((id) => kindOf(id) === "document").forEach((id, row) => { pos[id] = {col: 0, y: row * pitch}; taken[0].push(row * pitch); });
    for (const id of ids) {
      if (pos[id]) continue;
      const col = KINDS[kindOf(id)].column;
      const parents = ((from[id] || {}).parents || []).filter((parent) => pos[parent]);
      const desired = parents.length ? parents.reduce((sum, parent) => sum + pos[parent].y, 0) / parents.length : 0;
      pos[id] = {col, y: place(taken[col], desired, pitch)};
    }
    for (const id of ids) {
      pos[id].x = PAD.left + pos[id].col * (NODE.w + NODE.gapX);
      pos[id].y += PAD.top;
    }
    return pos;
  }

  // A link's curve and the knot at its end come from one calculation, so they always meet. A link
  // within one column leaves and re-enters on the right-hand side; summaries' stacked layers add 6.
  function threadGeometry(a, b, aKind, bKind) {
    const right = (p, kind) => p.x + NODE.w + (kind === "summary" ? 6 : 0);
    const startX = right(a, aKind);
    const y1 = a.y + NODE.h / 2, y2 = b.y + NODE.h / 2;
    if (Math.abs(a.x - b.x) < 1) {
      const endX = right(b, bKind);
      const bulge = Math.max(startX, endX) + Math.min(36, 16 + Math.abs(y2 - y1) / 10);
      return {d: `M${startX} ${y1}C${bulge} ${y1} ${bulge} ${y2} ${endX} ${y2}`, end: {x: endX, y: y2}};
    }
    const dx = Math.max(26, (b.x - startX) / 2);
    return {d: `M${startX} ${y1}C${startX + dx} ${y1} ${b.x - dx} ${y2} ${b.x} ${y2}`, end: {x: b.x, y: y2}};
  }

  function createTrail(frame, options) {
    const opts = {interactive: true, probe: false, onSelect: null, onHover: null, ...options};
    const st = {run: null, legend: null, from: {}, children: {}, ids: [], pos: {}, nodes: new Map(), threads: [],
                present: new Set(), stage: null, selected: null, hover: null, context: [], cited: []};
    let root = null, probeThreads = null, probeLayer = null;

    function lineage(id) {
      const seen = new Set([id]);
      const walk = (start, next) => {
        for (const other of next(start)) if (!seen.has(other) && st.present.has(other)) { seen.add(other); walk(other, next); }
      };
      walk(id, (x) => (st.from[x] || {}).parents || []);
      walk(id, (x) => st.children[x] || []);
      return seen;
    }

    function applyHighlight() {
      if (!root) return;
      const focus = st.hover && st.present.has(st.hover) ? st.hover : st.selected;
      const lit = focus && st.present.has(focus) ? lineage(focus) : null;
      root.classList.toggle("has-focus", Boolean(st.hover && lit));
      for (const [id, node] of st.nodes) {
        node.g.classList.toggle("is-lit", Boolean(lit && lit.has(id)));
        node.g.classList.toggle("is-selected", id === st.selected);
        if (opts.interactive) node.g.setAttribute("aria-pressed", String(id === st.selected));
      }
      for (const thread of st.threads) thread.g.classList.toggle("is-lit", Boolean(lit && lit.has(thread.from) && lit.has(thread.to)));
    }

    function hover(id) {
      st.hover = id;
      applyHighlight();
      if (opts.onHover) opts.onHover(id);
    }

    function select(id) {
      if (!st.nodes.has(id)) return;
      st.selected = id;
      applyHighlight();
      if (opts.onSelect) opts.onSelect(id);
    }

    function build() {
      clear(frame);
      st.nodes = new Map();
      st.threads = [];
      const maxY = Math.max(...st.ids.map((id) => st.pos[id].y));
      const columns = opts.probe ? 5 : 4;
      const width = PAD.left + 4 * (NODE.w + NODE.gapX) - NODE.gapX + (opts.probe ? NODE.gapX + PROBE.w : 6) + PAD.right;
      const height = Math.max(maxY + NODE.h + 9, opts.probe ? PAD.top + 2 * (NODE.h + NODE.gapY) + NODE.h / 2 + PROBE.h / 2 : 0) + PAD.bottom;
      root = el("div", "trail");
      const canvas = svg("svg", {class: "trail-svg", viewBox: `0 0 ${width} ${height}`, width, height,
                                 role: opts.interactive ? "group" : "img", "aria-label": opts.label || "Memory trail"});
      canvas.style.maxWidth = `${Math.round(width * 1.14)}px`;
      const headings = Object.values(KINDS).map((kind) => kind.heading);
      if (opts.probe) headings.push("RECORDED ANSWER");
      headings.slice(0, columns).forEach((heading, col) => {
        canvas.append(svg("text", {class: "tcol", x: PAD.left + col * (NODE.w + NODE.gapX), y: 14, "aria-hidden": "true"}, heading));
      });
      const threadLayer = svg("g", {class: "trail-threads", "aria-hidden": "true"});
      probeThreads = svg("g", {class: "trail-context", "aria-hidden": "true"});
      const nodeLayer = svg("g", {class: "trail-nodes"});
      probeLayer = svg("g", {class: "trail-probe"});
      for (const id of st.ids) {
        const origin = st.from[id];
        if (!origin) continue;
        for (const parent of origin.parents) {
          if (!st.pos[parent]) continue;
          const how = origin.how === "seed design" ? "seed" : origin.how;
          const g = svg("g", {class: `thread thread--${how}`});
          const link = threadGeometry(st.pos[parent], st.pos[id], kindOf(parent), kindOf(id));
          g.append(svg("path", {d: link.d}), svg("circle", {cx: link.end.x, cy: link.end.y, r: 2.4}));
          threadLayer.append(g);
          st.threads.push({g, from: parent, to: id});
        }
      }
      for (const id of st.ids) {
        const node = buildNode(id, kindOf(id));
        node.g.setAttribute("transform", `translate(${st.pos[id].x} ${st.pos[id].y})`);
        if (opts.interactive) {
          node.g.addEventListener("click", () => select(id));
          node.g.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(id); }
          });
          node.g.addEventListener("focus", () => hover(id));
          node.g.addEventListener("blur", () => hover(null));
        }
        node.g.addEventListener("pointerenter", () => hover(id));
        node.g.addEventListener("pointerleave", () => hover(null));
        nodeLayer.append(node.g);
        st.nodes.set(id, node);
      }
      canvas.append(threadLayer, probeThreads, nodeLayer, probeLayer);
      root.append(canvas);
      frame.append(root);
    }

    function buildNode(id, kind) {
      const {w, h} = NODE;
      const g = svg("g", {class: `tnode tnode--${kind}`, "data-id": id});
      if (opts.interactive) {
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        g.setAttribute("aria-pressed", "false");
      }
      const d = shapePath(kind, w, h);
      if (kind === "summary") g.append(svg("path", {class: "tnode__layer", d, transform: "translate(6 6)"}), svg("path", {class: "tnode__layer", d, transform: "translate(3 3)"}));
      g.append(svg("path", {class: "tnode__after", d, transform: "translate(7 -7)"}), svg("path", {class: "tnode__body", d}),
               svg("path", {class: "tnode__outline", d}));
      if (kind === "document") g.append(svg("path", {class: "tnode__fold", d: `M${w - 14} 0V10a4 4 0 0 0 4 4H${w}Z`}));
      g.append(svg("rect", {class: "tnode__rule", x: 0, y: 10, width: 3, height: h - 20, rx: 1.5}),
               svg("text", {class: "tnode__kind", x: 13, y: 19}, KINDS[kind].label.toUpperCase()));
      const chip = svg("g", {class: "tnode__chip"});
      const chipRect = svg("rect", {y: 8, height: 15, rx: 3});
      const chipText = svg("text", {y: 18.5});
      chip.append(chipRect, chipText);
      const sub = svg("text", {class: "tnode__sub", x: 13, y: 56});
      g.append(chip, svg("text", {class: "tnode__id", x: 13, y: 40}, shortId(id)), sub,
               svg("rect", {class: "tnode__ring", x: -5, y: -5, rx: 8, width: w + 10 + (kind === "summary" ? 6 : 0),
                            height: h + 10 + (kind === "summary" ? 6 : kind === "conversation" ? 6 : 0)}));
      return {g, chipRect, chipText, sub};
    }

    function subtitle(id, status) {
      if (status === "withdrawn") return "Emptied · retitled";
      if (status === "purged") return "Emptied · ID kept";
      if (st.legend.documents[id]) return st.legend.documents[id];
      const origin = st.from[id];
      if (!origin) return "";
      return `${origin.parents.length} ${origin.parents.length === 1 ? "parent" : "parents"} · ${origin.how}`;
    }

    function setStage(stage, probe) {
      st.stage = stage;
      st.present = new Set(st.ids.filter((id) => statusFor(st.run, stage, id)));
      st.context = probe ? probe.context : [];
      st.cited = probe ? probe.citations : [];
      for (const [id, node] of st.nodes) {
        const status = statusFor(st.run, stage, id);
        node.g.classList.remove(...STATE_CLASSES);
        if (!status) {
          node.g.classList.add("is-absent");
          node.g.setAttribute("aria-hidden", "true");
          if (opts.interactive) node.g.setAttribute("tabindex", "-1");
          continue;
        }
        node.g.removeAttribute("aria-hidden");
        if (opts.interactive) node.g.setAttribute("tabindex", "0");
        const info = STATUS[status];
        if (info.cls.length) node.g.classList.add(...info.cls);
        if (st.context.includes(id)) node.g.classList.add("is-context");
        if (st.context.includes(id) && probe && !probe.containsMarker) node.g.classList.add("is-context-clean");
        if (st.cited.includes(id)) node.g.classList.add("is-cited");
        if (info.chip) {
          node.g.classList.add("has-chip");
          const chipWidth = 10 + info.chip.length * 5.4;
          const x = NODE.w - 8 - chipWidth;
          node.chipRect.setAttribute("x", x.toFixed(1));
          node.chipRect.setAttribute("width", chipWidth.toFixed(1));
          node.chipText.setAttribute("x", (x + 5).toFixed(1));
          node.chipText.textContent = info.chip;
        }
        node.sub.classList.toggle("tnode__sub--title", Boolean(st.legend.documents[id]) && !info.cls.includes("is-removed"));
        fitText(node.sub, subtitle(id, status), NODE.w - 21);
        const title = st.legend.documents[id] ? `, ${st.legend.documents[id]}` : "";
        const context = st.context.includes(id) ? (st.cited.includes(id) ? " Supplied to the recorded answer and cited." : " Supplied to the recorded answer, not cited.") : "";
        node.g.setAttribute("aria-label", `${id}, ${KINDS[kindOf(id)].label.toLowerCase()}${title}. ${info.label}.${context}`);
      }
      for (const thread of st.threads) {
        const absent = !st.present.has(thread.from) || !st.present.has(thread.to);
        const faded = ["withdrawn", "purged"].includes(statusFor(st.run, stage, thread.from)) || ["withdrawn", "purged"].includes(statusFor(st.run, stage, thread.to));
        thread.g.classList.toggle("is-absent", absent);
        thread.g.classList.toggle("is-faded", !absent && faded);
      }
      drawProbe(probe);
      if (st.selected && !st.present.has(st.selected)) st.selected = null;
      if (st.hover && !st.present.has(st.hover)) st.hover = null;
      applyHighlight();
    }

    function drawProbe(probe) {
      if (!probeLayer) return;
      clear(probeThreads);
      clear(probeLayer);
      if (!opts.probe || !probe) return;
      const x = PAD.left + 4 * (NODE.w + NODE.gapX);
      const centre = PAD.top + 2 * (NODE.h + NODE.gapY) + NODE.h / 2;
      const y = centre - PROBE.h / 2;
      const present = probe.context.filter((id) => st.present.has(id) && st.pos[id]);
      present.forEach((id, index) => {
        const a = st.pos[id];
        const endY = centre + (index - (present.length - 1) / 2) * 9;
        const startX = a.x + NODE.w + (kindOf(id) === "summary" ? 6 : 0);
        const dx = Math.max(30, (x - 10 - startX) / 2);
        const g = svg("g", {class: `thread thread--context${probe.containsMarker ? "" : " is-clean"}${probe.citations.includes(id) ? "" : " is-uncited"}`});
        g.append(svg("path", {d: `M${startX} ${a.y + NODE.h / 2}C${startX + dx} ${a.y + NODE.h / 2} ${x - 10 - dx} ${endY} ${x - 10} ${endY}`}),
                 svg("circle", {cx: x - 10, cy: endY, r: 2.2}));
        probeThreads.append(g);
      });
      const {w, h} = PROBE;
      const g = svg("g", {class: "tprobe", transform: `translate(${x} ${y})`, role: "img",
                          "aria-label": `Recorded answer. Question: ${probe.question} Answer: ${probe.answer} ${probe.containsMarker ? "The answer reveals the marker." : "The answer does not contain the marker."}`});
      const body = `M8 0H${w - 8}a8 8 0 0 1 8 8V${h - 8}a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V${h / 2 + 7}L-9 ${h / 2}L0 ${h / 2 - 7}V8a8 8 0 0 1 8-8Z`;
      g.append(svg("path", {class: "tprobe__after", d: body, transform: "translate(6 -6)"}), svg("path", {class: "tprobe__body", d: body}),
               svg("text", {class: "tprobe__label", x: 14, y: 20}, probe.label.toUpperCase()));
      wrapWords(`“${probe.question}”`, 31).slice(0, 2).forEach((line, index) => {
        g.append(svg("text", {class: "tprobe__q", x: 14, y: 41 + index * 15}, line));
      });
      const answer = svg("text", {class: "tprobe__a", x: 14, y: 84});
      wrapWords(probe.answer, 25).slice(0, 3).forEach((line, index) => {
        const tspan = svg("tspan", {x: 14, dy: index ? 17 : 0});
        String(line).split(/(MOTH-[A-F0-9]{12})/).forEach((part) => {
          if (!part) return;
          tspan.append(/^MOTH-/.test(part) ? svg("tspan", {class: "tprobe__mark"}, part) : document.createTextNode(part));
        });
        answer.append(tspan);
      });
      const verdictText = probe.containsMarker ? "◆ MARKER REVEALED" : "✓ NO MARKER";
      const verdict = svg("g", {class: `tprobe__verdict tprobe__verdict--${probe.containsMarker ? "leak" : "clean"}`});
      verdict.append(svg("rect", {x: 14, y: h - 30, width: 12 + verdictText.length * 5.4, height: 17, rx: 3}),
                     svg("text", {x: 20, y: h - 18.5}, verdictText));
      g.append(answer, verdict);
      probeLayer.append(g);
    }

    function setRun(run, legend) {
      st.run = run;
      st.legend = legend;
      st.from = origins(run, legend);
      st.children = {};
      for (const [id, origin] of Object.entries(st.from)) for (const parent of origin.parents) (st.children[parent] = st.children[parent] || []).push(id);
      st.ids = trailIds(run);
      st.pos = layoutTrail(st.ids, st.from);
      st.selected = null;
      st.hover = null;
      build();
    }

    return {setRun, setStage, select, get selected() { return st.selected; }};
  }

  // ---- The accessible list view of the same trail ----

  function renderTrailList(container, run, legend, stage, view) {
    const from = origins(run, legend);
    const ids = trailIds(run);
    clear(container);
    for (const [kind, info] of Object.entries(KINDS)) {
      const members = ids.filter((id) => kindOf(id) === kind && statusFor(run, stage, id));
      if (!members.length) continue;
      const group = el("section", "tlist__group");
      group.append(el("h3", null, info.group));
      const items = el("ul", "tlist__items");
      for (const id of members) {
        const status = statusFor(run, stage, id);
        const context = view.context.includes(id) ? ` is-context${view.clean ? " is-context-clean" : ""}` : "";
        const item = el("li", `tlist__item ${STATUS[status].cls.join(" ")}${context}`);
        const button = el("button", "tlist__btn");
        button.type = "button";
        button.setAttribute("data-id", id);
        button.setAttribute("aria-pressed", String(id === view.selected));
        const chip = STATUS[status].chip ? el("span", `chip ${chipClass(status)}`, STATUS[status].chip) : el("span", "chip", "Active");
        const origin = from[id];
        const parts = [legend.documents[id] || KINDS[kind].label, STATUS[status].label];
        if (origin && origin.parents.length) parts.push(`from ${origin.parents.map(shortId).join(", ")} (${origin.how})`);
        if (view.context.includes(id)) parts.push(view.cited.includes(id) ? "supplied to the recorded answer and cited" : "supplied to the recorded answer, not cited");
        button.append(kindIcon(kind), el("span", "tlist__id", shortId(id)), chip, el("span", "tlist__meta", parts.join(" · ")));
        button.addEventListener("click", () => { if (view.onSelect) view.onSelect(id); });
        item.append(button);
        items.append(item);
      }
      group.append(items);
      container.append(group);
    }
  }

  function chipClass(status) {
    return {marker: "chip--marker", stale: "chip--stale", "stale-marker": "chip--stale", withdrawn: "chip--removed",
            purged: "chip--purged", rebuilt: "chip--rebuilt"}[status] || "";
  }

  function renderLegend(list, withProbe) {
    clear(list);
    const group = (title) => {
      const item = el("li", "trail-legend__group");
      item.append(el("span", "trail-legend__title", title));
      list.append(item);
      return item;
    };
    const add = (into, node, text) => { const key = el("span", "trail-legend__key"); key.append(node, document.createTextNode(text)); into.append(key); };
    const shapes = group("Artifacts");
    for (const [kind, info] of Object.entries(KINDS)) add(shapes, kindIcon(kind), info.label);
    if (withProbe) { const probe = kindIcon("conversation"); probe.classList.add("kicon--probe"); add(shapes, probe, "Recorded answer"); }
    const states = group("States");
    add(states, el("span", "chip chip--marker", "◆"), "Holds the marker");
    add(states, el("span", "chip chip--stale", "Stale"), "Depends on a withdrawn source");
    add(states, el("span", "chip chip--removed", "Tombstone"), "Content emptied, ID kept");
    add(states, el("span", "chip chip--rebuilt", "↻"), "Rebuilt");
    const links = group("Links");
    add(links, el("span", "line-key"), "Recorded");
    add(links, el("span", "line-key line-key--seed"), "Seed design");
    add(links, el("span", "line-key line-key--inferred"), "Inferred");
    if (withProbe) add(links, el("span", "line-key line-key--context"), "Given to the answer (dotted: not cited)");
  }

  // ---- Recorded model-call timings ----

  const SHORT_RUN = {cold: ["Cold start", "Oct 28 · first run after starting Ollama"],
                     warm: ["Warm", "Oct 28 · straight afterwards"],
                     oct27: ["October 27", "First recorded live run"]};

  function modelCalls(run) {
    return run.events.filter((event) => "duration_ms" in event);
  }

  function callLabel(event) {
    if (event.name === "summary.generated") {
      return event.artifact_id.startsWith("s-rebuilt") ? `Rebuild ${event.artifact_id}` : `Summarize into ${event.artifact_id}`;
    }
    if (event.answer_key === "seeded_conversation") return "Seeding answer (saved to memory)";
    return `Answer · ${ANSWER_LABELS[event.answer_key] || event.answer_key}`;
  }

  const TIP = 84;

  // The tooltip's place in the chart box's own coordinates (the box is its containing block): above
  // and to the right of the pointer, below it near the top, and inside both edges at any width.
  function tipPlacement(pointer, box, tip) {
    const gap = 8;
    const x = pointer.x - box.left, y = pointer.y - box.top;
    const above = y - tip.height - 12;
    return {left: Math.max(gap, Math.min(x + 14, box.width - tip.width - gap)), top: above >= gap ? above : y + 20};
  }

  function niceStep(max) {
    for (const step of [5000, 10000, 20000, 30000, 60000]) if (max / step <= 7) return step;
    return 120000;
  }

  function renderTiming(container, runs) {
    clear(container);
    const box = el("div", "timing");
    const max = Math.max(...runs.map((run) => run.model_call_total_ms));
    const legendList = el("ul", "timing__legend");
    const first = el("li"); first.append(el("span", "swatch swatch--first"), document.createTextNode("First model call (the summary that creates s-vault)"));
    const rest = el("li"); rest.append(el("span", "swatch"), document.createTextNode("Every later call, in recorded order"));
    legendList.append(first, rest);
    box.append(legendList);
    const tip = el("div", "timing__tip");
    tip.hidden = true;
    tip.setAttribute("aria-hidden", "true");
    const showTip = (event, value, label) => {
      clear(tip).append(el("strong", null, value), document.createTextNode(label));
      tip.hidden = false;
      // Absolute offsets start at the box's padding edge, inside its border (clientLeft, clientTop).
      const frame = box.getBoundingClientRect();
      const at = tipPlacement({x: event.clientX, y: event.clientY},
                              {left: frame.left + box.clientLeft, top: frame.top + box.clientTop, width: box.clientWidth},
                              {width: tip.offsetWidth, height: tip.offsetHeight});
      tip.style.left = `${Math.round(at.left)}px`;
      tip.style.top = `${Math.round(at.top)}px`;
    };
    const rows = el("div", "timing__rows");
    for (const run of runs) {
      const calls = modelCalls(run);
      const [name, detail] = SHORT_RUN[run.id] || [run.label, ""];
      const row = el("div", "timing__row");
      row.tabIndex = 0;
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", `${name}: ${calls.length} model calls, ${ms(run.model_call_total_ms)} in total; the first call took ${ms(calls[0].duration_ms)}.`);
      const label = el("div", "timing__label");
      label.append(el("strong", null, name), el("span", null, detail));
      const lane = el("div", "timing__lane");
      const bar = el("div", "timing__bar");
      // The space after the longest bar is kept for its value label, so every value sits at its bar's tip.
      bar.style.width = `calc((100% - ${TIP}px) * ${(run.model_call_total_ms / max).toFixed(4)})`;
      calls.forEach((call, index) => {
        const segment = el("span", "timing__seg");
        segment.style.flex = `${call.duration_ms} 1 0`;
        const text = ` ${callLabel(call)} · call ${index + 1} of ${calls.length} · ${name.toLowerCase()}`;
        segment.addEventListener("pointermove", (event) => showTip(event, ms(call.duration_ms), text));
        segment.addEventListener("pointerleave", () => { tip.hidden = true; });
        bar.append(segment);
      });
      lane.append(bar, el("span", "timing__total", ms(run.model_call_total_ms)));
      row.append(label, lane);
      rows.append(row);
    }
    box.append(rows);
    const axisRow = el("div", "timing__axisrow");
    const axis = el("div", "timing__axis");
    axis.setAttribute("aria-hidden", "true");
    const step = niceStep(max);
    for (let t = 0; t <= max; t += step) {
      const tick = el("span", "timing__tick", `${t / 1000} s`);
      tick.style.left = `calc((100% - ${TIP}px) * ${(t / max).toFixed(4)})`;
      axis.append(tick);
    }
    axisRow.append(el("span"), axis);
    box.append(axisRow, tip);
    box.append(el("p", "timing__note", "Summed model-call time adds up the per-call durations recorded in each report. It is not the run's wall-clock time. Hover a segment for one call; the table lists them all."));
    const details = el("details", "disclosure");
    const summary = el("summary");
    const summaryLabel = el("span", null, `All ${modelCalls(runs[0]).length} model calls, in recorded order`);
    summaryLabel.append(el("small", null, "The table behind the chart"));
    summary.append(summaryLabel);
    const wrap = el("div", "disclosure__body table-wrap");
    const table = el("table", "table");
    const head = el("tr");
    head.append(el("th", "num", "#"), el("th", null, "Model call"));
    for (const run of runs) head.append(el("th", "num", (SHORT_RUN[run.id] || [run.label])[0]));
    if (runs.length === 2) head.append(el("th", "num", "Difference"));
    const thead = el("thead"); thead.append(head);
    const tbody = el("tbody");
    modelCalls(runs[0]).forEach((call, index) => {
      const tr = el("tr");
      tr.append(el("td", "num", index + 1), el("td", null, callLabel(call)));
      const values = runs.map((run) => (modelCalls(run)[index] || {}).duration_ms);
      for (const value of values) tr.append(el("td", "num", value === undefined ? "—" : ms(value)));
      if (runs.length === 2 && values.every((value) => value !== undefined)) tr.append(el("td", "num", ms(values[0] - values[1])));
      tbody.append(tr);
    });
    const total = el("tr");
    total.append(el("td"), el("td", null, "Total"));
    for (const run of runs) total.append(el("td", "num", ms(run.model_call_total_ms)));
    if (runs.length === 2) total.append(el("td", "num", ms(runs[0].model_call_total_ms - runs[1].model_call_total_ms)));
    tbody.append(total);
    table.append(thead, tbody);
    wrap.append(table);
    details.append(summary, wrap);
    box.append(details);
    container.append(box);
  }

  // ---- Copyable commands with visible confirmation ----

  function initCopyButtons() {
    for (const button of document.querySelectorAll("[data-copy-target]")) {
      const target = document.getElementById(button.getAttribute("data-copy-target"));
      const status = el("span", "visually-hidden");
      status.setAttribute("role", "status");
      button.after(status);
      let timer = null;
      const done = (label, message) => {
        button.textContent = label;
        button.classList.toggle("is-copied", label === "Copied ✓");
        status.textContent = message;
        clearTimeout(timer);
        timer = setTimeout(() => { button.textContent = "Copy"; button.classList.remove("is-copied"); status.textContent = ""; }, 2200);
      };
      const selectText = () => {
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        done("Selected", "Command selected. Press Command-C or Control-C to copy.");
      };
      button.addEventListener("click", () => {
        if (!target) return;
        const text = target.textContent.replace(/\s+$/, "");
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(() => done("Copied ✓", "Command copied to the clipboard."), selectText);
        } else {
          selectText();
        }
      });
    }
  }

  onReady(initCopyButtons);

  window.GC = {el, svg, clear, onReady, ms, shortId, joinList, markText, loadEvidence, KINDS, kindOf, origins, trailIds,
               statusFor, STATUS, ANSWER_LABELS, describe, kindIcon, createTrail, renderTrailList, renderLegend, chipClass,
               renderTiming, tipPlacement, modelCalls, callLabel, SHORT_RUN};
})();
