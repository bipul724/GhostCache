"use strict";
// Home page: a replay control for the explanatory drawing, and a preview of one recorded
// trail from data/evidence.json (loaded by site.js). Switching moments only changes the view.

(function () {
  const GC = window.GC;
  const {el, clear, shortId} = GC;

  const MOMENTS = {
    setup: (r) => `Seeded: ${r.stages.initial_audit.total_artifacts} artifacts from five fictional documents; the ${r.stages.initial_audit.matched_canary} marked ◆ hold the marker.`,
    source_only: (r) => `Source deleted: ${r.source_id} is a tombstone, yet ${GC.joinList(r.stages.source_only_audit.stale_ids.map(shortId))} stay active, stale and still holding the marker.`,
    cleanup: (r) => {
      const rebuilt = r.stages.cleaned_audit.active_ids.filter((id) => !r.stages.initial_audit.active_ids.includes(id));
      return `Cleaned up: the source and its ${r.stages.cleaned_audit.invalidated_artifacts} descendants are content-free tombstones; ${GC.joinList(rebuilt)} was rebuilt from surviving documents. ${r.stages.cleaned_audit.matched_canary} hold the marker.`;
    },
  };

  function initReplay() {
    const button = document.getElementById("afterimage-replay");
    if (!button) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    button.hidden = false;
    button.addEventListener("click", () => {
      const drawing = document.getElementById("afterimage");
      drawing.replaceWith(drawing.cloneNode(true));
    });
  }

  function initPreview(data) {
    const run = data.runs.find((r) => r.id === "cold") || data.runs[0];
    const frame = document.getElementById("preview-trail");
    const trail = GC.createTrail(frame, {interactive: false, probe: false, label: "Recorded memory trail"});
    trail.setRun(run, data.seed_legend);
    const buttons = [...document.querySelectorAll("#preview-moments button")];
    const caption = document.getElementById("preview-caption");
    const show = (key) => {
      trail.setStage(key, null);
      for (const button of buttons) button.setAttribute("aria-pressed", String(button.getAttribute("data-moment") === key));
      const text = MOMENTS[key](run);
      clear(caption).append(el("b", null, "Fig. 1"), document.createTextNode(`Recorded, ${run.label}. ${text}`));
      const drawing = frame.querySelector("svg");
      if (drawing) drawing.setAttribute("aria-label", `Recorded memory trail. ${text}`);
    };
    for (const button of buttons) button.addEventListener("click", () => show(button.getAttribute("data-moment")));
    show("source_only");
    document.getElementById("preview-tag").textContent = `Recorded · ${run.model}`;

    const s = run.stages;
    const perfect = data.runs.filter((r) => r.passed && r.checks.every((c) => c.passed)).length;
    const figures = clear(document.getElementById("preview-figures"));
    for (const [value, label] of [
      [s.initial_audit.matched_canary, "stored items held the marker once memory was seeded"],
      [s.source_only_audit.matched_canary, "still held it after only the source was deleted"],
      [s.cleaned_audit.matched_canary, "held it after provenance cleanup"],
      [`${perfect}/${data.runs.length}`, `recorded live runs passed every check (${run.checks.length} per run)`],
    ]) {
      const item = el("div");
      item.append(el("dt", null, label), el("dd", null, value));
      figures.append(item);
    }
  }

  function fail() {
    clear(document.getElementById("preview-trail")).append(el("p", "trail-frame__status", "The recorded evidence could not be loaded, so the trail preview is unavailable. The saved reports are in the repository."));
    for (const button of document.querySelectorAll("#preview-moments button")) button.disabled = true;
  }

  GC.onReady(() => {
    initReplay();
    GC.loadEvidence().then(initPreview, fail);
  });
})();
