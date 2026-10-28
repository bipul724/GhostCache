# Narrow-screen overflow fix (T-E7) — before and after

Captured on October 28, 2026 by the documentation and fix pass. Every file here is **local**: `site/` was served with `python3.12 -m http.server --bind 127.0.0.1 --directory site` and loaded in headless Chrome through the Chrome DevTools Protocol. None of these images shows the deployed Render site; the deployed check is recorded separately once the fix is pushed (DEPLOYMENT.md, T-E7). *That deployed evidence (commit `2a1ffb0`) is now in [deployed-2a1ffb0/](deployed-2a1ffb0/README.md), with its own manifest; this folder's files and manifest are unchanged.*

- **Before:** `site/style.css` as committed in `3cc0814` (SHA-256 `86b48762…100b0927`).
- **After:** `site/style.css` with the two-rule fix described in [TESTING.md](../../TESTING.md), "Narrow-screen overflow fix T-E7".

Widths of 414 px and below were emulated as a mobile device (`Emulation.setDeviceMetricsOverride`, `mobile: true`); 768 px and wider as a desktop window. This is device emulation, not a real phone. File names give the emulated viewport in CSS pixels (width × height).

**The dashed red line** in the explainers and questions captures was added by the test harness only for the screenshot. It marks the right edge of the viewport (`document.documentElement.clientWidth`). Content to the right of it overflowed the page. The captures span the document's full `scrollWidth`, so a "before" image is wider than its viewport.

| File | Viewport | Shows |
| --- | --- | --- |
| [before-local-320x720-explainers.png](before-local-320x720-explainers.png) | 320 × 720, mobile | Explainer text and command block running past the viewport edge (`scrollWidth` 573 px) |
| [after-local-320x720-explainers.png](after-local-320x720-explainers.png) | 320 × 720, mobile | Text wraps inside the viewport; the command block is clipped at its own border and scrolls inside itself |
| [before-local-375x812-explainers.png](before-local-375x812-explainers.png) | 375 × 812, mobile | As above, `scrollWidth` 573 px |
| [after-local-375x812-explainers.png](after-local-375x812-explainers.png) | 375 × 812, mobile | No overflow (`scrollWidth` 375 px) |
| [before-local-414x896-explainers.png](before-local-414x896-explainers.png) | 414 × 896, mobile | As above, `scrollWidth` 573 px |
| [after-local-414x896-explainers.png](after-local-414x896-explainers.png) | 414 × 896, mobile | No overflow (`scrollWidth` 414 px) |
| [before-local-320x720-questions.png](before-local-320x720-questions.png) | 320 × 720, mobile | Second, smaller overflow at 320 px: the answer card's label "After source-only deletion · reworded question" does not wrap and runs past its card |
| [after-local-320x720-questions.png](after-local-320x720-questions.png) | 320 × 720, mobile | The label wraps onto two lines inside the card; the selected question button stays highlighted |
| [after-local-375x812-fullpage.png](after-local-375x812-fullpage.png) | 375 × 812, mobile, full page at 1× scale | The whole page after the fix: banner, run, stage and question selectors, memory cards, timing table and explainers |
| [before-local-768x1024-explainers.png](before-local-768x1024-explainers.png), [after-local-768x1024-explainers.png](after-local-768x1024-explainers.png) | 768 × 1024, desktop | Byte-identical before and after: no overflow and no change |
| [before-local-1280x900-explainers.png](before-local-1280x900-explainers.png), [after-local-1280x900-explainers.png](after-local-1280x900-explainers.png) | 1280 × 900, desktop | Byte-identical before and after: the three-column desktop layout is unchanged |

[before-local-measurements.json](before-local-measurements.json) and [after-local-measurements.json](after-local-measurements.json) hold the raw geometry for all ten tested viewports: `clientWidth`, `scrollWidth`, the elements extending past the viewport, the explainer widths, the command block's and timing table's own scroll widths, the selector and banner checks, and console messages. The only console message in either run is the browser's `/favicon.ico` 404 on the first page load (T-E8).

Hashes are in [SHA256SUMS.txt](SHA256SUMS.txt). From the repository root: `(cd screenshots/mobile-overflow-fix && shasum -a 256 -c SHA256SUMS.txt)`. The parent folder's `screenshots/SHA256SUMS.txt` covers only the original 16 deployment screenshots and was not changed.
