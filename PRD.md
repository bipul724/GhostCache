# GhostCache: Product Requirements

| Field | Value |
| --- | --- |
| Version | 0.1.0 (the `pyproject.toml` and `ghostcache/__init__.py` version) |
| Document date | October 27, 2026 |
| Status | The MVP below is implemented. Category and public-demo requirements are not. |
| Source of truth | The code in `ghostcache/`, `web/` and `tests/` defines what is implemented. The workspace handoff `context.md` records intent and history. Where they differ, this document follows the code and says so. |

## 1. Problem

AI assistants built on retrieval rarely use a document only once. The app copies it into search chunks, generated summaries, handoff notes and saved answers. If the user later withdraws the original document, those copies can stay active. A new question can then retrieve a copy and send the withdrawn information back to the model. The user believes the document is gone, but the assistant can still state its contents.

Dependency tracking and source-aware cache invalidation are known fixes. The failure is still hard to *see*, because the copies are spread across intermediate artifacts that people rarely inspect.

## 2. Product purpose

GhostCache is a **local, inspectable testbed**. It makes this failure visible, traces its cause through the recorded provenance, removes every managed copy, keeps information that should survive, and verifies the result with explicit checks. It is a demonstration and a teaching tool. It is not yet a product that audits other people's RAG systems.

**Theme fit (DEV Hacktoberfest Week 4, "Ghost in the Machine"):** a deleted source whose traces keep reappearing is a digital haunting. The graph shows *real* data dependencies rather than a spooky persona.

## 3. Intended users

| User | Need |
| --- | --- |
| Developers building RAG or agent memory | See how derived artifacts outlive their source, and see a working provenance-based cleanup pattern. |
| Challenge judges and readers | Understand the failure, the fix and the evidence quickly, with honest limits. |
| The project author | Collect clear evidence for the write-up and for each category the entry actually uses. |

These are **not** current users: end users with real private documents, multi-tenant teams, or compliance officers who need deletion certificates.

## 4. Goals

- G1. Reproduce residual application-managed context after a source-only deletion, using fictional data.
- G2. Make the cause traceable through a provenance graph of every supplied context artifact.
- G3. Remove all managed copies through provenance-based cleanup, and rebuild useful mixed summaries from the sources that remain.
- G4. Prove that legitimate information survives: an unrelated fact and a fact supported by an independent source.
- G5. Run the AI parts on an open-weight model locally (Gemma through Ollama), plus a deterministic mode that needs no model.
- G6. Keep every claim bounded and backed by evidence.

## 5. Non-goals

- Model unlearning, fine-tuning or changing model weights.
- Secure physical erasure of SQLite pages, journals, disk blocks or backups.
- Deleting evaluator references, saved reports, screenshots, browser history or third-party logs.
- Universal semantic forgetting (every paraphrase, inference or other query).
- Legal or privacy-compliance certification.
- Claiming a vulnerability in any other product.
- Real-document upload, connectors to arbitrary RAG systems, multi-user accounts or authentication (for the MVP).
- Measuring how often models leak secrets naturally. The summary prompt asks the model to keep the passphrase on purpose.

## 6. User stories

- US-1. As a developer, I can seed a fresh fictional archive, so each run uses a new secret marker.
- US-2. As a developer, I can ask the assistant for the secret and see which artifacts supplied the answer.
- US-3. As a developer, I can delete only the source and then see the secret still returned, so I understand the failure.
- US-4. As a developer, I can inspect any artifact's body, status, parents and original sources.
- US-5. As a developer, I can run cascade cleanup and see the source and all descendants become content-free tombstones, while unrelated artifacts stay.
- US-6. As a developer, I can run verification and see which storage, retrieval and behavior checks passed or failed.
- US-7. As a judge, I can tell immediately whether answers came from a deterministic fixture or from live local Gemma.
- US-8. As a maintainer, I can run one command that executes the whole ten-check experiment and saves a JSON report.
- US-9. As a maintainer, I can run the unit, controller and HTTP tests without a network or a model.

