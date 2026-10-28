# Evaluation protocol

GhostCache evaluates application-managed retrieval content and provenance. It does not evaluate removal of knowledge from model weights or certify deletion in another product.

## Modes and reproducibility

Run from the project directory:

```sh
python3.12 -m unittest discover -s tests -v
python3.12 -m ghostcache evaluate --mode fixture --output results/fixture-new-run.json
python3.12 -m ghostcache evaluate --mode live --model gemma4:e2b-it-qat --output results/live-gemma-new-run.json
```

The last command requires that model to be installed in a running local Ollama instance. Python 3.12.6 is the verified interpreter; the author's default `python3` is 3.15.0 and untested. Choose a new output filename for every run so the original saved evidence and earlier failures are not overwritten. Each evaluation creates a fresh in-memory SQLite store. The UI's disposable on-disk database is separate.

| Mode | Generation | What a pass supports |
| --- | --- | --- |
| `fixture` | Explicit deterministic string operations; no language-model call | The defined storage, provenance, retrieval, and preservation invariants hold in the controlled case. |
| `live` | Actual Ollama calls for digests and answers | Those same checks hold for this particular model run and its recorded outputs. |

Keep the modes separate. Neither an unavailable model nor malformed model output causes a silent fixture fallback. Expected `ProviderError`/`ValueError` failures produce a failed report and exit status `1`; a provider error is not a successful no-leak observation. Malformed model output (for example content that decodes to `[]` or a string, or missing `message.content`) is a `ProviderError` and is handled the same way (fixed in T-A5). Transport failures, including a truncated response body (`IncompleteRead`) or a bad status line, are also `ProviderError`s. Their messages carry only a fixed category such as `(connection failed)` or `(HTTP status 500)`, never the underlying error text ([DECISIONS.md](DECISIONS.md) D-10). Any other exception is treated as a programming defect: it is not converted into a report and exits with a traceback. Record those failures too.

If the live model fails while an experiment is being seeded, that reset publishes nothing: the evaluation reports the provider error, and in the UI the previous experiment and its database bytes stay current. A reset is seeded in memory and copied into the UI database in place only after seeding succeeds. If the restored database cannot be verified, the UI reset returns 503 and the next reset recovers (T-A6, [DECISIONS.md](DECISIONS.md) D-20). The CLI evaluation uses an in-memory database and never touches a file.

Random markers change on every run. The detailed JSON is the record of the actual run, not a byte-identical golden output. Record model identity and the execution environment when comparing live results; one run is not an estimated general success rate.

### Recorded verification — October 27, 2026

| Verification | Recorded result | Evidence |
| --- | --- | --- |
| Python automated suite | 22 tests passed, including five HTTP-handler tests | `python3.12 -m unittest discover -s tests -v` |
| Python automated suite after the T-A5/T-A6 fixes | 36 tests passed (9 store, 13 controller, 6 HTTP-handler, 8 provider/CLI) | same command; see [TESTING.md](TESTING.md) |
| Python automated suite after the reset-publication and transport-error fixes (D-20, D-10) | 52 tests passed (11 store, 20 controller, 9 HTTP-handler, 12 provider/transport/CLI) | same command; see [TESTING.md](TESTING.md) |
| Python automated suite after the first-attach follow-up (D-20) | 55 tests passed (11 store, 23 controller, 9 HTTP-handler, 12 provider/transport/CLI) | same command; see [TESTING.md](TESTING.md) |
| Python automated suite after the T-A2–T-A4 UI fixes | 62 tests passed, including 7 UI contract tests run with Node v22 (6 skip without Node) | same command; see [TESTING.md](TESTING.md) |
| Python automated suite after Sentry tracing (T-D2) | 71 tests passed with `sentry-sdk` 2.72.0 in `.venv`; with plain `python3.12` the 6 SDK tests skip | same command, and `.venv/bin/python -m unittest discover -s tests -v`; see [TESTING.md](TESTING.md) |
| Controlled fixture evaluation | 10 of 10 checks passed | [results/fixture.json](results/fixture.json) |
| Live local Gemma evaluation | 10 of 10 checks passed | [results/live-gemma.json](results/live-gemma.json), model `gemma4:e2b-it-qat` |

These are completed checks, not projected results. The live evidence is a single synthetic-corpus run. Re-running with a fresh marker can produce different model behavior; report subsequent failures as well as passes.

## Controlled corpus

Every run creates five synthetic documents about an observatory:

- A vault note contains a freshly randomized `MOTH-…` passphrase and the reading-room name.
- A roof-garden timetable contains an unrelated opening time.
- An independent archive directory repeats the reading-room name.
- A maintenance plan and shuttle guide supply other unrelated facts.

Seeding creates five chunks, three summaries (a vault digest, a mixed digest, and a transitive handoff summary), and one saved assistant answer. Later interactive questions may create additional saved answers. The live summary prompt explicitly requests preservation of the supplied passphrase. Fixture mode copies it through deterministic operations. The experiment therefore tests propagation and cleanup of a known traceable fact, not the frequency of naturally occurring secret leakage.

The passphrase's expected value lives in `Experiment.scenario` as **evaluator state outside the assistant artifact store**. It also appears in the exported report and may be visible in the inspector before cleanup. `GET /api/state` returns `scenario.canary` even after cleanup, so the fictional marker remains accessible through evaluator state in the browser/API. After cleanup, model requests receive only the question, instructions, and retrieved artifact bodies; the evaluator's expected value is not separately supplied. Exported results and evaluator references are expressly outside the deletion claim.

## End-to-end sequence

