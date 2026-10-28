# GhostCache tasks

Last updated October 29, 2026 (T-E7 deployed and verified; earlier the same night, the documentation audit after the Render deployment). The list is ordered: work top to bottom unless a dependency says otherwise.

**Priority:**

- **P0:** needed for a valid, honest submission.
- **P1:** needed for a targeted category or important correctness.
- **P2:** strengthens the entry.
- **P3:** optional.

**Done** means the evidence column exists. Writing configuration alone never completes an external integration.

**Deadline uncertainty:**

- The written rules end on October 31, 2026 at 23:59 PDT (November 1, 12:29 IST).
- The DEV API's `ends_at` is October 31, 06:59 UTC (October 31, 12:29 IST).
- Work to the internal target of **October 30, 23:00 IST** (T-I0).

## Completed, with evidence

| Work | Evidence |
| --- | --- |
| GhostCache chosen; smallest five-document experiment approved and built (October 27) | `context.md` §2; code in `ghostcache/` |
| Fictional corpus, fresh markers, chunks, chained summaries, saved answer | `app.py` `reset`; `test_reset_uses_fresh_marker…` |
| Full-context provenance and parent/root validation | `store.py` `add_artifact`; `test_invalid_parents…`, `test_stale_active_parent…` |
| Source-only deletion (broken control) | `test_naive_deletion_keeps_stale_copies…`; `source_only_audit` in both reports |
| Recursive cleanup with tombstone titles; rebuild from surviving roots | `test_multi_hop_purge…`, `test_titles_are_audited_and_scrubbed…`, `test_cleanup_rebuilds_only_from_surviving_roots` |
| Independent facts preserved | `test_independently_sourced_duplicate_fact…`, `test_mixed_summary_invalidated_whole…` |
| Fixture and live Ollama providers with no silent fallback | `test_live_request_never_silently_uses_fixture`, `test_missing_live_model_is_an_error…` |
| Local browser UI (graph, inspector, checks, ledger) | `web/`; screenshots in `results/` |
| 8-check interactive and 10-check CLI verification | `app.py` `verify` and `evaluate` |
| 22 tests passing (before T-A5/T-A6) | Rerun with Python 3.12.6 during the documentation audit: `Ran 22 tests … OK`. After T-A5/T-A6: `Ran 36 tests … OK`. After the reopened T-A5/T-A6 fixes: `Ran 52 tests … OK`. After the first-attach follow-up: `Ran 55 tests … OK`. After the UI fixes (T-A2 to T-A4): `Ran 62 tests … OK`. After Sentry tracing (T-D2): `Ran 71 tests … OK` with `sentry-sdk` in `.venv`, and `OK (skipped=6)` without it. |
| Fixture evaluation 10/10 | `results/fixture.json` (SHA-256 `b4d187bd…c7a19044`); fresh rerun to a scratch path also passed 10/10, exit 0 |
| One live Gemma evaluation 10/10 | `results/live-gemma.json` (SHA-256 `1146258e…89d44992`), model `gemma4:e2b-it-qat` |
| Desktop and 390 px mobile browser QA in fixture mode (no console errors reported) | `results/ghostcache-ui-*.jpg`; described in `context.md` §12 (performed in an earlier session, not repeated here) |
| GitHub Actions workflow written and its commands run locally | `.github/workflows/checks.yml`; `context.md` §18. **Hosted [run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) passed** on October 28, 2026 (see the T-B rows below). |
| README, EVALUATION, CATEGORIES; this documentation set | the files in this directory |
| T-A5: malformed model responses normalized to `ProviderError` (October 27) | `providers.py` `_model_object`/`_generate`; `tests/test_providers.py` (7 response tests + `test_malformed_model_output_exits_1_with_failed_report`); `test_malformed_live_output_is_a_502_without_fixture_fallback`; suite `Ran 36 tests … OK`. The unexpected-exception policy (defects propagate, not converted into reports) is documented in architecture.md. |
| T-A6: reset builds a candidate experiment and publishes it only on success (October 27; this candidate-file design was superseded by D-20, see the next row) | `app.py` `reset`/`_seed`; `ResetFailureTests` (5 tests) in `tests/test_app.py`; DECISIONS.md D-19; suite `Ran 36 tests … OK`; fresh fixture evaluation 10/10, exit 0 |
| T-A5/T-A6 **reopened and completed** (October 27). A review found four defects: (1) a failed reopen after the file swap left the controller on an unlinked inode; (2) the candidate file could leak, and an unrelated `<database>.candidate` was deleted; (3) transport error text was echoed into messages; (4) `IncompleteRead`/`BadStatusLine` escaped as HTTP 500 or a traceback | Publication through SQLite online backup into the attached connection, with rollback, verification and a `storage_failed` state (DECISIONS.md D-20); content-free transport categories and the `HTTPException` catch (D-10). 16 new tests: `PublicationTests` (7), `PublicationPrimitiveTests` (2), `TransportErrorTests` (4), `TransportHTTPTests` (2), `StorageFailureHTTPTests` (1). Suite `Ran 52 tests … OK`; fresh fixture evaluation 10/10, exit 0; `results/*` hashes unchanged. **Follow-up (October 27):** a failed first attach wrote GhostCache tables into an existing unrelated SQLite file before the copy. It now opens the target with `Store(path, create_schema=False)`. Three tests were added (unrelated-file failure and success, and a write check failing after a completed copy). Suite `Ran 55 tests … OK` |
| T-A2/T-A3/T-A4: UI trace shows supplied context from `trace.parent_ids`; "Look for the echo" sends `scenario.questions.paraphrase`; fixture banner says "Deterministic rules. No model inference." (October 27) | `web/app.js`, `web/index.html`; `tests/test_ui.py` with `tests/ui/app_contract.js` (7 tests). 5 of the 6 Node cases fail against the previous `app.js`; `reset_and_delete_clear_stale_display` passes on both (a guard). Suite `Ran 62 tests … OK`; fixture evaluation 10/10. HTTP smoke test on a separate port: echo returns the marker with context IDs, verify 8/8. Browser check by the planner on October 27/28 (built-in Chromium-based browser; see TESTING.md, UI fixes section). **No new screenshots yet** (the original evidence column asked for screenshots). |
| T-B1: public repository with `ghostcache/` as its root, MIT license (October 28) | [bipul724/GhostCache](https://github.com/bipul724/GhostCache), default branch `main`; 25 commits, HEAD `6e767ee`; `git ls-files` = 32 files, with no `__pycache__`, `.local/`, `.env` or `.DS_Store` |
| T-B2: workflow run on GitHub (October 28) | [Run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) (job 122423115717), triggered by the push of `6e767ee`: success. `Ran 62 tests in 3.013s` OK, none skipped (all 7 UI tests ran). The evaluate step succeeded, and `evaluate` exits 0 only when the report has `passed: true`. Run #1's artifact (2,107 bytes) was not downloaded. The artifact from [run #3](https://github.com/bipul724/GhostCache/actions/runs/40573873485) (push of `172ccb4`; also 62 tests and a successful evaluation) was downloaded and inspected on October 28: `ghostcache-fixture.json`, SHA-256 `cf68765a7cd229ad54274e2457e163e09cec5b83d9eb4625c40b984724490bc7`, mode `fixture`, `passed: true`, 10 of 10 checks. *Later runs (checked through GitHub's public API in the October 28 documentation audit; step results only, logs not read):* runs #4 to #10 all succeeded, the latest being [run #10](https://github.com/bipul724/GhostCache/actions/runs/40725375114) on `26a1c3e` with all seven steps successful; run #2 was a cancelled duplicate of #3. |
| T-B4: action pins resolve on GitHub (October 28) | The same [run](https://github.com/bipul724/GhostCache/actions/runs/40570510382): checkout `v7.0.1`, setup-python `v7.1.0` and upload-artifact `v7.0.2` resolved with no errors |
| T-D2: optional, metadata-only Sentry tracing, off unless `GHOSTCACHE_SENTRY_DSN` is set (October 28) | `ghostcache/telemetry.py` (`ALLOWED_KEYS`); spans in `app.py` and `__main__.py`; `tests/test_telemetry.py` (9 tests: 3 always run, 6 need `sentry-sdk`), including a privacy test over the serialized envelopes; all 6 SDK tests fail with the instrumentation removed; `.env.example` and DECISIONS.md D-17 updated. Suite `Ran 71 tests … OK`. Done before T-D1 because it needs no account. Its CI step first ran on GitHub in [run #5](https://github.com/bipul724/GhostCache/actions/runs/40623927599) (push of `7abcc11`), which succeeded. Real traces: see T-D3. |
| T-D3: real Sentry traces and one explained finding (October 28, IST) | Traced evaluations by the user: fixture at 09:10 (10/10), live cold at 09:18 (10/10, trace `dd21f76b3293450b84b0ad5ca45961dd`), live warm at 09:19 (10/10, trace `fb1530272ecd481399aa77f95d505dfa`); three 09:16 attempts failed first because Ollama was not running. Files: `results/sentry-live-cold.json`, `results/sentry-live-warm.json` and seven `results/sentry-*.jpg` screenshots, including `sentry-failed-run.jpg`: one failed attempt's trace `7e075ad683f247d687b59dddbb038ce5`, a single root span with `internal_error` and `error.type: ProviderError`. **Finding:** the first model call after an Ollama server start took 40.45 s cold against 2.28 s warm and accounts for most of the 1.03 min against 22.40 s; later calls are 1–3 s in both. Model loading is the likely cause but is **inferred, not measured** (no `load_duration` recorded). Second finding: the source-only leak is visible through `answer_contains_marker: true` and the synthetic `context_ids`, with no content exported. Done a few hours before T-D1 (the plan and usage were recorded the same day). See README.md, "What the real traces showed", and TESTING.md, "Real Sentry traces T-D3". |
| T-D1: Sentry plan and span usage recorded (October 28) | Read from the user's Sentry screenshots (Subscription overview; Stats & Usage, Errors, last 14 days): **Business Plan Trial** ("Trial plan"), 14 days left on October 28, 2026; no billing details and no payment method on file. Usage period Oct 28 – Nov 10, 2026: **120 of 100M spans** used, 0 of 1M errors, every other feature 0. Stats & Usage: 0 errors accepted, filtered, rate-limited or invalid, as expected because `telemetry.py` drops every error event. 120 spans is consistent with three completed evaluations at 39 spans each (117) plus one root span from each of the three failed 09:16 IST attempts (3); the failed-attempt traces were not inspected individually. Not the free Developer plan the original plan targeted; that plan's limits and what happens when the trial ends were not checked. See TESTING.md, "Sentry plan and usage T-D1". |
| T-E1: public demo design chosen (October 28) | DECISIONS.md D-13 accepted: option A, a static walkthrough of recorded live runs; the localhost app is still never exposed. |
| T-E2: public recorded walkthrough implemented and tested locally (October 28) | `site/` (static HTML, CSS, JS) labelled "Recorded local Gemma evaluation — no live inference"; `site/data/evidence.json` exported by `scripts/export_site_data.py` from `results/sentry-live-cold.json`, `results/sentry-live-warm.json` and `results/live-gemma.json` (allowlisted fields, source SHA-256s, fixture reports refused); `render.yaml` static-site Blueprint publishing `./site`. `tests/test_site.py` (20 tests). Suite `Ran 91 tests … OK` with `.venv`, `OK (skipped=6)` with plain Python 3.12. Checked in the in-app browser at desktop and phone widths: all controls work, no console errors, and only `style.css`, `walkthrough.js` and `data/evidence.json` load. **Not deployed** (T-E3) at that point; *deployed later on October 28, 2026, see the T-E3 row below.* *Correction (documentation audit, October 28): the phone-width result was not reproduced. In headless Chrome emulation at the tested 375 px viewport, the document's scrollWidth was 573 px; see T-E7.* |
| T-E3: walkthrough deployed on Render (October 28) | <https://ghostcache-walkthrough.onrender.com/>: Render service `ghostcache-walkthrough`, a Blueprint-managed static site, live from commit `8013d01` ([dashboard screenshot](screenshots/00-render-dashboard-live-8013d01.png); [deployed page](screenshots/01-walkthrough-cold-run-overview.png)). Acceptance rechecked with read-only requests on October 28 (about 21:00 IST): HTTPS `onrender.com` URL returns 200; `/data/evidence.json` 200; the exact `/api/state` returns 404; headers include the `render.yaml` Content-Security-Policy, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `X-Frame-Options: DENY`; the deployed files are byte-identical to `site/` at `8013d01`; a headless Chrome click-through (1280×900) showed the banner and working run (3), stage (5) and question (6) buttons, with only the three expected files requested besides Chrome's automatic `/favicon.ico` (404, one console error). Earlier browser checks by the user: [screenshots/README.md](screenshots/README.md) (16 PNGs, checksums verified). Not shown: phone use on the deployed site, other browsers; no live inference (recorded reports only). Repeated in the documentation audit (about 22:00 IST) against `26a1c3e`, with the same results; that audit also found the narrow-viewport overflow (T-E7). See [DEPLOYMENT.md](DEPLOYMENT.md). |
| T-E7: narrow-screen horizontal overflow fixed, deployed and verified (October 28–29) | **Problem (found in the October 28 documentation audit):** in headless Chrome emulation at 375 px the document's `scrollWidth` was 573 px; below 980 px `.explainers` used `grid-template-columns:1fr`, and the `white-space:pre` command block held the column at about 557 px. **Fix** (`08e0524`): `.explainers` uses `minmax(0,1fr)` below 980 px, and `.tiny-label` may wrap below 650 px (a second offender at 320 px). **Local automated check (October 28, about 22:30 IST):** `scrollWidth` equalled `clientWidth` at 320, 360, 375, 390, 414, 768, 980, 981 and 1280 px across all 33 view states; command block and timing table scroll internally ([before/after captures](screenshots/mobile-overflow-fix/README.md)). **Deployed:** commit `2a1ffb0` (contains `08e0524`; no `site/` or `render.yaml` change between them), shown as successfully deployed in Render dashboard screenshots supplied by the user (not saved; the temporary files were gone). **Read-only CSS check by the coding agent (October 28, 18:45 UTC):** public `/style.css` 200, SHA-256 `035e46ec0210e14951f1e0c8cda9748ded207f9d1cdd73ee7a65126bbc488027`, byte-identical to `site/style.css` at `2a1ffb0` and `08e0524`; the other served files byte-identical to `2a1ffb0`. **User-reported manual checks** (Chrome DevTools responsive emulation, height 812 px): no horizontal overflow at the same nine widths; command box scrolling, timing table, six question buttons, three run selectors and five stage selectors PASS. Evidence: [deployed-2a1ffb0/](screenshots/mobile-overflow-fix/deployed-2a1ffb0/README.md) (10 screenshots, CSS comparison, manual-results record, checksums; the 320 px console capture, dashboard and phone-frame screenshots were unavailable); TESTING.md, "T-E7 deployed verification". Not covered: a physical phone, Safari or Firefox, and accessibility (T-E6); the favicon (T-E8) |
| T-A1: reconciled evaluation instructions and title cleanup wording (October 27 review) | `EVALUATION.md` uses Python 3.12 and fresh report names; describes neutral replacement titles, evaluator retention, eight versus ten checks and the known parsing gap |

## A. Consistency and hardening

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-A7 | P2 | Make evaluator retention visible in the UI, e.g. "the evaluator still holds the marker; `/api/state` returns it" next to the checks | none | The UI states it after cleanup | Screenshot |
| T-A8 | P1 | Add run metadata to new reports: ISO date-time with timezone, Python version, OS, GhostCache version, Ollama version, model digest, and options | none | New reports include a `metadata` object; old reports are left untouched | A new report file |
| T-A9 | P2 | **Partly done (October 27/28):** `tests/ui/app_contract.js` checks `parent_ids` rendering, the echo question, banner wording, mode labels and stale-display clearing offline (see Completed). The planner verified the same contract in a real browser on October 27/28 (built-in Chromium-based browser, separate fixture server on port 8811; see TESTING.md, UI fixes section). Hosted CI run #1 (October 28) ran all 7 UI tests with Node. Remaining: new screenshots only. | T-A2 | Runs offline | Command and output |
| T-A10 | P2 | Give the UI a dedicated state for `stage: "storage_failed"` (architecture.md known discrepancy 4): reload state after a 503, show that the experiment was cleared, and reset the step counter | none | After an unrestorable reset the UI shows the storage failure and offers reset; a UI contract test covers it | Test output |

## B. Publication and hosted CI

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-B3 | P2 | Decide whether a cleaned copy of `context.md` should ship in the repository | T-B1 | Decision recorded in `DECISIONS.md` | Commit or decision note |

## C. Stronger live evidence

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-C1 | P1 | Repeat live evaluations with fresh markers, keeping every report, **including failures**, under new names (e.g., `results/live/run-NN.json`) | T-A5, T-A8 | N runs with N chosen after T-C2; summary table of pass/fail per check | All report files and a summary |
| T-C2 | P1 | Measure live runtime and memory on this laptop (first-call load vs warm calls). **Partly done (October 28, via T-D3):** per-call durations for a cold run (first call 40,407 ms, 11 calls 61,325 ms) and a warm run (2,278 ms; 22,078 ms) are recorded, with Sentry span durations. **Remaining:** Ollama's `load_duration` and memory use were not recorded, so the load-time cause is still inferred | none | Numbers recorded with method | Command output |
| T-C3 | P2 | Add cases only where they add coverage: deeper chains, title-only copies, independent duplicates, rebuild failure | T-C1 | Each new case has a test and is included in the report | Tests and reports |

## D. Sentry Agent Tracing (target)

No open tasks. T-D1, T-D2 and T-D3 are done (October 28, 2026); see "Completed, with evidence".

## E. Public demo hosting (Render; not an entered category)

T-E3 (deploy the static walkthrough on Render from `render.yaml`; acceptance: a reachable HTTPS `onrender.com` URL, the banner, controls and headers checked as listed in the README, and `/api/state` returning 404) is done (October 28, 2026); see "Completed, with evidence". Deployment details: [DEPLOYMENT.md](DEPLOYMENT.md). T-E7 (fix the narrow-screen overflow) is done (deployed in `2a1ffb0`, verified October 28–29, 2026); see "Completed, with evidence".

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-E6 | P2 | Check the deployed walkthrough on a real phone, in a second browser engine (Safari or Firefox), and with a screen reader or an automated accessibility check | T-E7 (done) | Results recorded per device/browser, including failures; nothing claimed beyond what was checked | Notes and screenshots |
| T-E8 | P3 | Optional polish: add a favicon so browsers stop logging a 404 for `/favicon.ico` | none | `/favicon.ico` (or a linked icon) returns 200; the CSP still allows it; no console error | `curl` output |
| ~~T-E4~~ | — | **Dropped October 28, 2026** (three-category scope, D-14): verify the `bipulchamoli.tech` promo claim and DNS host | — | — | — |
| ~~T-E5~~ | — | **Dropped October 28, 2026:** point a `.tech` subdomain at the Render site | — | — | — |

## F. Backboard comparison — dropped October 28, 2026 (three-category scope, D-14); kept as history

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-F1 | P1 | Confirm Backboard credits, available open-weight models and prices | none | List with date | Note |
| T-F2 | P1 | Add an optional provider used only by a comparison command, with stateless calls, request, token and cost caps, and synthetic data | T-F1, T-A5 | Ollama path unchanged; no provider-side memory; tests with mocks | Tests |
| T-F3 | P1 | Run 2–3 models on the same corpus and checks; report disclosure in the broken control, cleanup, retained facts, latency, tokens and cost, and failures | T-F2 | One report per model; not described as an "unlearning leaderboard" | Reports and a summary table |

## G. Browserbase — dropped October 28, 2026 (three-category scope, D-14); kept as history

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-G1 | P2 | Check the Browserbase $0-plan allowances on the user's account | none | Allowances noted | Note |
| T-G2 | P2 | Stagehand script drives seed → ask → source-only → echo → cascade → verify on the public demo, asserting what the UI shows | T-E3, T-G1 | Asserts marker shown, then echoed, then gone; retained facts present; labelled replay or live | Session recording or ID; script output |

## H. ElevenLabs and Entire — dropped October 28, 2026 (three-category scope, D-14); kept as history

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-H1 | P3 | ElevenLabs narration for the demo video using a stock voice and fictional script; claim the listed promo only after the user chooses it | T-I1 script | Real generated audio used in the video | Audio file and usage record |
| T-H2 | P3 | Entire: test compatibility, then capture checkpoints of **upcoming** work | none | At least one real checkpoint; nothing back-filled | Checkpoint links |

## I. Submission

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-I0 | P0 | Confirm the real deadline with the organizers or platform | none | One authoritative timestamp recorded | Link or message |
| T-I1 | P0 | Record a short demo video: failure → lineage → cleanup → retained answers, with the mode stated | T-A2, T-A3, T-A4 | Under about 3 minutes; mode visible; no real data | Video link |
| T-I2 | P0 | Write a DEV draft using the official template (What I Built, Demo, Code, How I Built It, Why Does Open Innovation Matter?, optional My Agent Session and The Spirit of It, Prize Categories), tagged `devchallenge` and `hf26challenge` | T-B1, T-I1 | Includes the broken-control disclosure, prior art, scope limits and real numbers; lists **only** the three entered categories (Gemma, GitHub through Actions, Sentry), each with one evidence item; links the walkthrough only if T-E3 is done (done October 28: <https://ghostcache-walkthrough.onrender.com/>), labelled as recorded; accurate AI-assistance disclosure | Draft URL (unpublished) |
| T-I3 | P0 | Final verification: rerun the tests and fixture evaluation, check every link, and check category claims against this file | T-I2 | All pass; no category listed without evidence | Command output and checklist |
| T-I4 | P0 | Publish, **only after the user authorizes it** | T-I3, T-I0 | Published before the confirmed deadline | Post URL |