## 7. Main demonstration journey

1. The user starts the local server and opens the page. Fixture mode is the default.
2. **Seed:** 5 documents, 5 chunks, 3 summaries (`s-vault`, `s-mixed` and `s-handoff`, a chain) and 1 saved answer. That is 14 artifacts.
3. **Ask** the vault question. The answer shows the `MOTH-…` marker with citations.
4. **Delete just the source.** `d-vault` is emptied and renamed. In this guided fixture sequence, six derived artifacts stay active and are marked stale: the five seeded descendants plus the additional answer saved in step 3. The minimal CLI sequence has five because its extra probes do not persist answers.
5. **Look for the echo.** The reworded question ("Which access phrase opens the observatory vault?") is answered with the marker from the copies.
6. **Clean up the whole trail.** The source and its descendants are emptied and tombstoned, and one summary is rebuilt from surviving roots.
7. **Verify.** All eight interactive checks pass. The garden time and reading-room name are still answered.
8. *(Live mode)* The same journey with Gemma generating the summaries and answers.

## 8. Functional requirements

Status values: **Done** means implemented and covered by tests or saved evidence. **Partial** means implemented with a documented gap. **Not started** means no code.

| ID | Requirement | Acceptance criteria | Status |
| --- | --- | --- | --- |
| FR-01 | Seed a fixed fictional corpus with a fresh marker | Each reset produces 5 documents (`d-vault`, `d-garden`, `d-archive`, `d-maintenance`, `d-shuttle`) and a new `MOTH-` + 12 uppercase hex marker. A second reset gives a different marker, and the old one is absent from the store. | Done (`test_reset_uses_fresh_marker_and_discards_prior_context`) |
| FR-02 | Build derived artifacts | Seeding creates one chunk per document, the summaries `s-vault` ← `c-vault`, `s-mixed` ← `s-vault`+`c-garden`, `s-handoff` ← `s-mixed`+`c-maintenance`, and one saved answer. That is 14 artifacts in total. | Done (saved report initial audit = 14) |
| FR-03 | Record complete provenance | Each generated artifact lists **every** supplied context artifact as a parent, in order and without duplicates. Original roots are inferred from parents. | Done (`app._commit_generation`, `Store.add_artifact`) |
| FR-04 | Reject invalid lineage | Missing, inactive or self parents, duplicate IDs, parentless derived artifacts and documents with parents are all rejected with `ValueError`. | Done (`test_invalid_parents_and_cycles_cannot_be_inserted`) |
| FR-05 | Prevent stale writes | A generation whose parents or roots became inactive before commit is refused. | Done (`test_deletion_during_generation_prevents_stale_commit`, `test_stale_active_parent_and_deleted_root_cannot_create_new_memories`) |
| FR-06 | Source-only deletion (broken control) | Source body is emptied, title becomes `Withdrawn document`, status becomes `deleted`. Descendants stay active with their content, and the audit reports them as stale. | Done |
| FR-07 | Cascade cleanup | In one transaction, the source and all transitive descendants get empty bodies. Titles become `Withdrawn document` or `Purged <kind>`. Status becomes `deleted` or `invalidated`. Edges and source IDs are kept. Repeating it changes nothing. | Done (`test_multi_hop_purge_…`, `test_repeated_cleanup_…`) |
| FR-08 | Rebuild from surviving roots | After cleanup, one replacement summary is generated only from surviving original documents behind invalidated content. It never contains the old marker. | Done (`test_cleanup_rebuilds_only_from_surviving_roots`) |
| FR-09 | Retrieval | Lexical term overlap over active, non-empty artifacts, returning up to 6. After cleanup it also excludes active artifacts with withdrawn roots. | Done |
| FR-10 | Preserve independent facts | A fact also present in an independent source stays retrievable and answerable after withdrawal. | Done (`test_independently_sourced_duplicate_fact_survives…`, the shared check) |
| FR-11 | Fixture provider | Deterministic answers and summaries, labelled as fixture, with null token counts and no model call. | Done |
| FR-12 | Live provider | Calls local Ollama `/api/chat` with a JSON schema, temperature 0. Validates the outer response object, `message.content`, that the content decodes to a JSON object, non-empty text, a citation list and citation membership. Every malformed response raises `ProviderError` without echoing model output. Transport failures (`OSError` or `http.client.HTTPException`, including `IncompleteRead` and `BadStatusLine`) raise `ProviderError`, or make the availability check report unavailable, with only a fixed allowlisted category such as `connection failed` or `HTTP status 500`, never the error's text. | Done (T-A5, reopened and completed October 27; `tests/test_providers.py` including `TransportErrorTests`, `TransportHTTPTests`) |
| FR-13 | No silent fallback | An unavailable model, provider error or malformed response never produces fixture output in live mode. | Done (`test_live_request_never_silently_uses_fixture`, `test_malformed_live_output_is_a_502_without_fixture_fallback`, the missing-model 502 test) |
| FR-14 | Interactive verification | `POST /api/verify` returns 8 checks: the baseline exposure plus 7 cleanup and preservation checks. | Done |
| FR-15 | End-to-end CLI evaluation | `evaluate` runs baseline, source-only, reworded leak, cascade and verify, giving **10** checks. It writes an optional JSON report and exits 0 or 1. | Done (saved reports; `test_malformed_model_output_exits_1_with_failed_report`). Provider errors, including malformed output, give a failed report and exit 1. Other exceptions are treated as defects and deliberately propagate with a traceback. |
| FR-16 | Browser UI | Guided steps, graph, inspector, question box and shortcuts, citations, trace, checks, ledger, mode banner, busy state, responsive layout. | Done for the listed parts (T-A2 to T-A4, October 27): the trace shows the supplied context from `parent_ids`, the echo step uses the reworded question, and the fixture banner says "Deterministic rules. No model inference." Checked by offline contract tests (`tests/test_ui.py`); no new browser QA. Open: no dedicated UI state for `storage_failed` (architecture.md discrepancy 4). |
| FR-17 | Mode visibility | Every answer and the banner show fixture vs live, and having a model installed is shown separately from the active mode. | Done (UI and `state.provider`) |
| FR-18 | Reset | A successful reset replaces the demo database's contents in place and all run state (store, scenario, provider, events, stage, `seed_checks`, generation). A failed reset publishes nothing: the previous experiment and its checks stay current, and the database stays writable. An existing file, including an unrelated SQLite or non-database file, keeps its bytes when the failure happens before or during the copy. The one exception is a write check that fails after a completed first copy (D-20). No new file is left behind, and no unrelated file is deleted. | Done (T-A6, reopened and completed October 27 by D-20; `ResetFailureTests` and `PublicationTests` in `tests/test_app.py`) |
| FR-19 | Storage failure is explicit | If the database cannot be verified after a failed reset (lineage unchanged and still writable), the controller does not claim restoration. It enters `storage_failed` with an empty experiment, returns HTTP 503 "Experiment storage could not be restored; reset to recover.", refuses `ask`, `delete` and `verify`, and recovers on the next reset. | Done (D-20; `test_unverifiable_restore_enters_storage_failed_then_recovers`, `test_unrestorable_storage_is_a_503_and_the_next_reset_recovers`) |

