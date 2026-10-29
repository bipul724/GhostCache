# Public deployment verification, T-E9 — October 30, 2026

Read-only checks of the public walkthrough on both addresses, made by the coding agent between 19:53 and 20:10 UTC on October 29, 2026 (01:23–01:40 IST on October 30). Nothing was deployed, pushed or changed in DNS for these checks.

- <https://ghostcache.bipulchamoli.tech/> (the custom domain)
- <https://ghostcache-walkthrough.onrender.com/> (the Render address)

## Which commit

| Question | Answer |
| --- | --- |
| Commit compared | `04407eb2ecb27b4330b9c55dbcb49e12a388448b` ("Switch the accent colour from violet to blue on the site, lab and favicons", 2026-10-30 01:21:17 IST). It is the latest commit on `main` and on `origin/main`, and the latest that changes `site/`. The owner's request named no commit (its placeholder was left unfilled), so this commit was chosen as the newest pushed site change. |
| Bytes served | All 11 site files on both addresses are byte-identical to `site/` at `04407eb`. Two of them, `style.css` and `favicon.svg`, differ between `04407eb` and its parent site change `3932562`, so the served bytes are `04407eb`'s, not an earlier commit's. |
| Commit Render reports as built | **Not established.** No Render dashboard screenshot from October 30 was supplied. Matching bytes show what is served, not which commit Render built. The served `Last-Modified` (19:51:39 UTC) is 22 seconds after `04407eb`'s commit time (19:51:17 UTC), which is consistent with a Render build of that push, but it is not proof. |
| Hosted CI | GitHub's public API lists run #19 on `04407eb` as `completed`/`success` (created 19:51:27 UTC). Its report and log were **not** downloaded or read, so nothing about it is claimed beyond that status. It is not deployment evidence. |

The deployed content therefore includes the October 29 UI content refresh and audit fixes (`00cfb10`), the October 30 CI-evidence edit to `method.html` and `run.html` (`3932562`) and the accent-colour change to `style.css` and `favicon.svg` (`04407eb`). The accent change had no earlier local verification record; the browser checks below are its first recorded check, and they were made on the live site.

## HTTP, hashes and headers — [public-http-hashes-headers.json](public-http-hashes-headers.json)

Python 3.12 `urllib`, default TLS verification, system DNS, no cache-busting query strings, checked at 19:53:20 UTC.

| Check | `.tech` | `onrender.com` |
| --- | --- | --- |
| 11 files: 200, no redirect, SHA-256 equal to `04407eb` | 11 / 11 | 11 / 11 |
| Exact `/api/state` | 404 | 404 |
| Linked `/favicon.svg` | 200 (334 bytes) | 200 (334 bytes) |
| Direct `/favicon.ico` | 404, never requested by the pages (see the browser check) | 404, never requested |
| CSP, `nosniff`, `no-referrer`, `DENY` on `/`, `/index.html`, `/walkthrough.html`, `/method.html`, `/run.html` | all present, values exactly as in `render.yaml` | all present, exactly as in `render.yaml` |
| `/data/evidence.json` `Cache-Control` | `no-cache` | `no-cache` |

The other files carry `Cache-Control: public, max-age=0, s-maxage=300`, `Server: cloudflare`, `CF-Cache-Status: HIT` and `Age: 0`. `Last-Modified` was 19:51:39 UTC for every file, except `home.js` and `data/evidence.json` on the Render address, which showed 17:31:14 UTC (files unchanged since `00cfb10`; their bytes still match). The JSON keeps the size, SHA-256, committed SHA-256, status, final URL and cache headers for each file.

**Earlier stale responses, not saved as evidence.** In a planning session on the evening of October 29, after Render's `00cfb10` build (17:31 UTC) and before about 18:40 UTC, the `.tech` address served older copies of `walkthrough.html` and `method.js` (`Last-Modified` 07:10:38 UTC, the `6c8b9cc` build, `CF-Cache-Status: HIT`) while the Render address served the current ones. A later check in the same session, after run #18 started (19:01 UTC) and before `3932562` was committed (19:39 UTC), found all 22 responses matching `00cfb10`'s site files. Only command output from that session records this, and its exact times were not kept. The check here found no stale response.

## Served content

**Methodology, `method.html#project-evidence`** (read from the served bytes and in the browser):

- the eyebrow reads "07 · Current project evidence · October 30, 2026";
- the GitHub Actions entry, "Archived CI evidence: run #17 on 00cfb10", says runs #16 (`f66977d`) and #17 (`00cfb10`) succeeded on every step and that both archived reports match GitHub's artifact digest and are fixture evaluations that passed all ten checks;
- it says run #17 tested `00cfb10` and "did not test later commits, including this October 30 update";
- it says neither log was read, so the hosted test count is unverified;
- it links run #3, run #16, run #17, both evidence folders (`hosted-ci-run-16-2026-10-29`, `hosted-ci-run-17-2026-10-29`), the workflow and the run history.

**Run guide, `run.html`.** Its sections and wording are as committed:

- **Requirements:** Python 3.12 or newer is required (3.12.6 verified); "Fixture mode needs Python, but no extra Python packages, model or network"; `sentry-sdk==2.72.0` is optional, for tracing only; Ollama with `gemma4:e2b-it-qat` is for live mode only; Node is optional, for 27 tests.
- **Optional Sentry tracing:** a `.venv` install of `sentry-sdk==2.72.0` and `GHOSTCACHE_SENTRY_DSN`.
- **Troubleshooting:** recovery says "Repeating cleanup does not retry the rebuild … reset starts a fresh experiment", and storage failures say "reset to recover".

