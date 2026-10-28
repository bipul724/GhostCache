# Deployment and walkthrough screenshots

Copied from 16 user-provided screenshots on October 28, 2026. The original files were kept in place; PNG contents were not edited.

Public walkthrough: https://ghostcache-walkthrough.onrender.com/

These images show a static recorded walkthrough, a Render deployment dashboard, and browser endpoint checks. They are not new live model evaluations or proof of phone usability. A displayed Not Found message alone does not establish an HTTP status code.

| Screenshot | Contents | Dimensions |
| --- | --- | --- |
| [00-render-dashboard-live-8013d01.png](00-render-dashboard-live-8013d01.png) | Render dashboard showing the static site live from commit 8013d01. | 2940 x 1600 |
| [01-walkthrough-cold-run-overview.png](01-walkthrough-cold-run-overview.png) | Full-page overview with the October 28 cold run selected. | 672 x 1676 |
| [02-walkthrough-warm-run-overview.png](02-walkthrough-warm-run-overview.png) | Full-page overview with the October 28 warm run selected. | 656 x 1672 |
| [03-walkthrough-october-27-run-overview.png](03-walkthrough-october-27-run-overview.png) | Full-page overview with the October 27 recorded run selected. | 632 x 1672 |
| [04-source-only-deletion-stale-memory.png](04-source-only-deletion-stale-memory.png) | Stage 2: source-only deletion leaves five derived items holding the marker. | 2048 x 1363 |
| [05-leaked-answer-and-supplied-context.png](05-leaked-answer-and-supplied-context.png) | Stage 3: the recorded answer repeats the marker, with supplied context highlighted. | 1800 x 1594 |
| [06-provenance-cleanup-and-rebuilt-summary.png](06-provenance-cleanup-and-rebuilt-summary.png) | Stage 4: five derived items purged, a summary rebuilt, zero managed items holding the marker. | 1802 x 1240 |
| [07-recorded-verification-ten-checks.png](07-recorded-verification-ten-checks.png) | Stage 5: the recorded run shows ten passing verification checks. | 1220 x 1468 |
| [08-source-only-reworded-question-marker-revealed.png](08-source-only-reworded-question-marker-revealed.png) | Recorded reworded question after source-only deletion still reveals the marker. | 1228 x 486 |
| [09-after-cleanup-secret-question-no-marker.png](09-after-cleanup-secret-question-no-marker.png) | Recorded secret question after cleanup does not reveal the marker. | 1244 x 500 |
| [10-after-cleanup-secret-question-no-marker-duplicate.png](10-after-cleanup-secret-question-no-marker-duplicate.png) | Exact duplicate of screenshot 09, retained as supplied. | 1244 x 500 |
| [11-after-cleanup-garden-fact-preserved.png](11-after-cleanup-garden-fact-preserved.png) | Recorded answer retains the unrelated 07:40 garden schedule after cleanup. | 1196 x 492 |
| [12-after-cleanup-archive-fact-preserved.png](12-after-cleanup-archive-fact-preserved.png) | Recorded answer retains the independently supported Lantern Hall fact after cleanup. | 1224 x 494 |
| [13-public-evidence-json-in-browser.png](13-public-evidence-json-in-browser.png) | Browser opens the public /data/evidence.json file. | 2047 x 1331 |
| [14-public-api-not-found.png](14-public-api-not-found.png) | Browser shows Not Found for the public /api URL. | 2047 x 1331 |
| [15-public-api-state-extra-asterisks-not-found.png](15-public-api-state-extra-asterisks-not-found.png) | Browser shows Not Found for /api/state** with a tracking query; this is not a screenshot of the clean /api/state URL. | 2047 x 1331 |

## Evidence notes

- Screenshot 10 is byte-for-byte identical to screenshot 09. Both were retained.
- Screenshot 15 includes two literal asterisks after `state` and a query string. Do not describe it as a clean `/api/state` test.
- This set does not include a separate selected view for the reworded secret question after cleanup.
- Full SHA-256 hashes for every PNG are in [SHA256SUMS.txt](SHA256SUMS.txt). Each copied PNG was compared with its original after copying.

## Original attachment names

| Saved screenshot | Original attachment |
| --- | --- |
| 00-render-dashboard-live-8013d01.png | Screenshot 2026-10-28 at 7.35.59 PM.png |
| 01-walkthrough-cold-run-overview.png | codex-clipboard-afd8a7d2-5b5e-4b09-a3a4-1b617da3f117.png |
| 02-walkthrough-warm-run-overview.png | codex-clipboard-4f6470e4-0934-4f5d-bf19-1380d5cab338.png |
| 03-walkthrough-october-27-run-overview.png | codex-clipboard-e3f72c39-49af-4bdd-8c2e-3866a4cf1041.png |
| 04-source-only-deletion-stale-memory.png | codex-clipboard-73da98b0-23ac-43c5-80f5-9880adf82d2d.png |
| 05-leaked-answer-and-supplied-context.png | codex-clipboard-a10ebe37-5348-4b14-9fb7-4ed415aae454.png |
| 06-provenance-cleanup-and-rebuilt-summary.png | codex-clipboard-c37eb4fc-8232-4b6f-af11-b182e30feebc.png |
| 07-recorded-verification-ten-checks.png | codex-clipboard-2586bb94-34d5-4147-a0b5-48cc22dad96b.png |
| 08-source-only-reworded-question-marker-revealed.png | codex-clipboard-0ed14eb0-e80d-437a-a315-bb33fde77111.png |
| 09-after-cleanup-secret-question-no-marker.png | codex-clipboard-d187c920-9282-4b0e-9b93-be230ce326c9.png |
| 10-after-cleanup-secret-question-no-marker-duplicate.png | codex-clipboard-81ddd16e-8a13-4dd4-9c23-564c61d73cff.png |
| 11-after-cleanup-garden-fact-preserved.png | codex-clipboard-2b2a9309-94f4-4fe9-b211-0e1c09f2ebb5.png |
| 12-after-cleanup-archive-fact-preserved.png | codex-clipboard-0c466c51-9029-4683-bc49-fc7621240053.png |
| 13-public-evidence-json-in-browser.png | codex-clipboard-a3382076-1297-4621-9c9e-a50444ff4200.png |
| 14-public-api-not-found.png | codex-clipboard-94075f3a-75cc-4811-9b71-67b8e1cc58b6.png |
| 15-public-api-state-extra-asterisks-not-found.png | codex-clipboard-bc1f291d-382c-4ca2-b5a6-6f9d94d15696.png |
