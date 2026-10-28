# Instructions for coding agents

GhostCache is a small, local, standard-library Python testbed. It shows how withdrawn-document content survives in derived AI application memory, and how cleanup based on provenance removes it. Read [README.md](README.md), [architecture.md](architecture.md) and [tasks.md](tasks.md) before changing anything. The parent workspace's `context.md` records history and intent. **The code is the source of truth for current behaviour.**

## Layout

```text
ghostcache/            # application root = Git repository root (bipul724/GhostCache)
├── ghostcache/        # Python package
│   ├── __main__.py    # CLI (serve/evaluate) and local HTTP handler
│   ├── app.py         # Experiment controller, QUESTIONS, evaluate()
│   ├── store.py       # SQLite artifacts and provenance, deletion, retrieval, audit
│   ├── providers.py   # FixtureProvider, OllamaProvider, ProviderError
│   └── telemetry.py   # optional metadata-only Sentry tracing (ALLOWED_KEYS)
├── web/               # index.html, app.js, style.css (no build step)
├── tests/             # test_store.py, test_app.py, test_http.py, test_providers.py, test_ui.py, test_telemetry.py (unittest)
│   └── ui/            # app_contract.js: web/app.js contract cases under node:vm (Node built-ins only)
├── results/           # saved evidence: do not overwrite
├── .github/workflows/checks.yml
└── .local/            # disposable UI database (git-ignored)
```

## Commands

Run everything from the application root with Python 3.12. The default `python3` on the author's Mac is 3.15, which is untested.

```sh
python3.12 -m unittest discover -s tests -v
python3.12 -m ghostcache evaluate --mode fixture --output results/<new-name>.json
python3.12 -m ghostcache serve --port 8765             # fixture UI
python3.12 -m ghostcache serve --port 8765 --mode live # needs Ollama + gemma4:e2b-it-qat
node --check web/app.js                                # optional JS syntax check
.venv/bin/python -m unittest discover -s tests -v      # with the optional sentry-sdk in .venv
```

- **Do not start a server on a port that is already in use.** Check first.
- **`serve` (and every successful reset) replaces the contents of its `--database`.** Point it only at a disposable path. Resets seed in memory and publish with SQLite online backup into the attached connection, in place. Never reintroduce a candidate file or a file swap. A failed reset must keep the previous experiment, must not write to the target file before the copy (open a first-attach target with `create_schema=False`), and must otherwise keep the file's bytes or enter `storage_failed`. The one documented exception is a write check that fails after a completed first copy (DECISIONS.md D-20).
- **Live mode makes real local model calls**, which take minutes on a laptop. Run them only when the task needs live evidence.

## Keep the architecture

- Keep the zero-dependency, standard-library design unless a task needs an integration. Make any new dependency optional, so that fixture mode and the tests still run with nothing installed.
- Keep the module boundaries:
  - the store owns persistence and lineage rules,
  - the controller owns experiment flow,
  - providers own model I/O,
  - `__main__` owns transport.
- Explain any architectural change in [DECISIONS.md](DECISIONS.md).

## Invariants you must preserve

1. **Capture every supplied context artifact as a parent** when you commit a generated result. Do not use model citations as lineage.
2. **Revalidate parents and roots when you commit.** Store generated results through `Store.add_artifact` and nothing else, because it rechecks that every parent and inherited root is still active inside the transaction. Never write around it.
3. **Callers never supply `source_ids`.** They are inferred from parents.
4. **Cascade cleanup handles every transitive descendant in one transaction:**
   - bodies are emptied;
   - titles are replaced (`Withdrawn document` or `Purged <kind>`);
   - IDs, edges and `source_ids` are kept.
5. **Mixed summaries are invalidated whole.** Rebuild only from surviving *original documents*, never from old mixed prose. Independent sources and their facts must survive.
6. **Keep the broken control.** Source-only deletion stays deliberately incomplete, and evaluation still requires it to expose the marker before cleanup.
7. **Keep the positive controls.** The `07:40` garden fact and the `Lantern Hall` shared fact must stay answerable.

## Mode honesty

- Never substitute fixture output for live inference, including on errors, timeouts, rebuild failures and malformed output. Raise `ProviderError` and let it surface as HTTP 502 or a failed CLI report.
- Never put exception text, transport reasons, response bodies or partial reads into error messages. Use the fixed category from `providers._transport_category` (D-10).
- Label every result with its real `mode` and `provider`. Having a model available is not proof that an answer used it.
- Do not describe fixture output as "saved", "recorded" or "AI" output. If you add a replay mode, label it "recorded run".

## Evaluator state is not assistant memory

- `Experiment.scenario` (including `canary`), saved reports, screenshots and recordings are **evaluator or evidence data**. Do not feed them into model context, and do not store them as artifacts.
- They intentionally keep the marker. `/api/state` returns it. Do not "fix" that silently. If a change affects it, update the docs that describe this boundary.
- Never claim model unlearning, secure disk erasure, or deletion from logs, backups, the browser or reports.

## Secrets, privacy and telemetry

- Use fictional data only. Never add real personal documents to tests, fixtures or results.
- Never commit secrets. `.env` is git-ignored, and nothing loads it automatically. Document only variables the code actually reads in [.env.example](.env.example).
- Logs and telemetry may contain only metadata. Every Sentry span attribute must be a key in `ALLOWED_KEYS` in `ghostcache/telemetry.py` and be set through `telemetry.set`, which rejects anything else; Sentry does not filter manually set data. Never add `gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.system_instructions`, `gen_ai.memory.query.text` or `gen_ai.memory.records`. Span names are fixed strings. Never send document bodies or titles, questions, answers or markers, and extend the privacy test in `tests/test_telemetry.py` when you add attributes. Keep request content out of URLs.
- Keep the localhost bind, the Host and Origin checks, the JSON-only POST, the size limits and the security headers. Do not expose the current shared-state server publicly. A public demo needs the design decided in DECISIONS.md D-13.

## Evidence

- Never overwrite or edit `results/fixture.json`, `results/live-gemma.json` or the screenshots. Write new runs to new filenames.
- Keep failed reports. Never report only the passing runs.
- Do not claim an integration, deployment, hosted CI run, category entry or benchmark without the evidence listed in [tasks.md](tasks.md). Writing configuration alone does not count.
- Do not say GitHub Copilot wrote existing code. The GitHub category is targeted through GitHub Actions.

## Tests

- Add or adjust a test that would fail without your change: store tests for lineage and deletion, controller tests for flow and modes, HTTP tests for transport and validation, and UI contract cases in `tests/ui/app_contract.js` (registered in `tests/test_ui.py`) for `web/app.js` rendering and requests.
- Tests must stay offline. Patch `OllamaProvider.status`, `urlopen` or the provider methods, as the existing tests do.
- Run the full suite, plus a fixture evaluation to a new path, before you finish.

## Documentation upkeep

When you change behaviour, update the docs it affects in the same change:

- README (status, workflow, limits),
- architecture.md (and its "Known discrepancies" table),
- TESTING.md (the inventory and counts),
- tasks.md (move completed tasks, with their evidence),
- DECISIONS.md,
- `.env.example`.

Re-verify the test count instead of copying it.

## Actions the user decides

Publishing a DEV post, claiming promo codes, installing sponsor skills, creating accounts, changing DNS and deploying all affect external accounts. Do them only when the user asks.