1. Seed fresh documents and derived artifacts.
2. Ask the vault question and require the fresh marker to appear. A run without this demonstrated baseline cannot pass.
3. Perform **source-only deletion**: empty the source body and replace its original title with `Withdrawn document`, but intentionally retain active derived copies.
4. Require residual marker-bearing rows and an answer revealing the marker under the changed-wording probe. This proves the deliberately broken control actually exercised the failure in that run.
5. Perform **recursive cleanup**: empty the source and every descendant's body, replace original titles with neutral tombstone labels (`Withdrawn document` / `Purged <kind>`), retain provenance, and rebuild a digest using surviving source documents only.
6. Inspect all managed rows, run the defined retrieval probes, and ask the secret and preservation questions again.

Cleanup does not rely on hiding a marker with an answer filter. The audit examines every artifact's title/body, including inactive rows. Retrieval inspection is also run without the deleted-root filter so that the additional runtime guard cannot conceal stored residual content from verification.

The full CLI sequence has **ten checks**: the eight checks in `verify()` plus two checks requiring residual storage and disclosure in the broken control. Interactive verification alone has **eight checks** and can pass after direct cascade cleanup without demonstrating source-only failure first.

The minimal CLI case has five stale descendants because its extra probes use `persist=False`. The guided fixture UI sequence adds a second saved answer before deletion, producing six stale descendants and 15 rows before cleanup, then 16 rows after one rebuild. Other valid saved answers can change these counts. The question text itself is not stored in conversation artifacts.

## Checks and interpretation

| Check | Purpose |
| --- | --- |
| Pre-deletion answer exposes the fresh marker | Prevent a vacuous pass when the assistant never knew the tested fact. |
| Source-only control retains copies and exposes the marker | Confirm the broken comparison actually reproduces the intended failure. |
| Source and all descendants have cleared content | Check transitive cleanup, including mixed summaries and saved conversation context. |
| Marker absent from every managed title/body | Detect residual copies beyond the currently retrieved subset. |
| Marker absent from all defined retrieval probes | Check the retrieval-visible paths separately from generated answers. |
| Both secret questions stop returning the marker | Observe bounded answer behavior after cleanup. |
| Roof-garden opening time remains answerable | Reject a misleading “fix” that destroys all useful context. |
| Reading-room name remains answerable | Preserve a fact supported by an independent surviving document. |
| No active artifact depends on a withdrawn root | Check provenance consistency, not just literal marker absence. |

The defined questions cover the direct vault question, a changed-wording vault question, the garden timetable, and the independently supported reading-room fact. Retrieval is lexical; the paraphrase test is not evidence of arbitrary semantic recall or exhaustive adversarial coverage.

The result's `passed` field is the conjunction of its checks. Preserve failures and inspect their details. In live mode, a missed retained fact can be a model-answer failure even when the underlying surviving content remains intact; conversely, a withheld answer does not excuse residual stored content.

## Unit-test coverage

The test suite additionally exercises:

- Multi-hop cleanup, preserved tombstones/edges, and repeated cleanup without extra mutations.
- Whole invalidation of mixed summaries and rebuilding from surviving roots.
- An independently supported duplicate fact that must remain after withdrawing another source.
- Markers in titles as well as bodies.
- Missing, self-referential, duplicate, inactive, and absent parent cases.
- Refusing a derived artifact whose parents or original roots became inactive before commit.
- Fresh reset markers, database reopen, and the persistence of cleared content.
- Lexical retrieval behavior and explicit live-provider failure.
- Malformed Ollama responses at every layer (outer body, `message.content`, non-object content, invalid fields, unknown citations) raising `ProviderError`, with HTTP 502 and a failed CLI report (`tests/test_providers.py`).
- Reset failures on each summary, on the baseline answer, and on a non-provider error, which keep the previous experiment and its database file unchanged and recover on the next reset (`ResetFailureTests`).
- A real SQLite backup aborted mid-copy, on first attach and on an attached database, leaving memory, file bytes and writability unchanged. Also covered: no file swap, at most one open of the database per attachment, cleanup only of files the attempt created, no leaked connections, and the `storage_failed` path with its HTTP 503 and recovery (`PublicationTests`, `StorageFailureHTTPTests`).
- Transport failures carrying a sentinel string in their reason, message, body or partial read. The sentinel never appears in the provider error, the availability message, `/api/state`, 502 bodies, CLI reports, stdout or `serve` stderr (`TransportErrorTests`, `TransportHTTPTests`).

Nine HTTP tests exercise the real request handler through an in-memory socket fixture, without binding a network port. They cover the source-only/cleanup API workflow, Host and Origin rejection without mutation, JSON input errors and static-response headers, a missing live model returning an error rather than a successful fixture reset, malformed live output and transport failures returning 502 rather than 500, and unrestorable storage returning 503. These are handler tests, not a browser or deployed-network test.

The stale-generation test simulates deletion between reading context and committing a result. Controller operations are serialized; the store independently rechecks parent/root status on insertion. This is a bounded invariant test, not a distributed concurrency or multi-tenant security test.

## Boundaries

Passing this suite supports only this corpus, this implementation, the managed title/body fields, captured lineage, and the listed queries. It does not demonstrate secure disk erasure, removal from model weights, deletion of evaluator reports or browser history, cleanup of backups/external logs, or correctness of another RAG implementation.

Provenance must capture every artifact actually supplied as context. An undeclared copy outside this store is outside the graph and cannot be discovered by graph traversal alone. The synthetic marker is an exact-match oracle; its absence cannot establish removal of every paraphrase or inference. Likewise, a fact that survives in a legitimate independent source is not a source-withdrawal failure.

No general model-unlearning, compliance, universal forgetting, third-party vulnerability, or performance claim follows from a fixture pass or a single live evaluation.