**Canonical links.** The pages have no `<link rel="canonical">` element. Here, as in the earlier docs, "canonical links" means the footers. All four pages, on both addresses, link "Live .tech site" to `https://ghostcache.bipulchamoli.tech/` and "Render address" to `https://ghostcache-walkthrough.onrender.com/`. Their site navigation uses relative links, so it stays on whichever address is open.

## Links and anchors — [public-link-check.json](public-link-check.json)

All 114 `<a href>` links on the four served `.tech` pages were checked: 63 internal and 51 external, 23 unique external URLs. Every link returned 200. No redirect changed a destination, and nothing required sign-in or hit a rate limit. Every internal `#anchor` matches an `id` on its target page.

There is one note. `run.html`'s "Full README" link to `https://github.com/bipul724/GhostCache#readme` returns 200, but the `readme` anchor is not in GitHub's static HTML; GitHub adds it in the browser. It is not counted as broken.

## Browser — [public-browser-check.json](public-browser-check.json)

**Setup:**

- **Browser:** system Google Chrome 156.0.8078.73, `--headless=new`, driven over the Chrome DevTools Protocol from Node v22.23.4 (built-in WebSocket, no packages).
- **Viewport:** `Emulation.setDeviceMetricsOverride` at height 812, `deviceScaleFactor` 1 and `mobile: false`. This is a desktop viewport with normal classic scrollbars, 15 px wide in every measurement.
- **Input:** clicks and key presses were real `Input.dispatchMouseEvent` and `Input.dispatchKeyEvent` events.
- **Network:** normal DNS and TLS, with no interception or mocking.
- **Time:** 20:06:36–20:08:24 UTC.

| Check | Result |
| --- | --- |
| Overflow, 4 pages × 9 widths (320, 360, 375, 390, 414, 768, 980, 981, 1280) × 2 addresses | 72 measurements; `documentElement.scrollWidth` ≤ `documentElement.clientWidth` in all 72 (for example, at 320 px `clientWidth` and `scrollWidth` were both 305) |
| Recorded-mode labels | `walkthrough.html`: the bar reads "Recorded evaluation · No live inference" and the page carries "Recorded local Gemma evaluation — no live inference"; `index.html` carries the same sentence; every page says "no live inference" |
| Three recorded runs (`cold`, `warm`, `oct27`) | each selected by a real click; the source line switched between `results/sentry-live-cold.json`, `results/sentry-live-warm.json` and `results/live-gemma.json` |
| Five stages | each tab selected by a real click (`aria-selected`) |
| Keyboard | real ArrowRight, ArrowLeft, End, ArrowRight wrapping to the first tab, ArrowLeft wrapping to the last, Home, ArrowDown and ArrowUp moved both selection and focus as expected |
| Previous and next | Next, Next and Previous moved one stage each; Previous is disabled on the first stage and Next on the last |
| Diagram and list | each view shown on click, with `aria-pressed` following |
| Six recorded answers | six `details` disclosures; one opens by default; real clicks opened the other five, so all six were open |
| Controls repeated | at 1280 and 375 px on both addresses; every step passed |
| Requests | `index`, `walkthrough` and `method` load only the page, `style.css`, `site.js`, their own script and `data/evidence.json`; `run.html` loads only the page, `style.css` and `site.js`. Only the two site origins appear. No `/api` request, no model, Ollama or Sentry request, no other external request and no `/favicon.ico` request |
| Errors | no console error or warning, no uncaught exception, no CSP or other log error, no failed load and no navigation timeout |

## Screenshots — [public-evidence-screenshots.json](public-evidence-screenshots.json)

Seven direct viewport captures of `https://ghostcache.bipulchamoli.tech/method.html#project-evidence`, taken at 20:09:54 UTC. Each is exactly what the 812 px tall viewport showed, scrollbar included; no clip, full-page capture or stitching. The section was scrolled into view one viewport height at a time, starting at its top. The JSON records the requested and actual `scrollY` (equal in every frame) and the section's offset.

| Files | Viewport | Image | `clientWidth` / `scrollWidth` |
| --- | --- | --- | --- |
| `method-project-evidence-1280-1of3.png` to `-3of3.png` | 1280 × 812 | 1280 × 812 each | 1265 / 1265 |
| `method-project-evidence-375-1of4.png` to `-4of4.png` | 375 × 812 | 375 × 812 each | 360 / 360 |

All seven were inspected by eye. The section's eyebrow and heading are at the top of frame 1. The frames follow on with no gap or overlap, and nothing is cropped at the sides or overflows sideways. The 1280 px frames show the sticky "On this page" list, which belongs to the page.

**Captures not kept.** A first attempt used full-page clipped captures (`captureBeyondViewport`). Its 375 px image was offset: the eyebrow and heading were cut off and the next section showed at the bottom, because a full-page capture removes the scrollbar and the page reflows after the clip is measured. Both captures from that attempt were discarded and are not in this folder.

## Limits

- **Built commit:** not established; no October 30 Render dashboard screenshot was supplied.
- **What the browser checks cover:** these are desktop-Chrome viewport checks. They are not a physical phone, a second browser engine (Safari or Firefox), a screen reader or an accessibility audit; that is T-E6, still open.
- **Not repeated here:** the timing chart's hover tooltip and the copy buttons.
- **Not run for this check:** no unit tests, fixture evaluation or hosted CI run. Run #19's status above is GitHub's report only.
- **Point in time:** these results describe the responses at the times stated; a later deploy or cache change can alter them.

## Verify checksums

`SHA256SUMS.txt` covers the four JSON files and seven PNGs in this folder, and excludes this README. From the repository root:

```sh
(cd screenshots/public-deploy-04407eb-2026-10-30 && shasum -a 256 -c SHA256SUMS.txt)
```
