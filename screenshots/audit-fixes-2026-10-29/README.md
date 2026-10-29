# Audit fixes — October 29, 2026

Evidence for the fixes made after the October 29 GhostCache audit. Everything here was run **locally**, except the read-only public checks listed under "Public site". It is not a deployment of the changes, a hosted CI result or a live Gemma result. Existing evidence folders, `results/`, `site/data/evidence.json` and `.local/assistant.sqlite` were not changed.

## A4: a failed mode switch

**Defect.** In fixture mode, choosing Live sends `POST /api/reset {"mode": "live"}`. When that failed with HTTP 502, the server kept the fixture experiment and the banner still said fixture. But the menu and the page's internal `selectedMode` stayed on Live, so the next **Reset** requested live again. A second instance: after a 503 whose state read-back also failed, the menu showed fixture while `selectedMode` stayed live.

**Fix.** In `perform()` (`web/app.js`), after the existing error recovery, a failed seed or reset sets `selectedMode = currentMode()` and redraws the menu (`renderProvider()`). The original error, the unchanged experiment's answer and checks, 503 `storage_failed` recovery, unknown-state handling and failed-cleanup reconciliation are unchanged. Nothing is retried.

### Offline regression ([regression-proof.json](regression-proof.json))

The contract harness now keeps event listeners, so the new cases fire the page's real `mode-select` change handler. Each case was run with Node v22.23.4 against three copies of `web/app.js`, identified by SHA-256:

| `web/app.js` | `failed_mode_switch_keeps_the_confirmed_mode` | `successful_mode_switch` |
| --- | --- | --- |
| Pre-fix (`9e657ca8…`): the working tree before this fix, including the uncommitted T-A7 change | **FAIL**: menu and `selectedMode` `live` under a fixture banner | pass |
| 502-only variant (`1da9eba2…`, scratch only) | **FAIL** at the unknown-state step: menu `fixture`, `selectedMode` `live` | pass |
| Fixed (`fe26a085…`) | pass | pass |

`GHOSTCACHE_APP_JS=<pre-fix copy> python3.12 -B -m unittest tests.test_ui`: 24 tests, exactly 1 failure (the new case). The existing `storage_failed_state` and `failed_reconciliation_keeps_the_original_error` cases pass on all three.

### Real browser, mocked responses ([lab-mode-switch.json](lab-mode-switch.json), [lab-mode-switch-pre-fix.json](lab-mode-switch-pre-fix.json))

Headless Chrome 156.0.8078.73 ran against the real lab server in fixture mode on `127.0.0.1:8891`, with a new scratch database outside the repository. **Mocked by request interception:**
- Live availability. Ollama was not running, so every real state was rewritten to say Live is available. This is why the captures read "Live Gemma is ready".
- Every `mode: "live"` reset response: 502, 503 or a 200 live-looking state.
- The 503 read-backs: a network failure, and a `storage_failed` state.

Fixture resets, questions and verification went to the real server. **No live request reached the server, and no model was called.** The lab server's own log shows 6 `POST /api/reset`, all 200 (fixture); with Ollama down, a live reset would have returned 502. The menu change was made by script (`value` plus a `change` event), because the arrow key did not change the closed `<select>` in headless Chrome. The Reset clicks were real pointer events.

| Scenario (fixed `web/app.js`) | Menu / `selectedMode` / banner after the failure | Next Reset sent |
| --- | --- | --- |
| A. Live chosen, reset 502 | fixture / fixture / fixture; error shown; answer and checks kept | `fixture` |
| B. Live chosen, reset 503, state read fails | fixture / fixture / fixture; "could not reload the server's state" | `fixture` |
| C. Live chosen, reset 503, state `storage_failed` | fixture / fixture / fixture; storage notice shown | `fixture`; notice cleared |
| D. Live chosen, mocked success; then back to fixture | live / live / live, then fixture / fixture / fixture | `live` |

The same run with the pre-fix file served as `/app.js` reproduced the defect:
- **A:** menu and `selectedMode` `live` under a fixture banner. The next Reset asked for `live`; the test blocked that request, as it would have reached the server.
- **B:** menu `fixture`, `selectedMode` `live`.
- **C:** already correct.

Console errors in the fixed run are only the four network errors from the deliberately failed requests; there were no page errors.

