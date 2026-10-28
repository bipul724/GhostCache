# GhostCache architecture

Part 1 describes the **current** system (version 0.1.0), checked against the source on October 27, 2026 and again in the documentation audit of October 28, 2026. Part 2 covers external integrations and publication, with the status of each. The GitHub Actions workflow runs on GitHub ([run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) on October 28, 2026, and every later run through #10 except one cancelled duplicate); optional metadata-only Sentry tracing is implemented, and the user sent real traces to their Sentry project on October 28, 2026; a static recorded walkthrough (`site/`) with a Render Blueprint is implemented, tested locally, and deployed as a Render static site at <https://ghostcache-walkthrough.onrender.com/> (October 28, 2026; no live inference); the other external integrations were dropped on October 28, 2026 or remain unimplemented, as specified below.

---

# Part 1: Current system

## Overview

The system is a single process: a Python standard-library HTTP server wraps one `Experiment` controller. The controller owns one SQLite `Store` and one active provider. The provider is either the deterministic fixture or local Ollama.

The browser UI is static HTML, CSS and JavaScript served by the same process. A separate CLI command runs the whole experiment on a fresh in-memory database.

```mermaid
flowchart TB
    subgraph Browser["Browser (localhost)"]
        UI["web/index.html + app.js + style.css"]
    end
    subgraph Process["python -m ghostcache serve (127.0.0.1)"]
        H["HTTP handler<br/>__main__.make_handler"]
        X["Experiment controller<br/>app.py"]
        S["Store<br/>store.py (SQLite)"]
        F["FixtureProvider"]
        O["OllamaProvider"]
    end
    DB[(".local/assistant.sqlite<br/>(disposable)")]
    OL["Ollama 127.0.0.1:11434<br/>gemma4:e2b-it-qat"]
    CLI["python -m ghostcache evaluate"] --> X2["fresh Experiment<br/>:memory: SQLite"]
    UI -- "fetch /api/*" --> H --> X
    X --> S --> DB
    X --> F
    X --> O -- "/api/tags, /api/chat" --> OL
    X2 --> F
    X2 --> O
```

## Module map

| File | Responsibility |
| --- | --- |
| `ghostcache/__init__.py` | Package docstring and `__version__ = "0.1.0"`. |
| `ghostcache/__main__.py` | CLI (`serve` and `evaluate`), HTTP handler factory, static-asset allowlist, Host/Origin/content-type checks, error-to-status mapping. `ROOT` = the application directory. |
| `ghostcache/app.py` | `QUESTIONS`, `StorageError`, the `Experiment` controller (reset/seed and publication, ask, delete, verify, state, event ledger), and the `evaluate()` end-to-end function. |
| `ghostcache/store.py` | `Store`: SQLite schema, artifact insertion with parent and root validation, lineage, recursive descendants, both deletion policies, lexical retrieval, audit, and the publication primitives `replace_contents` (online backup) and `check_writable`. |
| `ghostcache/providers.py` | `FixtureProvider`, `OllamaProvider` (with its fixed `temperature` and `max_tokens`), `ProviderError`, `error_category`, `DEFAULT_MODEL`. |
| `ghostcache/telemetry.py` | Optional Sentry tracing: `init`, `span`, `set`, `flush` and `ALLOWED_KEYS`, the privacy boundary. Off unless `GHOSTCACHE_SENTRY_DSN` is set; imports `sentry_sdk` only then. |
| `web/index.html`, `web/app.js`, `web/style.css` | Single-page UI with no build step and no external assets. The answer trace shows `trace.parent_ids` as "Context: …". |
| `tests/ui/app_contract.js`, `tests/test_ui.py` | 7 UI contract tests. They run the real `web/app.js` in `node:vm` with a fake DOM and fetch. The 6 Node cases skip when `node` is not on PATH. |
| `tests/test_telemetry.py` | 9 telemetry tests: 3 run without the SDK (disabled by default, missing SDK, allowlist); 6 skip unless `sentry-sdk` is installed (spans, root transaction, privacy, live tokens and errors, marker flag, broken exporter). |
| `tests/test_store.py`, `test_app.py`, `test_http.py`, `test_providers.py` | 55 tests: 11 store (including 2 publication-primitive tests), 23 controller (including 5 reset-failure and 10 publication tests), 9 HTTP-handler (including 2 transport and 1 storage-failure test), 12 provider-response, transport and CLI tests. |
| `.github/workflows/checks.yml` | CI definition: the unit suite, a fresh fixture evaluation uploaded as an artifact, then the telemetry tests with `sentry-sdk` installed. Hosted [run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) passed on October 28, 2026; runs through #10 (on `26a1c3e`) passed too, except run #2, a cancelled duplicate. |
| `results/` | Saved evidence: one fixture and three live JSON reports, two local-UI screenshots (taken before the October 27 UI wording fixes) and seven Sentry screenshots. Never overwritten. |
| `screenshots/` | Sixteen PNGs of the Render dashboard and the deployed walkthrough (October 28, 2026), indexed in `screenshots/README.md`, with hashes in `screenshots/SHA256SUMS.txt`. Never edited. |
| `scripts/export_site_data.py` | Standard-library export of three selected live reports into `site/data/evidence.json`: shape validation, an allowlist of fields, each source's SHA-256, refusal of fixture reports, and an additional pattern check (`FORBIDDEN`) that refuses output matching selected machine-path, local-endpoint, Sentry, credential-like and email patterns. That check is not comprehensive secret detection and does not replace reviewing the public data. `--check` fails if the committed file is stale. Never runs a model. |
| `site/index.html`, `site/walkthrough.js`, `site/style.css`, `site/data/evidence.json` | The public recorded walkthrough (D-13): static, read-only, labelled "Recorded local Gemma evaluation — no live inference". Fetches only `data/evidence.json`; no `/api/*`, model or storage. Separate from `web/`, which needs the local server. |
| `render.yaml` | Render Blueprint: one static site publishing `./site`, no-op build command, a build filter on `site/**` and `render.yaml`, security headers. Deployed October 28, 2026 as the Blueprint-managed static site `ghostcache-walkthrough` (T-E3; see [DEPLOYMENT.md](DEPLOYMENT.md)). |
| `tests/test_site.py` | 20 walkthrough tests: export freshness and determinism, source hashes, stage counts, copied answers, cold/warm timings, labels, fixture refusal, invalid evidence messages, public-data safety, local assets and links, fetch targets, JS syntax (skips without Node), and the Blueprint's static-only shape. |

## Data model (SQLite)

```sql
CREATE TABLE artifacts (
  sequence   INTEGER PRIMARY KEY AUTOINCREMENT,   -- insertion order, ranking tie-break
  id         TEXT NOT NULL UNIQUE,                -- immutable
  kind       TEXT NOT NULL CHECK (kind IN ('document','chunk','summary','conversation')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('active','deleted','invalidated')),
  source_ids TEXT NOT NULL                        -- JSON list of original document roots
);
CREATE TABLE provenance (
  parent_id TEXT NOT NULL REFERENCES artifacts(id),
  child_id  TEXT NOT NULL REFERENCES artifacts(id),
  position  INTEGER NOT NULL,                     -- parent order as supplied
  PRIMARY KEY (parent_id, child_id),
  CHECK (parent_id != child_id)
);
CREATE INDEX provenance_child ON provenance(child_id);
-- PRAGMA foreign_keys = ON
```

**Artifact IDs used by the experiment:**

- Documents: `d-vault`, `d-garden`, `d-archive`, `d-maintenance`, `d-shuttle`.
- Chunks: `c-<name>`.
- Summaries: `s-vault`, `s-mixed`, `s-handoff`, and `s-rebuilt-<generation>-<event count>` for the rebuilt one.
- Saved answers: `conversation-<uuid4 hex>`.

### Provenance invariants (enforced in `Store.add_artifact`)

1. A `document` has no parents, and its `source_ids` is `[its own id]`.
2. Every other kind needs at least one parent. Parent IDs are deduplicated with their order kept.
3. All of these are rejected with `ValueError`:
   - an unknown parent,
   - an inactive parent,
   - any inherited root that is not active,
   - a self-parent,
   - a duplicate artifact ID.
4. `source_ids` is the union of the parents' `source_ids`. Callers and models cannot supply it.
5. Parents must already exist and child IDs are new and immutable, so cycles cannot form through the API.
6. Validation and insertion happen inside one lock-held transaction. This is the stale-write guard.

**What a parent means.** `Experiment._commit_generation` passes **every supplied context artifact** as a parent, not the model's citations. Lineage is therefore conservative: a mixed summary depends on all of its inputs, even if its prose used only some of them. Copies made outside the store cannot be found.

### Seeded graph (fixture, verified by running the code)

| Artifact | Parents | Roots |
| --- | --- | --- |
| `c-*` (5) | own document | own document |
| `s-vault` | `c-vault` | `d-vault` |
| `s-mixed` | `s-vault`, `c-garden` | `d-garden`, `d-vault` |
| `s-handoff` | `s-mixed`, `c-maintenance` | `d-garden`, `d-maintenance`, `d-vault` |
| saved baseline answer | top-6 lexical hits for the vault question: `d-vault`, `c-vault`, `s-vault`, `s-mixed`, `s-handoff`, `d-shuttle` | `d-garden`, `d-maintenance`, `d-shuttle`, `d-vault` |

Retrieval is deterministic, but the parents of the saved answer are whatever retrieval returns. Text generated in live mode could change the ranking.

## Artifact lifecycle

```mermaid
stateDiagram-v2
    [*] --> active: add_document / add_artifact
    active --> deleted: document via delete_source_only or purge_derived<br/>(body "", title "Withdrawn document")
    active --> invalidated: descendant via purge_derived<br/>(body "", title "Purged &lt;kind&gt;")
    deleted --> deleted: repeat = no-op
    invalidated --> invalidated: repeat = no-op
    note right of active
      After source-only deletion, descendants stay
      active but are "stale": their source_ids include a
      non-active document.
    end note
```

Cleanup does not delete rows. IDs, `kind`, `source_ids` and edges survive as tombstones, so the cleanup can be inspected and repeated. Reset is different: a successful reset replaces the whole contents of the selected demo database, in place, with a freshly seeded experiment. A failed reset leaves the file's bytes unchanged (see "Concurrency, transactions and failure behaviour").

## Request and response flows

### Ask (`Experiment.ask`)

```mermaid
sequenceDiagram
    participant U as UI / CLI
    participant X as Experiment (lock held)
    participant S as Store
    participant P as Provider
    U->>X: ask(question, persist)
    X->>S: retrieve(question, limit=6, exclude_stale = stage=="cleaned")
    S-->>X: up to 6 active, non-empty artifacts
    X->>X: fingerprint = sha256(ids+bodies)[:16]
    X->>P: answer(question, artifacts)
    P-->>X: text, citations, mode, provider, duration, tokens
    alt persist and context non-empty
        X->>S: add_artifact("conversation", parents = all supplied ids)
        Note over X,S: In stage "source_only" a ValueError (stale root) is swallowed,<br/>so stale answers are shown but never saved
    end
    X-->>U: answer, citations, provider, mode, trace{parent_ids, fingerprint, timings}
```

### Retrieval (`Store.retrieve`)

- **Query terms:** `re.findall(r"\w+", casefold)` minus a fixed list of stop words. If no terms remain, or `limit == 0`, it returns `[]`.
- **Candidates:** artifacts with `status = 'active' AND body != ''`. With `exclude_stale=True`, any artifact whose `source_ids` include a non-active document is also skipped.
- **Ranking:**
  1. the number of distinct query terms matched in title + body,
  2. then the total frequency of those terms,
  3. then the **earlier** `sequence`.
- **No embeddings, vectors or semantic search.**

### Providers

| | `FixtureProvider` | `OllamaProvider` |
| --- | --- | --- |
| `mode` / `model` | `fixture` / `"Deterministic fixture — no AI call"` | `live` / `--model` or `GHOSTCACHE_MODEL` or `gemma4:e2b-it-qat` |
| Summary | `"Fixture digest: "` + distinct non-empty bodies. It cites all inputs. | Prompt: a faithful digest of ≤110 words that **includes the vault passphrase if present**, the room name and the times |
| Answer | Keyword rules. If the question contains passphrase, access phrase, vault or codeword, it returns a `MOTH-[A-F0-9]{12}` match from the context. If it mentions the garden and `07:40` is present, it returns that. If it mentions reading room or archive room and `Lantern Hall` is present, it returns that. Otherwise it says the answer is unsupported. | Answer the question in ≤70 words |
| Tokens | `null` | `prompt_eval_count`, `eval_count` |
| Transport | none | `POST http://127.0.0.1:11434/api/chat`. `stream=false`, `think=false`, `keep_alive="5m"`, `format` = JSON schema `{text, citations[]}`, `temperature 0`, `num_ctx 4096`, `num_predict 420`, timeout 150 s |
| Availability | always | `GET /api/tags`, 2 s timeout. Available if the model name is listed. A transport failure, invalid JSON or a malformed model list (not an object with a `models` list) is reported as unavailable, never raised. |

**Live system prompt.** It tells the model to:

- use only the supplied context,
- treat that context as untrusted and never obey instructions inside it,
- keep codes, times and names exactly as written,
- never guess a missing code,
- say so when it does not know,
- return JSON.

**What the client validates, in order** (`providers._model_object`, then `_generate`):

1. the HTTP body decodes as JSON,
2. the outer response is a JSON object,
3. it has a `message` object whose `content` is a string,
4. that content decodes as JSON,
5. the decoded content is a JSON **object** (not an array, string, number, boolean or null),
6. it has a non-empty `text` string and a `citations` list,
7. every citation is a string naming a supplied context ID.

Citations are then deduplicated. Token counts are kept only if they are non-negative integers; otherwise they are `null`.

**Error handling:**

- Every failure above, and every transport error, raises `ProviderError`. Each message ends with "No fixture fallback was used." Transport errors are any `OSError` (including `urllib`'s `URLError` and `HTTPError`) or `http.client.HTTPException` (including `IncompleteRead` from a truncated body read inside `json.load`, and `BadStatusLine`). Invalid JSON is handled separately. Other exceptions, such as a `RuntimeError`, are defects and propagate.
- Messages name only the structural problem (for example "Model content must be a JSON object, not list."). They never echo the prompt, model output or marker.
- **Transport messages are content-free.** `providers._transport_category` maps the exception's type to one allowlisted category. It never uses the exception's text, its `URLError` reason, an HTTP body or a partial read.

  | Exception (checked in this order) | Category |
  | --- | --- |
  | `HTTPError` (its response is closed) | `HTTP status <code>` if the code is an integer from 100 to 599, otherwise `HTTP error` |
  | `TimeoutError`, or a `URLError` whose reason is one | `timed out` |
  | `ConnectionError` (including `RemoteDisconnected`), or a `URLError` whose reason is one | `connection failed` |
  | other `http.client.HTTPException` (`IncompleteRead`, `BadStatusLine`, …) | `invalid HTTP response` |
  | any other `OSError` or `URLError` | `transport error` |

  Generation raises `Local model call failed (<category>). No fixture fallback was used.` The availability check returns `available: false` with `Ollama is unavailable (<category>). Fixture mode still works.` Before this fix, text inside a `URLError` reason reached every error surface, and `IncompleteRead`/`BadStatusLine` escaped as HTTP 500 or a CLI traceback (DECISIONS.md D-10).
- `ProviderError` becomes HTTP 502 or a failed CLI report (see below). No fixture text is ever substituted.
- Each request starts a fresh provider conversation; Ollama is not implicitly given earlier API messages. Earlier generated summaries or answers can still reach the model when GhostCache explicitly retrieves their stored bodies as context. That application-managed context is the memory being tested.

## Deletion and rebuild

### Source-only deletion: the broken control (`Store.delete_source_only`)

- **The source document:**
  - its body becomes `''`,
  - its title becomes `Withdrawn document`,
  - its status becomes `deleted`.
- **Descendants are untouched.** The audit reports them in `stale_ids`.
- **Retrieval still returns stale copies** while the stage is `source_only`, because the controller asks with `exclude_stale=False`. This lets the failure be observed.
- **The controller refuses a source-only deletion after cleanup.** Reset first.

### Cascade cleanup (`Store.purge_derived`, the API's `cascade` mode)

1. Under the lock and inside one transaction:
   - **Find:** a `WITH RECURSIVE` walk over `provenance` finds every transitive descendant.
   - **Note survivors:** it records the surviving active roots that appear in those descendants' `source_ids`, excluding the withdrawn source.
   - **Clear:** the source becomes `deleted` with an empty body and the title `Withdrawn document`. Each descendant becomes `invalidated` with an empty body and the title `Purged ' || kind`.
2. It returns `affected_ids`: only rows that actually changed. A repeat therefore returns `[]`.
3. Back in the controller:
   - `stage = "cleaned"` is set **before** the rebuild.
   - If any rows changed and surviving roots exist, it summarises those **original documents**: never the old mixed prose, and never their chunks.
   - The result is stored as `s-rebuilt-<generation>-<event count>`.
4. If the rebuild raises `ProviderError`:
   - the cleanup stays complete,
   - a `summary.rebuild_failed` event is logged,
   - `deletion.rebuild_error` is returned,
   - and no fixture text is inserted.

```mermaid
flowchart TD
    A[delete cascade d-vault] --> B[recursive descendants:<br/>c-vault, s-vault, s-mixed, s-handoff, saved answers]
    B --> C[surviving roots in their lineage:<br/>d-garden, d-maintenance, d-shuttle]
    B --> D[one transaction: empty bodies,<br/>tombstone titles, deleted / invalidated]
    D --> E[stage = cleaned]
    E --> F{changed rows and surviving roots?}
    F -- yes --> G[provider.summarize surviving documents]
    G -- ok --> H[add s-rebuilt-* with parents = surviving docs]
    G -- ProviderError --> I[log rebuild_failed; cleanup stays complete]
    F -- no --> J[no rebuild]
    E --> K[later retrieval uses exclude_stale=True]
```

`d-archive` is never a descendant, so the "Lantern Hall" fact survives through `d-archive` and `c-archive`.

## Verification

| Check | `verify()` (8, UI and `/api/verify`) | `evaluate()` (10, CLI) |
| --- | :---: | :---: |
| Source-only control leaves marker rows | | ✓ |
| Source-only reworded answer contains marker | | ✓ |
| Pre-deletion baseline exposed marker (`seed_checks`) | ✓ | ✓ |
| Source and descendants have empty bodies, no marker in titles | ✓ | ✓ |
| Marker absent from every managed title or body (case-insensitive) | ✓ | ✓ |
| Marker absent from 4 retrieval probes (`limit=100`, `exclude_stale=False`) | ✓ | ✓ |
| Neither secret answer contains marker | ✓ | ✓ |
| Garden answer contains `07:40` | ✓ | ✓ |
| Shared answer contains `Lantern Hall` | ✓ | ✓ |
| No stale active artifacts | ✓ | ✓ |

- **Behavioural probes** are run with `persist=False`, so they are not saved as memories.
- **The interactive `verify()`** does not require that the source-only failure was shown first. A direct cascade can pass all 8 checks.
- **`evaluate()`** uses its own `:memory:` database and returns these fields:
  - `project`, `mode`, `model`, `passed`, `checks`,
  - `oracle` (the scenario, including the marker),
  - `stages` (three audits),
  - `answers`, `events`, `scope`.

## Concurrency, transactions and failure behaviour

- **Locks.** `Store` holds an `RLock` around database access and uses `with self._conn:` for write transactions. `Experiment` holds its own `RLock` across reset, ask, delete, verify and state, so model calls and mutations are serialised. `ThreadingHTTPServer` can accept parallel requests, but they queue on the controller lock. A long live call blocks every other API call.
- **SQLite thread setting.** `check_same_thread=False`, which is safe here only because of the locks.
- **Stale writes.** The store rechecks the status of parents and roots when committing, so deletion that slips in between reading the context and saving a result cannot create a stale memory. A test covers this.
- **Reset seeds in memory and publishes with SQLite online backup** (decision D-20, which supersedes D-19's candidate file and `os.replace` swap):
  1. **Preflight.** An invalid mode raises `ValueError`, and live mode with an unavailable model raises `ProviderError`. Both happen before anything changes.
  2. **Snapshot and seed.** The run state (`store`, `provider`, `scenario`, `events`, `stage`, `seed_checks` and the `_attached` flag) is snapshotted. If the controller is attached to a file, the store's lineage (artifacts and edges) is snapshotted too. A new in-memory candidate `Store()` is created inside the protected block, and the controller seeds into it with `stage="seeding"` while holding the lock, so no other request can observe it.
  3. **Publish.**
     - `:memory:` path: the candidate becomes the store.
     - File path, not yet attached: the controller records whether the database and its `-journal` already exist, then opens `Store(path, create_schema=False)`. That call only connects and sets the row factory and `PRAGMA foreign_keys`; it creates no tables. Then the controller copies the candidate in with `replace_contents` (online backup), which writes the schema, and runs `check_writable()`.
     - File path, already attached: `replace_contents` copies the candidate into the **existing** connection, so the file keeps its path and inode. SQLite commits the destination only when the backup completes; an aborted backup is rolled back.
     - Then every other connection (candidate, placeholder or previous store) is closed, `stage` becomes `seeded` and `generation_number` is incremented.
  4. **Failure.** On *any* exception during seeding, construction or publication, every connection the attempt opened is closed. A database or `-journal` file is deleted only if this attempt created it. The snapshot is restored, `generation_number` is unchanged, and the **original** exception is re-raised. Cleanup errors are attached to it as notes with only their class name. A `ProviderError` therefore still surfaces as HTTP 502 or a failed CLI report, and other exceptions still surface as defects.
  5. **Verification.** If the restored store is attached to the file, its lineage must equal the snapshot and `check_writable()` must succeed. Otherwise the controller enters `storage_failed`: it closes that store, switches to an empty in-memory placeholder, clears `scenario`, `events` and `seed_checks`, detaches, and raises `StorageError` ("Experiment storage could not be restored; reset to recover.") chained from the original exception. `ask`, `delete` and `verify` refuse with a `ValueError` carrying that message until a reset reopens the file.
  - **Before the first successful reset**, the controller holds an empty in-memory placeholder store. The configured database file is opened only to publish a fully seeded experiment.
  - **The file's bytes after a failed reset:**
    - An existing file is unchanged if the failure happens before or during the copy. This holds for a previous GhostCache database, an unrelated SQLite database or a non-database file. Nothing writes to it before the backup, and an aborted backup is rolled back.
    - A database or `-journal` this attempt created is deleted.
    - **Exception:** on first attach, if the copy completes and the `check_writable()` that follows it fails, the file already holds the new experiment and is not deleted if it existed before. The controller stays unattached on its placeholder and re-raises; the next reset reopens the file. On an attached file nothing runs after the copy, so this case does not arise there.
    - When verification fails (`storage_failed`), nothing is claimed about the file's bytes.
    - Crashes and power loss are untested.
  - **What is not claimed:** crash safety or durability (for example, power loss during a copy), concurrent writers from other processes, and Windows. None of these is tested.
  - Covered by `ResetFailureTests` (5) and `PublicationTests` (10) in `tests/test_app.py`, `PublicationPrimitiveTests` (2) in `tests/test_store.py`, and `StorageFailureHTTPTests` in `tests/test_http.py`.
- **HTTP error mapping:**
  - `ProviderError` → 502 with the active mode.
  - `StorageError` → 503 with its fixed message only.
  - `ValueError`, `TypeError` or `JSONDecodeError` → 400.
  - Anything else → 500 with a generic message. The log records only the class name.
- **CLI error handling.** `evaluate` turns `ProviderError` (including malformed model output) and `ValueError` into a failed report (`passed: false`, `error`, "No silent switch to fixture mode."), written to `--output` if given, and exits 1. Any other exception is treated as a programming defect: it is deliberately *not* caught, so Python prints a traceback, exits non-zero and writes no report. This keeps defects from being disguised as evaluation outcomes. `serve` exits 1 if the initial reset fails with a `ProviderError`, `StorageError`, `ValueError` or SQLite error, and prints only fixed text (for a SQLite error, a fixed sentence plus the exception class name).
- **Unexpected-exception policy.** No layer uses a broad `except Exception` to turn defects into normal results. The HTTP handler's final `except Exception` returns a generic 500 and logs only the class name; it is a last-resort guard against leaking tracebacks or content, not a recovery path. `reset()`'s `except BaseException` only closes what the attempt opened, restores state and re-raises (or raises `StorageError` when the restored storage fails verification).

## HTTP API

| Method and path | Body | Result |
| --- | --- | --- |
| `GET /api/state` | none | `mode`, `stage` (`empty`, `seeded`, `source_only`, `cleaned` or `storage_failed`), `provider` (availability, model, message, `installed_models`, `active_provider`), `artifacts`, `graph{nodes,edges}`, `audit`, **`scenario` (includes `canary`)**, the last 50 `events`, `seed_checks`, `summary` |
| `GET /`, `/index.html`, `/app.js`, `/style.css` | none | Allowlisted static files from `web/`. Anything else returns 404. A missing file returns 503. |
| `POST /api/reset` | `{"mode":"fixture"\|"live"}` (default fixture) | New experiment state. Live mode with no model, or a provider failure while seeding, returns 502, and the previous experiment stays current. If the restored database cannot be verified, it returns 503 with "Experiment storage could not be restored; reset to recover." |
| `POST /api/ask` | `{"question": "<1–1000 chars>"}` | `answer`, `citations`, `provider`, `mode`, `trace{parent_ids, context_fingerprint, duration_ms, input_tokens, output_tokens}`, `state`. May save generated answer text as a conversation artifact when supplied context has valid active lineage. Empty-context answers and source-only answers with stale parents are not saved; question text is not stored in that artifact. |
| `POST /api/delete` | `{"mode":"source_only"\|"cascade"}` | State plus `deletion{source_id, affected_ids, targeted_ids, deleted_ids, invalidated_ids, descendant_ids, retained_root_ids[, rebuild_error]}` |
| `POST /api/verify` | `{}` | `checks` (8), `passed`, `answers`, `mode`, `state` |

### Security boundaries

- **Binding.** The server listens on `127.0.0.1` only (IPv4 loopback).
- **Host check.** The `Host` header, without its port, must be `localhost` or `127.0.0.1`. Otherwise the response is 403. This protects against DNS rebinding.
- **Origin check.** If a POST carries `Origin`, its scheme must be `http` and its host:port must equal `Host`. Otherwise the response is 403.
- **Request body.** POST must use `Content-Type: application/json` (otherwise 415) and have a JSON-object body of 1–16,384 bytes.
- **Response headers:**
  - `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  - a CSP of `default-src 'self'` covering scripts, styles and connections, with `img-src 'self' data:` and `frame-ancestors 'none'`.
- **Not present:** authentication, per-user sessions, TLS, rate limiting, upload or import, and arbitrary file serving.
- **One shared state.** All browsers share one controller and store, and any client can reset it. **This server must not be exposed unchanged as a public or shared service.** Binding to `0.0.0.0` behind a proxy would also fail the Host check by design.

## CLI and configuration

```text
python3.12 -m ghostcache serve    [--port 8765] [--mode fixture|live] [--model NAME]
                                  [--database <app>/.local/assistant.sqlite]
python3.12 -m ghostcache evaluate [--mode fixture|live] [--model NAME] [--output PATH]
```

- **`serve`** runs `reset(mode)` before it starts listening. **A successful reset replaces the contents of `--database`** in place with a freshly seeded experiment, copied by SQLite online backup from an in-memory candidate. No other file is created. If that first reset fails, `serve` exits 1 and prints only fixed messages. An existing file's bytes are unchanged unless the copy completed and only the write check after it failed (see "Concurrency, transactions and failure behaviour"). A file it created during the failed attempt is removed.
- **`--output`** creates missing parent directories.
- **`pyproject.toml`** declares a `ghostcache` console script. Installing the package has **not** been tested; the verified way to run it is `-m` from the application directory.
- **Two environment variables are read:** `GHOSTCACHE_MODEL` (`--model` takes precedence over it) and `GHOSTCACHE_SENTRY_DSN` (optional tracing; see Part 2). If the DSN is set without `sentry-sdk`, `serve` and `evaluate` exit 1 before doing anything else. The Ollama URL `http://127.0.0.1:11434`, the timeouts and the inference options are fixed in the source. No `.env` file is loaded (see [.env.example](.env.example)).

## Fixture vs live mode

| | Fixture | Live |
| --- | --- | --- |
| Generation | Deterministic string rules | Local Gemma through Ollama |
| Needs | Nothing | Ollama running, with the model pulled |
| What a pass supports | Storage, provenance, retrieval and preservation invariants | Those invariants plus this model's behaviour **in that run** |
| UI label | Title "Controlled fixture · deterministic simulation"; message "Deterministic rules. No model inference."; answer label "DETERMINISTIC FIXTURE", trace suffix "Deterministic fixture; no model inference" | Title "Live local Gemma mode"; answer label is the provider's model name |
| Fallback | n/a | **None.** Errors surface as 502 or a failed report. |

The model being *available* (`provider.available`) is reported separately from the *active* mode.

## Event ledger

Each event records:

- `name`, `time` (`HH:MM:SS` only), `mode`, `provider`,
- and, where available: `duration_ms`, `input_tokens`, `output_tokens`, artifact IDs, `parent_ids`, `context_fingerprint`, `affected_ids` and `error_type`.

It never records prompts or answers. It lives in memory, is replaced by a successful reset (a failed reset keeps the previous ledger, except that `storage_failed` clears it), and `state` returns its last 50 entries. The UI shows the last 12.

## Known discrepancies between code, UI and earlier docs

| # | Discrepancy | Where |
| --- | --- | --- |
| 4 | The UI has no dedicated state for `stage: "storage_failed"`. It shows the 503 error text, but it does not reload state after the error, and `acceptState` does not reset the step counter for that stage. The API refuses `ask`, `delete` and `verify` until a reset (T-A10) | `web/app.js` `acceptState` vs `app.py` `_roll_back` |
| 6 | The walkthrough has no favicon, so browsers log a 404 for `/favicon.ico` (cosmetic; T-E8) | `site/index.html` |

These remaining discrepancies are tracked in [tasks.md](tasks.md). Resolved items:

- The title-blanking and report-overwriting instructions in `EVALUATION.md` were corrected during the October 27 documentation review (T-A1).
- Non-object model JSON raising `AttributeError` (HTTP 500 or a CLI traceback) is fixed: it is now a `ProviderError` (T-A5).
- The non-atomic reset that could publish partial state with stale `seed_checks` was fixed by candidate publication (T-A6, D-19).
- Former rows 1–3, fixed on October 27 (T-A2, T-A3, T-A4) and covered by `tests/test_ui.py`:
  - The UI trace read `trace.retrieved_ids` while the API sends `trace.parent_ids`, so no context was shown. It now renders "Context: <ids in order>", "Context: none retrieved" for an empty list, and nothing when the field is absent.
  - "Look for the echo" re-sent the **secret** question. It now sends `scenario.questions.paraphrase`, as the CLI does. The step subtitle reads "Ask again in different words".
  - The fixture banner said "Saved, controlled answers", but there is no replay. It now says "Deterministic rules. No model inference."
- D-19's file swap could leave the controller on an unlinked inode after a failed reopen, leak `<database>.candidate`, and delete an unrelated file of that name. These are fixed by publishing through online backup into the attached connection (D-20).
- Transport errors echoed their text into messages, and `IncompleteRead` and `BadStatusLine` escaped as HTTP 500 or a traceback. Both are fixed with content-free categories (D-10).
- Former row 5 (T-E7), resolved October 28–29, 2026. *Original text:* the public walkthrough overflowed horizontally on narrow screens. In headless Chrome emulation at the tested 375 px viewport, the document's scrollWidth was 573 px while the layout viewport stayed 375 px. Under 980 px `.explainers` became `grid-template-columns:1fr`, and the `white-space:pre` command block in "Run it yourself" set that column's minimum width (about 557 px). *Fix:* `minmax(0,1fr)` below 980 px, plus `.tiny-label` wrapping below 650 px for a second offender at 320 px (`site/style.css` lines 111–112, commit `08e0524`). Verified locally across 33 view states, then deployed in `2a1ffb0`. The served `style.css` is byte-identical to the fixed file, and the user's DevTools checks on the public URL found no overflow from 320 to 1280 px (TESTING.md, "T-E7 deployed verification"). A real phone and other browsers remain unchecked (T-E6).

---

# Part 2: External integrations and publication

This part started as a proposal; each row now states its status. Three items are in use: GitHub Actions (successful hosted runs; see the table below), Sentry tracing and the Render-hosted walkthrough. The rest were dropped. Sentry tracing is implemented and has real traces from October 28, 2026 (see the table below), sent from a 14-day Business trial that recorded 120 of 100M spans used. The public recorded walkthrough (`site/`) and its Render Blueprint (`render.yaml`) are implemented, tested locally and deployed on Render (October 28, 2026; see the table below). On October 28, 2026 the .tech, Backboard, Browserbase, ElevenLabs and Entire integrations were dropped (DECISIONS.md D-14 amendment); their rows below are kept as history. Since October 29, 2026 Render is one of four intended submission categories (D-14, second amendment), on the basis of this deployment; its architectural role is unchanged. The static walkthrough is the only deployment, and no DNS setup exists; external account ownership and remaining allowances have not been fully audited. Each item needs the evidence listed in [tasks.md](tasks.md) before it can be claimed.

```mermaid
flowchart LR
    subgraph Local["Local machine (private path)"]
        App[GhostCache core] --> Ollama[(Ollama + Gemma)]
    end
    App -. metadata-only spans, only when a DSN is set .-> Sentry[(Sentry)]
    GH[GitHub repo] --> GHA[GitHub Actions: tests + fixture eval]
    Reports[(results/*.json<br/>recorded live runs)] -- scripts/export_site_data.py --> Site["site/: static recorded walkthrough<br/>(Render static site, deployed; no inference)"]
```

**Sentry data flow (implemented, optional).** Only when `GHOSTCACHE_SENTRY_DSN` is set, the process sends span metadata to the DSN's Sentry host. Spans carry operation and span names (fixed strings), the provider and model name, token counts, durations, record counts, synthetic artifact IDs (`d-vault`, `c-vault`, …), the stage and mode, a question kind (`secret`, `paraphrase`, `retained`, `shared` or `custom`), booleans such as `answer_contains_marker`, check counts, and an error's class name and fixed category. They never carry document text or titles, questions, answers, prompts, the marker, request bodies, the Ollama URL, the machine's hostname or file paths. The SDK adds its own envelope fields: release `ghostcache@0.1.0`, environment `local-<mode>`, server name `ghostcache-local`, SDK and Python runtime versions, thread IDs, trace and span IDs, timestamps and a random `gen_ai.conversation.id`. Because the SDK does not filter manually set span data, `telemetry.set` is the privacy boundary, and `tests/test_telemetry.py` checks the serialized envelopes.

| Integration | Proposed design | Constraints already identified |
| --- | --- | --- |
| **GitHub Actions** | Publish `ghostcache/` itself as the repository root so `.github/workflows/checks.yml` is discovered | Done: [bipul724/GhostCache](https://github.com/bipul724/GhostCache) has `ghostcache/` as its root, and [run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) discovered and ran the workflow on October 28, 2026. Publishing the parent `week 4/` folder instead would have left the workflow nested and never run. |
| **Sentry** | **Implemented locally (T-D2, October 28, 2026)** in `ghostcache/telemetry.py`. Root transactions per `POST /api/*` and per `evaluate`; `gen_ai.invoke_agent` (assistant and summarizer), `gen_ai.chat`, `gen_ai.memory.client` (`search_memory`, `create_memory`, `delete_memory`), `ghostcache.reset` and `ghostcache.verify` spans. The DSN is read from `GHOSTCACHE_SENTRY_DSN`. | Attributes only from `ALLOWED_KEYS`; no document text, titles, questions, answers or markers (D-17). The SDK's capture was checked offline: `default_integrations=False`, `server_name="ghostcache-local"`, error events dropped. Optional dependency `sentry-sdk==2.72.0`. **Real traces (T-D3, October 28, 2026):** each live `evaluate` arrived as one trace of 39 spans with environment `local-live`, every span's `domain` `ghostcache-local`, and 0 issues. Sentry's Agents view grouped the spans into conversations of 11 messages, with agents `ghostcache-assistant` and `ghostcache-summarizer`, and reported that inputs and outputs weren't captured. Evidence: `results/sentry-*.jpg` and README.md, "What the real traces showed". **Plan and usage (T-D1, October 28, 2026):** a 14-day Business Plan Trial with no payment method on file, not the free Developer plan; 120 of 100M spans and 0 errors used in the period Oct 28 – Nov 10. At this volume the span quota is no practical constraint. |
| **Public demo (Render)** | **Implemented and tested locally (T-E2, October 28, 2026); deployed (T-E3, October 28, 2026)** at <https://ghostcache-walkthrough.onrender.com/>: Render service `ghostcache-walkthrough`, a Blueprint-managed static site, initially live from commit `8013d01` and now from `2a1ffb0` (the user's Render dashboard; the served files match `site/` at `2a1ffb0`), with the `render.yaml` headers served and `/api/state` returning 404 ([DEPLOYMENT.md](DEPLOYMENT.md)). The narrow-screen overflow (former discrepancy 5, T-E7) is fixed and deployed. Known issue: no favicon (discrepancy 6). Option A of D-13: `site/` is a static walkthrough of three recorded live reports, labelled "Recorded local Gemma evaluation — no live inference". `scripts/export_site_data.py` exports allowlisted fields to `site/data/evidence.json` with each source report's SHA-256 and refuses fixture reports. The page fetches only that file; its buttons change the view only. `render.yaml` defines one static site publishing `./site` with security headers. | Copying `web/` to a static host does not work, because the UI needs `/api/*`; the walkthrough is a separate page. Free Render cannot run the 4.3 GB model, and a cloud host cannot reach the laptop's `127.0.0.1`, so nothing is generated online. The reports hold no artifact text, so the page shows IDs, counts, answers and checks only. The .tech subdomain was dropped. Render is hosting only. *(Category status: not an entered category until October 29, 2026; now an intended category (D-14, second amendment), which changes nothing that runs on Render.)* |
| **Backboard** *(dropped October 28, 2026)* | An optional third provider, used only by a comparison command. Stateless requests carrying only the supplied context, with request, token and cost caps. Output: one report per model in the existing check format. | Do not introduce provider-side memory into the deletion claim. Keep Ollama as the local path. Credits are finite and need rechecking. |
| **Browserbase / Stagehand** *(dropped October 28, 2026)* | A script that drives the public demo through seed → ask → source-only → echo → cascade → verify, asserting on what the UI shows | Allowances need rechecking. A replay run is a UI regression test, not a live evaluation. Needs a demo the browser can reach. |
| **ElevenLabs** (optional) *(dropped October 28, 2026)* | Stock-voice narration of fictional text for the demo video | No voice cloning. Claim a promo only with the user's choice. |
| **Entire** (optional) *(dropped October 28, 2026)* | Checkpoints for future development sessions | Compatibility with this workflow is untested. Do not back-fill earlier work. |
