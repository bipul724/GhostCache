# Hosted CI run #16 — October 29, 2026

Evidence for the latest hosted GitHub Actions run when checked, collected read-only through GitHub's public REST API on October 29, 2026 at 16:30–16:35 UTC. These are not screenshots; the folder follows the repository's dated-evidence convention.

**Run #16 tested committed `f66977d`. It did not test the uncommitted UI content refresh or the failed-mode-switch fix that were in the working tree when this was collected.**

## What was verified

| Field | Value (from the saved API responses) |
| --- | --- |
| Workflow | "GhostCache deletion checks" (`.github/workflows/checks.yml`) |
| Run | [#16](https://github.com/bipul724/GhostCache/actions/runs/40867758385), run ID `40867758385`, attempt 1, event `push`, branch `main` |
| Commit | `f66977d78da58c0f71fd9d57f9c5a6289629c73e` ("Document the ghostcache.bipulchamoli.tech custom domain and five intended categories"), commit timestamp 2026-10-29T11:44:36Z |
| Timestamps | created and started 2026-10-29T11:44:52Z; updated 11:45:11Z |
| Status / conclusion | `completed` / `success` |
| Job | [123426739687](https://github.com/bipul724/GhostCache/actions/runs/40867758385/job/123426739687), "Tests and fresh synthetic evaluation", `ubuntu-latest`, 11:44:56Z–11:45:10Z, `success` |
| Steps | all ten reported `success`: set up job; check out; set up Python 3.12; **check storage, provenance, and HTTP invariants**; **evaluate a fresh synthetic deletion case**; **retain the synthetic evaluation report**; **check telemetry privacy with the optional Sentry SDK**; and three post/complete steps |
| Annotations | one `notice`: the `ubuntu-latest` label's migration to Ubuntu 26. No warning or failure annotation |
| Artifact | `ghostcache-synthetic-evaluation`, ID `12893963182`, 2,111 bytes, created 2026-10-29T11:45:05Z, **expires 2026-11-01T11:45:03Z**, `expired: false` when checked, digest `sha256:c13599b5a2b2969fc6c0c5eccc5dcd7419bef4e1c383927267b297a8437248bf` (GitHub's digest of the uploaded zip). [API URL](https://api.github.com/repos/bipul724/GhostCache/actions/artifacts/12893963182) |
| All runs | 16 runs at check time: #1 and #3–#16 `success`; #2 `cancelled` (a duplicate push event for `172ccb4`, superseded by #3) |

## Evidence gap: the report itself was not downloaded

- `GET …/actions/artifacts/12893963182/zip` returned **401 "Requires authentication"**.
- `GET …/actions/jobs/123426739687/logs` returned **403 "Must have admin rights to Repository."**
- `gh` is not installed on this machine, and no API token was available. The only stored GitHub credential is the Git keychain helper. Extracting a token from it for API calls was out of scope ("existing authorized tools"), so it was not used.

Consequently:

- **The report's checks were not inspected.** The "Evaluate a fresh synthetic deletion case" step succeeded. In `ghostcache/__main__.py` at `f66977d`, `evaluate` returns 0 only when the report has `passed: true`, so a successful step is consistent with a passing report. That is an inference from the code, not an inspection of the report.
- **No hosted test count is claimed.** Step statuses do not establish how many tests ran or were skipped on the runner. Counted locally, the `f66977d` tree defines 124 tests (`Ran 124 tests … OK (skipped=6)` with Python 3.12.6 and Node v22.23.4; the 6 skips are the SDK telemetry tests). That local count shows only what the tree contains, not what the runner executed.

**To close the gap before the artifact expires (2026-11-01 11:45 UTC):** while signed in to GitHub, open the run page, download `ghostcache-synthetic-evaluation` and save it in a **new** subfolder (for example `report/`) with its own checksum manifest. Then read `passed` and the ten checks before citing them. Do not add it to this folder's existing manifest.

## Files

| File | Source |
| --- | --- |
| [run-40867758385.json](run-40867758385.json) | `GET /repos/bipul724/GhostCache/actions/runs/40867758385` |
| [run-40867758385-jobs.json](run-40867758385-jobs.json) | `GET …/actions/runs/40867758385/jobs` (job and step conclusions) |
| [run-40867758385-artifacts.json](run-40867758385-artifacts.json) | `GET …/actions/runs/40867758385/artifacts` (artifact metadata and expiry) |
| [job-123426739687-annotations.json](job-123426739687-annotations.json) | `GET …/check-runs/123426739687/annotations` |
| [workflow-runs-list.json](workflow-runs-list.json) | `GET …/actions/runs?per_page=30` (all 16 runs) |

The responses are saved unmodified. They contain only public repository metadata.

## Verify checksums

The manifest covers the five JSON files and excludes this README. From the repository root:

```sh
(cd screenshots/hosted-ci-run-16-2026-10-29 && shasum -a 256 -c SHA256SUMS.txt)
```
