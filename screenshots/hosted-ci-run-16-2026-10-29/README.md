# Hosted CI run #16 — October 29, 2026

Evidence for the latest hosted GitHub Actions run when checked, collected read-only through GitHub's public REST API on October 29, 2026 at 16:30–16:35 UTC. The run's report artifact was downloaded later and is in [report/](report/) ([details](#the-report-archived-later-inspected-october-30-2026)). These are not screenshots; the folder follows the repository's dated-evidence convention.

**Run #16 tested committed `f66977d`. It did not test the uncommitted UI content refresh or the failed-mode-switch fix that were in the working tree when this was collected.** *(Later status: those changes were committed in `00cfb10` and tested by [run #17](../hosted-ci-run-17-2026-10-29/README.md).)*

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

## The report (archived later; inspected October 30, 2026)

The artifact was later downloaded and saved in [report/](report/) with its own checksum manifest. The folder's file times put the download at about 00:10 IST on October 30, 2026 (18:40 UTC on October 29), before the recorded expiry; how it was downloaded is not recorded.

| Field | Value |
| --- | --- |
| Saved ZIP | [report/ghostcache-synthetic-evaluation.zip](report/ghostcache-synthetic-evaluation.zip): 2,111 bytes, SHA-256 `c13599b5a2b2969fc6c0c5eccc5dcd7419bef4e1c383927267b297a8437248bf`, equal to the artifact's size and GitHub's digest above, so it is the uploaded artifact, unmodified |
| Report | [report/ghostcache-fixture.json](report/ghostcache-fixture.json), the ZIP's only member (13,531 bytes) and byte-identical to it. SHA-256 `fd16a6f1999ba4e6bcfbb35ffb7f8e17bb1a3f5998339445eee4748fd1ebd577` |
| Mode | `fixture`; model `"Deterministic fixture — no AI call"` (deterministic fixture output, not live Gemma evidence) |
| Result | `passed: true`; **10 of 10** checks `passed: true` |
| Manifest | [report/SHA256SUMS.txt](report/SHA256SUMS.txt) covers the ZIP and the report |

The ten checks, each `passed: true`:

1. Source-only control exposes residual stored copies
2. Source-only control answer exposes fresh marker
3. Pre-deletion model answer exposed the fresh marker
4. Target source and all descendants have cleared content
5. Fresh marker absent from every managed title and body
6. Marker absent from all defined retrieval probes
7. Assistant does not reveal marker on either secret question
8. Unrelated roof garden schedule remains answerable
9. Shared fact remains supported by an independent source
10. No active artifact depends on a withdrawn root

The report has no run metadata of its own (T-A8); it is tied to run #16 through the ZIP digest and artifact `12893963182`.

**Still not established:** the job log has not been read, so **no hosted test count is claimed** for run #16. Downloading the report does not change that. Step statuses do not establish how many tests ran or were skipped on the runner. Counted locally, the `f66977d` tree defines 124 tests (`Ran 124 tests … OK (skipped=6)` with Python 3.12.6 and Node v22.23.4; the 6 skips are the SDK telemetry tests). That local count shows only what the tree contains, not what the runner executed.

## History: the report was first unavailable (October 29, 2026, 16:30–16:35 UTC)

*Kept as a dated record; resolved by the later download above.*

- `GET …/actions/artifacts/12893963182/zip` returned **401 "Requires authentication"**.
- `GET …/actions/jobs/123426739687/logs` returned **403 "Must have admin rights to Repository."**
- `gh` is not installed on this machine, and no API token was available. The only stored GitHub credential is the Git keychain helper. Extracting a token from it for API calls was out of scope ("existing authorized tools"), so it was not used.

At that time, the report's checks were not inspected. The successful "Evaluate a fresh synthetic deletion case" step was only consistent with a passing report, because `evaluate` in `ghostcache/__main__.py` at `f66977d` returns 0 only when `passed` is true. The later inspection confirms `passed: true`. The log failure (403) has not been resolved.

## Files

| File | Source |
| --- | --- |
| [run-40867758385.json](run-40867758385.json) | `GET /repos/bipul724/GhostCache/actions/runs/40867758385` |
| [run-40867758385-jobs.json](run-40867758385-jobs.json) | `GET …/actions/runs/40867758385/jobs` (job and step conclusions) |
| [run-40867758385-artifacts.json](run-40867758385-artifacts.json) | `GET …/actions/runs/40867758385/artifacts` (artifact metadata and expiry) |
| [job-123426739687-annotations.json](job-123426739687-annotations.json) | `GET …/check-runs/123426739687/annotations` |
| [workflow-runs-list.json](workflow-runs-list.json) | `GET …/actions/runs?per_page=30` (all 16 runs) |
| [report/ghostcache-synthetic-evaluation.zip](report/ghostcache-synthetic-evaluation.zip) | The artifact as downloaded later |
| [report/ghostcache-fixture.json](report/ghostcache-fixture.json) | The report extracted from it |
| [report/SHA256SUMS.txt](report/SHA256SUMS.txt) | Manifest for the ZIP and the report |

The responses are saved unmodified. They contain only public repository metadata. The report intentionally contains its fictional marker and full answers (evaluator data; see AGENTS.md).

## Verify checksums

There are two manifests. `SHA256SUMS.txt` covers the five metadata JSON files and excludes this README and `report/`; `report/SHA256SUMS.txt` covers the ZIP and the extracted report. Neither should be regenerated to include this README. From the repository root:

```sh
(cd screenshots/hosted-ci-run-16-2026-10-29 && shasum -a 256 -c SHA256SUMS.txt)
(cd screenshots/hosted-ci-run-16-2026-10-29/report && shasum -a 256 -c SHA256SUMS.txt)
```