## 9. Nonfunctional requirements

| ID | Requirement | Current state |
| --- | --- | --- |
| NFR-01 | No third-party Python dependencies. Python ≥3.12. | Met. Verified on 3.12.6; 3.15 untested. |
| NFR-02 | Offline unit tests (no network or model) | Met: provider status is mocked in tests |
| NFR-03 | Localhost-only server with Host and Origin checks, JSON-only POST, size limits and security headers | Met for the local prototype |
| NFR-04 | No raw content in server logs | Met: the access log records method, path and status, and unexpected errors record only the exception class |
| NFR-05 | Deterministic fixture evaluation suitable for CI | Met locally and on GitHub ([Actions run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382), October 28, 2026). |
| NFR-06 | Concurrency safety for one local user | Controller and store `RLock`s plus SQLite transactions. Not a multi-user or distributed guarantee. |
| NFR-07 | Accessibility basics | Labels, `aria-*`, `role=status/alert`, reduced-motion styles. No formal audit has been done. |
| NFR-08 | Honest labelling | Fixture vs live, broken control, and the scope text in reports and the UI |

## 10. Privacy and data boundaries

- **Assistant-managed content:** artifact titles and bodies in SQLite. This is the *only* scope of the cleanup claim.
- **Evaluator state:** `Experiment.scenario` (including `canary`). It is kept after cleanup on purpose, is returned by `GET /api/state`, and is written into reports as `oracle`. It is never sent to the model as a separate input.
- **Evidence artifacts:** saved reports, screenshots and any future recording or narration. They are outside the cleanup claim and may contain the fictional marker.
- **Event ledger:** stores operation names, time of day, mode and provider, durations, token counts, artifact and parent IDs, and context fingerprints. It does not store prompts or answers. Full answers do appear in API responses and reports.
- **Live mode:** traffic goes only to `127.0.0.1:11434`. No hosted inference.
- **Future cloud features** (Sentry, Render, Backboard, Browserbase, ElevenLabs) must use fictional data. Sentry may receive only deliberately chosen metadata. Local-mode privacy does not carry over to them automatically.

