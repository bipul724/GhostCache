# Decision records

Each record states its status:

- **Accepted:** implemented, or adopted as the working strategy.
- **Proposed:** not yet implemented.
- **Open:** a decision still needed.
- **Superseded:** replaced by a later record. The original text is kept as history.

The evidence for each record is code, tests, saved results or the workspace handoff `context.md` (dated October 27, 2026). Lines marked *Inferred tradeoff* are this document's own analysis, not reasoning recorded from the user. No alternative is listed as "considered" unless the record shows it was.

---

## D-01. Build a small local synthetic testbed first

- **Status:** Accepted (implemented October 27, 2026)
- **Context:** A critique of the GhostCache idea warned that it could look like an obvious bug in a costume, and that its deletion claims had to stay narrow. `context.md` §2 records that the user then approved the smallest experiment: five fictional documents, a fresh secret, local model summaries, a deliberately incomplete deletion control, provenance-aware cleanup, and verification that legitimate information survives.
- **Decision:** Use a fixed five-document fictional corpus (`d-vault`, `d-garden`, `d-archive`, `d-maintenance`, `d-shuttle`) with a random `MOTH-` marker on every reset. Do not support upload or real documents.
- **Consequences:**
  - The failure can be reproduced, inspected and checked against an exact marker.
  - Claims are limited to this corpus.
  - It is not yet a tool for auditing other RAG systems.
- **Evidence:** `app.py` `reset`; `test_reset_uses_fresh_marker_and_discards_prior_context`.

## D-02. Standard-library Python and SQLite, no third-party dependencies

- **Status:** Accepted
- **Context:** The project must run for free on a laptop, and CI must not need secrets.
- **Decision:**
  - Python ≥3.12 using `sqlite3`, `http.server`, `urllib.request` and `unittest`.
  - Plain HTML, CSS and JS with no build step.
  - `dependencies = []`.
- **Consequences:**
  - No install step, and the CI job is simple.
  - It has fewer features than a framework, such as no auth or sessions.
  - Future Sentry, Backboard or Stagehand work will add the first dependencies and must be optional. *(Outcome, October 28, 2026: Sentry added the only one so far, `sentry-sdk==2.72.0`, as the optional `sentry` extra (D-17). `dependencies = []` is unchanged; Backboard and Stagehand were dropped.)*
  - *Inferred tradeoff:* a smaller attack and supply-chain surface, at the cost of hand-written HTTP handling.
- **Evidence:** `pyproject.toml`; the imports in `ghostcache/`.

## D-03. Python 3.12 is the verified interpreter

- **Status:** Accepted
- **Context:** The Mac's default `python3` is 3.15.0, which is untested. 3.12.6 is installed.
- **Decision:** All documented commands use `python3.12`. CI pins 3.12.
- **Consequences:** Running on 3.15 is unverified until it is tested.
- **Evidence:** `context.md` §5; the test run in [TESTING.md](TESTING.md); `checks.yml`.

## D-04. Local Gemma through Ollama as the live provider

- **Status:** Accepted
- **Context:** The challenge requires meaningful open AI. Document context should stay on the machine.
- **Decision:**
  - Model: `gemma4:e2b-it-qat` by default, overridable with `--model` or `GHOSTCACHE_MODEL`.
  - Endpoint: the fixed `127.0.0.1:11434` `/api/chat`.
  - Requests: stateless, temperature 0, with a JSON schema for `{text, citations}`.
- **Consequences:**
  - No hosted inference cost.
  - Speed depends on the laptop (the first call took about 81 s in the saved run). *(Later runs, October 28: 40.4 s for the first call after an Ollama server start, 2.3 s with the model already loaded; the cause is inferred, not measured. TESTING.md, "Real Sentry traces T-D3".)*
  - A public cloud host cannot reach this model.
  - Gemma's weights are open-weight under their own terms, not MIT.
- **Evidence:** `providers.py`; `results/live-gemma.json`.

## D-05. Lexical retrieval

- **Status:** Accepted
- **Context:** Retrieval needs to be deterministic and dependency-free for a small corpus.
- **Decision:** Term overlap after case folding and removing stop words. Rank by distinct terms matched, then their frequency, then earlier insertion. Return up to 6 for answers.
- **Consequences:**
  - Reproducible and easy to explain.
  - The "paraphrase" probe still shares terms, so this is **not** a semantic-retrieval benchmark.
  - Retrieval decides the parents of the saved answer (`d-shuttle` is pulled in by "observatory").
