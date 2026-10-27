# GhostCache tasks

Last updated October 27, 2026. The list is ordered: work top to bottom unless a dependency says otherwise.

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
| 22 tests passing (before T-A5/T-A6) | Rerun with Python 3.12.6 during the documentation audit: `Ran 22 tests … OK`. After T-A5/T-A6: `Ran 36 tests … OK`. After the reopened T-A5/T-A6 fixes: `Ran 52 tests … OK`. After the first-attach follow-up: `Ran 55 tests … OK`. After the UI fixes (T-A2 to T-A4): `Ran 62 tests … OK`. |
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
| T-B2: workflow run on GitHub (October 28) | [Run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) (job 122423115717), triggered by the push of `6e767ee`: success. `Ran 62 tests in 3.013s` OK, none skipped (all 7 UI tests ran). The evaluate step succeeded, and `evaluate` exits 0 only when the report has `passed: true`. Artifact `ghostcache-synthetic-evaluation` (2,107 bytes) was uploaded but **not downloaded or inspected**, so its checks were not read directly. |
| T-B4: action pins resolve on GitHub (October 28) | The same [run](https://github.com/bipul724/GhostCache/actions/runs/40570510382): checkout `v7.0.1`, setup-python `v7.1.0` and upload-artifact `v7.0.2` resolved with no errors |
| T-A1: reconciled evaluation instructions and title cleanup wording (October 27 review) | `EVALUATION.md` uses Python 3.12 and fresh report names; describes neutral replacement titles, evaluator retention, eight versus ten checks and the known parsing gap |

## A. Consistency and hardening

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-A7 | P2 | Make evaluator retention visible in the UI, e.g. "the evaluator still holds the marker; `/api/state` returns it" next to the checks | none | The UI states it after cleanup | Screenshot |
| T-A8 | P1 | Add run metadata to new reports: ISO date-time with timezone, Python version, OS, GhostCache version, Ollama version, model digest, and options | none | New reports include a `metadata` object; old reports are left untouched | A new report file |
| T-A9 | P2 | **Partly done (October 27/28):** `tests/ui/app_contract.js` checks `parent_ids` rendering, the echo question, banner wording, mode labels and stale-display clearing offline (see Completed). The planner verified the same contract in a real browser on October 27/28 (built-in Chromium-based browser, separate fixture server on port 8811; see TESTING.md, UI fixes section). Hosted CI run #1 (October 28) ran all 7 UI tests with Node. Remaining: new screenshots only. | T-A2 | Runs offline | Command and output |

## B. Publication and hosted CI

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-B3 | P2 | Decide whether a cleaned copy of `context.md` should ship in the repository | T-B1 | Decision recorded in `DECISIONS.md` | Commit or decision note |

## C. Stronger live evidence

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-C1 | P1 | Repeat live evaluations with fresh markers, keeping every report, **including failures**, under new names (e.g., `results/live/run-NN.json`) | T-A5, T-A8 | N runs with N chosen after T-C2; summary table of pass/fail per check | All report files and a summary |
| T-C2 | P1 | Measure live runtime and memory on this laptop (first-call load vs warm calls) | none | Numbers recorded with method | Command output |
| T-C3 | P2 | Add cases only where they add coverage: deeper chains, title-only copies, independent duplicates, rebuild failure | T-C1 | Each new case has a test and is included in the report | Tests and reports |

## D. Sentry Agent Tracing (target)

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-D1 | P1 | Check the user's Sentry free-plan eligibility and tracing quota (no card) | none | Quota written down with date | Note |
| T-D2 | P1 | Add optional, metadata-only tracing (DSN from environment, off when unset) for retrieve, generate, delete, rebuild and verify | T-D1 | Attributes limited to durations, token and result counts, mode and error class; a test asserts no body, question, answer or marker leaves the process; default PII off | Tests; `.env.example` updated in the same change |
| T-D3 | P1 | Capture real traces and explain one finding (e.g., first-call latency dominates the recorded model time; investigate its cause rather than assuming model load) | T-D2 | A trace screenshot with a written finding | Screenshot and text |

## E. Public demo: Render and a .tech domain (targets)

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-E1 | P0 | Choose the public design: recorded replay or simulation, versus a redesigned per-session service. The current server must **not** be exposed unchanged. | User decision | Decision recorded (DECISIONS.md D-13) | Decision record |
| T-E2 | P1 | Implement the chosen design, with "recorded run", "simulation" or "live" clearly labelled | T-E1 | Works without the laptop; never implies a new Gemma call when replaying | Tests and screenshot |
| T-E3 | P1 | Deploy on the Render free tier | T-E2, T-B1 | Reachable HTTPS Render URL; behaviour on cold start documented | URL and Render dashboard screenshot |
| T-E4 | P1 | Verify that `bipulchamoli.tech` was claimed through the qualifying Hacktoberfest promo, and where its DNS is actually hosted | none | Promo or registration evidence in hand | Screenshot or email (kept private if needed) |
| T-E5 | P1 | Point a subdomain (suggested `ghostcache.bipulchamoli.tech`) at the Render service, leaving the existing apex and `www` untouched | T-E3, T-E4 | HTTPS loads the demo; the apex is unchanged | URL; DNS record screenshot |

## F. Backboard comparison (target)

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-F1 | P1 | Confirm Backboard credits, available open-weight models and prices | none | List with date | Note |
| T-F2 | P1 | Add an optional provider used only by a comparison command, with stateless calls, request, token and cost caps, and synthetic data | T-F1, T-A5 | Ollama path unchanged; no provider-side memory; tests with mocks | Tests |
| T-F3 | P1 | Run 2–3 models on the same corpus and checks; report disclosure in the broken control, cleanup, retained facts, latency, tokens and cost, and failures | T-F2 | One report per model; not described as an "unlearning leaderboard" | Reports and a summary table |

## G. Browserbase (stretch target)

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-G1 | P2 | Check the Browserbase $0-plan allowances on the user's account | none | Allowances noted | Note |
| T-G2 | P2 | Stagehand script drives seed → ask → source-only → echo → cascade → verify on the public demo, asserting what the UI shows | T-E3, T-G1 | Asserts marker shown, then echoed, then gone; retained facts present; labelled replay or live | Session recording or ID; script output |

## H. Optional: ElevenLabs and Entire

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-H1 | P3 | ElevenLabs narration for the demo video using a stock voice and fictional script; claim the listed promo only after the user chooses it | T-I1 script | Real generated audio used in the video | Audio file and usage record |
| T-H2 | P3 | Entire: test compatibility, then capture checkpoints of **upcoming** work | none | At least one real checkpoint; nothing back-filled | Checkpoint links |

## I. Submission

| ID | Pri | Task | Depends on | Acceptance criteria | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T-I0 | P0 | Confirm the real deadline with the organizers or platform | none | One authoritative timestamp recorded | Link or message |
| T-I1 | P0 | Record a short demo video: failure → lineage → cleanup → retained answers, with the mode stated | T-A2, T-A3, T-A4 | Under about 3 minutes; mode visible; no real data | Video link |
| T-I2 | P0 | Write a DEV draft using the official template (What I Built, Demo, Code, How I Built It, Why Does Open Innovation Matter?, optional My Agent Session and The Spirit of It, Prize Categories), tagged `devchallenge` and `hf26challenge` | T-B1, T-I1 | Includes the broken-control disclosure, prior art, scope limits and real numbers; lists **only** completed categories, each with one evidence item; accurate AI-assistance disclosure | Draft URL (unpublished) |
| T-I3 | P0 | Final verification: rerun the tests and fixture evaluation, check every link, and check category claims against this file | T-I2 | All pass; no category listed without evidence | Command output and checklist |
| T-I4 | P0 | Publish, **only after the user authorizes it** | T-I3, T-I0 | Published before the confirmed deadline | Post URL |