## 11. MVP and future scope

| Implemented MVP | Future (not implemented) |
| --- | --- |
| Fixture and live-Gemma experiment, provenance store, two deletion policies, rebuild, 8- and 10-check verification, local UI, 62 tests (7 UI contract tests need Node), CI workflow file, a public repository with one successful hosted Actions run (October 28, 2026) | Open consistency fixes (T-A7, T-A8, the rest of T-A9), repeated live evaluations with metadata, Sentry tracing, a public demo on Render or .tech, a Backboard comparison, a Browserbase run, optional ElevenLabs narration and Entire checkpoints |

## 12. Success measures

Each measure comes from a check the code already runs:

| Measure | Target | Source |
| --- | --- | --- |
| Baseline exposure | Pre-deletion answer contains the marker | seed check / `before` answer |
| Failure reproduced | After source-only deletion: rows with the marker > 0 **and** the reworded answer contains the marker | `source_only_audit`, the `source_only` answer |
| Storage cleanup | 0 managed titles or bodies contain the marker (case-insensitive); source and descendants have empty bodies | `cleaned_audit.matched_canary`, the cleared check |
| Retrieval cleanup | Marker absent from all 4 retrieval probes, with the stale guard *disabled* | the retrieval check |
| Behavior | Neither secret answer contains the marker | the behavior check |
| Preservation | Garden answer contains `07:40`; reading-room answer contains `Lantern Hall` | the retained and shared checks |
| Lineage consistency | 0 active artifacts depend on a withdrawn root | `stale_descendants` |
| Reliability (future) | Results from repeated live runs, *including failures*, with date, environment and model metadata | not yet collected |

A fixture pass supports the software invariants only. A live pass supports only that particular run.

## 13. Dependencies

