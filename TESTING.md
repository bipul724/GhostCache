# Testing GhostCache

This file covers what to run, what each result shows, what has actually been verified, and what has not.

## Interpreter and setup

- **Python ≥3.12.** The verified interpreter is **Python 3.12.6** at `/Library/Frameworks/Python.framework/Versions/3.12/bin/python3.12`, which is also `python3.12` on this Mac's PATH.
- The default `python3` here is **3.15.0**, which is **untested**. Use `python3.12`.
- There are no packages to install, and no virtualenv is needed.
- Run every command from the application directory (the one containing `pyproject.toml`). The tests import `ghostcache` from the current directory.
- Live evaluation also needs Ollama running locally, with `gemma4:e2b-it-qat` (or your `--model`) pulled.
- **Node.js is optional.** The UI contract tests in `tests/test_ui.py` call `node`. If `node` is not on PATH, those six tests are **skipped** with the reason "Node.js is not on PATH", and the suite still passes. Verified with Node v22.23.4; no npm packages are used.

## Commands

```sh
# 1. Unit, controller, HTTP-handler and UI contract tests (offline, no model, under 1 s)
python3.12 -m unittest discover -s tests -v

# Run a single test
python3.12 -m unittest tests.test_store.StoreTests.test_multi_hop_purge_erases_every_descendant_and_keeps_edges

# 2. Fixture end-to-end evaluation (offline, deterministic logic, fresh marker)
python3.12 -m ghostcache evaluate --mode fixture --output results/fixture-new-run.json

# 3. Live end-to-end evaluation (local Gemma; a few minutes on first load)
python3.12 -m ghostcache evaluate --mode live --model gemma4:e2b-it-qat --output results/live-gemma-new-run.json

# 4. JavaScript syntax only (optional, needs Node)
node --check web/app.js && node --check tests/ui/app_contract.js

# 5. One UI contract case directly (optional, needs Node); exits 0 or prints FAIL and exits 1
node tests/ui/app_contract.js context_from_parent_ids
```

Add `-B` (as in `python3.12 -B -m …`) if you do not want `__pycache__` folders written. They are git-ignored either way.

## Hosted CI run #1 (October 28, 2026)

