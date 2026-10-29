# Hosted CI run #17 — October 29, 2026

Evidence for the hosted GitHub Actions run triggered by the push of `00cfb10`: five saved GitHub REST API responses and the run's downloaded report artifact. The request URLs and times were not recorded with the responses; the artifact metadata shows `expired: false` when it was fetched. These are not screenshots; the folder follows the repository's dated-evidence convention. Inspected on October 30, 2026.

**Run #17 tested committed `00cfb10`.** That push carried the ten commits after `f66977d` (run #16's commit): the UI content refresh, the failed-mode-switch fix and its tests, the content-refresh and audit-fix evidence, run #16's metadata folder and the documentation for them. Run #17 did not test anything committed after `00cfb10`, including this folder, run #16's `report/` subfolder and the documentation that records them.

## What was verified

| Field | Value (from the saved API responses) |
| --- | --- |
| Workflow | "GhostCache deletion checks" (`.github/workflows/checks.yml`) |
| Run | [#17](https://github.com/bipul724/GhostCache/actions/runs/40922048949), run ID `40922048949`, attempt 1, event `push`, branch `main` |
| Commit | `00cfb10667de5f73fc37734063909cc68eb026a8` ("Document the content refresh, mode-switch fix, project evidence section and 126-test count"), commit timestamp 2026-10-29T17:30:44Z |
| Timestamps | created and started 2026-10-29T17:30:54Z; updated 17:31:11Z |
| Status / conclusion | `completed` / `success` |
| Job | [123617603513](https://github.com/bipul724/GhostCache/actions/runs/40922048949/job/123617603513), "Tests and fresh synthetic evaluation", `ubuntu-latest`, 17:30:57Z–17:31:10Z, `success` (the only job in the run) |
| Annotations | one `notice`: the `ubuntu-latest` label's migration to Ubuntu 26. No warning or failure annotation |
| All runs | 17 runs in the saved list, #17 the newest when fetched: #1 and #3–#17 `success`; #2 `cancelled` (a duplicate push event for `172ccb4`, superseded by #3) |

### Steps

All ten steps reported `completed` / `success` (times are 2026-10-29, UTC):

| # | Step | Started | Completed |
| ---: | --- | --- | --- |
| 1 | Set up job | 17:30:58Z | 17:30:59Z |
| 2 | Check out the project | 17:30:59Z | 17:31:02Z |
| 3 | Set up Python 3.12 | 17:31:02Z | 17:31:02Z |
| 4 | **Check storage, provenance, and HTTP invariants** | 17:31:02Z | 17:31:04Z |
| 5 | **Evaluate a fresh synthetic deletion case** | 17:31:04Z | 17:31:05Z |
| 6 | **Retain the synthetic evaluation report** | 17:31:05Z | 17:31:06Z |
| 7 | **Check telemetry privacy with the optional Sentry SDK** | 17:31:06Z | 17:31:07Z |
| 13 | Post Set up Python 3.12 | 17:31:07Z | 17:31:08Z |
| 14 | Post Check out the project | 17:31:08Z | 17:31:08Z |
| 15 | Complete job | 17:31:08Z | 17:31:08Z |

The step numbers are GitHub's; 8–12 are not present in the response.

## Artifact

| Field | Value |
| --- | --- |
| Name | `ghostcache-synthetic-evaluation` |
| Artifact ID | `12919335616` ([API URL](https://api.github.com/repos/bipul724/GhostCache/actions/artifacts/12919335616)) |
| Size | 2,108 bytes: the uploaded **ZIP**, not the report inside it |
| Created | 2026-10-29T17:31:05Z |
| Expires | **2026-11-01T17:31:05Z**; `expired: false` when fetched |
| GitHub digest | `sha256:e9be7680acc8fe9086d175e118a38d49c8e73fef578f7486e793e1d9e51af362` |
| Saved ZIP | [report/ghostcache-synthetic-evaluation.zip](report/ghostcache-synthetic-evaluation.zip): 2,108 bytes, SHA-256 `e9be7680acc8fe9086d175e118a38d49c8e73fef578f7486e793e1d9e51af362` |

The saved ZIP's SHA-256 equals GitHub's digest, and its size equals the artifact size, so it is the uploaded artifact, unmodified.

## The report

- **File:** [report/ghostcache-fixture.json](report/ghostcache-fixture.json), the ZIP's only member (`ghostcache-fixture.json`, 13,531 bytes). The extracted file is byte-identical to that member. SHA-256 `ebfc73b634b61a4e19ab005e0e3884054849086c9b46efbc8750417c113fc2f3`.
- **Mode:** `fixture`; model `"Deterministic fixture — no AI call"`. It is deterministic fixture output, not a model answer or live Gemma evidence.
- **Result:** `passed: true`, and all **10 of 10** checks are `passed: true`:

| # | Check | Result |
| ---: | --- | --- |
| 1 | Source-only control exposes residual stored copies | passed |
| 2 | Source-only control answer exposes fresh marker | passed |
| 3 | Pre-deletion model answer exposed the fresh marker | passed |
| 4 | Target source and all descendants have cleared content | passed |
| 5 | Fresh marker absent from every managed title and body | passed |
| 6 | Marker absent from all defined retrieval probes | passed |
| 7 | Assistant does not reveal marker on either secret question | passed |
| 8 | Unrelated roof garden schedule remains answerable | passed |
| 9 | Shared fact remains supported by an independent source | passed |
| 10 | No active artifact depends on a withdrawn root | passed |

Its fresh marker differs from run #16's. The report intentionally contains its fictional marker and full answers (evaluator data; see AGENTS.md).

## What this does not establish

- **No hosted test count.** The job log was not read. Step 4's `success` does not show how many tests ran or were skipped on the runner. Counted locally, unittest discovery of the `00cfb10` checkout finds 126 tests (October 30, discovery only, not a run); the October 29 local runs recorded `Ran 126 tests … OK` on the then-uncommitted working tree. Neither is a hosted count.
- **The report does not identify its run or commit.** It has no run metadata of its own (T-A8). It is tied to run #17 through the ZIP digest, the artifact ID and the artifact's `workflow_run` (`40922048949`, `head_sha` `00cfb10…`).
- **Not deployment evidence.** A passing workflow says nothing about what Render serves (T-E9).

## Files

| File | Content |
| --- | --- |
| [run-40922048949.json](run-40922048949.json) | The workflow run (`GET /repos/bipul724/GhostCache/actions/runs/40922048949`) |
| [run-40922048949-jobs.json](run-40922048949-jobs.json) | The run's jobs, with job and step conclusions and times |
| [run-40922048949-artifacts.json](run-40922048949-artifacts.json) | The run's artifacts: ID, size, digest and expiry |
| [job-123617603513-annotations.json](job-123617603513-annotations.json) | The job's check-run annotations |
| [workflow-runs-list.json](workflow-runs-list.json) | The repository's workflow runs (17) |
| [report/ghostcache-synthetic-evaluation.zip](report/ghostcache-synthetic-evaluation.zip) | The artifact as downloaded |
| [report/ghostcache-fixture.json](report/ghostcache-fixture.json) | The report extracted from it |
| [SHA256SUMS.txt](SHA256SUMS.txt) | Manifest for the five metadata files |
| [report/SHA256SUMS.txt](report/SHA256SUMS.txt) | Manifest for the ZIP and the report |

The responses are saved unmodified. They contain only public repository metadata.

## Verify checksums

There are two manifests:

- `SHA256SUMS.txt` covers the five metadata JSON files only.
- `report/SHA256SUMS.txt` covers the ZIP and the extracted report.

Neither covers this README, and neither should be regenerated to include it. From the repository root:

```sh
(cd screenshots/hosted-ci-run-17-2026-10-29 && shasum -a 256 -c SHA256SUMS.txt)
(cd screenshots/hosted-ci-run-17-2026-10-29/report && shasum -a 256 -c SHA256SUMS.txt)
```