- Python 3.12+ standard library and SQLite.
- Ollama with `gemma4:e2b-it-qat` (about 4.3 GB) for live mode, on the user's laptop.
- GitHub (repository and Actions) for CI evidence. Set up: [bipul724/GhostCache](https://github.com/bipul724/GhostCache), with one successful hosted run (October 28, 2026).
- Planned external services: Sentry, Render, a .tech domain registrar and its DNS, Backboard, Browserbase, ElevenLabs, Entire. Their pricing, free allowances and eligibility were checked on October 27, 2026 according to `context.md`, and **must be rechecked** before use.

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| Seen as an obvious bug in a Halloween costume | Present the provenance DAG, the preservation controls, the bounded claims and the prior art honestly |
| Overclaiming (unlearning, global deletion, seven categories entered) | Status labels everywhere; the rules in [AGENTS.md](AGENTS.md) |
| One live run is weak evidence | Repeated live runs with saved failures (T-C1) |
| A public demo exposes a single shared, resettable state | Use a replay or redesigned per-session service, never the current server unchanged (T-E1) |
| Free tiers change or are already used up | Recheck before each integration; keep fixture and local paths working |
| Laptop memory and latency in live mode | Measure (T-C2); fixture mode for CI and demos |
| Conflicting deadline timestamps | Internal target October 30, 23:00 IST (see §16) |

## 15. Open questions

- ~~Q1. Should the UI echo step use the reworded question (as the CLI does)?~~ Resolved: yes (T-A3, October 27).
- Q2. Public demo design: recorded replay or simulation, or a redesigned hosted service with per-session isolation?
- Q3. Was `bipulchamoli.tech` claimed through the qualifying Hacktoberfest promo? This is unverified. Which subdomain should be used (`ghostcache.bipulchamoli.tech` has been suggested), and where is DNS actually managed?
- Q4. Do the user's Sentry, Backboard and Browserbase accounts still have the free allowances?
- Q5. Should `context.md` (or a cleaned copy) be published inside the repository?
- ~~Q6. Should reset be made atomic, or should a failure be shown as a distinct "failed seed" state?~~ Resolved: a failed reset keeps the previous experiment (D-19, superseded by D-20's in-place backup publication). A distinct `storage_failed` state exists only for the case where the restored database cannot be verified.

## 16. Category-related requirements (not MVP)

These apply only if the category is entered. Each one requires **real use plus evidence**. Installing an SDK or adding a logo or placeholder does not count.

| ID | Category | Requirement for listing it in the submission |
| --- | --- | --- |
| CAT-01 | Gemma | Explain Gemma's role, the model ID and the saved live evidence, including any failures. *(Ready now.)* |
| CAT-02 | GitHub Copilot (via Actions, which the official category description includes) | A public repository and a successful hosted workflow run whose fixture-report artifact can be inspected. Do not claim Copilot authorship. *(Repository and successful hosted runs exist: [run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) and [run #3](https://github.com/bipul724/GhostCache/actions/runs/40573873485). Run #3's fixture-report artifact was downloaded and inspected: 10 of 10 checks passed.)* |
| CAT-03 | Sentry Agent Tracing | Metadata-only spans for retrieval, generation, deletion, rebuild and verify, plus real trace screenshots and one explained finding |
| CAT-04 | Render | A reachable Render-hosted frontend or demo, labelled replay, simulation or live |
| CAT-05 | .tech domain | Evidence of the promo claim, plus a live HTTPS subdomain serving the project; the existing apex is preserved |
| CAT-06 | Backboard | A comparison of 2–3 open-weight models on the same corpus and checks, with model IDs, token and cost figures, and failures reported |
| CAT-07 | Browserbase (stretch) | A Stagehand or Browserbase session driving the workflow with assertions, plus session evidence |
| CAT-08 | ElevenLabs (optional) | Real generated narration with a stock voice; promo claimed only with the user's choice |
| CAT-09 | Entire (optional) | Real checkpoints of future work; nothing back-filled |

**Submission rules** recorded in `context.md` from the [Week 4 challenge](https://dev.to/challenges/hacktoberfest-week4-2026-10-26) and its [contest rules](https://dev.to/page/hacktoberfest-week4-2026-10-26-contest-rules) (recheck before publishing):

- **What the entry needs:**
  - A new project.
  - Meaningful open AI.
  - A DEV post using the template and the tags `devchallenge` and `hf26challenge`.
  - A demo: a deployed link or a video.
  - A link to the code repository.
  - The "Why does open innovation matter?" section.
  - Every category that was genuinely used, listed in the post.
- **Winning:** one entry per person, and at most one prize.
- **Deadline conflict, to be resolved before relying on the later date:**
  - The written rules end on October 31, 2026 at 23:59 PDT (November 1, 12:29 IST).
  - The DEV API's `ends_at` is October 31, 06:59 UTC (October 31, 12:29 IST).
  - Internal target: **October 30, 23:00 IST**.