- **Repository:** [bipul724/GhostCache](https://github.com/bipul724/GhostCache): public, MIT, default branch `main`, with `ghostcache/` as the repository root. 25 commits; HEAD `6e767ee`. `git ls-files` lists 32 files, with no `__pycache__`, `.local/`, `.env` or `.DS_Store`.
- **Run:** [run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) (job 122423115717) of the workflow "GhostCache deletion checks", triggered by the push of `6e767ee` on 2026-10-27 at 19:35 UTC (October 28, 01:05 IST). Conclusion: **success**. The job "Tests and fresh synthetic evaluation" took 10 s; the run took 14 s in total.

| Step | Result |
| --- | --- |
| Check storage, provenance, and HTTP invariants | `Ran 62 tests in 3.013s` / `OK`, none skipped. All 7 `test_ui` tests ran and passed, so Node was on the hosted runner's PATH. |
| Evaluate a fresh synthetic deletion case | Success. `evaluate` exits 0 only when the report has `passed: true` (`__main__.py`), so the hosted fixture evaluation passed. |
| Upload | Artifact `ghostcache-synthetic-evaluation`, 2,107 bytes, kept 3 days. **Its JSON was not downloaded or inspected.** |

- The pinned actions (checkout `v7.0.1`, setup-python `v7.1.0`, upload-artifact `v7.0.2`) resolved, with no errors.
- One notice: `ubuntu-latest` migrates to Ubuntu 26 from October 19, 2026 (actions/runner-images#14748). It is informational only; Python 3.12 is installed by setup-python.

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
- No new screenshots were saved; `results/*.jpg` still show the pre-fix wording.

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

## Test inventory (62)

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

**`tests/test_app.py`: 23 controller tests** (8 in `ExperimentTests`, 5 in `ResetFailureTests`, 10 in `PublicationTests`). `OllamaProvider.status` is patched to "offline", so nothing touches the network. `ResetFailureTests` and `PublicationTests` use a temporary file database and `ScriptedLive`, a deterministic stand-in for Ollama that can fail on a chosen summary or answer call. `failing_publication()` runs the **real** `Store.replace_contents` with `pages=1` and a progress callback that raises on step 2, so the SQLite backup aborts with pages still to copy. `tracked_connections()` patches `ghostcache.store.sqlite3.connect` to use a connection subclass that records `close()`. The leftover-file helper allows only the database itself (and any named unrelated file) in the temporary directory.

| Test | Covers |
| --- | --- |
| `test_complete_fixture_demonstrates_leak_and_cleanup` | The full fixture journey through `verify()` |
| `test_cleanup_rebuilds_only_from_surviving_roots` | `s-rebuilt-*` has no `d-vault` root and no old marker, and keeps `07:40` |
| `test_reset_uses_fresh_marker_and_discards_prior_context` | Each reset gets a new marker; the old marker is absent |
| `test_verify_does_not_pass_before_cleanup` | `verify()` fails when seeded and after source-only deletion |
| `test_repeated_cleanup_does_not_rebuild_or_change_survivors` | A second cascade changes nothing |
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

**`tests/test_http.py`: 9 HTTP-handler tests** (6 in `HTTPTests`, 2 in `TransportHTTPTests`, 1 in `StorageFailureHTTPTests`). These drive the real `BaseHTTPRequestHandler` through an in-memory socket fixture, with no port bound.

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

**`tests/test_ui.py`: 7 UI contract tests** (`UIContractTests`). Six run `node tests/ui/app_contract.js <case>` as a subprocess and require exit 0; they are skipped when `node` is not on PATH. The harness loads the **unmodified** `web/app.js` into `node:vm`. It uses a minimal fake DOM (lazily created nodes with `textContent`, `hidden`, `value`, `classList`, children) and a fake `fetch` that records request bodies and returns canned state, ask, delete and verify replies. It waits one `setImmediate` tick for `initialize()`. Every `perform()` it drives must leave the error banner hidden. It uses only `assert`, `fs`, `path` and `vm`.

| Test | Covers |
| --- | --- |
| `test_context_from_parent_ids` | Trace contains "Context: d-vault, c-vault, s-mixed" from `parent_ids` (not citations), plus "3 ms" and both token counts; the single citation button is still `↗ c-vault`; no "Retrieved" |
| `test_context_empty_and_missing` | `[]` gives "Context: none retrieved". A missing field, `null` or a non-array gives no "Context". No "undefined" or "null" in the trace |
| `test_echo_sends_paraphrase` | `perform("inspect")` POSTs exactly `{"question": scenario.questions.paraphrase}` (a custom value, proving state is the source); the input, `lastAnswer.question` and the answer's question line match; `ask-secret` still sends the secret question; with no scenario questions the fallback is `QUESTIONS["paraphrase"]` |
| `test_fixture_banner_wording` | With the model available and unavailable: the fixture message has no "saved", "recorded", "replay" or "simulation" and contains "No model inference"; the title still says fixture; the model label is "LIVE MODEL ALSO AVAILABLE" / "NO MODEL REQUIRED"; the answer label is "DETERMINISTIC FIXTURE" and the trace has no "simulation" |
| `test_live_mode_label` | Live mode: title "Live local Gemma mode", banner `live` class, model label and answer label from the provider name, no "Deterministic fixture" in the trace, context listed |
| `test_reset_and_delete_clear_stale_display` | After an answer and 8/8 checks are shown, both `reset` and `source-only` hide the answer and show "NOT RUN" |
| `test_paraphrase_fallback_matches_backend_question` | Pure Python, no Node: the `paraphrase` fallback string in `app.js` equals `ghostcache.app.QUESTIONS["paraphrase"]` |

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
- **Timing.** Events have time-of-day stamps only. In the saved live run the first call took 81,246 ms, probably model load (an inference that has not been measured), and the other 10 calls took 2.4–6.8 s each.

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
- **UI contract tests:** they run inside the same `unittest` command, so they need `node` on the runner's PATH. Otherwise they are skipped and the job still passes. Hosted run #1 confirmed that the runner provides Node: all 7 UI tests ran and passed. The workflow was not changed.
- **Security settings:** read-only contents, no persisted credentials, actions pinned to commit SHAs, no secrets, no model and no live inference.

**Status:**

- The commands were verified locally.
- **Done:** hosted [run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) passed on October 28, 2026 (see "Hosted CI run #1" above).
- `ghostcache/` is the repository root, so the workflow was discovered.
- Evidence: the run URL is recorded. The uploaded report was not downloaded; the evaluate step's success means it had `passed: true`.

## Collecting new evidence without overwriting the old

- Keep `results/fixture.json`, `results/live-gemma.json` and the screenshots byte-for-byte. Check them with `shasum -a 256 results/*.json`.
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

- the UI JavaScript in a real browser: the contract tests cover only rendering of the answer trace, banner and labels, the echo request and stale-display clearing, against a fake DOM, not layout, CSS, graph drawing or events (a one-off manual browser check is recorded in the UI fixes section);
- live inference;
- concurrent HTTP requests;
- Python 3.15;
- package installation through the console script;
- the CLI `main()` success path (exit 0), and `serve` startup failure other than live transport errors;
- the `summary.rebuild_failed` path;
- crash safety or durability of reset publication (process kill or power loss mid-copy), concurrent writers from other processes, and Windows;
- the UI's handling of `storage_failed` (see architecture.md known discrepancy 4);
- large or real corpora.

They do not prove secure disk erasure, model unlearning, production authorisation or behaviour on arbitrary RAG systems.

Worthwhile additions, in order:

1. A rebuild `ProviderError` keeps cleanup complete, logs `summary.rebuild_failed` and returns `rebuild_error`.
2. `main(["evaluate", "--output", tmp])` in fixture mode writes a passing report and returns 0.
3. Asking during the `source_only` stage never saves a stale conversation.
4. An automated real-browser run of the UI contract. The manual check and hosted CI with Node are done; the rest of T-A9 is new screenshots.
5. Retrieval tie-break ordering.