- **Evidence:** `store.py` `retrieve`; `test_lexical_retrieval_returns_only_matching_active_artifacts`.

## D-06. Record every supplied context artifact as provenance

- **Status:** Accepted
- **Context:** Model citations can be incomplete or wrong, so they cannot define what a generated artifact depends on.
- **Decision:**
  - `_commit_generation` stores *all* supplied artifacts as ordered parents.
  - Root `source_ids` are inferred from those parents.
  - The store revalidates that parents and roots are active when it commits.
- **Consequences:**
  - Lineage is conservative: summaries can be invalidated even when their prose did not use the withdrawn input.
  - Copies made outside the store remain invisible.
  - Stale writes during deletion are refused.
- **Evidence:** `app.py` `_commit_generation`; `store.py` `add_artifact`; `test_deletion_during_generation_prevents_stale_commit`.

## D-07. A deliberately incomplete source-only deletion as a control

- **Status:** Accepted
- **Context:** The demonstration has to show the failure, not just assert that it exists.
- **Decision:** `delete_source_only` empties and renames the document but leaves descendants active. While the stage is `source_only`, retrieval does not filter stale rows. Answers built from stale context are shown but never saved.
- **Consequences:**
  - The failure is visible.
  - The write-up must say this bug is **introduced here on purpose**, not found in another product.
  - Source-only deletion is refused after cleanup until a reset.
- **Evidence:** `store.py`; `app.py` `ask` and `delete`; `source_only_audit` in the reports.

## D-08. Invalidate mixed summaries whole and rebuild from surviving original roots

- **Status:** Accepted
- **Context:** A summary mixing a withdrawn source with other sources cannot be safely edited.
- **Decision:**
  - The cascade invalidates every descendant whole.
  - Then it generates **one** replacement summary from the surviving *original documents* in their lineage, never from the old mixed prose.
  - If the rebuild fails, cleanup stays complete and no fixture text is substituted.
- **Consequences:**
  - Useful facts come back from clean inputs.
  - The rebuilt summary may not match the old structure (one summary replaces three).
  - Independent sources such as `d-archive` keep shared facts alive.
- **Evidence:** `app.py` `delete`; `test_cleanup_rebuilds_only_from_surviving_roots`; `test_mixed_summary_invalidated_whole_but_independent_source_preserved`.

## D-09. Tombstones: keep IDs, edges and roots; empty bodies; replace titles

- **Status:** Accepted
- **Context:** Cleanup has to be inspectable and repeatable, and titles can also carry the secret.
- **Decision:**
  - Rows are never deleted.
  - Bodies become `''`.
  - Titles become `Withdrawn document` or `Purged <kind>`, which is a replacement, not an empty string.
  - Status becomes `deleted` or `invalidated`.
- **Consequences:**
  - The graph stays inspectable after cleanup.
  - Repeating the cleanup is a no-op.
  - IDs and lineage metadata are kept by design.
  - Earlier docs that said titles were "blanked" were imprecise.
- **Evidence:** `store.py` `purge_derived`; `test_titles_are_audited_and_scrubbed_alongside_bodies`.

## D-10. Separate deterministic fixture mode, with no silent fallback

- **Status:** Accepted
- **Context:** CI and offline demos need runs without a model, but fixture output must never pass for AI output.
- **Decision:**
  - `FixtureProvider` uses explicit rules and is labelled "Deterministic fixture — no AI call".
  - Live errors raise `ProviderError`, which becomes HTTP 502 or a failed CLI report.
  - Fixture text never replaces live output.
  - Transport failures are caught as `OSError` or `http.client.HTTPException` (which covers `IncompleteRead` from a truncated body and `BadStatusLine`), in both generation and the `/api/tags` availability check. Invalid JSON stays a separate `ValueError` path. There is no broad `except Exception`, so unrelated defects such as a `RuntimeError` still propagate.
  - Transport messages are content-free: a fixed sentence plus one allowlisted category, `HTTP status <code>` (only for an integer code from 100 to 599; otherwise `HTTP error`), `timed out`, `connection failed`, `invalid HTTP response` or `transport error`. For example, `Local model call failed (connection failed). No fixture fallback was used.` and `Ollama is unavailable (timed out). Fixture mode still works.` Exception text, `URLError` reasons, HTTP bodies and partial reads are never echoed, because they can carry request content.
