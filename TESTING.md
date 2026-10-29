# Testing GhostCache

This file covers what to run, what each result shows, what has actually been verified, and what has not.

## Interpreter and setup

- **Python ≥3.12.** The verified interpreter is **Python 3.12.6** at `/Library/Frameworks/Python.framework/Versions/3.12/bin/python3.12`, which is also `python3.12` on this Mac's PATH.
- The default `python3` here is **3.15.0**, which is **untested**. Use `python3.12`.
- No packages are needed for the core suite. The 6 SDK-dependent tests in `tests/test_telemetry.py` need the optional `sentry-sdk==2.72.0`, installed only into a virtualenv: `python3.12 -m venv .venv && .venv/bin/python -m pip install "sentry-sdk==2.72.0"`. Without it they are **skipped** with the reason "sentry-sdk not installed; optional extra".
- Run every command from the application directory (the one containing `pyproject.toml`). The tests import `ghostcache` from the current directory.
- Live evaluation also needs Ollama running locally, with `gemma4:e2b-it-qat` (or your `--model`) pulled.
- **Node.js is optional.** 23 of the 24 UI tests in `tests/test_ui.py` call `node`; the twenty-fourth, `test_paraphrase_fallback_matches_backend_question`, is pure Python. Four tests in `tests/test_site.py` need it too: the script syntax test and the three `site/site.js` behaviour cases. If `node` is not on PATH, those 27 tests are **skipped** with the reason "Node.js is not on PATH"; without both Node and the optional `sentry-sdk`, 33 tests skip. Measured on October 29, 2026 after the audit fixes, with every directory containing `node` removed from PATH: `Ran 126 tests … OK (skipped=33)` (23 `web/app.js` contract, 3 `site.js` behaviour, 1 syntax and 6 SDK skips). *(After the UI content refresh the figures were 21 of 22, 25 and 31, counted from the registered tests.)* *Historical:* on October 29, 2026, before the rebuild-outcome and reconciliation tests, the suite was run with `node` removed from PATH: `Ran 107 tests … OK (skipped=24)` (18 Node plus 6 SDK). Verified with Node v22.23.4; no npm packages are used. *(Until October 29, 2026: six of seven UI tests.)*

## Commands

```sh
# 1. Unit, controller, HTTP-handler and UI contract tests (offline, no model)
python3.12 -m unittest discover -s tests -v

# Run a single test
python3.12 -m unittest tests.test_store.StoreTests.test_multi_hop_purge_erases_every_descendant_and_keeps_edges

# 2. Fixture end-to-end evaluation (offline, deterministic logic, fresh marker)
python3.12 -m ghostcache evaluate --mode fixture --output results/fixture-new-run.json

# 3. Live end-to-end evaluation (local Gemma; a few minutes on first load)
python3.12 -m ghostcache evaluate --mode live --model gemma4:e2b-it-qat --output results/live-gemma-new-run.json

# 4. JavaScript syntax only (optional, needs Node)
node --check web/app.js && node --check tests/ui/app_contract.js

# 5. One UI contract or public-site behaviour case directly (optional, needs Node); exits 0 or prints FAIL and exits 1
node tests/ui/app_contract.js context_from_parent_ids
node tests/ui/site_contract.js inspector_relationships_follow_the_stage

# 6. Every test, including the 6 telemetry tests that need the optional sentry-sdk
.venv/bin/python -m unittest discover -s tests -v

# 7. Public walkthrough data is up to date with the selected reports (exit 1 if not)
python3.12 scripts/export_site_data.py --check

# 8. Preview the public walkthrough on a free port (static files only)
python3.12 -m http.server 8790 --bind 127.0.0.1 --directory site

# 9. The rebuild-outcome regression tests (simulated failures; no model)
python3.12 -B -m unittest tests.test_app.RebuildOutcomeTests tests.test_http.HTTPTests.test_unresolved_rebuild_failure_survives_requests_and_reloads -v
node tests/ui/app_contract.js rebuild_failure_survives_reload             # add a path to an older web/app.js to compare

# 10. Every UI test against another copy of web/app.js (for before/after comparisons)
GHOSTCACHE_APP_JS=<path to an older web/app.js> python3.12 -B -m unittest tests.test_ui
```

Add `-B` (as in `python3.12 -B -m …`) if you do not want `__pycache__` folders written. They are git-ignored either way.

## CI evidence update (October 30, 2026)

**Local; uncommitted and not deployed.** The methodology page's `#project-evidence` GitHub Actions entry now reports both archived hosted reports. Run #16 on `f66977d` and run #17 on `00cfb10` each succeeded on every step, and each fixture report matches GitHub's artifact digest and passed 10/10. The entry says run #17 tested `00cfb10`, which contains the October 29 refresh and the failed-mode-switch fix, but not this later edit. The hosted test count stays unverified. The local-suite lines on `method.html` and `run.html` are redated to October 30. `tests/test_site.py` now also requires both CI evidence-folder links; against the pre-change page it fails on the run #17 link. Evidence: [ci-evidence-update-2026-10-30/](screenshots/ci-evidence-update-2026-10-30/README.md).

| Check actually run | Result |
| --- | --- |
| `.venv/bin/python -B -m unittest discover -s tests -v` (Python 3.12.6, `sentry-sdk` 2.72.0, Node v22.23.4, no DSN) | `Ran 126 tests` … `OK`; store 11, controller 33, HTTP 10, providers/CLI 12, UI 24, telemetry 9, site 27 |
| `python3.12 -B -m unittest discover -s tests -v` | `Ran 126 tests` … `OK (skipped=6)`, the SDK telemetry tests |
| `env -u GHOSTCACHE_SENTRY_DSN python3.12 -B -m ghostcache evaluate --mode fixture --output <new scratch path outside the repo>` | exit 0, `passed: true`, 10/10 |
| `python3.12 -B scripts/export_site_data.py --check` and `node --check` on the site scripts, `web/app.js` and both contract files | pass; `data/evidence.json` unchanged |
| Headless Chrome 156 against a local preview of `site/` with the `render.yaml` headers, classic scrollbars, widths 320–1280 (nine), height 812 | 36 measurements without page overflow; no console, CSP, script or request errors; recorded-mode labels present; run, stage and view controls respond to real pointer clicks at 375 and 1280 px |
| Read-only GET of the seven links in the revised entry | 200 each, no redirects |

The node-off-PATH run was not repeated for this edit. The October 29 figure was `OK (skipped=33)`.

## Audit fixes (October 29, 2026)

