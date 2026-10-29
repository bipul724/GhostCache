# CI evidence update — October 30, 2026 (local; not deployed)

Local verification of the public methodology page's revised GitHub Actions entry (`site/method.html#project-evidence`). The entry now reports the inspected run #16 and run #17 reports instead of saying run #16's report was not downloaded. Checked on October 30, 2026 at about 01:00 IST (October 29, 19:30–19:33 UTC) against the uncommitted working tree on top of `fe04ee7`.

**This is local evidence, not deployment acceptance.** The public site does not serve these edits until the owner commits, pushes and Render rebuilds; T-E9 stays open.

## What changed

- `site/method.html`, `#project-evidence`:
  - the eyebrow date is now October 30, 2026;
  - the GitHub Actions entry is labelled "Archived CI evidence: run #17 on 00cfb10" and:
    - states that runs #16 (`f66977d`) and #17 (`00cfb10`) reported success for every step;
    - says both archived reports match GitHub's artifact digests and are deterministic fixture evaluations that passed all ten checks;
    - says `00cfb10` contains the October 29 content refresh and the failed-mode-switch fix, and that run #17 did not test later commits, including this update;
    - says the hosted test count is unverified, because neither log was read;
    - links both evidence folders and run #17;
  - the local-suite line is dated October 30.
- `site/run.html`: the local verification line is dated October 30 (same 126-test count).
- `tests/test_site.py`: the project-evidence test also requires links to both CI evidence folders. Against the pre-change `method.html`, it fails: `AssertionError: … /tree/main/screenshots/hosted-ci-run-17-2026-10-29`.

`index.html` and `walkthrough.html` make no CI claim and are unchanged, as are the stylesheet, scripts, `data/evidence.json` and the recorded answers, timings and checks.

## Source evidence for each CI claim

| Claim on the page | Source |
| --- | --- |
| Run #16 on `f66977d`, every step `success` | [hosted-ci-run-16-2026-10-29/](../hosted-ci-run-16-2026-10-29/README.md), `run-40867758385-jobs.json` |
| Run #17 on `00cfb10`, every step `success` | [hosted-ci-run-17-2026-10-29/](../hosted-ci-run-17-2026-10-29/README.md), `run-40922048949.json` and `run-40922048949-jobs.json` |
| Each archived report matches GitHub's artifact digest | Each `report/` ZIP's SHA-256 equals the `digest` in the run's `*-artifacts.json` |
| Fixture evaluations that passed all ten checks | Each `report/ghostcache-fixture.json`: `mode: fixture`, `passed: true`, 10 of 10 |
| `00cfb10` contains the content refresh and the failed-mode-switch fix | `git merge-base --is-ancestor f66977d 00cfb10`; commits `cef0c3e`, `0be6362`, `cb3e8ef`, `a46694d`, `f9b5e18` and `153dec8` are in `f66977d..00cfb10`. `selectedMode = currentMode()` (`web/app.js`), `id="project-evidence"` (`site/method.html`), the retention note (`web/index.html`) and `failed_mode_switch_keeps_the_confirmed_mode` (`tests/ui/app_contract.js`) are present at `00cfb10` and absent at `f66977d` |
| Hosted test count unverified | Neither job log was read (run #16's log returned 403 without sign-in) |

## Checks run

| Check | Result |
| --- | --- |
| `.venv/bin/python -B -m unittest discover -s tests -v` (Python 3.12.6, `sentry-sdk` 2.72.0, Node v22.23.4, no DSN) | `Ran 126 tests` … `OK`; per module: store 11, controller 33, HTTP 10, providers/CLI 12, UI 24, telemetry 9, site 27 |
| `python3.12 -B -m unittest discover -s tests -v` (no DSN) | `Ran 126 tests` … `OK (skipped=6)`, all six "sentry-sdk not installed; optional extra" |
| `env -u GHOSTCACHE_SENTRY_DSN python3.12 -B -m ghostcache evaluate --mode fixture --output <new scratch path outside the repository>` | exit 0, `mode: fixture`, `passed: true`, 10/10 (report SHA-256 `cfbc03c2…f0fcc08`, not kept in the repository) |
| `python3.12 -B scripts/export_site_data.py --check` | "site/data/evidence.json matches the selected reports." |
| `node --check` on `site/home.js`, `site.js`, `walkthrough.js`, `method.js`, `web/app.js` and both contract files | all pass |
| Protected files: SHA-256 and modification times of all 126 files in `results/`, `screenshots/`, `site/data/` and `.local/`, before and after | unchanged (`.local/assistant.sqlite` included); the running lab on other ports was not touched |

## Browser checks ([local-preview.json](local-preview.json))

- **Setup:** headless Chrome 156.0.8078.73 over the DevTools protocol, against a local static preview of the working-tree `site/` on `127.0.0.1:8894`. The preview sent `render.yaml`'s CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options` and `/data/*` `no-cache` headers. Viewports were set with `Emulation.setDeviceMetricsOverride` (scale 1, not mobile), height 812.
- **Layout:** four pages × nine widths (320, 360, 375, 390, 414, 768, 980, 981, 1280) = 36 measurements. `scrollWidth <= clientWidth` held in all 36. Classic scrollbars were present: `clientWidth` was 15 px below `innerWidth` throughout.
- **Errors:** no console errors or warnings, exceptions, CSP violations (a `securitypolicyviolation` listener and Chrome's log), failed requests or HTTP errors.
- **Content:**
  - the eyebrow reads "07 · Current project evidence · October 30, 2026";
  - the entry contains no "not downloaded" or "latest hosted run";
  - all seven links are as intended.
- **Recorded-mode labels:** the "Recorded local Gemma evaluation — no live inference" notes on the home page and walkthrough, the walkthrough's "Recorded evaluation · No live inference" bar, and the "no live inference" footers on the other three pages are all present.
- **Walkthrough controls:** real pointer clicks at 375 and 1280 px.
  - Choosing the second and third run switched the checked run (`cold` → `warm` → `oct27`) and the source report line.
  - The fourth stage tab, next and previous moved between stages 04, 05 and 04.
  - The list and diagram view buttons switched the view.
  - No overflow afterwards.
- **Screenshots:**
  - [method-project-evidence-1280.png](method-project-evidence-1280.png) (1265 × 1788) shows the whole section.
  - [method-project-evidence-375.png](method-project-evidence-375.png) (360 × 3166) is offset: it starts at the section's intro paragraph, below the eyebrow, and continues into section 08. The revised entry is fully visible.

## External links ([github-links.txt](github-links.txt))

A read-only GET of each of the seven links in the revised entry, at 19:32 UTC, returned 200 with no redirect. This includes both evidence folders on `main`, which already contains them (commits `ac8e3b2`, `6f7c480`).

## Not checked

- The deployed site: this is a local preview.
- A physical phone, Safari or Firefox, or accessibility (T-E6).
- Live mode or Sentry.

## Verify checksums

`SHA256SUMS.txt` covers the four evidence files and excludes this README.

```sh
(cd screenshots/ci-evidence-update-2026-10-30 && shasum -a 256 -c SHA256SUMS.txt)
```