- **Consequences:**
  - Fixture passes show only software invariants.
  - Every malformed Ollama response (non-object outer body, missing `message.content`, content that is not a JSON object, invalid fields or citations) raises `ProviderError`. Error messages name the structural problem and never echo model output (T-A5, fixed October 27).
  - **Correction (October 27, after a review of T-A5).** The first T-A5 fix still interpolated `str(exc)` into transport messages, so text inside a `URLError` reason reached `ProviderError`, the availability message, HTTP 502 bodies, CLI reports and `serve` stderr. `IncompleteRead` and `BadStatusLine` were not caught at all, giving HTTP 500, a CLI traceback, or a crashed `/api/state`. Both were fixed with the category allowlist and the `HTTPException` catch above.
  - *Inferred tradeoff:* a category is less useful for debugging than the raw error text, but the raw text is not safe to show.
  - Unexpected exceptions are treated as programming defects. The CLI does not convert them into failed reports; they propagate with a traceback, so defects are not disguised as evaluation results. The HTTP handler's generic 500 only prevents leaking tracebacks.
- **Evidence:** `providers.py` (`_transport_category`); `test_live_request_never_silently_uses_fixture`; `test_missing_live_model_is_an_error_not_a_successful_fixture_reset`; `tests/test_providers.py` (including `TransportErrorTests`); `test_malformed_live_output_is_a_502_without_fixture_fallback`; `TransportHTTPTests` in `tests/test_http.py`.

## D-11. Bounded deletion claims; evaluator references and evidence are kept

- **Status:** Accepted
- **Context:** The test needs an oracle, and the write-up needs evidence that contains the marker.
- **Decision:**
  - The claim covers **only** managed SQLite titles and bodies, recorded provenance and the four defined retrieval and answer probes.
  - `Experiment.scenario` (including `canary`) is kept, is returned by `/api/state`, and is exported as `oracle`. It is never sent to the model as a separate input.
- **Consequences:**
  - Do not say the marker leaves the app, API, browser or disk.
  - Unlearning, secure erasure, backups, logs and paraphrases are out of scope.
- **Evidence:** `app.py` `state` and `evaluate`; the `scope` strings in the reports and `store.audit`.

## D-12. Single-user localhost server that resets its database on start

- **Status:** Accepted (for the prototype)
- **Context:** This is a local demo with one shared experiment.
- **Decision:**
  - Bind `127.0.0.1`.
  - Check Host and Origin.
  - Use one controller and store.
  - `serve` and every successful reset replace the contents of `--database` with a freshly seeded experiment, in place (see D-20).
- **Consequences:**
  - Safe on one laptop, but **not deployable as is** for public use.
  - Earlier experiments are never resumed.
  - A failed reset keeps the previous experiment and its database bytes, unless the restored storage cannot be verified (D-20).
- **Evidence:** `__main__.py`; `test_cross_origin_and_dns_rebinding_requests_do_not_mutate`.

## D-13. Public demo design

- **Status:** Accepted (implemented October 28, 2026; deployment not yet done at that point; **deployed later on October 28, 2026**, T-E3, see the resolution note below)
- **Context:** The current server needs `/api/*`, keeps one shared resettable state, and cannot reach a laptop model from the cloud. Free Render cannot run the 4.3 GB model.
- **Options recorded in `context.md` §25E:**
  - **A.** A clearly labelled recorded replay or synthetic simulation, with local live Gemma shown through instructions and video.
  - **B.** A redesigned hosted service with session isolation, correct bind and Host handling, and controls on state and cost, with any remote inference explicitly identified.
- **Decision (October 28, 2026): option A, as a static walkthrough of recorded live runs.**
  - [site/](site/) is plain HTML, CSS and JavaScript. Its only data is `site/data/evidence.json`, exported by [scripts/export_site_data.py](scripts/export_site_data.py) from three selected live reports (`results/sentry-live-cold.json`, `results/sentry-live-warm.json`, `results/live-gemma.json`). Each run is exported separately with its source file's SHA-256; fixture reports are refused, so recorded model output is never mixed with fixture output.
  - The page is labelled "Recorded local Gemma evaluation — no live inference". It makes no `/api/*` or model request, stores nothing, and its buttons only change the view. Questions are the six preset recorded ones.
  - The page shows only what the reports contain: audit counts and IDs, answers, citations, context IDs, checks and event timings. No summary or document text is shown, because the reports do not hold it. Lineage links are labelled recorded, seed design or inferred, and the page says it is not a complete run-specific provenance graph.
  - [render.yaml](render.yaml) defines one Render static site publishing `./site`, with a no-op build command and security headers (a restrictive CSP whose `connect-src` is `'self'`). No server, database, worker, model or secret.
  - The localhost app is unchanged and is still never exposed publicly.