**Fixed and verified locally; uncommitted, not run on GitHub and not deployed.** *(Later status: committed and pushed in `00cfb10`, and hosted [run #17](#ci-github-actions) on that commit succeeded, with its fixture report 10/10; no hosted test count. Deployment is still unverified, T-E9.)* Two parts: a code fix in the local lab, and documentation corrections. Evidence: [audit-fixes-2026-10-29/](screenshots/audit-fixes-2026-10-29/README.md) and [hosted-ci-run-16-2026-10-29/](screenshots/hosted-ci-run-16-2026-10-29/README.md).

**Failed mode switch (`web/app.js`).** Choosing Live in fixture mode, with `/api/reset` returning 502, kept the fixture experiment and banner. The menu and `selectedMode` stayed on Live, though, so the next Reset asked for live again. After a 503 whose state read-back also failed, the menu showed fixture while `selectedMode` stayed live. Now `perform()` sets `selectedMode = currentMode()` and calls `renderProvider()` after the existing error recovery for any failed seed or reset. It keeps the original error, the unchanged experiment's answer and checks, `storage_failed` recovery, unknown-state handling and failed-cleanup reconciliation, and it retries nothing. The contract harness's fake DOM now keeps event listeners, so the new cases fire the page's real `mode-select` change handler.

| Check actually run | Result |
| --- | --- |
| `.venv/bin/python -B -m unittest discover -s tests` (Python 3.12.6, `sentry-sdk` 2.72.0, Node v22.23.4) | `Ran 126 tests` … `OK` |
| `python3.12 -B -m unittest discover -s tests` | `Ran 126 tests` … `OK (skipped=6)`, the SDK telemetry tests |
| The same with every directory containing `node` removed from PATH | `Ran 126 tests` … `OK (skipped=33)`: 23 `web/app.js` contract, 3 `site.js` behaviour, 1 syntax and 6 SDK skips |
| Per-module count (verbose run) | store 11, controller 33, HTTP 10, providers/CLI 12, UI 24, telemetry 9, site 27 |
| New cases against the pre-fix `web/app.js` (`GHOSTCACHE_APP_JS=<copy> … tests.test_ui`) | 24 tests, 1 failure: `failed_mode_switch_keeps_the_confirmed_mode` (menu and `selectedMode` `live` under a fixture banner). A scratch variant fixing only the 502 path also fails it, at the unknown-state step. `successful_mode_switch` passes on both, because successful switching was already correct |
| `env -u GHOSTCACHE_SENTRY_DSN python3.12 -B -m ghostcache evaluate --mode fixture --output <new scratch path outside the repo>` | exit 0, `passed: true`, 10/10; telemetry off |
| Real headless Chrome 156 against the real fixture lab (scratch database, port 8891), with **mocked** live availability and live reset responses | 502, 503 with an unreadable state and 503 into `storage_failed`: menu, `selectedMode` and banner all fixture afterwards, and the next real pointer click on Reset sent `fixture`. A mocked successful switch: all live, and Reset sent `live`; switching back went to the real server. The pre-fix file reproduced the defect in the same browser. No live request reached the server; the menu change was script-dispatched, because the arrow key did not change the closed `<select>` in headless Chrome |
| Local preview of the working-tree `site/` with `render.yaml` headers, normal classic scrollbars, widths 320–1280 px (nine), height 812 | 54 measurements, `scrollWidth <= clientWidth` throughout; no console, CSP or page errors; the changed content renders |

**Documentation corrections.**
- The T-E7 stylesheet comparison is kept as a dated record; the redesign has since replaced that file.
- The missing-favicon claims are resolved with dated notes. The public checks found `/favicon.svg` 200 and no `/favicon.ico` request from headless Chrome, against a control page that did make one.
- DEPLOYMENT.md has a four-page verification checklist, tested in zsh and bash: 22 of 22 matches against `HEAD`.
- Run #16 is added (see [CI](#ci-github-actions)).
- Also corrected:
  - architecture.md's "last 12" events: the lab renders every event the server returns, up to 50;
  - the coverage limits below;
  - the "nothing to install" wording;
  - CATEGORIES.md's broken "Deployment record" reference;
  - scoped later-status notes on earlier "uncommitted" or "not deployed" records.
- These separate committed local code from publicly served static files: the lab and backend are never deployed.

**Limits:** no live Gemma, Sentry telemetry, hosted CI of these changes *(later: run #17 on `00cfb10`)*, physical phone, second browser engine or accessibility check. The public site still serves `f66977d`'s content; T-E9 stays open until the owner deploys and verifies it.

## UI content refresh (October 29, 2026)

**Implemented and verified locally; this refresh is not deployed.** The public methodology page distinguishes current project evidence from the three historical live reports. It links the 124-test local suite, historical hosted CI, real metadata-only Sentry findings, Render/custom-domain evidence and five intended categories, with their limits. The run guide now covers optional tracing and current error recovery. The local lab adds an evaluator-retention note after confirmed cleanup (T-A7), including a failed rebuild; it hides the note after reset, for unavailable storage and when current server state is unknown.

| Check actually run for this refresh | Result |
| --- | --- |
| `.venv/bin/python -B -m unittest discover -s tests` | 124 tests, OK, none skipped (2.642 s) |
| `python3.12 -B -m unittest discover -s tests` | 124 tests, OK (skipped=6, optional SDK tests; 2.471 s) |
| Fresh fixture evaluation to a scratch file outside `results/` | Exit 0, 10/10 checks |
| `python3.12 -B scripts/export_site_data.py --check` | Selected reports still match `site/data/evidence.json` |
| `node --check web/app.js` | Exit 0; the full suite also checks all public scripts |
| Automated local browser layout checks | 147 measurements; `scrollWidth <= clientWidth` throughout |
| Browser console / page errors | 0 / 0 |

**Browser method.** Headless Chrome 156.0.8078.73 with normal classic scrollbars (Playwright's `--hide-scrollbars` default removed), height 812 px. All four public pages, expanded run-guide troubleshooting and the fixture lab were checked at requested widths 320, 360, 375, 390, 414, 768, 980, 981 and 1280 px. Actual `clientWidth` was recorded, often 15 px below the requested viewport because of the vertical scrollbar; the comparison uses that actual width. Public preview used the deployed CSP and security headers. The lab used a separate disposable scratch database, not `.local/assistant.sqlite`.

**Real browser actions, driven by automation.** At 375 and 1280 px, all three recorded-run selectors, five stages, both diagram/list views, all six answer disclosures and arrow-key stage navigation worked. At every tested width, the fixture lab completed seed → secret → source-only → reworded echo → cascade → verify (8/8), showed the evaluator note after cleanup and reload, and hid it after reset. The offline contract cases also cover failed rebuild, failed-cleanup reconciliation, unavailable storage and unknown state. No new test methods were added: the existing site-link test and UI cases were extended.

**Evidence:** [UI refresh captures and browser report](screenshots/ui-content-refresh-2026-10-29/README.md). The screenshots are local browser captures, not a deployed-site or live-model result. They also supply the new local-UI captures for T-A9; the October 27 screenshots in `results/` remain unchanged historical evidence. The initial locator-based capture attempt clipped content; it was discarded in favour of the correctly framed captures indexed there.

**Separate read-only public comparison.** All 11 files served from the custom-domain site returned 200 and matched `site/` at committed `f66977d` byte for byte. The public HTML and `method.js` still differ from the local refresh; unchanged assets and the exported JSON match both. This confirms the earlier redesign and linked favicon are publicly served, not the new content. The report records actual hashes and headers; it does not identify Render's built commit. A separate normal-TLS GET of the exact custom-domain `/api/state` returned 404 (curl exit 0).

**Limits:** no new live Gemma evaluation, physical phone, second browser engine, screen-reader check or hosted CI run. No public deployment was performed. The 124 local regression tests are separate from the historical hosted 62-test run and from each saved evaluation's ten checks. Real-phone, other-browser and accessibility work remains T-E6; public verification of this content refresh remains T-E9.

## Cleanup-error reconciliation (October 29, 2026)

**Status: fixed and verified locally; uncommitted.** A focused follow-up to D-22 (recorded as its amendment). The backend did not change. *Later status (checked October 29, 2026): committed and pushed to `main` (in `f66977d`'s history). This is local lab and controller code; it is not served by Render, so it is committed, not deployed.*

**Root cause.** A cascade commits its purge, sets `stage = "cleaned"`, then summarises the surviving documents and stores the rebuilt summary. If storing it raises a non-provider error, the controller records `rebuild` `failed` / `not_stored` and re-raises: `sqlite3.OperationalError` becomes HTTP 500 ("Unexpected server error; inspect the local tests."), and a commit-validation `ValueError` from `Store.add_artifact` becomes HTTP 400 with its fixed message. `perform()` in `web/app.js` re-read state only after a 503, so the page kept the source-only view (5 stale descendants, 5 marker rows, the old graph, no rebuild warning) while the server was clean. A manual reload corrected it.

**Change (`web/app.js` only).**

- After any failed `/api/delete` request (either mode, any status, or a request that never reached the server), and after any 503, `perform()` reads `/api/state` once and renders it. It never repeats the deletion, a rebuild or a model call. Failed questions, verifications and resets other than a 503 change nothing on the server and do not trigger a read.
- The original error stays in the banner; the read's own error never replaces it.
- `stateSignature()` compares the stage, each artifact's ID, status, title and whether it has a body, and `rebuild`. If the state changed, the old answer and checks are dropped, as after a successful cleanup; if it is unchanged (a request rejected before any change), they stay. Selection follows the existing rule (kept if the artifact still exists); `storage_failed` still clears the discarded experiment's answer, checks, selection and local notes.
- If the read fails too, the banner adds "The lab could not reload the server's state, so it cannot tell whether the deletion finished. Reload the page to check.", the status line says "The lab could not confirm the server's state.", and the old answer and checks are withdrawn. The next successful state clears that. Busy state is released in `finally` in every branch.
- The rebuild warning still comes from `state.rebuild` only; for `not_stored` it says "The rebuilt summary could not be stored."

| Command or check | Result |
| --- | --- |
| `.venv/bin/python -B -m unittest discover -s tests -v` (Python 3.12.6, `sentry-sdk` 2.72.0, Node v22.23.4) | `Ran 124 tests` … `OK` |
| `python3.12 -B -m unittest discover -s tests` | `Ran 124 tests` … `OK (skipped=6)` (the SDK telemetry tests) |
| Per-module count from the verbose run | store 11, controller 33, HTTP 10, providers/CLI 12, UI 22, telemetry 9, site 27 |
| `test_design_tokens_are_shared_with_the_local_lab` (shared CSS block) | passes; neither stylesheet changed |
| `python3.12 -B -m ghostcache evaluate --mode fixture --output <new scratch path outside the repo>` | `passed: true`, 10/10 |
| `python3.12 -B scripts/export_site_data.py --check` | `site/data/evidence.json matches the selected reports.` |
| `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)` and the two `mobile-overflow-fix` manifests | 16/16, 15/15 and 12/12 OK |
| `node --check web/app.js`, `node --check tests/ui/app_contract.js`; `git diff --check` | pass; no output |
| `git status` on `results/`, `screenshots/`, `site/data/`, `render.yaml`, `.local/` | unchanged (only the untracked `screenshots/custom-domain-2026-10-29/`, left alone) |

**New tests (5).** All failures are simulated; no model is called.

| Test | What it drives | Observable failure it catches |
| --- | --- | --- |
| `test_save_failure_after_purge_is_a_500_and_the_lab_shows_the_server_state` (`CleanupFailureReconciliationTests`) | Real `Experiment` and HTTP handler: source-only deletion, then a cascade with `Store.add_artifact` raising `sqlite3.OperationalError`. Asserts HTTP 500 with the generic body, one `summarize` call, `source_only` → `cleaned`, 0 marker rows and 0 stale descendants, `failed` / `not_stored`, and no injected text in the state. Then the real `web/app.js` (Node case `cleanup_failure_reconciles_with_server_state`) gets those exact states and that response | The page keeping the source-only stage, counts or graph; no rebuild warning; the banner lost; old answer or 8/8 checks still shown; busy state stuck; any request other than one `/api/delete` and one `/api/state` |
| `test_validation_failure_after_purge_is_a_400_and_the_lab_shows_the_server_state` | The same with `ValueError("Cannot derive from inactive parent: d-garden")`: HTTP 400 with that message | The same, for the 400 path |
| `test_failed_reconciliation_keeps_the_original_error` | A 500 from `/api/delete`, then `/api/state` rejected as unreachable | The read's error replacing the original; a retried deletion; the old "Incomplete deletion" or a "Cleanup" claim; old results shown; busy state stuck; a later successful state not clearing the uncertainty |
| `test_unchanged_state_after_a_failed_deletion_keeps_results` | A 400 rejected before any change; the state read back is identical | Valid answer and checks discarded when nothing changed |
| `test_failed_question_does_not_read_state` | A 502 from `/api/ask` | An unnecessary state read, or dropped results, after a request that changes nothing |

Existing behaviour stays covered: `storage_failed_state` (503 reloads state and shows `storage_failed`, exactly two `/api/state` reads), `rebuild_failure_is_reported` (a provider rebuild failure from a normal cleanup response, a no-op cleanup that keeps it, a reset that clears it), the other rebuild cases and the ordinary cleanup flow in `reset_and_delete_clear_stale_display`.

**Against the pre-patch code.** The tree before this patch was copied to `/private/tmp/claude-501/-Users-bipulchamoli-Desktop-week-4/705194f6-0368-4db8-8150-4f99756d8ff9/scratchpad/baseline-reconcile/tree` before any edit, with a manifest in `../MANIFEST.sha256`. That tree's `git diff --binary HEAD` (HEAD `c7c05c3`) had SHA-256 `24aa045404ea4b010aab1a53bee3fb3120093091913e6160387686f66bf08f91`, and its `web/app.js` was `6cdbaa92113767060651ea0bf17c24c16ccab3446815e232e7a0c50282b928fe`. Running the new tests against that file (`GHOSTCACHE_APP_JS=<snapshot>/web/app.js python3.12 -B -m unittest tests.test_ui`): 4 of the 5 new tests fail and `test_failed_question_does_not_read_state` passes on both (it guards behaviour that was already right). Both real-state tests fail with the page still reading "Incomplete deletion, on purpose. d-vault is withdrawn, yet 5 derived artifacts still depend on it and 5 stored rows still hold the marker."; `failed_reconciliation_keeps_the_original_error` fails because no state read is attempted; `unchanged_state_after_a_failed_deletion_keeps_results` fails only on the missing read, since the pre-patch page also kept the results. The other 17 UI tests pass on both files.

**Browser check (built-in browser, real server).** A scratch launcher outside the repository ran the real `Experiment`, HTTP handler and `web/` files on port 8824 (checked free first) with a new scratch database, in fixture mode. All failures were **simulated**: the first `s-rebuilt-*` save raised `sqlite3.OperationalError`, and a scratch flag file made one reset's publication and restore probe fail. The launcher logged every model call and rebuilt-summary save.

1. "Delete just the source": "Incomplete deletion, on purpose … 5 derived artifacts … 5 stored rows", 3 / 5.
2. "Clean up the whole trail", without reloading: banner "Unexpected server error; inspect the local tests."; status "Cleanup is complete, but the summary rebuild failed. 1 source withdrawn and 5 descendants purged; 0 rows hold the marker and 0 active artifacts depend on a withdrawn source. The rebuilt summary could not be stored. …"; 5 / 5; `d-vault` withdrawn and `c-vault`, `s-vault`, `s-mixed`, `s-handoff` and the saved answer purged; no stale or marker node; 7 events; one page load. The server agreed: `cleaned`, 0 / 0, `failed` / `not_stored`.
3. Server log: one `POST /api/delete` (500), one model call and one save attempt for it, then one `GET /api/state` from the page (a second came from the check itself). Nothing was retried.
4. Normal cleanup: "Reset experiment" cleared the banner and the warning; the next cleanup stored `s-rebuilt-2-6` and showed "Cleanup propagated … Rebuilt s-rebuilt-2-6 from d-garden, d-maintenance, d-shuttle."
5. Storage failure: with the flag set, "Reset experiment" showed "Experiment storage could not be restored; reset to recover.", the `storage_failed` notice, 0 / 5, 0 events and an empty graph; "Reset to recover" returned to a seeded experiment with `rebuild` `not_attempted`.

The only console errors were the browser's resource-load messages for the intended 500 and 503. Only the temporary server was stopped; the unrelated server on port 8766 and `.local/assistant.sqlite` were left alone.

**Not verified:** live Gemma (every failure was simulated), real phones, Safari, Firefox, screen readers, a clipboard write and the deployed site. The suite was not rerun with Node removed from PATH. A network failure on the deletion request itself is covered only in the sense that it takes the same read path; no test drives it.

## Rebuild outcome survives the event window (October 29, 2026)

**Status: fixed and verified locally; uncommitted.** *Later status (checked October 29, 2026): committed and pushed to `main` (in `f66977d`'s history). This is local lab and controller code; it is not served by Render, so it is committed, not deployed.* D-22. The counts below are from that change (119 tests); current totals are in "Test inventory". Supersedes the "Known limit" recorded under "Review fixes to the redesign" below.

**Root cause.** `web/app.js` decided whether the cleanup's summary rebuild had failed by scanning `state.events` for `summary.rebuild_failed`. `Experiment.state()` returns only `self.events[-50:]`, so once 50 further events followed the failure it left the window and the lab showed the green "Cleanup propagated" state, though no successful rebuild or reset had resolved it. Each verification records four answer events, so 13 verifications were enough.

**Change.**

- `ghostcache/app.py`: `Experiment.rebuild` holds the current outcome, separate from the ledger, and `state()` returns it as `rebuild`. `{"status": "not_attempted"}`, `{"status": "succeeded", "artifact_id", "parent_ids"}` or `{"status": "failed", "parent_ids", "error_category"}`. The category comes from `providers.error_category` (or `not_stored` if the rebuilt summary could not be committed, which is still re-raised). It is in `_RUN_STATE`, set to `not_attempted` by a successful reset and cleared by `storage_failed`. The event window stays at 50 (`EVENT_WINDOW`); `deletion.rebuild_error` and the `summary.rebuild_failed` event are unchanged.
- `web/app.js`: `rebuildFailure()` reads `state.rebuild` only (in the `cleaned` stage). `rebuildReason()` shows the deletion response's fixed `rebuild_error` while the page still holds it for the same outcome, otherwise a sentence for the category, or "The summary rebuild did not complete." when there is none. The title, "The purge itself finished; no fixture text was inserted" and "Repeating cleanup does not retry the rebuild" are unchanged, as are the DOM hooks, routes and styles.

| Command or check | Result |
| --- | --- |
| `.venv/bin/python -B -m unittest discover -s tests -v` (Python 3.12.6, `sentry-sdk` 2.72.0, Node v22.23.4) | `Ran 119 tests` … `OK` |
| `python3.12 -B -m unittest discover -s tests` | `Ran 119 tests` … `OK (skipped=6)` (the SDK telemetry tests) |
| Per-module count from the verbose run | store 11, controller 33, HTTP 10, providers/CLI 12, UI 17, telemetry 9, site 27 |
| `test_design_tokens_are_shared_with_the_local_lab` (shared CSS block in `site/style.css` and `web/style.css`) | passes; neither stylesheet changed |
| `python3.12 -B -m ghostcache evaluate --mode fixture --output <new scratch path outside the repo>` | `passed: true`, 10/10 |
| `python3.12 -B scripts/export_site_data.py --check` | `site/data/evidence.json matches the selected reports.` |
| `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)` and the two `mobile-overflow-fix` manifests | 16/16, 15/15 and 12/12 OK |
| `node --check web/app.js` and `node --check tests/ui/app_contract.js` | pass |
| `git diff --check`; `git status` on `results/`, `screenshots/`, `site/data/`, `render.yaml`, `.local/` | no output; unchanged (only the untracked `screenshots/custom-domain-2026-10-29/`, left alone) |

**What each new test catches.** All failures are simulated: `ScriptedLive` (a deterministic stand-in that raises `ProviderError` on a chosen call) or a patched `summarize`. None of this is live Gemma verification.

| Requirement | Test | Observable failure it catches |
| --- | --- | --- |
| Failure appears in state, metadata only | `test_failed_rebuild_is_in_state_without_its_message_or_content` | No `rebuild` in state, or one carrying the exception text, the marker or document words; or the purge rolled back, or a fixture summary inserted |
| Survives 49, 50, 51, 100 and 120 later events; list stays bounded | `test_failure_outlives_the_event_window` | The outcome disappearing once the failure event leaves the window; `events` longer than 50 |
| Thirteen verifications | `test_thirteen_verifications_keep_the_failure`; UI `rebuild_warning_survives_thirteen_verifications` | The warning turning green after the 13th verification |
| Reload after the event has left the window | HTTP `test_unresolved_rebuild_failure_survives_requests_and_reloads`; UI `rebuild_failure_survives_reload` | `GET /api/state` (what a reload reads) without the failure, or a page that shows "Cleanup propagated" for it |
| No-op cleanup | `test_repeated_cleanup_with_nothing_to_purge_keeps_the_failure`; UI `rebuild_failure_is_reported` | A repeated cleanup clearing the failure or retrying the rebuild |
| Successful reset clears | `test_successful_reset_starts_with_no_rebuild`; UI `rebuild_failure_is_reported`; HTTP test | An old failure carried into a new experiment |
| Failed reset keeps the old experiment and its failure | `test_failed_reset_keeps_the_previous_experiment_and_its_failure` | A failed reset losing the outcome while restoring everything else |
| `storage_failed` clears | `test_storage_failed_discards_the_failure`; UI `storage_failure_discards_the_rebuild_warning` | A discarded experiment's failure shown over the storage-recovery state |
| A later successful rebuild resolves | `test_a_later_successful_rebuild_resolves_the_failure` | A failure that stays after a real rebuild succeeded |
| A newer failure supersedes an older success | `test_a_newer_failure_supersedes_an_older_success`; UI `rebuild_outcome_follows_server_state` | An older stored `s-rebuilt-*` summary or success standing in for a newer failure |

The two "later rebuild" tests need a second cascade with rows to purge, which ordinary use cannot produce (the second cascade purges nothing). They restore a body into a purged row (`reappear()`, labelled as simulated) and then run the real `delete("cascade")` path.

**Against the pre-fix code.** Baseline: commit `c7c05c3` (`c7c05c3cc63b46777de384bf78b4e6bc007e9ee8`) plus the uncommitted working tree as it stood before this fix, copied to a scratch directory outside the repository before any edit (the working tree was not reset, stashed or overwritten). `git diff --binary HEAD` of that tree had SHA-256 `8701df7753dc1dfc26337ab8d4ddd6357bd1049bbecab848d884acd0c0ff75fe`; its `ghostcache/app.py` was `cca45144dad76c2b1f37181baad6bd204be88d81464d4732d50e0a739034ab1d` and its `web/app.js` `8b6bf7579f22a90290842fe523f9449166a7144f5c05de26cc95d901afeaa3b7`. Before overlaying the new tests, that copy passed the suite of the time (`Ran 107 tests … OK (skipped=6)`). The copy is at `/private/tmp/claude-501/-Users-bipulchamoli-Desktop-week-4/705194f6-0368-4db8-8150-4f99756d8ff9/scratchpad/baseline-prefix/tree`, outside the repository, with `../MANIFEST.sha256` (18 files, all OK when rechecked on October 29) and `../working-tree.patch`.

| Run on the pre-fix copy with the new test files | Result |
| --- | --- |
| `RebuildOutcomeTests` (9) and the new HTTP test: 10 test methods | all 10 fail, with 14 `KeyError: 'rebuild'` error reports (the state has no current outcome): `test_failure_outlives_the_event_window` reports once per subtest (49, 50, 51, 100 and 120 later events) |
| `node tests/ui/app_contract.js rebuild_failure_survives_reload <pre-fix app.js>` | FAIL: `'ok' !== 'warn'`, "Cleanup propagated through the trail" |
| `… rebuild_warning_survives_thirteen_verifications` | FAIL "after verification 13": `'ok' !== 'warn'` |
| `… rebuild_outcome_follows_server_state` | FAIL at its second case: the pre-fix page warns there but names `(ProviderError)` instead of the category; its later "failure event left the window" case is the behavioural one |
| `… storage_failure_discards_the_rebuild_warning` | FAIL at its precondition (the pre-fix page shows no warning for an evicted failure), so it does not show a pre-fix storage-clearing defect: the pre-fix page already cleared on `storage_failed` |
| `… rebuild_failure_is_reported` | passes on both: it guards behaviour that already worked (the failure event was still in the window) |

**End-to-end reproduction of the original defect (scratch script, not in the repository).** The same scenario was run on both controllers in memory: fixture reset, cascade with a patched `summarize` raising `ProviderError`, 13 verifications, a repeated cleanup. Both returned 50 events, with `summary.rebuild_failed` in the window right after the failure and absent after the 13 verifications. The pre-fix state had no `rebuild`; the fixed state had `{"status": "failed", "parent_ids": ["d-garden", "d-maintenance", "d-shuttle"], "error_category": "invalid_output"}`. Rendering each state with its own `web/app.js` in the contract harness: pre-fix `tone=ok`, "Cleanup propagated through the trail."; fixed `tone=warn`, "Cleanup is complete, but the summary rebuild failed. … The model's reply could not be used as a summary. … Repeating cleanup does not retry the rebuild; reset to start again."

**Repeating this comparison.**

- *With the existing snapshots* (no commit needed while they exist). Check them first with `(cd <snapshot> && shasum -a 256 -c ../MANIFEST.sha256)`. The D-22 test files are the ones in the later snapshot `/private/tmp/claude-501/-Users-bipulchamoli-Desktop-week-4/705194f6-0368-4db8-8150-4f99756d8ff9/scratchpad/baseline-reconcile/tree` (taken just before the cleanup-error patch, which changed them again). Copy `tests/test_app.py` and `tests/test_http.py` from there into a scratch copy of `baseline-prefix/tree` (never into the snapshot itself) and run `python3.12 -B -m unittest tests.test_app.RebuildOutcomeTests tests.test_http.HTTPTests.test_unresolved_rebuild_failure_survives_requests_and_reloads`; for the UI, `node <baseline-reconcile>/tests/ui/app_contract.js <case> <baseline-prefix>/web/app.js`. Repeated this way on October 29: `Ran 10 tests`, `FAILED (errors=14)`, 14 `KeyError: 'rebuild'`; `rebuild_failure_survives_reload` and `rebuild_warning_survives_thirteen_verifications` FAIL, `rebuild_failure_is_reported` ok.
- *From Git alone.* Not possible yet: the pre-fix tree was HEAD `c7c05c3` plus uncommitted changes, recorded only by the patch hash above. It becomes possible if the redesign is committed separately from the D-22 and reconciliation changes; then check that commit out in a worktree and use the same commands. The snapshots are in a temporary scratch directory that the system may clear, which would leave only this route.

**Browser check (built-in browser, real server).** A scratch launcher outside the repository ran the real `Experiment` and HTTP handler on port 8823 with a scratch `--database`, in fixture mode, with `FixtureProvider.summarize` patched to raise a fixed `ProviderError` on its fourth call only (the first cleanup's rebuild). This is a **simulated** failure, not Gemma. Results:

1. Cleanup (step 05): warning with the response's fixed message and the purge counts; `state.rebuild` `failed`, `invalid_output`; 7 events.
2. "Verify the cleanup" clicked 13 times (driven from the page, waiting for each request): 8 / 8 PASS each time, 50 events, `summary.rebuild_failed` no longer in the window.
3. The warning was still shown.
4. Reload: still shown, now with "The model's reply could not be used as a summary."; the ledger showed 50 events and no "Rebuild failed" row.
5. Repeated cleanup: `delete.propagated` with no affected rows, no rebuild retried, warning still shown.
6. Reset experiment: neutral "Seeded" status, `rebuild` `not_attempted`, 5 events. A following cleanup (the eighth summary call; the launcher fails only the fourth) rebuilt `s-rebuilt-2-6` and, after a reload, showed "Cleanup propagated … Rebuilt s-rebuilt-2-6 from d-garden, d-maintenance, d-shuttle."

No console errors. Only the temporary server was stopped; the unrelated server on port 8766 and `.local/assistant.sqlite` were left alone.

**Not verified:** live Gemma (every failure above is simulated), persistence across a server restart (not implemented: the outcome lives in memory like the ledger, and `serve` resets at startup), real phones, Safari, Firefox, screen readers, a clipboard write and the deployed site. The UI suite was not rerun with Node removed from PATH.

## Review fixes to the redesign (October 29, 2026)

**Status: fixed and verified locally; not committed or deployed (T-E9).** *Later status (checked October 29, 2026): committed and pushed to `main` (in `f66977d`'s history). Its public `site/` files are served byte-identical to committed `f66977d`; its `web/` lab changes run only on the local server.* A review of the uncommitted redesign found eight problems. All are fixed in the working tree. No backend, export script, report, screenshot, evidence file or `render.yaml` change.

| # | Problem | Fix |
| --- | --- | --- |
| 1 | The walkthrough inspector listed relationships from the whole recorded run, so at "Seeded memory" `d-garden` "fed into" `s-rebuilt-1-9`, which exists only after cleanup. | `describe()` in `site/site.js` keeps only parents and children that exist at the selected stage, read from the same `statusFor()` audit model as the diagram: an artifact not created yet is left out, a tombstone stays. The marker history lists only the audits reached so far and reads "NOT CREATED", not "NO", where the artifact did not exist yet. The default detail label no longer calls the source "withdrawn" at the seeded stage. |
| 2 | The timing tooltip was absolutely positioned, but the chart box was not positioned, so it was placed against an ancestor and could appear thousands of pixels away. | `.timing{position:relative}`. `tipPlacement()` places the tooltip from the pointer in the chart's padding-box coordinates: above it (below it near the top), clamped inside both edges. The tooltip is `max-content` wide, capped at the chart width less 16 px. |
| 3 | The lab's rebuild-failure warning depended on the last deletion response, so a reload or a repeated cleanup replaced it with the green "Cleanup propagated" state. | `rebuildFailure()` in `web/app.js` reads the failure from the server's state: the later of `summary.rebuild_failed` and a `summary.generated` event for a stored, active `s-rebuilt-*` summary wins. The response's sanitized reason is kept with its ledger event and shown while that failure is unresolved; after a reload the status names only the recorded error type (`ProviderError`). A reset starts a new ledger. No browser storage, no retry. |
| 4 | After an HTTP 503 storage failure the ledger fell back to the page's own notes, showing the discarded experiment's events ("1 EVENT" over zero server events). | Accepting `storage_failed` also clears the page's notes, selection and hover; the ledger treats any `events` array from the server, even an empty one, as authoritative. |
| 5 | At 320 px with a classic 15 px scrollbar, the home illustration badge (absolute and `nowrap`) reached about 309 px of a 305 px document. | The badge is capped at its plate's width and may wrap; at 520 px and below it sits in flow above the drawing, in 10 px type with tighter tracking, and stays on one line. No `overflow-x: hidden`. |
| 6 | Links within one column (summary to summary, saved answer to saved answer) ended on the target's right edge, but the knot was drawn on its left edge. | `threadGeometry()` in both renderers returns the curve and its end point together; same-column links end on the right edge, outside a summary's stacked layers. |
| 7 | `site/run.html` said the model was or was not loaded during the measured calls. | It gives the measured first-call durations (40.41 s, 2.28 s, 81.25 s) and calls model loading the likely, unmeasured cause, as the walkthrough and methodology do. The lab's busy hint and one README sentence were qualified the same way. |
| 8 | PRD.md §11 still listed T-A10 and the narrow-screen fix as future work. | Reconciled with tasks.md and DEPLOYMENT.md. |

| Command or check | Result |
| --- | --- |
| `.venv/bin/python -m unittest discover -s tests -v` (Python 3.12.6, `sentry-sdk` 2.72.0, Node v22.23.4) | `Ran 107 tests` … `OK` |
| `python3.12 -m unittest discover -s tests` | `Ran 107 tests` … `OK (skipped=6)` (the SDK telemetry tests) |
| The same with `node` removed from PATH | `Ran 107 tests` … `OK (skipped=24)` (6 SDK, 18 Node) |
| Per-module count from the verbose run | store 11, controller 24, HTTP 9, providers/CLI 12, UI 15, telemetry 9, site 27 |
| The new and extended Node cases against the code from before these fixes (rebuilt in a scratch directory by reversing the edits) | all 8 fail: site `inspector_relationships_follow_the_stage` (first failure "cold/setup/d-garden names s-rebuilt-1-9, which does not exist at this stage"), `timing_tooltip_stays_inside_the_chart` and `thread_ends_meet_their_knots`; lab `storage_failed_state` (`'2 EVENTS'` instead of `'0 EVENTS'`), `rebuild_failure_is_reported`, `rebuild_failure_survives_reload`, `rebuild_outcome_follows_the_ledger_order` and `thread_ends_meet_their_knots` |
| `python3.12 -m ghostcache evaluate --mode fixture --output <new scratch path outside the repo>` | `passed: true`, 10/10 |
| `python3.12 scripts/export_site_data.py --check` | `site/data/evidence.json matches the selected reports.` |
| `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)` and the two `mobile-overflow-fix` manifests | 16/16, 15/15 and 12/12 OK |
| `git status` on `results/`, `screenshots/`, `site/data/`, `render.yaml`, `.local/`; `git diff --check` | unchanged (only the untracked `screenshots/custom-domain-2026-10-29/`, left alone); no whitespace errors |

**New tests (8 new, 1 extended).**

- `tests/ui/site_contract.js` (new), registered as `SiteBehaviourTests` in `tests/test_site.py`. It runs the real `site/site.js` in `node:vm` with a fake DOM and the real `site/data/evidence.json`. `inspector_relationships_follow_the_stage`: for all three runs and five stages, every parent and child the inspector names exists at that stage; the rebuilt summary appears under its parents only after cleanup; tombstones keep their links; the marker history matches the stages reached. `timing_tooltip_stays_inside_the_chart`: real segment `pointermove` handlers place the tooltip in the chart's padding-box coordinates; placement stays inside both edges, flips below near the top, and fits a narrow chart; the table lists every call. `thread_ends_meet_their_knots`: every drawn link ends at its knot, and same-column knots sit on the right edge. Plus `test_timing_chart_contains_its_tooltip`, a pure-Python check that `.timing` is `position:relative`.
- `tests/ui/app_contract.js`: `storage_failed_state` now also checks the ledger count, that no earlier event row remains, the cleared notes, checks, selection, inspector and graph, and that recovery shows only the new experiment's history. `rebuild_failure_is_reported` now covers a no-op repeated cleanup that keeps the warning and its reason, and a reset that clears it; its mock now carries the `summary.rebuild_failed` event that the controller writes. New: `rebuild_failure_survives_reload`, `rebuild_outcome_follows_the_ledger_order` (a normal cleanup; an older success then a failure; a failure then a stored rebuild; a success event whose summary is not stored) and `thread_ends_meet_their_knots`.
- `tests/test_app.py`: `test_failed_rebuild_stays_in_the_ledger_after_repeated_cleanup` pins the server behaviour the lab now reads. The backend did not change, so it passes before and after.

**Browser checks (headless Chrome over the DevTools protocol, harness outside the repository).** Unlike the first redesign sweep, Chrome kept its **classic 15 px scrollbars** (`innerWidth` 320, `clientWidth` 305). `site/` was served by a scratch server that sends the `render.yaml` headers, including the CSP, and a `securitypolicyviolation` listener recorded violations. The lab ran with `python3.12 -m ghostcache serve --port 8811 --database <new scratch file>` (fixture mode). Ports were checked free first, and every server was stopped afterwards.

- **Overflow:** `documentElement.scrollWidth <= clientWidth + 1` on home, walkthrough, methodology, run locally and the lab at 320, 360, 375, 390, 768, 1024 and 1440 px. At each width the check also covered the walkthrough (October 27 cleanup in the diagram; verified stage in the list view; every disclosure open), run locally and methodology with every disclosure open, and the home preview's cleaned moment: 70 states, with no element past the client width outside a scroll container. The hero badge is one line, 240 px wide and in flow at 320–390 px, and unchanged (absolute, 278 px) at 521 px and above.
- **Fixture flow by real clicks:** 14, 15, then 16 artifacts; an incomplete-deletion warning after the source-only step; the rebuilt `s-rebuilt-1-9` after cleanup; verification 8 / 8 PASS.
- **Link geometry, rendered SVG:** each path's end point (`getPointAtLength`) against its knot: lab 25 links (3 in one column), walkthrough 19 links (2 in one column); the largest gap was 0.
- **Keyboard, real key events:** in the lab, Tab from the view toggle reaches the first node, Enter and Space select, and in the list view Tab then Enter selects. On the walkthrough, ArrowRight, End and Home on the stage tabs move focus and selection and update the hash; Tab into the trail and Enter selects.
- **Inspector relationships, all three runs at all five stages:** `d-garden` fed into `c-garden` only before cleanup, and `c-garden` and `s-rebuilt-1-9` after it. `s-rebuilt-1-9` has `tabindex="-1"` before cleanup; after it, its marker history reads NOT CREATED, NOT CREATED, NO. `c-garden` still feeds the purged `s-mixed`, and the withdrawn `d-vault` still lists its tombstoned children. The default label reads "The source document" at the seeded stage.
- **Timing tooltips after scrolling, real pointer moves:** walkthrough and methodology at 1440 px (scrolled 2,618–3,829 px) on the first call's left edge, a middle call and the last call's right edge, and both pages at 375 px (scrolled 6,079–6,481 px) on both edges. Each time the tooltip was visible, inside the chart and the viewport, and within 40 px of the pointer. The table lists all 11 calls and scrolls inside its wrapper at 375 px.
- **Rebuild warning, end to end:** a scratch server ran the real `Experiment` and HTTP handler with a scripted stand-in provider (not Gemma; no Ollama), whose fourth summary call, the first rebuild, raised a fixed `ProviderError`. Cleanup showed the warning with the sanitized reason and the purge counts. A repeated cleanup, a reload, and a reload followed by cleanup all kept it, naming only `ProviderError` after the reload. A reset cleared it, and the next cleanup's successful rebuild showed the normal state.
- **Mobile inspector (375 px, touch emulation):** the list view by default, the inspector collapsed ("Show"); selecting an artifact opens it (`aria-expanded="true"`); Hide collapses it.
- **Reduced motion:** the home drawing shows its final state and the replay control stays hidden; trail and lab transitions are 0 s.
- **Missing evidence** (a scratch copy of `site/` without `data/`): the walkthrough, methodology and home show their "unavailable" messages; the only log entries are the expected 404s for `evidence.json`.
- **Console and CSP:** no console errors, exceptions or CSP violations on any page under the deployed CSP, or in the lab.

**Not verified:** a real phone, Safari or Firefox, a screen reader or automated accessibility audit, live Gemma (the rebuild-failure check used a scripted stand-in, not a model), a real clipboard write, and the deployed site (T-E9). **Known limit:** `/api/state` returns the latest 50 ledger events, so a rebuild failure followed by 50 or more further events in the same experiment (each question or cleanup adds one) would leave that window, and the warning would no longer show. The server was not changed. *Fixed October 29, 2026 (D-22): the lab now reads the current outcome from `state.rebuild`; see "Rebuild outcome survives the event window" above.*

## Residual Archive redesign (October 29, 2026)

**Status: implemented and verified locally; not deployed (T-E9).** *Later status (checked October 29, 2026): committed and pushed to `main` (in `f66977d`'s history). Its public `site/` files are served byte-identical to committed `f66977d`; its `web/` lab changes run only on the local server.* A light redesign of the public site (`site/`, now four pages) and the local lab (`web/`), recorded as DECISIONS.md D-21. No backend, export script, report, screenshot or `render.yaml` change. Live mode was not exercised: Ollama was not running, which let the "unavailable model" state be checked instead.

| Command or check | Result |
| --- | --- |
| `.venv/bin/python -B -m unittest discover -s tests` (Python 3.12.6, `sentry-sdk` 2.72.0, Node v22.23.4) | `Ran 99 tests` … `OK` |
| `python3.12 -B -m unittest discover -s tests` | `Ran 99 tests` … `OK (skipped=6)` (the SDK telemetry tests) |
| Per-module count from the verbose run | store 11, controller 23, HTTP 9, providers/CLI 12, UI 12, telemetry 9, site 23 |
| The 5 new UI cases, and the changed `live_mode_label`, against the previous `web/app.js` (`node tests/ui/app_contract.js <case> <old app.js>`) | all 6 fail; all 11 Node cases pass on the new file |
| `python3.12 -B scripts/export_site_data.py --check` | `site/data/evidence.json matches the selected reports.` (the data file is unchanged) |
| `python3.12 -B -m ghostcache evaluate --mode fixture --output <scratch path outside the repo>` | exit 0, `passed: true`, 10/10 |
| `node --check` on `web/app.js`, `tests/ui/app_contract.js` and the four `site/*.js` | all pass |
| `git status` / `git diff --stat` on `results/`, `screenshots/`, `site/data/` | unchanged; `.local/assistant.sqlite` untouched (the lab ran on a scratch `--database`) |
| `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)` and the two `mobile-overflow-fix` manifests | 16/16, 15/15 and 12/12 OK |
| `git diff --check` | no output |

**New tests.** UI contract (`tests/ui/app_contract.js`, registered in `tests/test_ui.py`): graph shapes by kind, lineage highlighting, node reuse across a deletion, tombstones and their accessible names (`graph_kinds_lineage_and_tombstones`); the list view (`list_view_alternative`); the `storage_failed` state after a 503, with a state reload and recovery (`storage_failed_state`, T-A10); a cascade's `rebuild_error` (`rebuild_failure_is_reported`); the unavailable-model label and the answer's marker verdict (`unavailable_model_and_marker_labels`). Site (`tests/test_site.py`): links, anchors and an external-link allowlist on every page, shared navigation and landmarks, CSP compatibility of every page and of `web/index.html`, and the shared design block; the existing file-list, label, fetch and syntax tests now cover all four pages and scripts.

**Browser checks (headless Chrome over the DevTools protocol, harness kept outside the repository).** `site/` was served with `python3.12 -m http.server 8790 --bind 127.0.0.1 --directory site`, and the lab with `python3.12 -m ghostcache serve --port 8811 --database <scratch>` (fixture mode).

- **Horizontal overflow**, all five pages (home, walkthrough, methodology, run locally, lab) at 320, 360, 375, 414, 768, 1024, 1280 and 1440 px (mobile emulation below 768): `scrollWidth` equalled `clientWidth` everywhere except the walkthrough at 320 and 360 px, where the sticky label's unwrapped mono text reached 366–367 px. After letting it wrap below 760 px, 320 px measured 320/320. *Correction (review, October 29): this sweep ran Chrome with `--hide-scrollbars`, so it measured no scrollbar. With a classic 15 px scrollbar the home illustration badge overflowed at 320 px; fixed and rechecked in "Review fixes to the redesign" above.*
- **Flows:** the lab's full fixture sequence (seed, ask, delete the source, echo, cleanup, verify) showed 14, then 15, then 16 artifacts, six stale descendants after the source-only deletion, tombstones and a rebuilt summary after cleanup, and 8/8 checks; no console errors on any page.
- **Keyboard and hover:** a focused trail node selects with Enter or Space, and the detail panel or inspector follows it, with focus kept (nodes are not rebuilt); stage tabs move with the arrow keys and End, and update the URL hash; nodes not yet created at a stage get `tabindex="-1"` and `aria-hidden`; hovering a lab node lights its full lineage.
- **Other states:** with `prefers-reduced-motion: reduce`, the home drawing shows its final state at once and the replay control stays hidden; copy buttons fall back to selecting the command and announcing it, because headless Chrome refused clipboard writes; with `data/evidence.json` missing (a scratch copy of `site/`), the walkthrough, home preview and methodology tables each show an "unavailable" message; the local lab showed "Live Gemma — unavailable" with Ollama's fixed message. No page requested `/favicon.ico`.

**Not verified:** a real phone, Safari or Firefox, a screen reader or automated accessibility audit, a contrast audit beyond the token arithmetic (body and accent text tokens were computed at 4.5:1 or more on white), live Gemma in the redesigned lab, a real clipboard write, and the deployed site (T-E9).

## T-E7 deployed verification (October 28–29, 2026)

**Status: resolved.** The narrow-screen fix is live on the public site, and T-E7 is complete. The record below adds the deployed checks; the original failure ("Documentation audit") and the local fix ("Narrow-screen overflow fix T-E7") are kept unchanged further down. Evidence: [screenshots/mobile-overflow-fix/deployed-2a1ffb0/](screenshots/mobile-overflow-fix/deployed-2a1ffb0/README.md).

Three sources, kept separate:

**1. Read-only checks by the coding agent (October 28, 18:45–18:48 UTC; October 29, 00:15–00:18 IST).** Only `curl` and Git; no browser was opened on the public site in this task, and no unit tests were rerun.

| Command or check | Result |
| --- | --- |
| `git merge-base --is-ancestor 08e0524 2a1ffb0` | exit 0: the CSS fix commit `08e05246611d457e337792203e3de90638924387` is an ancestor of `2a1ffb04d57c01cc8f454ca6a1b147e4a30408de` |
| `git log 08e0524..2a1ffb0 -- site render.yaml`; `git diff --quiet 08e0524 2a1ffb0 -- site/style.css` | no commits; no difference (the nine commits after the fix changed only documentation and screenshots) |
| `git ls-remote origin refs/heads/main` (18:48:30 UTC) | `2a1ffb04d57c01cc8f454ca6a1b147e4a30408de` |
| `curl https://ghostcache-walkthrough.onrender.com/style.css` (18:45:49 UTC) | 200; 9,935 bytes; `text/css; charset=utf-8`; `Last-Modified: Wed, 28 Oct 2026 17:21:42 UTC` (after the fix and `2a1ffb0` commits, 17:20–17:21 UTC) |
| SHA-256 of the served `style.css` | `035e46ec0210e14951f1e0c8cda9748ded207f9d1cdd73ee7a65126bbc488027` |
| SHA-256 of `site/style.css` at `2a1ffb0`, at `08e0524` and in the working tree | the same hash for all three; `cmp` byte-identical to the served file |
| SHA-256 of `site/style.css` at `3cc0814` (the fix's parent, the old stylesheet) | `86b4876204f567996900d44154d86340d7deffa54517fd618d02a889100b0927`; differs from the served file |
| Both fixed rules in the served file | `.explainers{grid-template-columns:minmax(0,1fr)}` (below 980 px) and `.tiny-label{white-space:normal}` (below 650 px) present |
| `/`, `/index.html`, `/walkthrough.js`, `/data/evidence.json`, `/api/state` | 200, 200, 200, 200, 404; the four `render.yaml` security headers on `/` |
| SHA-256 of the served `index.html`, `walkthrough.js`, `data/evidence.json` against `site/` at `2a1ffb0` | identical |

Outcome: **pass.** The public site serves the fixed stylesheet, byte for byte, together with the same three other files that were measured locally. This proves which bytes were served at the check time; on its own it does not identify the commit Render built. Full record: [css-comparison.json](screenshots/mobile-overflow-fix/deployed-2a1ffb0/css-comparison.json).

**2. Deployed commit, from the user's Render dashboard screenshots.** The user supplied Render dashboard and deployment-detail screenshots showing `2a1ffb0` as successfully deployed. Those source files no longer existed when copying was attempted, so they were not saved; the statement rests on the user's report, supported by the Git and hash checks above.

**3. Manual public-site checks reported by the user.** Method: Chrome DevTools responsive device emulation, reported height 812 px. The user ran `scrollWidth > clientWidth` on `document.documentElement` in the console. These are the user's observations, not automated tests, and the agent did not reproduce them.

| Width | Viewport width | Page width | Horizontal overflow |
| --- | --- | --- | --- |
| 320 | 320 | 320 | false |
| 360 | 360 | 360 | false |
| 375 | 375 | 375 | false |
| 390 | 390 | 390 | false |
| 414 | 414 | 414 | false |
| 768 | 768 | 768 | false |
| 980 | 980 | 980 | false |
| 981 | 981 | 981 | false |
| 1280 | 1280 | 1280 | false |

Manual functional results, as reported: command/code box internal horizontal scrolling PASS; timing table layout and scrolling PASS; all six recorded-question buttons PASS; all three recorded-run selectors PASS; all five stage selectors PASS. Record: [user-reported-manual-results.json](screenshots/mobile-overflow-fix/deployed-2a1ffb0/user-reported-manual-results.json).

Saved screenshots back eight of the nine width rows (360 to 1280 px) and the command-block scrolling. The eight console captures are published cropped, with the browser's tabs, address bar, profile icon and bookmarks removed; the DevTools device toolbar, page and console stay visible, and the originals are kept outside the repository (see the folder's README, "Cropping"). The 375 px screenshot's DevTools toolbar shows 375 × 404, not 812; the reported values are kept as given. The listed 320 px console screenshot, the Render dashboard and deployment-detail screenshots and two phone-frame previews were unavailable and were not saved.

**Why this closes T-E7.** The fix commit is in the deployed history; the served stylesheet is byte-identical to the one verified locally across all 33 view states at the same nine widths (section below); and the user's checks on the public URL found no horizontal overflow at any of those widths, with the command block and timing table scrolling inside themselves.

**Not verified:** a physical phone, Safari or Firefox, and assistive technology (all still T-E6); other heights or view-state combinations on the public site; the favicon 404 (T-E8; *resolved October 29, 2026: the linked `favicon.svg` is served*). No phone-frame preview is evidence of a physical device or Safari.

| Command | Result |
| --- | --- |
| `(cd screenshots/mobile-overflow-fix/deployed-2a1ffb0 && shasum -a 256 -c SHA256SUMS.txt)` | 12 of 12 OK (8 cropped console captures, 2 command-block images, 2 JSON records). The manifest was regenerated after cropping; each crop's pixel rows were checked against its original's, and the two command-block images are `cmp`-identical to their sources |
| `(cd screenshots/mobile-overflow-fix && shasum -a 256 -c SHA256SUMS.txt)` | 15 of 15 OK (local before/after, unchanged) |
| `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)` | 16 of 16 OK (unchanged) |
| `git diff --check` | no output |

## Narrow-screen overflow fix T-E7 (October 28, 2026, about 22:30 IST)

**Status: fixed and verified locally; not yet deployed.** The deployed site still serves the old `site/style.css` until the fix is pushed and Render rebuilds it (see [DEPLOYMENT.md](DEPLOYMENT.md)). *Superseded: deployed in `2a1ffb0` and verified on the public site; see "T-E7 deployed verification" above.*

**Cause, confirmed before editing.** Below 980 px, `.explainers` used `grid-template-columns:1fr`. A `1fr` track's minimum is `auto`, so the grid items could not shrink below their content's minimum width, and the `white-space:pre` command block in "Run it yourself" set that minimum. Its own `overflow-x:auto` did not help, because its ancestor grew instead. A scratch copy of `site/` with only that track changed to `minmax(0,1fr)` removed the overflow at 360–414 px. At 320 px it exposed a second, smaller offender: the answer card's `.tiny-label` "After source-only deletion · reworded question" is `white-space:nowrap` and 285 px wide in a 224 px card.

**Change (`site/style.css`, two rules inside existing media queries; nothing else):**
- `@media(max-width:980px)`: `.explainers{grid-template-columns:1fr}` → `.explainers{grid-template-columns:minmax(0,1fr)}`, the same track sizing the desktop layout already uses.
- `@media(max-width:650px)`: added `.tiny-label{white-space:normal}`, so a section label longer than its container wraps; shorter labels look the same.

No page-level `overflow-x:hidden`, clipping, zoom or font-size change. `site/style.css` SHA-256 changed from `86b48762…100b0927` to `035e46ec…bc488027`; `index.html`, `walkthrough.js` and `data/evidence.json` are unchanged.

**Method.** `site/` was served locally with `python3.12 -m http.server 8790 --bind 127.0.0.1 --directory site` and loaded in headless Chrome over the Chrome DevTools Protocol, with `Emulation.setDeviceMetricsOverride` (mobile mode at 414 px and below; desktop mode at 768 px and above, plus a desktop-mode 375 px row). For each viewport the harness walked all 33 view states (3 runs × 5 stages, then 3 runs × 6 questions), recorded `document.documentElement.clientWidth` and `scrollWidth` in every state, and listed any element extending past `clientWidth`, ignoring content inside the two intentional scroll containers (`.table-wrap` and `pre.command`). In this headless build `clientWidth` equalled the emulated width in both modes (no classic scrollbar was subtracted); overflow was judged as `scrollWidth > clientWidth`, not against the requested width. Raw results and screenshots: [screenshots/mobile-overflow-fix/](screenshots/mobile-overflow-fix/README.md).

| Viewport | Mode | Before: clientWidth / scrollWidth | After: clientWidth / scrollWidth | After: explainer width; command block client / scroll |
| --- | --- | --- | --- | --- |
| 320 × 720 | mobile | 320 / **573** | 320 / 320 | 288; 286 / 555 |
| 360 × 780 | mobile | 360 / **573** | 360 / 360 | 328; 326 / 555 |
| 375 × 812 | mobile | 375 / **573** | 375 / 375 | 343; 341 / 555 |
| 390 × 844 | mobile | 390 / **573** | 390 / 390 | 358; 356 / 555 |
| 414 × 896 | mobile | 414 / **573** | 414 / 414 | 382; 380 / 555 |
| 375 × 812 | desktop | 375 / **573** | 375 / 375 | 343; 341 / 555 |
| 768 × 1024 | desktop | 768 / 768 | 768 / 768 | 688; 686 / 686 (fits) |
| 980 × 900 | desktop | 980 / 980 | 980 / 980 | 900; 898 / 898 (fits) |
| 981 × 900 | desktop | 981 / 981 | 981 / 981 | 286 (three columns); 284 / 555 |
| 1280 × 900 | desktop | 1280 / 1280 | 1280 / 1280 | 372 (three columns); 370 / 555 |

The maximum `scrollWidth` over all 33 states equalled the initial value in every row, before and after. Element counts are a separate measurement: the number of elements extending past the viewport, not counting content inside the two scroll containers. Before the fix, in the initial view state, 15 elements did so at 360–414 px and in the desktop-mode 375 px row, and 16 at 320 px; the maximum across all tested states was the same, except at 320 px, where it was 17. After the fix, no element extended past the viewport in any tested state or viewport.

**Other checks after the fix, at every tested viewport:**
- **Command block:** where it is narrower than its 555 px content, setting its `scrollLeft` to 60 scrolled it to 60, and the page did not move. The full command text is still in the `<pre>`, so it can be selected and copied.
- **Timing table:** still scrolls inside `.table-wrap` where it is narrower than the table's 520 px minimum (256–350 px wide at 320–414; `scrollLeft` 60 reached).
- **Selectors:** every run, stage and question button set `aria-pressed="true"` when clicked, in all 33 states.
- **Readability:** the recorded-mode banner lies within the viewport; the memory-trail cards lie within the viewport; the explainer text stays 14 px.
- **Desktop unchanged:** the 768 × 1024 and 1280 × 900 captures are byte-identical before and after.
- **Console:** no new messages. The only one in either run was the browser's `/favicon.ico` 404 on the first page load (T-E8).

| Command | Result |
| --- | --- |
| `.venv/bin/python -B -m unittest discover -s tests` | `Ran 91 tests in 1.129s` … `OK` |
| `python3.12 -B -m unittest discover -s tests` | `Ran 91 tests in 0.766s` … `OK (skipped=6)` (the SDK telemetry tests) |
| `python3.12 -B -m unittest tests.test_site` | `Ran 20 tests` … `OK` |
| `python3.12 -B scripts/export_site_data.py --check` | `site/data/evidence.json matches the selected reports.`, exit 0 |
| `python3.12 -B -m ghostcache evaluate --mode fixture --output <new scratch path outside results/>` | exit 0, `passed: true`, 10/10 |
| `node --check` on `site/walkthrough.js`, `web/app.js`, `tests/ui/app_contract.js` | all pass |
| `git diff --check` | no output |
| `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)` | 16 of 16 OK (original manifest unchanged) |
| `(cd screenshots/mobile-overflow-fix && shasum -a 256 -c SHA256SUMS.txt)` | 15 of 15 OK |

**Not verified (at the time):** the deployed site (pending push and rebuild; *since verified, see "T-E7 deployed verification" above*), a real phone, browsers other than Chrome, and assistive technology (T-E6). No test was added that searches the CSS for a declaration; the check is browser geometry, and the harness lives outside the repository.

## Documentation audit (October 28, 2026, about 22:00 IST)

A documentation-only audit of every Markdown file against the code, saved evidence and the public site. No application code, tests, deployment configuration, generated data, reports, screenshots or checksum manifests were changed. No live model was run, no dependency was installed, and nothing was deployed.

| Command or check | Result |
| --- | --- |
| `.venv/bin/python -B -m unittest discover -s tests` (Python 3.12.6, `sentry-sdk` 2.72.0, Node v22.23.4 on PATH) | `Ran 91 tests in 1.245s` … `OK`, none skipped |
| `python3.12 -B -m unittest discover -s tests` (no `sentry-sdk`) | `Ran 91 tests in 3.135s` … `OK (skipped=6)`; all 6 skips are "sentry-sdk not installed; optional extra" |
| Per-module count from the verbose run | store 11, controller 23, HTTP 9, providers/CLI 12, UI 7, telemetry 9, walkthrough 20 |
| `python3.12 -B -m ghostcache evaluate --mode fixture --output <new scratch path outside the repo>` | exit 0; mode `fixture`, model "Deterministic fixture — no AI call", `passed: true`, 10/10 checks |
| `python3.12 -B scripts/export_site_data.py --check` | `site/data/evidence.json matches the selected reports.`, exit 0 |
| `node --check` on `web/app.js`, `site/walkthrough.js`, `tests/ui/app_contract.js` | all pass |
| `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)` | 16 of 16 OK |
| The four saved reports, recomputed from `results/*.json` | All `passed: true`, 10/10, same stage pattern (14/14/0/6 → 14/13/5/5 → 15/9/0/0). Live model-call sums: 130,650 ms (October 27), 61,325 ms (cold), 22,078 ms (warm); first calls 81,246, 40,407 and 2,278 ms; input/output tokens 3,209/677, 3,198/679 and 3,190/671. These match the figures quoted in the docs |
| GitHub's public API, `GET /repos/bipul724/GhostCache/actions/runs` and the jobs of run #10 | 10 runs. #1 and #3–#10 succeeded; #2 was cancelled (duplicate of #3's push). Run #10 (`26a1c3e`, the current `main`) had all seven steps succeed, and its 2,110-byte report artifact exists. Test counts are in the logs, which need authentication and were not read |
| `curl` on the public site | `/`, `/index.html`, `/style.css`, `/walkthrough.js`, `/data/evidence.json`: 200. Exact `/api/state`, `/api` and `/favicon.ico`: 404. Headers on `/` and `/data/evidence.json`: the `render.yaml` CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`; `/data/evidence.json` also `Cache-Control: no-cache`. `Last-Modified` October 28, 14:02:51 UTC |
| SHA-256 of the four deployed files against `site/` at `26a1c3e` | identical (`site/` is unchanged since `8013d01`) |
| Headless Chrome at 1280×900, temporary profile, Chrome DevTools Protocol | Banner correct, no load error; 3 run buttons (each "10 / 10 checks passed"), 5 stage buttons, 6 question buttons all change the view; requests: the page, `style.css`, `walkthrough.js`, `data/evidence.json` and the browser's `/favicon.ico` (404, one console error) |
| The same page with an emulated 375×812 viewport (`Emulation.setDeviceMetricsOverride`, mobile and desktop modes) | **Horizontal overflow.** At the tested 375 px viewport, the document's scrollWidth was 573 px, while the layout viewport stayed 375 px (mobile mode; desktop mode reported 360 px after its scrollbar). The three explainer articles were 557 px wide: below 980 px, `.explainers` uses `grid-template-columns:1fr`, and the `white-space:pre` command block sets the column's minimum width. Controls still worked. This is headless Chrome emulation; the exact width at which overflow starts can vary with browser and font metrics, and no real phone was tested (T-E7). *Fixed locally later the same day; see "Narrow-screen overflow fix T-E7" above* |
| Relative links and heading anchors in every Markdown file in the repository (scripted, after the edits) | 148 relative links checked, including the workspace handoff; 0 broken; every repository link resolves to a file inside the repository, so it also works on GitHub |
| The verification block in [DEPLOYMENT.md](DEPLOYMENT.md), run as written from the repository root | 200, 200, 404; the four headers; the served and local `site/data/evidence.json` have the same SHA-256 |

**Contradiction found.** The T-E2 record below says the in-app browser's 375×812 phone preset showed no horizontal overflow. The CSS rule above was the same then, and the emulated check reproduces the overflow, so that earlier result is not relied on. Phone usability remains unverified (T-E6).

## Render deployment T-E3 (October 28, 2026)

The user deployed the walkthrough from `render.yaml` as the Blueprint-managed Render static site `ghostcache-walkthrough`, live at <https://ghostcache-walkthrough.onrender.com/> from commit `8013d01` ([dashboard screenshot](screenshots/00-render-dashboard-live-8013d01.png)). It performs no live inference; the Python backend and Ollama stay on the laptop.

**Fresh checks during the documentation update (October 28, 2026, about 21:00 IST; read-only requests):**

| Command or check | Result |
| --- | --- |
| `curl` status of `/`, `/data/evidence.json`, `/style.css`, `/walkthrough.js` | 200 each (`text/html`, `application/json`, `text/css`, `application/javascript`) |
| `curl` status of the exact `/api/state` | 404 (`text/plain`) |
| `curl -sI` on `/` and `/data/evidence.json` | `Content-Security-Policy` identical to `render.yaml`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`; `/data/evidence.json` also `Cache-Control: no-cache` |
| SHA-256 of the deployed `index.html`, `style.css`, `walkthrough.js`, `data/evidence.json` against `git show 8013d01:site/…` | identical for all four |
| Headless Chrome 1280×900 (temporary profile, Chrome DevTools Protocol), clicking every button once | Banner "Recorded local Gemma evaluation — no live inference"; no load error; 3 run buttons (each 10/10 checks, 14 items), 5 stage buttons (stage 5 shows the checks) and 6 question buttons (the unrelated-fact answer contains `07:40`, the shared-fact answer `Lantern Hall`) all change the view. Requests: the page, `style.css`, `walkthrough.js`, `data/evidence.json`, and Chrome's automatic `/favicon.ico`, which returns 404 and logs one console error (the site has no favicon) |
| `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)` | 16 of 16 OK |
| `.venv/bin/python -m unittest discover -s tests` | `Ran 91 tests` … `OK` |
| `python3.12 -m unittest discover -s tests` | `Ran 91 tests` … `OK (skipped=6)` (the 6 SDK telemetry tests) |
| `python3.12 -m ghostcache evaluate --mode fixture --output <new scratch path outside results/>` | exit 0, `passed: true`, 10/10 checks |

**Recorded earlier by the user (screenshots, not rerun here):** switching between all three recorded runs, the source-only, leak, cleanup and verification views, the preserved garden answer, the public `/data/evidence.json` and a Not Found page for `/api`. Index: [screenshots/README.md](screenshots/README.md). Screenshot 15's URL has extra characters after `/api/state`, so it is not evidence of the clean `/api/state` check; the 404 above comes from `curl`.

**Not verified:** phone usability on the deployed site, other browsers, assistive technology, and every combination of run, stage and question (each button was clicked once). No live Gemma evaluation was run.

## Public recorded walkthrough T-E2 (October 28, 2026)

The static walkthrough in `site/`, its export script and the Render Blueprint (DECISIONS.md D-13). Everything below was run on October 28, 2026; the site was **not deployed** at that point. *(Deployed later the same day; see "Render deployment T-E3" above.)*

| Command or check | Result |
| --- | --- |
| `python3.12 -m unittest discover -s tests` | `Ran 91 tests` … `OK (skipped=6)` (the 6 SDK telemetry tests) |
| `.venv/bin/python -m unittest discover -s tests` | `Ran 91 tests` … `OK` |
| `python3.12 -m unittest tests.test_site` | `Ran 20 tests` … `OK` |
| `python3.12 -m ghostcache evaluate --mode fixture --output <scratch path outside the repo>` | `passed: true`, 10/10 checks |
| `python3.12 scripts/export_site_data.py --check` | `site/data/evidence.json matches the selected reports.` |
| `node --check site/walkthrough.js` and `node --check web/app.js` | no output, exit 0 |
| Local static server (`python3.12 -m http.server 8791 --bind 127.0.0.1 --directory site`) | `/`, `/index.html`, `/style.css`, `/walkthrough.js` and `/data/evidence.json` return 200 with the right content types; `/api/state` returns 404 |
| In-app browser, 1440×900 and the 375×812 phone preset | Banner shown; all three run buttons, five stage buttons and six question buttons work; stage text, counts, memory-trail statuses and answers match the cold report (for example, after cleanup: `d-vault` deleted, `c-vault`, `s-vault`, `s-mixed`, `s-handoff` and the saved answer purged, `s-rebuilt-1-9` rebuilt); no console messages; no horizontal page overflow at phone width; the only resources loaded were `style.css`, `walkthrough.js` and `data/evidence.json` |
| Evidence integrity | All 13 files in `results/` kept their SHA-256 values; `.local/assistant.sqlite` was not touched (modified time still October 27, 16:44:23) |

**What the walkthrough tests cover** (`tests/test_site.py`, 20 tests):

- **Export:** the committed `site/data/evidence.json` equals a fresh export and `--check` passes; the export is deterministic; each run records its source file and SHA-256; cold stage counts (14/14/6, then 13 active with 5 stale and 5 marker rows, then 15/9/0 with 5 purged); every answer and citation list is copied exactly; cold and warm first-call and total timings (40,407 and 2,278 ms; 61,325 and 22,078 ms); every recorded answer event joins to a recorded answer (plus the seeding answer).
- **Labels:** every run is `recorded`, `live` and `gemma4:e2b-it-qat`; the page carries the "Recorded local Gemma evaluation — no live inference" label; a fixture report is refused.
- **Invalid evidence:** a missing file, invalid JSON, a non-object, a missing stage, inconsistent counts, a non-live answer and a missing answer each raise `EvidenceError` naming the file and the problem; the CLI prints "Evidence check failed: …" and exits 1.
- **Public safety:** the public data matches none of the export's `FORBIDDEN` patterns, and `render()` refuses four examples (a home-directory database path, a Sentry DSN, the local Ollama URL and an email address). The patterns are a selected, additional safeguard, not comprehensive secret detection, so they do not prove the data holds no other private string; `site/` holds exactly four files; local asset paths are relative and exist, and external links go only to the GitHub repository; the script's only `fetch` is `data/evidence.json`, with no `/api/`, Ollama port, localhost, storage, `innerHTML` or `eval`.
- **Blueprint:** one static site publishing `./site`, with no start command, plan, environment variables or database, and a CSP whose `connect-src` is `'self'`.

**Not verified:** a real Render deployment (T-E3), the Blueprint being accepted by Render, the headers on a deployed site, other browsers, and assistive technology. *(The deployment, the Blueprint and the deployed headers were verified later on October 28; see "Render deployment T-E3". Other browsers and assistive technology remain unverified.)* *(Correction, documentation audit: the "no horizontal page overflow at phone width" result in the table above was not reproduced; in headless Chrome emulation at the tested 375 px viewport, the document's scrollWidth was 573 px. See "Documentation audit" above and T-E7.)*

## Real Sentry traces T-D3 (October 28, 2026)

All times in this section are IST on October 28, 2026. The user created a Sentry project and ran these commands from `ghostcache/` with `GHOSTCACHE_SENTRY_DSN` exported from the git-ignored `.env`. The DSN was never printed, pasted or committed. The planner read the values below from the user's Sentry screenshots and cross-checked them against the reports; this documentation pass rechecked the reports.

| Report written | Command | Result | Sentry trace |
| --- | --- | --- | --- |
| 09:10:11 | `.venv/bin/python -m ghostcache evaluate --mode fixture --output ../runs/sentry-fixture.json` | passed, 10/10 | a fixture conversation, 0.15 ms, no model calls |
| 09:18:11 | `.venv/bin/python -m ghostcache evaluate --mode live --output ../runs/sentry-live-cold.json` | passed, 10/10, `gemma4:e2b-it-qat` | `dd21f76b3293450b84b0ad5ca45961dd` |
| 09:19:33 | `.venv/bin/python -m ghostcache evaluate --mode live --output ../runs/sentry-live-warm.json` | passed, 10/10, `gemma4:e2b-it-qat` | `fb1530272ecd481399aa77f95d505dfa` |

**Failed attempts, and what "cold" means.** At 09:16, three earlier live attempts failed with `Ollama is unavailable (connection failed)` because the Ollama server was not running. Each exited 1 with no fixture fallback, and each sent a short failed `evaluate live` trace. No report from them is kept in `runs/`. The user then started `ollama serve`. The 09:18 run was therefore the first evaluation after a fresh Ollama server start ("cold"). The 09:19 run followed straight afterwards, with the model still loaded ("warm"). `ollama stop` was not used.

**What Sentry showed.**

- **Agents view** (`results/sentry-agents-overview.jpg`): three conversations of 11 messages each, with timespans of 1.02 min (cold), 21.00 s (warm) and 0.15 ms (fixture); agents `ghostcache-assistant` and `ghostcache-summarizer`; 0 errors. Sentry shows its own banner: "These conversations' inputs and outputs weren't captured". Estimated cost shows no data (a local model has no pricing).
- **Both live traces** (`results/sentry-cold-trace.jpg`, `results/sentry-warm-trace.jpg`): root `ghostcache.evaluate` "evaluate live", release `0.1.0`, environment `local-live`, 39 spans, 0 issues. Every span's `domain` is `ghostcache-local`.
- **Cold against warm:**

  | Span | Cold `dd21f76b3293450b84b0ad5ca45961dd` | Warm `fb1530272ecd481399aa77f95d505dfa` |
  | --- | ---: | ---: |
  | First `chat gemma4:e2b-it-qat` model-call span (the summarizer's, during reset; a child of `invoke_agent ghostcache-summarizer`) | 40.45 s | 2.28 s |
  | `ghostcache.reset` | 48.20 s | 9.58 s |
  | `ghostcache.verify` | 4.99 s | 4.51 s |
  | Root `ghostcache.evaluate` | 1.03 min | 22.40 s |

  Every later chat span takes about 1–3 s in both traces. The warm first chat span (`results/sentry-warm-chat-tokens.jpg`) used 181 input + 55 output = 236 tokens.
- **The leak, in the cold trace** (`results/sentry-source-only-leak.jpg`, `results/sentry-c-vault-search.jpg`): after the source-only `delete_memory` (11.86 ms), the `invoke_agent ghostcache-assistant` span (2.77 s; `duration 2770.708`) has `ghostcache.stage: source_only`, `ghostcache.question_kind: paraphrase`, `ghostcache.answer_contains_marker: true` and `status: ok`. Its `search_memory` child (0.23 ms, memory store `ghostcache-sqlite`, 6 records) has `ghostcache.context_ids` = `c-vault, s-mixed, s-handoff, s-vault, conversation-ac1ed7b44098484690552c629a0b637a, d-garden`.

**Cross-check against the reports.**

- `answers.<key>.trace.duration_ms`: cold `source_only` 2770 ms (span 2.77 s), cold `before` 2887 ms (span 2.89 s), warm `source_only` 2845 ms.
- Per-call `duration_ms` in the `events` list: cold first call 40,407 ms, the other ten 1,116–2,887 ms, 61,325 ms in total. Warm first call 2,278 ms, the other ten 1,042–2,845 ms, 22,078 ms in total. The first call is about 38.1 s of the 39.2 s difference in summed call time. Input tokens per run: 3,198 cold and 3,190 warm.
- In both reports, the marker appears in the `before` and `source_only` answers only. It is in none of `secret`, `paraphrase`, `retained` or `shared` (the answers after cascade deletion).
- Cold `source_only` citations: `c-vault, s-mixed, s-handoff, s-vault, conversation-ac1ed7b44098484690552c629a0b637a`. `d-garden` was supplied as context but not cited.
- Both reports show the same stage counts as `results/fixture.json` and `results/live-gemma.json` (14/14/0/6, then 14/13/5/5, then 15/9/0/0).
- The October 27 run in `results/live-gemma.json` has the same shape: first call 81,246 ms, then 2,389–6,776 ms per call.

**Findings.**

1. In the cold run, the first model call took 40.45 s against 2.28 s warm. That one call accounts for most of the 1.03 min against 22.40 s difference; every later call is 1–3 s in both. This is consistent with Ollama loading the model on the first request after a server start. GhostCache does not record Ollama's `load_duration`, so the cause is **inferred, not measured**. The pass/fail result (10/10 in both runs) does not show this. The report's per-call `duration_ms` events do record it, but the trace places the call inside `ghostcache.reset` next to every other span.
2. The trace makes the source-only leak visible without exporting any content: `answer_contains_marker: true` and the synthetic `context_ids` show that the deleted document's chunk, three summaries and an earlier saved answer were still retrieved and sent to Gemma.

**Evidence files** (copied or converted on October 28, 2026). The JSON reports are byte-for-byte copies. The screenshots were converted from the user's PNGs with `sips -s format jpeg -s formatOptions 80 -Z 1800`, and each was checked: it is legible and shows no DSN, Sentry URL, email address, home path or hostname.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `results/sentry-live-cold.json` | 13,238 | `d46bd854eecb72ee578c4a5135c8afaeb98cd98a42231333736fc1729c819c05` |
| `results/sentry-live-warm.json` | 13,237 | `828c5e498fac97992a142086cb135917e9783492934d8ff470edd100825853c0` |
| `results/sentry-agents-overview.jpg` (1800×981) | 207,511 | `0200fd5fca76786dd3dc8ba026289a17ff1fa08ddb2dca998712e6d262bacb79` |
| `results/sentry-cold-trace.jpg` (1800×978) | 236,946 | `0fed579298db44b758572b9a04cd2f466c4e35ad192c8f51ee5ae6b3a3aa1c77` |
| `results/sentry-source-only-leak.jpg` (1800×977) | 284,583 | `2e69935c729720bc0ee3ef5e79ba3ef67769ead0857cebea3ba8224907533e43` |
| `results/sentry-c-vault-search.jpg` (1800×979) | 255,933 | `a87e803ce2b791ffb0206747052c6acf41a0b96aa3730f983d94fb5c4ea93e39` |
| `results/sentry-warm-trace.jpg` (1800×982) | 244,400 | `e78d8a1b4705e0527864bbbefd9f4700c90ddb399bcb02195a9e074fd0abb438` |
| `results/sentry-warm-chat-tokens.jpg` (1800×984) | 271,669 | `219e6fe15ecf7204165ebdeb1656cb890d312619bfc9624eea3b0f53635e79e4` |
| `results/sentry-failed-run.jpg` (1800×979; added later on October 28, from source PNG SHA-256 `23b7a39d81393df51efe5e2daf8bdfd360d61b43332aee6c86d8334ea8683a30`) | 153,911 | `4142d9b6cfe3121839951462eead848fc5cd7ca5f1a011c77ab5fd1fbf3efd5a` |

The fixture report stays outside the repository: `../runs/sentry-fixture.json`, SHA-256 `7e2fc0cc6ace4ae8d1e59c9640b46cf96017e9733ef92e91bf714dd3cd105270`.

**Not verified.**

- The cause of the slow first call. Model loading is inferred; no `load_duration`, memory or Ollama log was recorded (T-C2 stays open).
- Of the three failed 09:16 attempts, one trace was inspected later on October 28, 2026: `7e075ad683f247d687b59dddbb038ce5` (`results/sentry-failed-run.jpg`). It has 1 span, the root `ghostcache.evaluate` "evaluate live", 9.69 ms (`duration 9.68504`), status `internal_error`, 0 issues, `error.type: ProviderError`, `ghostcache.mode: live`, `origin: manual`, release `ghostcache@0.1.0`, environment `local-live`. Its `precise.start_ts` 1793159179.292204 is 03:46:19 UTC (09:16:19 IST). It has no `ghostcache.error.category`, because the run stopped at the Ollama availability check in `Experiment.reset`, before any `gen_ai.chat` span; that attribute is set only on a failed chat span. Sentry's note "This span returned an error status but has no associated issue" is expected, because `telemetry.py` drops every error event. The other two failed traces were not inspected.
- No screenshot of the fixture trace itself was saved; it is seen only as a conversation in the Agents view.
- These traces come from the user's manual runs. No automated test or CI step sends anything to Sentry.

### Sentry plan and usage T-D1 (October 28, 2026)

The planner read these values from the user's Sentry screenshots on October 28, 2026. The screenshots are not saved in `results/`.

- **Settings → Subscription → Overview:** "Trial plan", a **Business Plan Trial** with 14 days left. No billing details and no payment method on file, so no card was needed. Usage period Oct 28 – Nov 10, 2026: **spans 120 used of 100M**, errors 0 of 1M, and 0 for every other feature.
- **Settings → Stats & Usage** (Errors, last 14 days): 0 errors in total, accepted, filtered, rate-limited or invalid. This is expected, because `telemetry.py` drops every error event (`before_send` returns `None`) and sends traces only.
- **Cross-check:** 120 spans is consistent with the recorded runs. The fixture, cold and warm evaluations sent 39 spans each (117). Each of the three failed 09:16 IST attempts could send only its root `ghostcache.evaluate` span (3): `Experiment.reset` checks Ollama's availability and raises before it opens the `ghostcache.reset` span (`app.py`). One failed trace, `7e075ad683f247d687b59dddbb038ce5` (`results/sentry-failed-run.jpg`), was later confirmed to contain exactly one span. The other two are inferred, not inspected.
- **What it means:** the account used a 14-day Business trial, not the free Developer plan the original plan targeted. The Developer plan's limits and what happens when the trial ends were not checked. At about 40 spans per evaluation, the span quota is no practical constraint for this challenge. The trace screenshots are saved in `results/`, so the evidence does not depend on Sentry's retention after the trial.

## Sentry tracing T-D2 (October 28, 2026)

**Change.** New `ghostcache/telemetry.py` adds optional, metadata-only Sentry tracing, off unless `GHOSTCACHE_SENTRY_DSN` is set. `app.py` and `__main__.py` are instrumented and wired; `providers.py` gains `error_category` and names its fixed `temperature` and `max_tokens`. No return value, report field, ledger entry, HTTP response or exit code changes. `pyproject.toml` adds the optional `sentry` extra; `dependencies = []` is unchanged. The SDK was installed only into `.venv` (`sentry-sdk 2.72.0`, which brought its own dependencies `urllib3 2.8.0` and `certifi 2026.10.23`).

| Command | Result |
| --- | --- |
| `python3.12 -m unittest discover -s tests -v` (no `sentry-sdk`; Node v22.23.4 on PATH) | **Ran 71 tests in 0.889s: OK (skipped=6)**. The 6 skips are the SDK telemetry tests ("sentry-sdk not installed; optional extra") |
| `.venv/bin/python -m unittest discover -s tests -v` (`sentry-sdk` 2.72.0) | **Ran 71 tests in 0.830s: OK**, none skipped. One `DeprecationWarning`: 2.72.0 deprecates `send_default_pii` in favour of `data_collection`; `send_default_pii=False` is still honoured |
| `python3.12 -m ghostcache evaluate --mode fixture --output <scratch>/a.json` (DSN unset) | exit 0; `passed: true`; 10/10; nothing on stderr |
| `python3.12 -c "import ghostcache.app, sys; print('sentry_sdk' in sys.modules)"` | `False` |
| `GHOSTCACHE_SENTRY_DSN=<dummy> python3.12 -m ghostcache evaluate --mode fixture` (no SDK) | exit 1; stderr is only the fixed message; the DSN is not printed |
| `node --check web/app.js` | passes |
| `shasum -a 256 results/*` | all four evidence files unchanged |

**Proof that the tests depend on the instrumentation.** In scratch copies, all 6 SDK tests failed (4 failures, 2 errors) both with the previous `app.py` and `__main__.py` and with `telemetry.span` turned into a no-op. A third copy that sent the question text as `ghostcache.question_kind` failed the privacy test: "Which access phrase opens the observatory vault?" was found in the envelope bytes. The missing-SDK test also fails against the previous `__main__.py`. During that proof, a first attempt with the previous `__main__.py` (which has no DSN check) let the missing-SDK test start a real `serve` on the default port 8765, with a temporary `--database`. It was stopped, and the test now patches the HTTP server so it can never bind a port. `.local/assistant.sqlite` was not touched.

**SDK behaviour confirmed in the installed 2.72.0 source:**
- `start_transaction(op=, name=)` and `start_span(op=, name=)` exist; spans are sent only inside a transaction; `Span.set_data(key, value)` and `Span.set_status("internal_error")` exist; `Span` has no `attributes=` argument.
- `Scope.set_conversation_id` and `sentry_sdk.ai.set_conversation_id` both exist; the code uses the scope method. The SDK copies the ID onto `gen_ai.*` spans as `gen_ai.conversation.id` when they finish.
- `gen_ai.*` spans are split out of the transaction into a separate `span` envelope item (version 2, typed attributes), so the tests read every item.
- `Transport.capture_envelope(envelope)` is the abstract method; `transport=` accepts an instance. A raising transport propagates out of a transaction's finish, so `telemetry.span` swallows exporter errors.
- `default_integrations=False` also skips the auto-enabling integrations.

**Not done.** No real Sentry account, DSN, network call or trace (T-D1, T-D3). No live Gemma run: the live path was tested with mocked Ollama. The new CI step has not run on GitHub yet.

*Update, later on October 28, 2026:* the CI step has now run on GitHub: [run #5](https://github.com/bipul724/GhostCache/actions/runs/40623927599) succeeded (see "Hosted CI run #5" below). Real traces and two live runs are recorded in "Real Sentry traces T-D3" above. The Sentry plan and usage (T-D1) were recorded later the same day; see "Sentry plan and usage T-D1".

## Hosted CI run #1 (October 28, 2026)

- **Repository:** [bipul724/GhostCache](https://github.com/bipul724/GhostCache): public, MIT, default branch `main`, with `ghostcache/` as the repository root. 25 commits; HEAD `6e767ee`. `git ls-files` lists 32 files, with no `__pycache__`, `.local/`, `.env` or `.DS_Store`.
- **Run:** [run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) (job 122423115717) of the workflow "GhostCache deletion checks", triggered by the push of `6e767ee` on 2026-10-27 at 19:35 UTC (October 28, 01:05 IST). Conclusion: **success**. The job "Tests and fresh synthetic evaluation" took 10 s; the run took 14 s in total.

| Step | Result |
| --- | --- |
| Check storage, provenance, and HTTP invariants | `Ran 62 tests in 3.013s` / `OK`, none skipped. All 7 `test_ui` tests ran and passed, so Node was on the hosted runner's PATH. |
| Evaluate a fresh synthetic deletion case | Success. `evaluate` exits 0 only when the report has `passed: true` (`__main__.py`), so the hosted fixture evaluation passed. |
| Upload | Artifact `ghostcache-synthetic-evaluation`, 2,107 bytes, kept 3 days. Run #1's artifact was not downloaded. The report from run #3 was downloaded and inspected instead (JSON SHA-256 `cf68765a7cd229ad54274e2457e163e09cec5b83d9eb4625c40b984724490bc7`; see below). |

- The pinned actions (checkout `v7.0.1`, setup-python `v7.1.0`, upload-artifact `v7.0.2`) resolved, with no errors.
- One notice: `ubuntu-latest` migrates to Ubuntu 26 from October 19, 2026 (actions/runner-images#14748). It is informational only; Python 3.12 is installed by setup-python.

### Hosted CI runs #2 and #3

- **Run #3** ([run](https://github.com/bipul724/GhostCache/actions/runs/40573873485), push of `172ccb4`) also passed: 62 tests and a successful evaluation step.
- **Run #2** (same commit, created in the same second) was cancelled before any step by the workflow's `cancel-in-progress` concurrency setting. It was a duplicate push event, not a failure.
- **Run #3's report, downloaded and inspected by the planner on October 28, 2026.** The `ghostcache-synthetic-evaluation` zip is 2,106 bytes (SHA-256 `1170be7817b55f64fa8533aa8fbc57f66dd79e170eb948659b10c5ba1426f281`). It contains one file, `ghostcache-fixture.json`: 13,531 bytes, SHA-256 `cf68765a7cd229ad54274e2457e163e09cec5b83d9eb4625c40b984724490bc7`.
- Contents: mode `fixture`, `passed: true`, model "Deterministic fixture — no AI call", 10 of 10 checks passed. It has the same top-level keys and the same 10 check names, in the same order, as `results/fixture.json`. Its fresh marker differs from the saved report's, so it is a new synthetic case. No runner paths or credentials appear in it. The file was not added to the repository.

### Hosted CI run #5 (October 28, 2026)

- **Run:** [run #5](https://github.com/bipul724/GhostCache/actions/runs/40623927599) (job 122604231695), triggered by the push of `7abcc11` ("Add optional metadata-only Sentry agent tracing") at 02:57 UTC (08:27 IST). Conclusion: **success**.
- **Steps:** all seven steps succeeded, including step 7, "Check telemetry privacy with the optional Sentry SDK", on its first hosted run.
- **Evidence limits:** the step results were read through GitHub's public API. The log text was not read, so the hosted test counts for this run are not recorded. Run #4 (push of `7602577`, a docs-only commit) also succeeded according to the same API.

## UI fixes T-A2, T-A3 and T-A4 (October 27, 2026)

**Changes (in `web/` only, with no backend change):**
- The answer trace renders `trace.parent_ids` as "Context: …", or "Context: none retrieved" for an empty list. The dead `retrieved_ids` branch is gone.
- "Look for the echo" sends `scenario.questions.paraphrase`. The step 04 subtitle is now "Ask again in different words".
- The fixture banner message is "Deterministic rules. No model inference.", and the fixture trace suffix is "Deterministic fixture; no model inference".

| Command | Result |
| --- | --- |
| `python3.12 -m unittest discover -s tests -v` (Node v22.23.4 on PATH) | **Ran 62 tests in 0.786s: OK**, none skipped (55 earlier tests + 7 in `tests/test_ui.py`) |
| `python3.12 -m unittest tests.test_ui -v` with `node` removed from PATH | `Ran 7 tests … OK (skipped=6)`; only the pure-Python fallback check runs |
| Each Node case against the **previous** `app.js` (`node tests/ui/app_contract.js <case> <old app.js>`) | 5 of 6 fail: `context_from_parent_ids`, `context_empty_and_missing`, `echo_sends_paraphrase`, `fixture_banner_wording` and `live_mode_label` (no "Context:" in the trace). `reset_and_delete_clear_stale_display` **passes** on the old file: it guards behaviour that already worked. |
| `python3.12 -m ghostcache evaluate --mode fixture --output <fresh scratch path>` | exit 0; `passed: true`; 10/10 |
| `node --check web/app.js && node --check tests/ui/app_contract.js` | both pass |
| `shasum -a 256 results/*` | All four evidence files unchanged |
| HTTP smoke test: separate `serve` on free port 8799 with a scratch database, fixture mode; requests through `urllib` | Served `app.js`/`index.html` contain the changes. After source-only deletion, the paraphrase returned the marker with `parent_ids` listed. Verify 8/8; retained `07:40`, shared `Lantern Hall`. The server was stopped and the scratch database removed. |

**Browser verification (October 27/28, by the planner, in the built-in Chromium-based browser):**
- A separate `python3.12 -m ghostcache serve --mode fixture --port 8811 --database <scratch>` was used; port 8765 and `.local/` were not touched.
- The banner read "Deterministic rules. No model inference." with "NO MODEL REQUIRED", and the step 04 subtitle read "Ask again in different words".
- Seed → ask → delete the source only (15 nodes) → look for the echo: it sent "Which access phrase opens the observatory vault?", the marker was echoed, and the trace read "Context: c-vault, s-mixed, s-handoff, s-vault, d-garden, c-garden · Deterministic fixture; no model inference". Cleanup → verify gave **8 / 8 PASS**.
- The retained and shared shortcuts answered correctly, with the context shown.
- No console errors. At a 375 px viewport the page `scrollWidth` was 375 (no horizontal page scroll), and the trace wrapped.
- No new screenshots were saved; `results/*.jpg` still show the pre-fix wording. *(Resolved October 29, 2026: new local captures of the current wording were saved separately for T-A9 in [screenshots/ui-content-refresh-2026-10-29/](screenshots/ui-content-refresh-2026-10-29/README.md); the October 27 images are unchanged.)*

Not run: live Gemma and hosted CI. The UI tests on the hosted runner depend on Node being on its PATH, which is unverified until a real Actions run. `.github/workflows/` was not changed.

## First-attach follow-up (October 27, 2026)

**Problem (reproduced).** With `--database` pointing at an existing, valid but unrelated SQLite file (one table, `notes`), a reset whose publication failed still added the `artifacts`, `provenance` and `sqlite_sequence` tables, changing the file's bytes. The first-attach branch opened the target with `Store(path)`, whose `CREATE TABLE IF NOT EXISTS` ran before `replace_contents()`. **Fix:** the target is opened with `Store(path, create_schema=False)` (connect, row factory and `PRAGMA foreign_keys` only), and the backup writes the schema. Every other `Store` use is unchanged.

| Command | Result |
| --- | --- |
| `python3.12 -m unittest discover -s tests -v` | **Ran 55 tests in 0.192s: OK** (11 store, 23 controller, 9 HTTP-handler, 12 provider/transport/CLI) |
| `test_failed_first_attach_does_not_write_to_an_unrelated_sqlite_file` against a scratch copy with the old `Store(self.path)` line | Fails: the file's SHA-256 changes |
| `python3.12 -m ghostcache evaluate --mode fixture --output <fresh scratch path outside the repo>` | exit 0; `passed: true`; 10/10 checks |
| `shasum -a 256 results/*` | All four evidence files unchanged |

**Not run:** live Gemma, browser QA, GitHub Actions, crash or power-loss testing, Windows.

## What was actually run after the reset-publication and transport-error fixes (October 27, 2026)

A review reopened T-A5 and T-A6 with four reproduced defects. A failed reopen after D-19's file swap left the controller on an unlinked inode. The candidate file could leak, and an unrelated `<database>.candidate` was deleted. Transport error text was echoed into messages. `IncompleteRead`/`BadStatusLine` escaped as HTTP 500 or a traceback. The fixes are recorded as DECISIONS.md D-20 and the amended D-10.

| Command | Result |
| --- | --- |
| `python3.12 -m unittest discover -s tests -v` | **Ran 52 tests in 0.203s: OK** (11 store, 20 controller, 9 HTTP-handler, 12 provider/transport/CLI) |
| The 16 new tests run against the pre-fix code (in a scratch copy, with a `StorageError` stub so the modules import) | 14 fail: 6 of 7 `PublicationTests`, `StorageFailureHTTPTests`, both `TransportHTTPTests`, 3 of 4 `TransportErrorTests` and both store-primitive tests. Two also pass on the old code because they guard behaviour it already had: `test_candidate_construction_failure_changes_nothing` and `test_non_transport_defects_still_propagate`. |
| `python3.12 -m ghostcache evaluate --mode fixture --output <fresh scratch path outside the repo>` | exit 0; `passed: true`; 10/10 checks; model `Deterministic fixture — no AI call` |
| `shasum -a 256 results/*` | All four evidence files unchanged (`fixture.json` `b4d187bd…c7a19044`, `live-gemma.json` `1146258e…89d44992`, `ghostcache-ui-desktop.jpg` `f99c86d4…0442a25d`, `ghostcache-ui-mobile.jpg` `0ce9c54b…c027518f`) |
| Suite rerun with `TMPDIR` pointed at an empty scratch folder, then a search of the application directory | No files left in `TMPDIR`; no `*.candidate`, `-journal` or backup files in the application directory |
| Import check (AST scan against `sys.stdlib_module_names`; `python3.12 -I` import of `ghostcache.app` and `ghostcache.__main__`) | Every import in `ghostcache/` and `tests/` is standard library |

**Measured while implementing:** the brief's `SAVEPOINT` / `ROLLBACK TO` / `RELEASE` write probe changed the database file's SHA-256, because `RELEASE` commits an empty transaction. `check_writable()` therefore rolls back the whole transaction. Both forms detect the replaced-file case, which `BEGIN IMMEDIATE` did not.

**Not run:** live Gemma evaluation (no model calls), browser QA, GitHub Actions, crash or power-loss testing, and Windows. All new tests use temporary databases, mocked `urlopen` or `ScriptedLive`. `.local/assistant.sqlite` and `results/` were not touched.

## Earlier run after the first T-A5/T-A6 fixes (October 27, 2026)

The reset design verified here (D-19) was later superseded by D-20 (see above).

| Command | Result |
| --- | --- |
| `python3.12 -m unittest discover -s tests -v` | **Ran 36 tests in 0.126s: OK** |
| `python3.12 -m ghostcache evaluate --mode fixture --output <fresh scratch path outside the repo>` | exit 0; `passed: true`; 10/10 checks; model `Deterministic fixture — no AI call` |
| `shasum -a 256 results/*` | Both JSON reports and both screenshots unchanged (same hashes as below) |
| Import check with `python3.12 -I` (isolated mode, no user site-packages) | `ghostcache.app` and `ghostcache.__main__` import; all imports in `ghostcache/` and `tests/` are standard library |

**Not run:** live Gemma evaluation (no model calls), browser QA, GitHub Actions. All new tests use mocked transport or a scripted provider, plus temporary databases. The running demo database `.local/assistant.sqlite` was not touched.

## Earlier documentation audit (October 27, 2026, before the fixes)

The last two rows below record the bugs as found. They were fixed afterwards (T-A5, T-A6) and are now covered by regression tests.

| Command | Result |
| --- | --- |
| `python3.12 -B -m unittest discover -s tests -v` | **Ran 22 tests in 0.042s: OK** |
| `python3.12 -B -m ghostcache evaluate --mode fixture --output <scratch path outside the repo>` | exit 0; `passed: true`; 10 checks; model `Deterministic fixture — no AI call` |
| `node --check web/app.js` (Node v22) | no syntax errors |
| `shasum -a 256 results/*.json` | `fixture.json` `b4d187bd0d308383e45d04ea80fe90bb6145caf69197db56c9b7a592c7a19044`; `live-gemma.json` `1146258ea99bfc5f64c013acc03d1823a25dff452facc3f94835209689d44992`. Both match the values recorded in `context.md`. |
| Mocked `urlopen` returning model content `[]` and `"text"` | **Uncaught `AttributeError`**, not `ProviderError` (fixed afterwards by T-A5) |
| Mocked live reset whose 2nd summary raises `ProviderError` | Error raised; state left at `stage="seeded"` with 11 artifacts and `seed_checks` not refreshed (fixed afterwards by T-A6) |

**Not run in this audit:** live Gemma evaluation (no model calls were made), browser QA, and GitHub Actions. The saved files in `results/` were not modified.

## Test inventory (126)

**`tests/test_store.py`: 11 store tests** (9 in `StoreTests`, 2 in `PublicationPrimitiveTests`), using in-memory SQLite except for the reopen and publication-primitive tests:

| Test | Covers |
| --- | --- |
| `test_naive_deletion_keeps_stale_copies_but_filtered_retrieval_rejects_them` | Source-only deletion leaves 3 marker copies and 3 stale artifacts; `exclude_stale` hides them |
| `test_multi_hop_purge_erases_every_descendant_and_keeps_edges` | Transitive purge, edges and `source_ids` kept, repeat is a no-op |
| `test_mixed_summary_invalidated_whole_but_independent_source_preserved` | Mixed summary invalidated whole; other root survives; rebuild from root |
| `test_independently_sourced_duplicate_fact_survives_and_audit_reports_it` | A duplicate fact from an independent source is still active and still reported by the audit |
| `test_titles_are_audited_and_scrubbed_alongside_bodies` | Marker in titles found, then replaced with `Withdrawn document` and `Purged summary` |
| `test_invalid_parents_and_cycles_cannot_be_inserted` | Missing, self and duplicate-ID parents, parentless derived artifacts, and documents with parents are all rejected |
| `test_stale_active_parent_and_deleted_root_cannot_create_new_memories` | No new artifacts from a deleted root or a stale parent |
| `test_reopen_preserves_provenance_tombstones_and_erased_bodies` | Persistence across reopening a file-backed database |
| `test_lexical_retrieval_returns_only_matching_active_artifacts` | Term matching, limit 0, missing IDs |
| `test_aborted_copy_leaves_bytes_and_writability_then_full_copy_replaces` | `replace_contents` aborted after the second one-page backup step leaves the file byte-identical and writable; a full copy replaces the contents, stays writable, survives reopening and leaves no extra files |
| `test_write_probe_changes_nothing_and_detects_a_replaced_file` | `check_writable` leaves rows and file bytes unchanged, and raises `OperationalError` once the file has been replaced under the connection |

**`tests/test_app.py`: 33 controller tests** (9 in `ExperimentTests`, 5 in `ResetFailureTests`, 10 in `PublicationTests`, 9 in `RebuildOutcomeTests`). `OllamaProvider.status` is patched to "offline", so nothing touches the network. `ResetFailureTests` and `PublicationTests` use a temporary file database and `ScriptedLive`, a deterministic stand-in for Ollama that can fail on a chosen summary or answer call. `failing_publication()` runs the **real** `Store.replace_contents` with `pages=1` and a progress callback that raises on step 2, so the SQLite backup aborts with pages still to copy. `tracked_connections()` patches `ghostcache.store.sqlite3.connect` to use a connection subclass that records `close()`. The leftover-file helper allows only the database itself (and any named unrelated file) in the temporary directory.

| Test | Covers |
| --- | --- |
| `test_complete_fixture_demonstrates_leak_and_cleanup` | The full fixture journey through `verify()` |
| `test_cleanup_rebuilds_only_from_surviving_roots` | `s-rebuilt-*` has no `d-vault` root and no old marker, and keeps `07:40` |
| `test_reset_uses_fresh_marker_and_discards_prior_context` | Each reset gets a new marker; the old marker is absent |
| `test_verify_does_not_pass_before_cleanup` | `verify()` fails when seeded and after source-only deletion |
| `test_repeated_cleanup_does_not_rebuild_or_change_survivors` | A second cascade changes nothing |
| `test_failed_rebuild_stays_in_the_ledger_after_repeated_cleanup` | With `ScriptedLive` failing the fourth summary (the rebuild), cascade returns `rebuild_error` and logs `delete.propagated` then `summary.rebuild_failed` (`error_type` `ProviderError`); a repeated cascade purges nothing, reports no error and makes no fifth summary call, and the state's ledger still holds the failure with no `s-rebuilt-*` artifact. This is the record the lab reads |
| `test_live_request_never_silently_uses_fixture` | Live reset with no model raises; a live `ask` error propagates |
| `test_deletion_during_generation_prevents_stale_commit` | Deletion between reading the context and committing is refused |
| `test_evaluation_labels_fixture_and_preserves_positive_controls` | `evaluate("fixture")`: passes, 10 checks, 0 marker rows |
| `test_failed_first_seed_publishes_nothing_and_leaves_no_database` | A failure on the first summary with no prior experiment leaves stage `empty`, no artifacts, scenario, events or checks, generation 0, no database file and no candidate file; `verify` and `delete` refuse to run |
| `test_failure_at_any_seed_step_keeps_previous_experiment` | After a successful experiment, failures on summary 1, 2 or 3, on the baseline answer, and a non-provider `RuntimeError` each re-raise and leave mode, stage, scenario, artifacts, events, `seed_checks`, generation and the database file bytes unchanged; the preserved experiment then completes source-only → cascade → verify |
| `test_invalid_mode_and_unavailable_model_leave_state_untouched` | Invalid mode (`ValueError`) and unavailable live model (`ProviderError`) change nothing and make no model calls |
| `test_successful_reset_after_failure_replaces_all_run_state` | Recovery after a failure: fresh marker, live mode, stage `seeded`, generation +1 (not +2), one passing baseline check, 5 live events, 14 artifacts, old marker absent in memory **and** in the reopened database file |
| `test_failed_reset_does_not_modify_an_existing_database_file` | A restarted controller whose first reset fails leaves an existing database file byte-identical |
| `test_candidate_construction_failure_changes_nothing` | `Store()` raising for the candidate, both before and after attachment, leaves memory, file bytes and files unchanged; the attached experiment still persists answers |
| `test_mid_publication_failure_keeps_attached_experiment_and_file` | A real mid-copy abort re-raises the original exception; mode, stage, scenario, artifacts, events, `seed_checks`, generation and file SHA-256 are unchanged; disk artifacts equal memory; `ask` persists to disk; source-only → cascade → verify passes; a later reset leaves only the new marker in an independently reopened `Store` |
| `test_mid_publication_failure_on_first_attach` | With no file, the file is removed and state stays empty. With an existing file, its bytes are unchanged; a later reset replaces its contents |
| `test_publication_never_swaps_files_and_opens_the_database_once` | Across successful and failed resets, `os.replace`/`os.rename` are never called, and the database path is opened exactly once, by the current store's connection |
| `test_unverifiable_restore_enters_storage_failed_then_recovers` | Publication failure plus a failed post-restore probe raise `StorageError` (fixed message, chained from the original); stage `storage_failed`, empty scenario, events, checks and artifacts, generation unchanged; `ask`/`delete`/`verify` refused; the next reset reopens the file and recovers, with no other connection left open |
| `test_failed_target_construction_removes_only_files_it_created` | A target `Store` (asserted to be opened with `create_schema=False`) that creates the database and `-journal` and then raises: both removed when new, an existing database's bytes kept; an unrelated `<database>.candidate` survives failed and successful resets |
| `test_failed_first_attach_does_not_write_to_an_unrelated_sqlite_file` | An existing valid SQLite file with only a `notes` table, plus a real mid-copy failure on first attach: SHA-256 and table list unchanged, state empty, only the placeholder connection left open, no leftover files |
| `test_successful_first_attach_replaces_an_unrelated_sqlite_file` | The same kind of file plus a successful reset: it now holds only the GhostCache tables and the new marker (the documented disposable-database behaviour) |
| `test_probe_failure_after_a_completed_first_copy_is_not_hidden` | The documented exception: the copy into an existing file completes, then `check_writable` fails. The error is re-raised, the file holds the new experiment, the controller is empty and unattached, and the next reset succeeds |
| `test_failed_and_successful_resets_close_every_other_connection` | After failed (seeding, first-attach copy, attached copy) and successful resets, only the current store's connection is open; `Store.__init__` on a non-database file closes its connection and keeps the file, and a reset targeting it fails without changing it |
| `test_failed_rebuild_is_in_state_without_its_message_or_content` | `RebuildOutcomeTests` (all simulated with `ScriptedLive`, file database): a failed rebuild sets `rebuild` to `failed` with the surviving roots and `invalid_output`, without the exception text, marker or document words; the purge stands and no `s-rebuilt-*` exists |
| `test_failure_outlives_the_event_window` | After 49, 50, 51, 100 and 120 later answers, `events` stays at 50, the failure event is in it only below 50, and `rebuild` stays `failed` |
| `test_thirteen_verifications_keep_the_failure` | 13 `verify()` calls evict the failure event; `rebuild` stays `failed` in `state()` and in the last verification's state |
| `test_repeated_cleanup_with_nothing_to_purge_keeps_the_failure` | A second cascade purges nothing, returns no `rebuild_error`, keeps `failed` and makes no fifth summary call |
| `test_successful_reset_starts_with_no_rebuild` | Live and fixture resets after a failure return `not_attempted` |
| `test_failed_reset_keeps_the_previous_experiment_and_its_failure` | A reset failing on its first seeding summary keeps the cleaned stage, the old marker and the failure |
| `test_storage_failed_discards_the_failure` | An unrestorable reset enters `storage_failed` with `not_attempted`; the recovery reset also starts at `not_attempted` |
| `test_a_later_successful_rebuild_resolves_the_failure` | After a simulated reappearing copy, a real cascade rebuild succeeds: `succeeded` names an active stored summary built from the same roots |
| `test_a_newer_failure_supersedes_an_older_success` | A successful rebuild, then a failed one: `failed` stands although the older summary is still active, also after 60 more events |

**`tests/test_http.py`: 10 HTTP-handler tests** (7 in `HTTPTests`, 2 in `TransportHTTPTests`, 1 in `StorageFailureHTTPTests`). These drive the real `BaseHTTPRequestHandler` through an in-memory socket fixture, with no port bound.

| Test | Covers |
| --- | --- |
| `test_state_and_static_assets_have_no_store_headers` | `no-store`, CSP `frame-ancestors 'none'`, index served |
| `test_api_workflow_exposes_failure_then_passes_cleanup` | Source-only → verify fails → cascade → verify passes |
| `test_cross_origin_and_dns_rebinding_requests_do_not_mutate` | Foreign `Origin`, foreign `Host`, other-port `Origin` all return 403 and change nothing |
| `test_bad_requests_are_rejected_without_a_traceback` | Bad mode, non-string question and bad JSON return 400; wrong content type returns 415; path traversal returns 404 |
| `test_missing_live_model_is_an_error_not_a_successful_fixture_reset` | Live reset with no model returns 502 |
| `test_malformed_live_output_is_a_502_without_fixture_fallback` | Live `ask` with model content `[]` returns 502 (not 500) with `mode: live`, no marker in the body, and no new artifact |
| `test_state_reset_and_ask_never_echo_transport_text` | For nine transport failures carrying `SENTINEL-not-a-real-key-7f3a`: `/api/state` returns 200 with `provider.message` naming the category; live `/api/reset` and live `/api/ask` return 502 naming it; the sentinel is in none of the bodies; the experiment stays seeded |
| `test_incomplete_body_read_during_ask_is_a_502` | `IncompleteRead` raised by the response's `read()` inside `json.load` gives 502 `(invalid HTTP response)` and no new artifact |
| `test_unrestorable_storage_is_a_503_and_the_next_reset_recovers` | With publication and the post-restore probe failing (the injected error text is the sentinel), `/api/reset` returns 503 with exactly the fixed message; `/api/state` shows `storage_failed`; ask, delete and verify return 400 with the same message; the next `/api/reset` returns 200 and the file holds only the new marker |
| `test_unresolved_rebuild_failure_survives_requests_and_reloads` | Simulated (patched fixture `summarize`): after a failed rebuild, 13 `POST /api/verify` and a repeated cleanup, `GET /api/state` has 50 events without the failure event, `rebuild` `failed` / `invalid_output`, and not the exception's sentinel text; a reset returns `not_attempted` |

**`tests/test_providers.py`: 12 tests** (7 provider-response tests, 4 transport tests and 1 CLI test). Ollama transport is mocked with `urllib.request.urlopen`; no model is called. Every rejection also asserts that the error message does not contain the marker and states that no fixture fallback was used. The transport matrix covers `URLError` with a string, `ConnectionRefusedError` or `TimeoutError` reason, `HTTPError` with a valid and an invalid code (the sentinel is in its message, a header and its body), `OSError`, `TimeoutError`, `ConnectionRefusedError`, `IncompleteRead` (sentinel as partial bytes), `BadStatusLine` and `RemoteDisconnected`.

| Test | Covers |
| --- | --- |
| `test_non_object_outer_responses_raise_provider_error` | Outer body `[]`, a string, `null`, a number, invalid JSON, invalid UTF-8 |
| `test_missing_or_invalid_message_structure_raises_provider_error` | `{}`, an `error` object, `message` null, string or empty, `content` null or an object |
| `test_content_that_is_not_a_json_object_raises_provider_error` | Content that is empty, invalid JSON, an array, a string, null, a number or a boolean |
| `test_invalid_answer_fields_and_unknown_citations_raise_provider_error` | Missing, empty, blank or non-string `text`; missing or non-list `citations`; non-string or unknown citation IDs |
| `test_valid_response_still_succeeds` | A valid response returns text, deduplicated citations and token counts; malformed token counts become `null` |
| `test_transport_failures_raise_provider_error` | Connection refused and timeout |
| `test_malformed_model_list_reports_live_mode_unavailable` | A malformed `/api/tags` payload reports the model unavailable instead of raising |
| `test_generation_and_status_report_only_a_category` | For each transport failure, `ProviderError` and `status()` (available `false`, never raised) name the right category and never contain the sentinel or the marker |
| `test_cli_evaluate_and_serve_failures_print_only_a_category` | For each transport failure, `evaluate --mode live` exits 1 with a failed report, and neither the report file nor stdout contains the sentinel. `serve --mode live --database <temp>` returns 1, its stderr names the category without the sentinel, and the database file is not created |
| `test_incomplete_body_read_is_a_provider_failure` | `IncompleteRead` from `read()` inside `json.load`: generation raises `ProviderError`, `status()` reports unavailable without raising, and `evaluate` exits 1 with a failed report |
| `test_non_transport_defects_still_propagate` | `urlopen` raising `RuntimeError` propagates from both generation and `status()` |
| `test_malformed_model_output_exits_1_with_failed_report` | `main(["evaluate", "--mode", "live", …, "--output", …])` with malformed output returns 1, writes `passed: false` with the error and the no-fallback note, and prints a failed summary |

**`tests/test_ui.py`: 24 UI tests** (22 in `UIContractTests`, 2 in `CleanupFailureReconciliationTests`). Twenty-three run `node tests/ui/app_contract.js <case>` as a subprocess and require exit 0; they are skipped when `node` is not on PATH (the two reconciliation tests first check the real controller and HTTP handler, then skip their Node half). Setting `GHOSTCACHE_APP_JS` runs the same cases against another copy of `web/app.js`. The harness loads the **unmodified** `web/app.js` into `node:vm`. It uses a minimal fake DOM (lazily created nodes with `textContent`, `hidden`, `value`, `classList`, attributes and children) and a fake `fetch` that records request bodies and returns canned state, ask, delete and verify replies, or a chosen HTTP failure. It waits one `setImmediate` tick for `initialize()`. Every `perform()` it drives must leave the error banner hidden. It uses only `assert`, `fs`, `path` and `vm`.

| Test | Covers |
| --- | --- |
| `test_context_from_parent_ids` | Trace contains "Context: d-vault, c-vault, s-mixed" from `parent_ids` (not citations), plus "3 ms" and both token counts; the single citation button is still `↗ c-vault`; no "Retrieved" |
| `test_context_empty_and_missing` | `[]` gives "Context: none retrieved". A missing field, `null` or a non-array gives no "Context". No "undefined" or "null" in the trace |
| `test_echo_sends_paraphrase` | `perform("inspect")` POSTs exactly `{"question": scenario.questions.paraphrase}` (a custom value, proving state is the source); the input, `lastAnswer.question` and the answer's question line match; `ask-secret` still sends the secret question; with no scenario questions the fallback is `QUESTIONS["paraphrase"]` |
| `test_fixture_banner_wording` | With the model available and unavailable: the fixture message has no "saved", "recorded", "replay" or "simulation" and contains "No model inference"; the title still says fixture; the model label is "LIVE MODEL ALSO AVAILABLE" / "NO MODEL REQUIRED"; the answer label is "DETERMINISTIC FIXTURE" and the trace has no "simulation" |
| `test_live_mode_label` | Live mode: title "Live Gemma — local model inference" ("Live local Gemma mode" before the redesign), banner `live` class, model label and answer label from the provider name, no "Deterministic fixture" in the trace, context listed |
| `test_reset_and_delete_clear_stale_display` | After an answer and 8/8 checks are shown, both `reset` and `source-only` hide the answer and show "NOT RUN" |
| `test_graph_kinds_lineage_and_tombstones` | Node shapes by kind; selecting a chunk lights its ancestors and descendants but not an unrelated document; the same drawn nodes are reused across deletions; tombstones and their accessible names |
| `test_list_view_alternative` | The list view groups artifacts by kind, and its buttons follow the selection |
| `test_storage_failed_state` | After a 503 reset: the state is reloaded and the `storage_failed` notice, `0 / 5` and a failed status show; the ledger shows `0 EVENTS` with no earlier row, the page's notes are cleared, and no answer, checks, selection, inspector or graph remain; a successful reset shows only the new experiment's one event (T-A10; extended in the review fixes) |
| `test_rebuild_failure_is_reported` | A cascade whose rebuild failed (`state.rebuild` `failed`) shows a warning with the response's fixed reason, the purge counts and "no fixture text was inserted"; a repeated cleanup that purges nothing keeps it and its reason; a reset clears it |
| `test_rebuild_failure_survives_reload` | A page opened on a cleaned experiment whose 50-event ledger no longer holds `summary.rebuild_failed` still shows the warning from `state.rebuild`, with the category's sentence; the ledger shows no "Rebuild failed" row |
| `test_rebuild_warning_survives_thirteen_verifications` | After a failed rebuild, 13 verifications whose server ledger loses the failure event keep the warning after each one, with 8/8 checks shown |
| `test_rebuild_outcome_follows_server_state` | The warning follows `state.rebuild`, not the ledger: a success shows "Rebuilt …"; a newer failure after an older stored success warns, also after its event left the window; a failure event still in the window with a later success does not warn; `invalid_output` and a missing category get fixed sentences; a server with no `rebuild` field shows no warning |
| `test_storage_failure_discards_the_rebuild_warning` | A 503 reset that ends in `storage_failed` replaces the warning with the failed storage state |
| `test_failed_reconciliation_keeps_the_original_error` | A 500 from `/api/delete`, then an unreachable `/api/state`: exactly those two requests; the original error stays, with "cannot tell whether the deletion finished"; the status says the state could not be confirmed (neither "Incomplete deletion" nor "Cleanup"); old answer and checks withdrawn; not busy; a later successful state clears it |
| `test_unchanged_state_after_a_failed_deletion_keeps_results` | A 400 rejected before any change: one `/api/delete` and one `/api/state`; the identical state keeps the answer and 8/8 checks |
| `test_failed_question_does_not_read_state` | A 502 from `/api/ask`: no state read, results kept, banner shown |
| `test_failed_mode_switch_keeps_the_confirmed_mode` | Fires the page's real `mode-select` change handler (fixture confirmed, Live chosen). A 502 from `/api/reset`: exactly one `{mode: "live"}` request, no retry or state read, the original error, menu, `selectedMode` and banner all back on fixture, answer and 8/8 checks kept, and the next Reset sends `{mode: "fixture"}`. Then a 503 with an unreachable `/api/state` (unknown state; menu and `selectedMode` agree on fixture) and a 503 that ends in `storage_failed` (the server's restored mode wins); after each, Reset sends `fixture` |
| `test_successful_mode_switch` | The same handler switches fixture → live and back: menu, `selectedMode` and banner follow each server state, and each following Reset sends that mode |
| `test_save_failure_after_purge_is_a_500_and_the_lab_shows_the_server_state` | `CleanupFailureReconciliationTests`, simulated: the real controller and HTTP handler after source-only deletion, with `Store.add_artifact` raising `sqlite3.OperationalError` during the cascade, return 500 with the generic body after one `summarize` call; the state is `cleaned`, 0 marker rows, 0 stale, `failed` / `not_stored`. The real `web/app.js` given those states shows them under the original error: warning with "The rebuilt summary could not be stored.", the audit's counts, 5 / 5, tombstones on every removed node, the server's ledger, no old answer or checks, one `/api/delete` and one `/api/state` |
| `test_validation_failure_after_purge_is_a_400_and_the_lab_shows_the_server_state` | The same with a commit-validation `ValueError`: 400 with its message, then the same display |
| `test_thread_ends_meet_their_knots` | Every link's curve ends at its knot; a same-column link (summary to summary) ends on the target's right edge, others on its left edge |
| `test_unavailable_model_and_marker_labels` | The live option is disabled and labelled unavailable with Ollama's message; the answer verdict marks a leak and a clean answer |
| `test_paraphrase_fallback_matches_backend_question` | Pure Python, no Node: the `paraphrase` fallback string in `app.js` equals `ghostcache.app.QUESTIONS["paraphrase"]` |

**`tests/test_telemetry.py`: 9 telemetry tests.** The 3 in `DisabledTelemetryTests` always run. The 6 others need `sentry-sdk` and are skipped without it. They use the DSN `https://public@example.invalid/1` with an in-memory capturing `Transport`, so nothing leaves the process, and `tearDown` closes the client (`telemetry.shutdown()`). Ollama status is patched.

| Test | Covers |
| --- | --- |
| `test_disabled_by_default_never_imports_the_sdk_or_changes_the_report` | In a subprocess with no DSN: `init` returns `False`, `evaluate` exits 0, `sentry_sdk` is not in `sys.modules`, and the report's top-level keys and check names equal `results/fixture.json` |
| `test_missing_sdk_exits_1_with_a_fixed_message_and_never_prints_the_dsn` | DSN set, `sys.modules["sentry_sdk"] = None`: `evaluate` and `serve --database <temp>` exit 1 with exactly the fixed message; the DSN is not printed; no report or database is created; the HTTP server is patched so it cannot bind |
| `test_allowlist_rejects_unknown_keys_and_non_scalar_values` | `telemetry.set` rejects unknown keys and the five forbidden `gen_ai.*` content keys, and dict, list, tuple and bytes values; it accepts a JSON string and skips `None`; disabled `span()` yields `None` |
| `test_fixture_evaluation_emits_agent_memory_reset_and_verify_spans` | A traced `evaluate`: one root (`ghostcache.evaluate`, "evaluate fixture"); `gen_ai.invoke_agent` (assistant and summarizer), `gen_ai.chat`, `gen_ai.memory.client` (`search_memory`, `create_memory`, `delete_memory`), `ghostcache.reset` and `ghostcache.verify` (8 of 8, 0 marker rows, 0 stale); every `gen_ai` span has `gen_ai.operation.name` and a 32-character conversation ID |
| `test_post_request_is_a_root_transaction` | `POST /api/ask` through the real handler is a `ghostcache.request` transaction named "POST /api/ask"; the assistant span is its child, with `search_memory`, `chat …` and `create_memory` in order |
| `test_no_content_leaves_the_process` | Serializes every envelope and asserts that none of these appear: both markers, "MOTH-", every `QUESTIONS` text and a custom question, every seeded title and body, every report answer, the hostname, the home directory and "127.0.0.1:11434" |
| `test_chat_spans_carry_token_usage_and_errors_carry_only_a_category` | Live reset with mocked Ollama: 4 `chat mock-model` spans with integer tokens (120, 30, 150), the response model, temperature 0 and max tokens 420. Timeout, HTTP 503 and malformed output each give one error-status chat span with `error.type` `ProviderError` and the category ("timed out", "HTTP status 503", "invalid_output"); the sentinel in the exception text and the model's answer never appear |
| `test_marker_flag_follows_source_only_and_cascade_deletion` | After source-only deletion the paraphrase span has `answer_contains_marker` true and its search context includes `c-vault`; after cascade it is false and `c-vault` is gone; both `delete_memory` spans name `d-vault` with the stage after the call |
| `test_a_failing_sentry_transport_never_changes_results` | `capture_envelope` raises: `evaluate` and `POST /api/ask` give the same results as an untraced run (with a fixed marker; wall-clock times, random IDs and the fingerprint over them removed), and the exporter was really called twice |

**`tests/test_site.py`: 27 public-site tests** (10 in `ExportTests`, 4 in `InvalidEvidenceTests`, 8 in `PublicSafetyTests`, 4 in `SiteBehaviourTests`, 1 in `RenderBlueprintTests`). Offline; they read the selected reports and `site/`, and write only to a temporary directory. The syntax test and the three `site/site.js` behaviour cases (`tests/ui/site_contract.js`) skip without Node. See "Public recorded walkthrough T-E2", "Residual Archive redesign" and "Review fixes to the redesign" above for what each group covers.

## Fixture evaluation vs live evaluation

| | Fixture | Live |
| --- | --- | --- |
| What generates text | Deterministic string rules (`FixtureProvider`) | Gemma through local Ollama |
| What a pass supports | Storage, provenance, retrieval and preservation invariants of this code | The same invariants **plus** this model's behaviour in **that one run** |
| Repeatability | The marker changes each run; otherwise the logic is deterministic | Can vary between runs even at temperature 0, and between model or runtime versions |
| Token counts | `null` | From Ollama |

The fixture report's 11 generation events are deterministic operations, **not** 11 model calls. Never present a fixture result as Gemma evidence.

## Interactive verification vs the full CLI experiment

- **UI "Verify the cleanup" (`POST /api/verify`): 8 checks.** It does not require the broken control to have been demonstrated first, so a direct cascade can pass. Generated answer text is saved only when persistence is enabled and supplied context has valid active lineage. The question text is not stored in that conversation artifact. Source-only answers using stale context, and answers with no context, are not persisted. Valid additional saved answers can make artifact counts differ from the CLI run.
- **`evaluate`: 10 checks.** These are the 8 above, plus "source-only control leaves marker rows" and "source-only *reworded* answer reveals the marker". Requiring the failure to actually appear before cleanup stops a model that never answered from being counted as "forgetting".

## How to read a report

The top-level keys are `project`, `mode`, `model`, `passed`, `checks[]`, `oracle`, `stages`, `answers`, `events` and `scope`.

- **`passed`** is the AND of all checks. Read the `detail` of each check that failed.
- **`oracle`** is evaluator state and **contains the marker on purpose**. The fact that it is there does not mean cleanup failed.
- **`stages`** holds `initial_audit`, `source_only_audit` and `cleaned_audit`. The expected pattern for the minimal run is 14/14/6 → 14 rows, 13 active, 5 stale, 5 marker rows → 15 rows, 9 active, 0 stale, 0 marker rows.
- **Retained-fact checks.** A live failure on `07:40` or `Lantern Hall` can be a model answer failure even though the surviving content is intact. Look at the answer text and the stored artifacts before deciding which it is. A correct answer that withholds the marker does **not** excuse marker rows left in storage.
- **Provider errors**, including malformed model output, make the CLI write `{"passed": false, "error": …, "note": "No silent switch to fixture mode."}` and exit 1. That is a failed run, never a "no leak" result.
- **Unexpected exceptions** are treated as programming defects. They are deliberately not caught: they crash with a traceback, exit non-zero and write no report. Record them anyway, and fix the defect rather than widening the catch.
- **Timing.** Events have time-of-day stamps only. Each event's `duration_ms` is one model call (or fixture operation), not wall-clock time for the run. In the October 27 live run the first call took 81,246 ms and the other 10 took 2.4–6.8 s each; in the October 28 cold and warm runs the first call took 40,407 ms and 2,278 ms (see "Real Sentry traces T-D3"). Model loading is the likely cause of a slow first call, but it has not been measured.

## Browser verification

**Already performed (earlier session, recorded in `context.md` §12):**

- A local Chrome session in fixture mode exercised:
  - all five actions,
  - the eight checks,
  - the retained and shared shortcuts,
  - the inspector and its dropdown,
  - reset.
- Viewports: desktop and 390 px.
- No horizontal body overflow and no console errors or warnings were reported.
- Screenshots: `results/ghostcache-ui-desktop.jpg` and `results/ghostcache-ui-mobile.jpg`, taken at different moments.
- This was **not** Browserbase.

**Not performed:** browser QA in live mode, assistive-technology testing, and cross-browser testing.

The public walkthrough (`site/`) is a separate page; its browser checks are recorded above in "Public recorded walkthrough T-E2", "Render deployment T-E3" and "Documentation audit", and in [DEPLOYMENT.md](DEPLOYMENT.md).

**Manual checklist for a new browser pass:**

1. Run `python3.12 -m ghostcache serve` and open `http://127.0.0.1:8765`.
2. Seed → the graph shows 14 nodes and the banner says fixture.
3. Ask for the private detail → the marker appears with citations.
4. Delete just the source → `d-vault` shows as removed and the warning appears.
5. Look for the echo → the input and the answer show the reworded question "Which access phrase opens the observatory vault?", the marker is answered again, and the trace lists "Context: …" IDs.
6. Cleanup → 6 descendants are invalidated and `s-rebuilt-*` appears in this fixture sequence: the extra Ask in step 3 saved a second conversation answer. The minimal CLI run has 5 descendants. After this browser cleanup, there are 16 total rows: 9 active, 1 deleted source and 6 invalidated descendants, before the later shortcut questions create any further answers.
7. Verify → 8/8 PASS.
8. Retained and Shared shortcuts → `07:40` and `Lantern Hall`.
9. Check the browser console for errors.
10. Every answer trace shows "Context: …" (the supplied context IDs, in order). The fixture banner reads "Deterministic rules. No model inference."

## CI (GitHub Actions)

`.github/workflows/checks.yml`:

- **Triggers and runner:** push, pull request or manual dispatch, on `ubuntu-latest` with Python 3.12 and a 5-minute timeout.
- **Steps:** runs the unit suite, then a fresh fixture evaluation into `$RUNNER_TEMP`, and uploads only that JSON (`ghostcache-synthetic-evaluation`, kept 3 days).
- **The evaluation still runs if the tests fail**, as long as Python setup succeeded.
- **Telemetry step (added October 28, 2026; first ran on GitHub in [run #5](https://github.com/bipul724/GhostCache/actions/runs/40623927599), which succeeded):** after the steps above, "Check telemetry privacy with the optional Sentry SDK" installs `sentry-sdk==2.72.0` and runs `python -m unittest tests.test_telemetry -v`. The earlier steps run without the SDK, so its 6 tests skip there. No DSN or secret is used, and nothing contacts Sentry.
- **UI contract and site behaviour tests:** they run inside the same `unittest` command, so 23 of the 24 UI tests and 4 site tests (27 in all) need `node` on the runner's PATH. Otherwise they are skipped and the job still passes. Hosted run #1 confirmed that the runner provides Node: all 7 UI tests of that time ran and passed. The workflow was not changed.
- **Security settings:** read-only contents, no persisted credentials, actions pinned to commit SHAs, no secrets, no model and no live inference.

**Status:**

- The commands were verified locally.
- **Done:** hosted [run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) passed on October 28, 2026 (see "Hosted CI run #1" above). [Run #5](https://github.com/bipul724/GhostCache/actions/runs/40623927599) passed the same day with the telemetry step (see "Hosted CI run #5").
- **Later runs (checked in the documentation audit through GitHub's public API):** runs #6 to #10 also succeeded, the latest being [run #10](https://github.com/bipul724/GhostCache/actions/runs/40725375114) on `26a1c3e` with all seven steps successful. Of the ten runs, only #2 did not succeed; it was a cancelled duplicate. The logs were not read, so hosted test counts are recorded only for runs #1 and #3 (62 tests each).
- `ghostcache/` is the repository root, so the workflow was discovered.
- Evidence: the run URLs are recorded. Run #1's report was not downloaded; run #3's report was downloaded and inspected (10 of 10 checks, `passed: true`; see "Hosted CI runs #2 and #3" above).
- **Run #16 (checked October 29, 2026, 16:30–16:35 UTC, through the public API):** [run #16](https://github.com/bipul724/GhostCache/actions/runs/40867758385) (run ID `40867758385`, job `123426739687`) was triggered by the push of `f66977d` and completed with `success` at 11:45:11 UTC. All ten job steps, including the test, fixture-evaluation, report-upload and telemetry steps, reported `success`; the only annotation is a notice about the `ubuntu-latest` label. Runs #11 to #15 also succeeded, so 15 of 16 runs succeeded and #2 remains the only cancelled one. The artifact `ghostcache-synthetic-evaluation` (ID `12893963182`, 2,111 bytes) expires on 2026-11-01 at 11:45:03 UTC.
  - **Report (archived later; inspected October 30, 2026):** the artifact ZIP was saved in [hosted-ci-run-16-2026-10-29/report/](screenshots/hosted-ci-run-16-2026-10-29/README.md#the-report-archived-later-inspected-october-30-2026) with its own manifest. Its SHA-256 `c13599b5a2b2969fc6c0c5eccc5dcd7419bef4e1c383927267b297a8437248bf` equals GitHub's artifact digest. The extracted `ghostcache-fixture.json` (13,531 bytes, SHA-256 `fd16a6f1999ba4e6bcfbb35ffb7f8e17bb1a3f5998339445eee4748fd1ebd577`) has `mode: fixture`, `passed: true` and 10 of 10 checks passed.
  - **Not established:** the job log has not been read, so **no hosted test count is claimed** for run #16. Counted locally, the `f66977d` tree defines 124 tests; that is not a hosted count.
  - *History (October 29, 16:30–16:35 UTC):* without sign-in the report download returned HTTP 401 and the job log HTTP 403, so the checks were first left uninspected; the successful evaluation step was then only consistent with a passing report (`evaluate` exits 0 only when `passed` is true). The later download resolved the report gap, not the log gap.
  - **Not tested on GitHub:** run #16 tested committed `f66977d`, not the uncommitted UI content refresh or the audit fixes; no hosted run has tested them yet. *(Later status: run #17 tested them in `00cfb10`; see the next item.)*
  - Evidence: [hosted-ci-run-16-2026-10-29/](screenshots/hosted-ci-run-16-2026-10-29/README.md) (the API responses and a checksum manifest; the report and its own manifest in `report/`).
- **Run #17 (inspected October 30, 2026, from saved API responses and the downloaded artifact):** [run #17](https://github.com/bipul724/GhostCache/actions/runs/40922048949) (run ID `40922048949`, attempt 1, job `123617603513`) was triggered by the push of `00cfb10`, which carried the ten commits after `f66977d`, including the UI content refresh and the audit fixes. It ran 2026-10-29T17:30:54Z–17:31:11Z and completed with `success`. All ten job steps reported `success`; the only annotation is the `ubuntu-latest` migration notice. The saved list then held 17 runs: all succeeded except #2.
  - **Report:** artifact `12919335616` (ZIP 2,108 bytes, expires 2026-11-01T17:31:05Z); the saved ZIP's SHA-256 `e9be7680acc8fe9086d175e118a38d49c8e73fef578f7486e793e1d9e51af362` equals GitHub's digest. The extracted `ghostcache-fixture.json` (13,531 bytes, SHA-256 `ebfc73b634b61a4e19ab005e0e3884054849086c9b46efbc8750417c113fc2f3`) has `mode: fixture`, `passed: true` and 10 of 10 checks passed.
  - **Not established:** the job log was not read, so **no hosted test count is claimed**. Locally, unittest discovery of the `00cfb10` checkout finds 126 tests (discovery only), and the October 29 local runs recorded 126 on the then-uncommitted tree; neither is a hosted count. A successful run is not deployment evidence (T-E9).
  - **Not tested on GitHub:** anything committed after `00cfb10`, such as the run #16 report folder, the run #17 folder and the documentation that records them.
  - Evidence: [hosted-ci-run-17-2026-10-29/](screenshots/hosted-ci-run-17-2026-10-29/README.md) (five API responses and their manifest; the report and its own manifest in `report/`).

## Collecting new evidence without overwriting the old

- Keep everything in `results/` and `screenshots/` byte-for-byte. Check the reports with `shasum -a 256 results/*.json` against the hashes recorded in this file, and the deployment screenshots with `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)` (run inside `screenshots/`, because the manifest holds bare file names).
- Write new runs to new paths, e.g. `results/live/2026-10-28-run-01.json`. `--output` creates missing folders.
- Save **failed** reports as well, and summarise every run you did, not just the passing ones.
- Record outside the report (until T-A8 adds metadata):
  - the date and timezone,
  - `python3.12 --version`,
  - `ollama --version`,
  - `ollama list` (model digest),
  - the machine.
- Reports contain the fictional marker and full answers. Use only fictional data.

## Coverage limits and worthwhile missing tests

The current tests do **not** cover:

- the UI JavaScript in a real browser. The contract tests run the real `web/app.js` and `site/site.js` against a fake DOM and fetch. They cover the answer trace, banner and labels, requests (including the echo question and the mode each Reset sends), stale-display clearing, graph structure (node kinds, lineage highlighting, node reuse across deletions, tombstones and the list view), link geometry computed from the SVG attributes the code writes (`thread_ends_meet_their_knots`), the rebuild outcome, failed-cleanup reconciliation, unknown state, `storage_failed` recovery and mode switching through the page's real change handler. A fake DOM does **not** establish actual browser rendering, layout, CSS, real pointer or keyboard input, or accessibility. Those were checked only in separate, one-off automated local browser sessions (the UI fixes, redesign, UI content refresh and audit-fix sections), and assistive technology has not been checked at all (T-E6);
- live inference;
- concurrent HTTP requests;
- Python 3.15;
- package installation through the console script;
- `serve` startup failure other than live transport errors and the missing-SDK check (the `evaluate` success path, exit 0, is now covered by `tests/test_telemetry.py`);
- real Sentry ingestion: the tests use an in-memory transport, so the SDK's network transport is exercised only by the user's manual traced runs of October 28, 2026 (see "Real Sentry traces T-D3"), not by any automated test or CI step;
- a rebuild failure from live Gemma: every rebuild-failure test uses a simulated `ProviderError`;
- the deployed walkthrough: `tests/test_site.py` checks `site/` and `render.yaml` offline, but no automated test or CI step requests the public URL, its headers or its layout (the deployment checks above were manual, read-only runs);
- crash safety or durability of reset publication (process kill or power loss mid-copy), concurrent writers from other processes, and Windows;
- large or real corpora.

They do not prove secure disk erasure, model unlearning, production authorisation or behaviour on arbitrary RAG systems.

Worthwhile additions, in order:

1. *(Done; extended October 29, 2026 by D-22.)* A rebuild `ProviderError` keeps cleanup complete, logs `summary.rebuild_failed`, returns `rebuild_error` and sets `state.rebuild`.
2. *(Done October 28, 2026, in `tests/test_telemetry.py`.)* `main(["evaluate", "--output", tmp])` in fixture mode writes a passing report and returns 0.
3. Asking during the `source_only` stage never saves a stale conversation.
4. A repeatable real-browser test in the suite or CI. The manual check, hosted CI with Node and one-off automated local browser sessions are done, and T-A9's new screenshots were saved on October 29, 2026 ([UI refresh captures](screenshots/ui-content-refresh-2026-10-29/README.md)); what remains is a browser check that runs on every change.
5. Retrieval tie-break ordering.
