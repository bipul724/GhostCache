# UI content refresh — October 29, 2026

New local browser captures and verification records for the project's UI content refresh. These are not deployed-site screenshots or new live Gemma results. All existing screenshots, manifests, saved model reports and `site/data/evidence.json` were left unchanged.

The public pages now link current test, CI, tracing, domain and category evidence separately from the recorded experiment. The run guide adds optional tracing and current recovery instructions. The local lab explicitly explains evaluator retention after confirmed cleanup (T-A7). See [TESTING.md](../../TESTING.md#ui-content-refresh-october-29-2026), [DEPLOYMENT.md](../../DEPLOYMENT.md) and [tasks.md](../../tasks.md).

## Screenshots

These eight PNGs are unedited Chrome DevTools Protocol viewport captures, taken from local servers at `127.0.0.1:8876` (static public preview with the deployed CSP) and `127.0.0.1:8877` (fixture-only lab with a separate scratch database). The capture report records actual dimensions, scroll position and client/scroll widths before and after each image. No browser tabs, account pages or desktop chrome were captured.

| File | What it actually shows | Viewport |
| --- | --- | --- |
| [01-project-evidence-1280.png](01-project-evidence-1280.png) | Current project evidence and the five intended categories, separate from historical model results | 1280 × 1800 |
| [02-project-evidence-375.png](02-project-evidence-375.png) | The heading and upper evidence rows at a narrow width; this is a viewport excerpt, not the entire section | 375 × 1200 |
| [03-five-intended-categories-375.png](03-five-intended-categories-375.png) | Five intended categories, eligibility limits and remaining work | 375 × 1200 |
| [04-optional-tracing-375.png](04-optional-tracing-375.png) | Optional Sentry setup with a placeholder DSN and an internally scrolling command box | 375 × 1200 |
| [05-lab-cleanup-retention-1280.png](05-lab-cleanup-retention-1280.png) | Cleaned fixture state, 8/8 checks and the new evaluator-retention note | 1280 × 2800 |
| [06-lab-cleanup-retention-375.png](06-lab-cleanup-retention-375.png) | The same cleanup-scope note and checks at a narrow width | 375 × 1200 |
| [07-lab-source-only-echo-1280.png](07-lab-source-only-echo-1280.png) | Fixture label, deliberately incomplete deletion, the reworded echo question and supplied-context trace (T-A9) | 1280 × 2800 |
| [08-lab-cleaned-retained-fact-1280.png](08-lab-cleaned-retained-fact-1280.png) | Fixture label, garden fact retained at 07:40, supplied context, 8/8 checks and evaluator retention (T-A9) | 1280 × 2800 |

The fixture screenshots have their own fresh marker. Interactive questions can save extra answer artifacts, so their row/descendant counts differ from the fixed CLI recording. They do not replace or amend the three historical live reports.

## Reports and actual results

- [layout-and-controls.json](layout-and-controls.json): the original successful local browser run, Chrome 156.0.8078.73, height 812 px, 147 measurements with `scrollWidth <= clientWidth`. Requested widths were 320, 360, 375, 390, 414, 768, 980, 981 and 1280 px. All four public pages and expanded run-guide troubleshooting were measured. At 375 and 1280 px, automation used the three run selectors, five stages, both diagram/list views, six recorded-answer disclosures and arrow-key stage navigation. The fixture lab completed the failure/cleanup flow at all nine widths, passed 8/8 checks, retained the scope note across reload and hid it after reset. No console or page errors were recorded.
- [capture-verification.json](capture-verification.json): the later successful eight-image capture run, with before/after dimensions and explicit fixture assertions. These captures use heights 1200, 1800 or 2800 px as listed above, not the 812 px layout-check height. Capture did not change the recorded client or scroll widths.
- [regression-proof.json](regression-proof.json): the extended existing `graph_kinds_lineage_and_tombstones` contract case fails against the old `HEAD:web/app.js` (`f66977d` when checked) and passes against the refreshed file. The expected old-code failure is evidence that the new assertion detects the missing visibility behaviour.
- [public-before-refresh.json](public-before-refresh.json): separate read-only HTTPS checks from October 29. All 11 public files returned 200 and matched `site/` at committed `f66977d` byte for byte. The working-tree HTML and `method.js` differ from those served bytes; unchanged assets and exported JSON match both. This verifies the earlier redesign and linked favicon are served, not this refresh. The file records hashes and headers; matching bytes do not identify Render's built commit. A separate exact `/api/state` request returned 404, recorded in TESTING.md.

**Capture limitation discovered and corrected:** the original layout report lists five initial locator-based screenshot names. Those images are not archived here: visual inspection found clipped content. A subsequent full-page capture also changed the scrollbar/client width while taking the image. The original measurements in the layout report compare the actual client width at each point; some were recorded after that capture behaviour and therefore had no 15 px scrollbar subtraction. The eight images above instead use direct viewport capture, preserve the measured width and were visually inspected. No layout CSS, clipping rule or font change was made to obtain them. Failed capture attempts remain in the session scratch directory, outside the repository.

## Other verification

The current suite ran 124 tests with the optional Sentry SDK (all passed), and 124 with plain Python 3.12 (six SDK-dependent tests skipped). A fresh fixture CLI evaluation passed 10/10 to a scratch path; the export freshness check and JavaScript syntax checks passed. These local results are distinct from historical hosted CI and the ten checks in each recorded live evaluation. Commands and observed timings are in TESTING.md.

The original 76-file baseline of saved results, existing screenshot evidence, exported JSON and `.local/assistant.sqlite` matched both SHA-256 and modification time after this refresh. Existing screenshot manifests passed separately: 16/16, 15/15, 12/12, 4/4 and 2/2. No application backend, model, database schema, export or deployment configuration changed.

Final documentation validation checked 238 relative links and heading anchors across twelve Markdown files without a broken target. `git diff --check` was clean. All six manifests, including this folder's twelve entries, passed.

Not checked here: live Gemma, physical phones, a second browser engine, screen readers or a new hosted CI run. T-E6 remains open. The current UI refresh was not committed, pushed or deployed by the agent; T-E9 remains open for public verification after the owner deploys it.

## Checksums

The manifest covers the eight PNGs and four JSON reports, excluding this README and the manifest itself. Run from the repository root:

```sh
(cd screenshots/ui-content-refresh-2026-10-29 && shasum -a 256 -c SHA256SUMS.txt)
```