- **Consequences:**
  - Visitors see real recorded evidence without anything running on the laptop, and cannot get new AI answers.
  - The public evidence keeps the fictional marker, as all saved reports do (D-11).
  - `site/data/evidence.json` must be regenerated and committed when the selected reports change; `scripts/export_site_data.py --check` and `tests/test_site.py` fail if it is out of date.
  - Render hosts the page but is not entered as a category (D-14). The deployment itself needs the user's Render account and is not done yet (T-E3). *(Category status superseded October 29, 2026: Best Use of Render is now an intended category (D-14, second amendment). Render's role is unchanged: it hosts this static page only.)*
  - *Resolution (October 28, 2026): the user deployed it from `render.yaml` as the Blueprint-managed static site `ghostcache-walkthrough`, live at <https://ghostcache-walkthrough.onrender.com/> from commit `8013d01`. The page, `/data/evidence.json` and the Blueprint's security headers are served, and `/api/state` returns 404. It still runs no inference, and Render is still hosting only (D-14).*
- **Evidence:** `site/`, `scripts/export_site_data.py`, `render.yaml`, `tests/test_site.py` (20 tests); TESTING.md, "Public recorded walkthrough T-E2 (October 28, 2026)" and "Render deployment T-E3 (October 28, 2026)"; [screenshots/README.md](screenshots/README.md).

## D-14. Category expansion only through useful, evidenced integrations

- **Status:** Accepted as strategy; amended October 28, 2026 to three entered categories, and October 29, 2026 to four intended categories by adding Render (see the amendments)
- **Context:** The user asked for more categories, and also for real, demonstrable integrations rather than a list of sponsor names (`context.md` §2).
- **Decision:**
  - Seven targets: Gemma (implemented), GitHub Copilot via **GitHub Actions** (configured), Sentry, Render, .tech, Backboard, Browserbase.
  - Optional: ElevenLabs and Entire.
  - The other eleven partner categories are not pursued (`context.md` §20).
  - A category is listed in the submission only with working use and evidence.
- **Consequences:**
  - The extra work is substantial.
  - One person can still win at most one prize, so more categories are not independent chances.
  - Writing quality carries the most weight in judging.
- **Evidence:** [CATEGORIES.md](CATEGORIES.md); [tasks.md](tasks.md).
- **Amendment (October 28, 2026): three categories.** The submission enters only the three categories with working use and evidence: Gemma, GitHub (through Actions) and Sentry Agent Tracing. The .tech domain, Backboard, Browserbase, ElevenLabs and Entire targets are dropped, and none of them has code or evidence. Render hosts the public walkthrough (D-13) but is not added to the category list; that would need a separate decision after a verified deployment. The original seven-target text above is kept as history. *(Update, October 28, 2026: the deployment was verified (T-E3), and no decision to add Render was made, so it remains hosting only.)* *(Resolved October 29, 2026: the separate decision this amendment called for was made; Render is now an intended category. See the next amendment. The rest of this amendment, including the dropped categories, still stands.)*
- **Amendment (October 29, 2026): four intended categories, adding Render.** Authorized by the user on October 29, 2026.
  - **Intended categories:** Best Use of Gemma, Best Use of GitHub Copilot (targeted through GitHub Actions only; no claim that Copilot wrote the project), Best Use of Sentry Agent Tracing, and Best Use of Render.
  - **Why Render now:** the earlier amendment required a verified deployment first, and that evidence now exists:
    - the public walkthrough is deployed from [render.yaml](render.yaml) (T-E3, initial commit `8013d01`, [screenshot 00](screenshots/00-render-dashboard-live-8013d01.png));
    - it is checked read-only ([DEPLOYMENT.md](DEPLOYMENT.md), "Verification record");
    - the narrow-screen fix is served byte for byte (T-E7, [deployed evidence](screenshots/mobile-overflow-fix/deployed-2a1ffb0/README.md)).
  - **Official wording, checked October 29, 2026 (19:34 UTC on October 28) at <https://dev.to/challenges/hf26>:** "Use Render as your project's AI runtime, to host an agent's front end, or to run Hermes or OpenClaw." GhostCache relies only on "to host an agent's front end": Render hosts the public front end for recorded runs of GhostCache's local Gemma assistant. It is not an AI runtime and does not run Hermes or OpenClaw.
  - **Interpretation, not confirmation:** the wording does not explicitly address a static walkthrough of recorded runs with no live agent behind it. This is a reasonable intended entry under that wording, not organizer-confirmed eligibility, and acceptance is not guaranteed.
  - **What does not change:** Render's role. It serves the static walkthrough (D-13) and nothing else. It runs no inference, and the Python backend, the SQLite experiment and Ollama stay on the laptop.
  - **Entry:** these are intended categories. A category is entered only when the eventual DEV submission lists it. The official page says each submission "is automatically in the running for the overall prize and every partner category it qualifies for", so the organizers decide whether it qualifies. Editing these documents enters nothing.
  - **Unchanged:** the .tech domain, Backboard, Browserbase, ElevenLabs and Entire stay dropped.
  - **History:** the original seven-target text and the October 28 three-category amendment are kept above as history.