| Capture | Shows | Viewport (client = scroll width) |
| --- | --- | --- |
| [01-lab-failed-switch-502-1280.png](01-lab-failed-switch-502-1280.png) | Scenario A after the failure: fixture menu and banner, the 502 message | 1280 × 900 (1265) |
| [02-lab-failed-switch-502-375.png](02-lab-failed-switch-502-375.png) | The same at a narrow width | 375 × 1000 (360) |
| [03-lab-failed-switch-unknown-state-1280.png](03-lab-failed-switch-unknown-state-1280.png) | Scenario B: the unknown-state message, fixture menu | 1280 × 900 (1265) |
| [04-lab-failed-switch-storage-failed-1280.png](04-lab-failed-switch-storage-failed-1280.png) | Scenario C: the storage notice, fixture menu | 1280 × 900 (1265) |

## Public content changed by the audit fixes, checked locally ([site-layout.json](site-layout.json))

A local static preview of the working-tree `site/` was served on `127.0.0.1:8892` with the `render.yaml` headers. In the same Chrome, with normal classic scrollbars, the four pages were loaded at widths 320, 360, 375, 390, 414, 768, 980, 981 and 1280 px, height 812:
- `method.html` was also measured with `#project-evidence` in view;
- `run.html` was also measured with every disclosure open;
- `scrollWidth <= clientWidth` held in all 54 measurements, with `clientWidth` 15 px below each width because of the scrollbar;
- there were no console, CSP or page errors, and no request outside the site's own files.

The rendered text was checked for:
- the 126-test figure;
- run #16 with its "no hosted test count" limit and links;
- the model-call (`chat`) span wording and the mode-switch recovery;
- on `run.html`, the absence of "nothing to install" and the Python-required wording;
- the 23-of-24 and 27 Node counts and the no-retry sentence.

These are local captures of undeployed content, not the public site.

| Capture | Viewport (client = scroll width) |
| --- | --- |
| [05-method-project-evidence-1280.png](05-method-project-evidence-1280.png), [05-method-project-evidence-375.png](05-method-project-evidence-375.png) | 1280 (1265), 375 (360) × 812 |
| [06-run-requirements-375.png](06-run-requirements-375.png) | 375 (360) × 812 |
| [07-run-troubleshooting-375.png](07-run-troubleshooting-375.png) (the model-error disclosure open) | 375 (360) × 812 |

## Public site (read-only)

- [public-served-files.json](public-served-files.json), 16:33 UTC: Python `urllib` GETs with normal TLS validation and no DNS override, on both `https://ghostcache.bipulchamoli.tech/` and `https://ghostcache-walkthrough.onrender.com/`.
  - All 11 site files returned 200 and are byte-identical to `site/` at committed `f66977d`.
  - The working tree's four HTML pages and `method.js` differ, because the refresh is not deployed.
  - `style.css` (55,445 bytes) is **not** the T-E7 file from `2a1ffb0`.
  - `/favicon.svg` returned 200; the exact `/api/state` and a direct `/favicon.ico` returned 404; the four security headers were present.
  - Matching bytes do not identify the commit Render built.
- [public-favicon.json](public-favicon.json), headless Chrome, read-only:
  - **Control:** a local page with no icon link on `127.0.0.1:8893`. Chrome requested `/favicon.ico` and got a 404, seen both in Chrome's network events and in the control server's log. This shows the method detects icon requests.
  - **Public pages:** the public home page requested `favicon.svg` (200). None of the four public pages requested `/favicon.ico`, and none logged a console error. The other three pages reused the cached icon.
- The [Verify a deployment](../../DEPLOYMENT.md#verify-a-deployment) checklist was run in zsh and bash against `HEAD`: 22 of 22 "200 match". It is not saved separately.

## Not checked

- Live Gemma, Sentry telemetry and a hosted CI run of these changes.
- A physical phone, a second browser engine, and a screen reader or other accessibility tool (T-E6).
- The public site after deployment of this content (T-E9).
- Real keyboard selection in the mode menu (see above).

## Checksums

The manifest covers the eight PNGs and six JSON files, excluding this README. From the repository root:

```sh
(cd screenshots/audit-fixes-2026-10-29 && shasum -a 256 -c SHA256SUMS.txt)
```