## D-15. Publish `ghostcache/` itself as the repository root

- **Status:** Accepted (implemented October 28, 2026)
- **Context:** GitHub only discovers workflows at `<repo root>/.github/workflows/`. No Git repository exists yet.
- **Decision:** Initialise the repository in the application directory. `context.md` stays in the parent workspace unless D-16 decides otherwise.
- **Consequences:** Publishing the parent folder unchanged would leave the workflow undiscovered.
- **Evidence:** `context.md` §18.
- **Outcome (October 28, 2026):** published as [bipul724/GhostCache](https://github.com/bipul724/GhostCache) with `ghostcache/` as the root; [Actions run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) discovered and ran the workflow successfully.

## D-16. Whether to ship the handoff context in the repository

- **Status:** Open
- **Context:** `context.md` sits outside the application root and includes account- and promo-related notes.
- **Decision:** Not yet made (T-B3).

## D-17. Sentry telemetry is metadata only

- **Status:** Accepted (implemented October 28, 2026)
- **Context:** Telemetry creates a new data path, and the cleanup claim depends on content staying local.
- **Decision:** If Sentry is added, spans carry durations, token counts, result counts, mode and error class only. No bodies, questions, answers or markers. It is off unless a DSN is set in the environment.
- **Consequences:** A test must prove that no content leaves the process. Debugging gets less context.
- **Amendment (October 28, 2026):** synthetic artifact IDs (for example `ghostcache.context_ids` and `gen_ai.memory.record.id`) and the boolean `ghostcache.answer_contains_marker` flag are allowed, because they are identifiers and signals, not content. The marker value itself never is. The full list is `ALLOWED_KEYS` in `ghostcache/telemetry.py`; `telemetry.set` rejects every other key and any non-scalar value. `sentry-sdk==2.72.0` is an optional extra (`dependencies = []` is unchanged, D-02) and is imported only when the DSN is set.
- **Evidence:** `ghostcache/telemetry.py`; `tests/test_telemetry.py` (9 tests, including the envelope privacy test); TESTING.md, section "Sentry tracing T-D2 (October 28, 2026)". Real traces (T-D3, October 28, 2026): live traces `dd21f76b3293450b84b0ad5ca45961dd` (cold) and `fb1530272ecd481399aa77f95d505dfa` (warm), their reports `results/sentry-live-cold.json` and `results/sentry-live-warm.json`, and seven screenshots `results/sentry-*.jpg`, including one failed live attempt (trace `7e075ad683f247d687b59dddbb038ce5`). Sentry's Agents view reported that the conversations' inputs and outputs weren't captured. See TESTING.md, section "Real Sentry traces T-D3 (October 28, 2026)".

## D-18. The Backboard comparison is stateless and optional

- **Status:** Proposed; **not pursued**: the Backboard target was dropped on October 28, 2026 (D-14 amendment). The record is kept as history
- **Context:** Comparing models through Backboard must not bring opaque provider memory into the deletion claim.
- **Decision:** An optional provider used only by a comparison command. Requests are stateless and carry only the supplied synthetic context, with caps on requests, tokens and cost. Ollama stays the local path.
- **Consequences:** Results report each model's run and are not an "unlearning leaderboard".
- **Evidence:** None yet (T-F2).

## D-19. Reset seeds a candidate and publishes it only on success

- **Status:** Superseded by D-20 (October 27, 2026). Implemented October 27, 2026 (task T-A6); the record below is kept as history.
- **Context:**
  - The old `reset()` closed and deleted the current store, set `stage="seeded"`, and only then seeded through several writes and model calls.
  - A live failure partway through (reproduced with a mock on the second summary) left 11 of 14 artifacts labelled `seeded`, with the *previous* experiment's `seed_checks`.
  - Task T-A6 offered two fixes: build atomically, or expose an explicit failed state. The fix brief preferred building a complete candidate.
- **Decision:**
  - Preflight first. An invalid mode or an unavailable live model raises before anything changes.
  - Snapshot the run state (`store`, `provider`, `scenario`, `events`, `stage`, `seed_checks`). Seed into a new candidate store (`:memory:`, or `<database>.candidate` beside a file database) while holding the controller lock.
  - On success, atomically `os.replace` the candidate file over the database, reopen it, close the previous store, set `stage="seeded"` and increment `generation_number`.
  - On any exception, close and delete the candidate, restore the snapshot and re-raise. Live failures stay failures, with no fixture fallback.
  - Before the first successful reset, the controller uses an empty in-memory placeholder, so the configured database file is untouched until a reset succeeds.
- **Consequences:**
  - A failed reset can never publish partial data or reuse another run's baseline checks. The previous valid experiment stays usable, and a later reset recovers normally.
  - No new `failed` stage is needed, and `ask`, `delete` and `verify` need no extra guards. *Inferred tradeoff:* a separate failed state would have been simpler to implement, but it would have destroyed a working experiment because of one transient model error.
  - A successful reset still replaces the disposable database, so the documented "do not point `--database` at a file you want to keep" warning stands. The replacement is now a file swap rather than delete-then-create.
  - **Remaining edge:** if the swap succeeds but reopening the file fails, the in-memory controller keeps the previous experiment while the file holds the candidate. This is not covered by a test.
  - `os.replace` over a file with an open SQLite connection relies on POSIX semantics (macOS and the Linux CI runner). It is not verified on Windows.
- **Evidence:** `app.py` `reset` and `_seed`; `ResetFailureTests` (5 tests) in `tests/test_app.py`; suite `Ran 36 tests … OK`.
- **Publication defects found afterwards (October 27, both reproduced against this code):**
  1. **Reopen after the swap.** If reopening the file failed after `os.replace`, restoring the previous `Store` left a connection to the replaced, unlinked inode. Memory held the old experiment, disk held the new one, and the next write failed with `OperationalError: attempt to write a readonly database`. The "remaining edge" above understated this: the restored experiment was not usable.
  2. **Candidate cleanup.** `Store(candidate_path)` ran outside the `try`, so a failure after the file was created left `<database>.candidate` behind. `_discard()` also deleted any pre-existing, unrelated file at `<database>.candidate` on every reset.
  - Both are fixed by D-20, which removes the candidate file and the swap.

## D-20. Publish a reset through SQLite online backup into an attached connection

- **Status:** Accepted (implemented October 27, 2026; reopens and completes T-A6). Supersedes D-19.
- **Context:** D-19's file swap had the two defects recorded above. A scratch prototype showed that `sqlite3.Connection.backup` aborted part-way (`pages=1` and a `progress` callback that raises on step 2) left the destination file byte-identical and still writable, with no leftover files. A full backup replaced the contents and survived a reopen.
- **Decision:**
  - **Preflight is unchanged.** An invalid mode raises `ValueError`, and an unavailable live model raises `ProviderError`, before anything changes.
  - **The candidate is always in memory.** `Store()` is created inside the protected block. There is no `<database>.candidate` file, no `os.replace` and no `_discard`.
  - **Attachment flag.** `Experiment._attached` records whether `store` is a connection to the configured file. Before the first successful reset the controller uses an empty in-memory placeholder, and the file is neither opened nor modified.
  - **Publication.**
    - `:memory:` path: the candidate becomes the store and the previous store is closed.
    - File path, not yet attached: note whether the database and its `-journal` existed, then open `Store(path, create_schema=False)`, which only connects and sets the row factory and `PRAGMA foreign_keys`. Call `replace_contents(candidate)` (the backup writes the schema) and `check_writable()`, then make it the store and close the candidate and placeholder. On any failure, close it and delete the database or `-journal` **only if this attempt created them**.
    - *Follow-up (October 27):* the first version opened the target with `Store(path)`, whose `CREATE TABLE IF NOT EXISTS` added `artifacts`, `provenance` and `sqlite_sequence` to an existing unrelated SQLite file before the copy. A failed publication therefore changed that file's bytes. `create_schema=False` is used only for this target; every other `Store` use still creates the schema.
    - File path, already attached: `previous_store.replace_contents(candidate)` copies into the same connection and inode. SQLite commits the destination only when the backup completes; an aborted backup is rolled back.
  - **`Store.replace_contents(source, *, pages=-1, progress=None)`** runs `source._conn.backup(self._conn, …)` under both stores' locks. `pages` and `progress` exist so tests can inject a real mid-copy failure.
  - **`Store.check_writable()`** opens a `SAVEPOINT`, inserts a throwaway row into `artifacts`, then rolls the whole transaction back. It detects the replaced-or-moved-file case, which `BEGIN IMMEDIATE` does not. The brief proposed `ROLLBACK TO` plus `RELEASE`. Measured here, that commits an empty transaction and rewrites the file header, changing the file's SHA-256, so a full rollback is used instead.
  - **`Store.__init__`** closes its connection and re-raises if setup fails (for example, schema creation on a file that is not a database). It never deletes files. With `create_schema=False` it writes nothing.
  - **Rollback.** On any exception (seeding, construction or publication), close every connection the attempt opened, restore `store`, `provider`, `scenario`, `events`, `stage`, `seed_checks` and the attachment flag, leave `generation_number` unchanged, and re-raise the **original** exception. Cleanup errors are attached to it as notes giving only their class name. They neither replace it nor stop the restore.
  - **Verification.** After restoring an attached store, check that its lineage (artifacts and edges) equals a snapshot taken before the attempt, and that `check_writable()` succeeds. If either check fails, the controller does not claim restoration. It closes that store, switches to an empty in-memory placeholder, clears `scenario`, `events` and `seed_checks`, sets `stage = "storage_failed"` and `_attached = False`, and raises `StorageError("Experiment storage could not be restored; reset to recover.")` chained from the original. `ask`, `delete` and `verify` refuse with a `ValueError` carrying that message. The next reset reopens the file and recovers.
  - **Transport.** `StorageError` becomes HTTP 503 with its fixed message. `ProviderError` stays 502, `ValueError` 400, and anything else a generic 500. `serve` exits 1 on a startup reset failure and prints only fixed messages (for a SQLite error, a fixed sentence plus the exception class name).
- **Consequences:**
  - A failed reset keeps the previous experiment in memory, and the restored connection stays writable. If that cannot be verified, the controller says so instead of serving a mismatched experiment.
  - **The file's bytes on failure.**
    - A file that existed before the attempt keeps its exact bytes if the failure happens before or during the copy. This holds whether it is an attached GhostCache database, an unrelated SQLite database or a non-database file. Nothing writes to it before the backup, and an aborted backup is rolled back.
    - A database or `-journal` the attempt created is deleted.
    - **Exception:** on first attach, if the copy completes and the following `check_writable()` fails, the file already holds the new experiment, and a pre-existing file is not deleted. The controller stays unattached and re-raises; the next reset reopens the file. This is tested.
    - Nothing is claimed about the bytes in the `storage_failed` case, or after a crash or power loss.
  - The database path is opened at most once per attachment, and no file is swapped, so an existing connection never points at an unlinked inode.
  - A successful reset still replaces the database's contents. The "point `--database` only at a disposable file" warning stands, even though the replacement no longer swaps files.
  - A file that is not a SQLite database now makes the reset fail and is left unchanged. D-19 would have replaced it. A *valid* but unrelated SQLite file is replaced by a successful reset, as for any `--database` path (the disposable-database warning).
  - **Limits.** This is not a crash-safety or durability claim: power loss or a process kill during publication is untested. Concurrent writers from other processes, and Windows, are untested. The `storage_failed` stage has no dedicated UI state; the UI shows the 503 error text.
- **Evidence:** `store.py` `replace_contents`, `check_writable` and `__init__`; `app.py` `reset`, `_roll_back` and `StorageError`; `__main__.py`; `PublicationTests` (10, three of them from the first-attach follow-up) in `tests/test_app.py`; `PublicationPrimitiveTests` (2) in `tests/test_store.py`; `StorageFailureHTTPTests` in `tests/test_http.py`; suite `Ran 52 tests … OK`, then `Ran 55 tests … OK` after the follow-up.
