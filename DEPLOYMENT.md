# Deploying the public walkthrough

GhostCache has exactly one public deployment: the **static recorded walkthrough** in [site/](site/), hosted on Render. It replays three saved live Gemma reports. It runs **no inference**, cannot answer new questions, stores nothing and deletes nothing. The interactive app in `web/`, the Python server, the SQLite database and Ollama stay on the author's laptop and are never deployed (DECISIONS.md D-13).

Render is used only for hosting: it serves these static files and runs nothing else. Since October 29, 2026, **Best Use of Render** is one of the five intended submission categories, alongside Gemma, GitHub Copilot through Actions, Sentry Agent Tracing and a .tech Domain (DECISIONS.md D-14, second and third amendments). The .tech category uses the custom domain below, which points to this same static site.

- **Basis:** the deployment and verification recorded here.
- **Eligibility:** our interpretation of the category's "host an agent's front end" wording, not organizer confirmation ([CATEGORIES.md](CATEGORIES.md#best-use-of-render)).
- **Effect on Render:** entering the category changes nothing about what runs there.

*(Until October 29, 2026, Render was hosting only and not one of the submission's categories.)*

## Pending local update: demo video status (October 30, 2026)

The local methodology page now links the [public demo video](https://www.youtube.com/watch?v=yzjmyaA-9Vw) (4:55) and identifies the DEV submission as remaining work. The owner confirmed Public visibility and accepted the final duration on October 30. This content edit is uncommitted and has not been pushed or deployed in this update. The historical deployment checks below remain unchanged; verify the new served page after deployment before claiming it is live.

## Earlier pending record: the UI content refresh (October 29, 2026)

**Resolution, October 30, 2026 (T-E9 done):** read-only checks at 19:53–20:10 UTC on October 29 found both addresses serving all 11 site files byte-identical to `site/` at `04407eb`, the latest `main`. That commit includes this refresh and the audit fixes (`00cfb10`), the CI-evidence edit (`3932562`) and an accent-colour change to `style.css` and `favicon.svg` (`04407eb`). Status codes, headers, served content, links and a live-browser pass all met the T-E9 criteria ([evidence](screenshots/public-deploy-04407eb-2026-10-30/README.md); [Verification record](#verification-record)). No October 30 Render dashboard screenshot was supplied, so the commit Render built is not established. The record below is kept as history.

*Later status, October 30, 2026:* the refresh and audit fixes were committed and pushed by the owner in `00cfb10`, and hosted run #17 tested that commit. Whether Render serves them has not been checked. A further local edit updates the methodology page's GitHub Actions entry with the archived run #16 and run #17 reports and redates the local-test lines on `method.html` and `run.html`; it was checked in a local preview only ([evidence](screenshots/ci-evidence-update-2026-10-30/README.md)). T-E9 covers deploying and verifying all of these together.

The current local refresh has not been pushed or deployed by the agent. It updates the four public HTML pages and the opening comment in `method.js`; the public stylesheet, report export, `data/evidence.json` and `render.yaml` are unchanged. The home page links to `method.html#project-evidence`, which separates current tests, tracing, hosting, domain proof and five intended categories from recorded model results. The run guide adds optional tracing and current recovery instructions; footers show the custom domain and alternate Render address.

Local verification is recorded in [TESTING.md](TESTING.md#ui-content-refresh-october-29-2026) and [new captures](screenshots/ui-content-refresh-2026-10-29/README.md): 124 tests, a fresh 10/10 fixture evaluation and browser checks with normal scrollbars. The later audit fixes updated the same pages' project evidence and run guide (hosted run #16, current counts, the favicon, fixture prerequisites and recovery wording) and were checked locally again: 126 tests and new browser measurements ([audit-fix evidence](screenshots/audit-fixes-2026-10-29/README.md)). This is local evidence, not public deployment acceptance; the new project-evidence links reach the public section only after the owner deploys it.

After the owner reviews, commits and pushes, confirm Render's deployment in the dashboard, compare the served files with the actual new commit, repeat the status/header checks in [Verify a deployment](#verify-a-deployment), and inspect the new project-evidence section and run guide at narrow and desktop widths. Preserve the recorded-mode labels and controls; keep T-E9 open until the current refresh has been verified publicly. The local lab's evaluator-retention note and failed-mode-switch fix are served by the Python app only and are not part of Render's static deployment.

## Earlier pending record: the light redesign (October 29, 2026)

**Later resolution, October 29:** the new [read-only comparison](screenshots/ui-content-refresh-2026-10-29/public-before-refresh.json) returned 200 for all 11 public files and found them byte-identical to committed `f66977d`. This confirms the earlier four-page redesign and linked favicon are served, resolving T-E8. It does not identify Render's built commit or supply public browser acceptance for the current content refresh. The original pending record below is retained as history; T-E9 now covers the new refresh.

The working tree holds a redesign of `site/` that is **not deployed**. It replaces the single walkthrough page with four static pages and their shared assets: `index.html` (home), `walkthrough.html`, `method.html`, `run.html`, `style.css`, `site.js`, `home.js`, `walkthrough.js`, `method.js`, `favicon.svg` and the unchanged `data/evidence.json`. Nothing about hosting changes: `render.yaml` still publishes `./site` with the same headers, and the pages need no font, inline script or inline style, so the existing CSP fits them.

After it is pushed and Render rebuilds:

- the site's root URL shows the new home page, and the walkthrough moves to `/walkthrough.html` (links to the root still work and lead to it);
- run the [Verify a deployment](#verify-a-deployment) checks, adding `/walkthrough.html`, `/method.html`, `/run.html` and `/favicon.svg` (expect 200);
- measure overflow as `document.documentElement.scrollWidth` against `document.documentElement.clientWidth` (not `innerWidth`) with the browser's normal scrollbars showing: the October 29 review found a 320 px overflow of the home page's illustration badge that a check with hidden scrollbars had missed (fixed in the working tree; TESTING.md, "Review fixes to the redesign");
- record the deployed commit and the results here and in TESTING.md, and close T-E8 and T-E9 only then.

## Current deployment

| Field | Value |
| --- | --- |
| Public URL | <https://ghostcache-walkthrough.onrender.com/> |
| Custom domain | <https://ghostcache.bipulchamoli.tech/> (since October 29, 2026), a CNAME to the Render site, which shows it as Verified with Certificate Issued ([custom-domain evidence](screenshots/custom-domain-2026-10-29/README.md)). The portfolio at `bipulchamoli.tech` is separate and stays on Vercel |
| Render service | `ghostcache-walkthrough`, a Blueprint-managed Render static site created from [render.yaml](render.yaml) |
| Initial deployment | October 28, 2026, from branch `main` at commit `8013d01`, as shown in the Render dashboard ([screenshot 00](screenshots/00-render-dashboard-live-8013d01.png)) |
| Latest verified public content | **October 30, 2026 (T-E9):** read-only checks at 19:53 UTC on October 29 (01:23 IST) on **both** addresses: all 11 public files returned 200 with no redirect, byte-identical to `site/` at `04407eb` (`style.css` and `favicon.svg` distinguish it from the previous site commit `3932562`); the exact `/api/state` 404; `/favicon.ico` 404 and never requested; the four headers exactly as in `render.yaml` on all four pages; `/data/evidence.json` `no-cache`. A live headless-Chrome pass found no overflow at the nine T-E7 widths and working recorded controls ([evidence](screenshots/public-deploy-04407eb-2026-10-30/README.md)). No October 30 dashboard screenshot, so the built commit is not named; `Last-Modified` 19:51:39 UTC is 22 s after `04407eb` was committed. *(Earlier, October 29: both addresses matched committed `f66977d` ([comparison](screenshots/audit-fixes-2026-10-29/public-served-files.json)).)* |
| Deployed by | The repository owner, from their own Render account |

**Earlier dashboard-backed deploy records.** Two deploys are evidenced; the later content comparison above establishes the currently served bytes separately:
- **`8013d01`, the initial deploy.** Shown in screenshot 00.
- **`2a1ffb0`, the T-E7 fix.** The user reported that their Render dashboard screenshots show it as successfully deployed. Those screenshots were not saved, because the temporary files were gone when copying was tried. Separately, a read-only check found `/style.css` and the other three served files byte-identical to `site/` at `2a1ffb0`. The stylesheet's `Last-Modified` header was 17:21:42 UTC on October 28, just after the fix commit was made. The byte comparison shows what is served; it does not by itself name the commit Render built.

Between the two deploys, commit `26a1c3e` changed nothing under `site/` or `render.yaml`. Whether Render built it was not checked. The site's `Last-Modified` header at that time (October 28, 14:02:51 UTC) was earlier than that push (16:22 UTC), which is consistent with no redeploy but does not prove it. Check the dashboard's deploy list before naming any later commit as deployed.

## What the Blueprint defines

[render.yaml](render.yaml) declares one static site and nothing else: no server, database, worker, model, environment variable or secret.

- `type: web`, `runtime: static`, `name: ghostcache-walkthrough`.
- `buildCommand` only echoes a message; `site/` is committed static files. `staticPublishPath: ./site` publishes nothing outside `site/`.
- A build filter on `site/**` and `render.yaml`.
- Response headers on every path: a restrictive `Content-Security-Policy` (`default-src 'none'`; scripts, styles and `connect-src` limited to `'self'`; `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `X-Frame-Options: DENY`. Files under `/data/` also get `Cache-Control: no-cache`.

## Deploy or recreate the site

Steps for the account owner. They were followed for the October 28, 2026 deployment.

1. Push `main` so that `render.yaml` and `site/` are on GitHub.
2. In the Render Dashboard choose **New → Blueprint**, connect `bipul724/GhostCache`, branch `main`, and apply the `render.yaml` it finds. It creates the static site `ghostcache-walkthrough`.
3. Or create the site by hand with **New → Static Site**: repository `bipul724/GhostCache`, branch `main`, root directory blank (the repository root), build command `echo "No build step; site/ is committed static files"`, publish directory `site`. A hand-made site does not get the Blueprint's headers; add them under the site's **Headers** settings, copying `render.yaml`.
4. Run the checks in [Verify a deployment](#verify-a-deployment) against the URL Render shows.
5. Record the URL, the deployed commit and the results here and in [tasks.md](tasks.md).

Render's documentation describes static sites as free to deploy, with bandwidth and build minutes counted against the workspace's plan. That was read from the documentation on October 28, 2026; it was not checked against an account.

## Update the published data

The page shows only `site/data/evidence.json`, exported from three saved reports by [scripts/export_site_data.py](scripts/export_site_data.py). After changing a selected report or the export script:

```sh
python3.12 scripts/export_site_data.py          # rewrite site/data/evidence.json
python3.12 scripts/export_site_data.py --check  # exit 1 if it is out of date (also a unit test)
python3.12 -m unittest tests.test_site -v       # 27 walkthrough and site tests (4 need Node)
```

Commit `site/data/evidence.json` with the change and push `main`. Review the exported data before publishing: the export keeps an allowlist of fields and refuses text matching a few selected private-string patterns, but that pattern check is an additional safeguard, not comprehensive secret detection. See README.md, "Public recorded walkthrough".

Preview locally on a free port (check first with `lsof -nP -iTCP:8790 -sTCP:LISTEN`). This does not touch the app, its database or Ollama:

```sh
python3.12 -m http.server 8790 --bind 127.0.0.1 --directory site
```

## Verify a deployment

Read-only checks for the current four-page site, run from the repository root against the commit you expect Render to serve (set `REV`). Check both addresses:

```sh
REV=HEAD                               # the commit you pushed and Render reports as live
for URL in https://ghostcache.bipulchamoli.tech https://ghostcache-walkthrough.onrender.com; do
  for f in index.html walkthrough.html method.html run.html style.css site.js home.js \
           walkthrough.js method.js favicon.svg data/evidence.json; do
    served=$(curl -s "$URL/$f" | shasum -a 256 | cut -c1-64)
    committed=$(git show "${REV}:site/$f" | shasum -a 256 | cut -c1-64)   # braces matter in zsh
    printf '%s %s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$URL/$f")" \
      "$([ "$served" = "$committed" ] && echo match || echo DIFFERS)" "$URL/$f"
  done                                 # expect 200 match for all 11
  printf '%s %s/api/state\n' "$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/state")" "$URL"   # expect 404
  curl -sI "$URL/" | grep -iE '^(content-security-policy|x-content-type-options|referrer-policy|x-frame-options):'
done
```

Matching bytes show what is served, not which commit Render built; confirm that in the Render dashboard.

In a browser with its normal scrollbars, also confirm:

- on `/walkthrough.html` the sticky bar reads "Recorded evaluation · No live inference" and the page also carries "Recorded local Gemma evaluation — no live inference";
- the three run choices, five stage tabs (including arrow keys), the diagram/list toggle and the six recorded-answer disclosures change the view;
- each page requests only `style.css`, `site.js`, `favicon.svg`, its own script and `data/evidence.json`, except `run.html`, which has no page script and no data request; there is no `/favicon.ico` request and no console error;
- scrolled down to the timing chart on the walkthrough and methodology pages, hovering a segment shows its tooltip beside the pointer, inside the chart;
- `method.html#project-evidence` and `run.html` show the content of the commit you deployed;
- `document.documentElement.scrollWidth` does not exceed `document.documentElement.clientWidth` at 320, 360, 375, 390, 414, 768, 980, 981 and 1280 px on all four pages.

*Original checklist (October 28, 2026), for the single-page site of that date:* status codes for `/`, `/data/evidence.json` and `/api/state` (200, 200, 404), the four headers, the evidence JSON's hash against `site/data/evidence.json`, the banner, the run/stage/question buttons, and a network panel showing only `style.css`, `walkthrough.js` and `data/evidence.json` plus the browser's own `/favicon.ico` request. Those checks are recorded below; the list above replaces them for the four-page site.

The screenshot evidence can be checked with `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)`. The manifest holds bare file names, so the command must run inside `screenshots/`. The T-E7 captures have their own manifests: `(cd screenshots/mobile-overflow-fix && shasum -a 256 -c SHA256SUMS.txt)` (local before/after) and `(cd screenshots/mobile-overflow-fix/deployed-2a1ffb0 && shasum -a 256 -c SHA256SUMS.txt)` (deployed site).

## Verification record

Every check below was read-only. Full command tables are in [TESTING.md](TESTING.md), "Render deployment T-E3", "Documentation audit" and "T-E7 deployed verification".

| When (October 28, 2026, unless stated) | Who and how | Result |
| --- | --- | --- |
| From about 19:35 IST (the dashboard screenshot's file name; browser screenshot times were not recorded) | The owner: Render dashboard and their own browser, recorded in [screenshots/](screenshots/README.md) | Dashboard shows the Blueprint-managed static site live from `8013d01` (00). The page and all three recorded runs (01–03), the source-only, leak, cleanup and verification views (04–07), recorded question answers including the preserved garden and archive facts (08, 09, 11, 12), the public `/data/evidence.json` (13) and a Not Found page for `/api` (14) |
| About 21:00 IST | Documentation update: `curl` and headless Chrome | `/` and `/data/evidence.json` returned 200 and the exact `/api/state` 404; all four security headers present; deployed files byte-identical to `site/` at `8013d01`; every run, stage and question button worked at 1280×900 |
| About 22:00 IST | Documentation audit: `curl` and headless Chrome | The same status codes and headers; `/style.css`, `/walkthrough.js` and `/index.html` 200; `/api` and `/favicon.ico` 404; deployed files byte-identical to `site/` at `26a1c3e`; the click-through repeated. A 375 px emulated viewport showed horizontal overflow (see Known issues) |
| Date not stated; the screenshot files date from about 23:25 IST on October 28 to 00:04 IST on October 29 | The owner: Render dashboard and Chrome DevTools responsive emulation (reported height 812 px), as reported by the user | Dashboard showed `2a1ffb0` successfully deployed (screenshots not saved). Console `scrollWidth` equalled `clientWidth`, with no horizontal overflow, at 320, 360, 375, 390, 414, 768, 980, 981 and 1280 px. The command block and timing table scrolled internally, and all run, stage and question buttons passed. Saved screenshots: [deployed-2a1ffb0/](screenshots/mobile-overflow-fix/deployed-2a1ffb0/README.md) (360–1280 px and the command block; the 320 px capture was unavailable) |
| October 29, about 00:15 IST (18:45 UTC on October 28) | Coding agent: `curl` and Git, read-only | `/style.css` 200; its SHA-256 `035e46ec…bc488027` is byte-identical to `site/style.css` at `2a1ffb0` and at the fix commit `08e0524`. `/`, `/index.html`, `/walkthrough.js` and `/data/evidence.json` 200, with the latter three byte-identical to `2a1ffb0`. `/api/state` 404; the four headers present. `08e0524` is an ancestor of `2a1ffb0`. No browser measurement was made by the agent |
| October 29, about 02:25 IST (20:55 UTC on October 28) | Coding agent: `curl` and Git, read-only, on the custom domain ([custom-domain evidence](screenshots/custom-domain-2026-10-29/README.md)) | Normal HTTPS GETs on `ghostcache.bipulchamoli.tech` returned 200 for the page, stylesheet, script and evidence JSON, byte-identical to the committed files at `c7c05c3`; the exact `/api/state` returned 404. Global DNS propagation was not established |
| October 29, about 22:03 IST (16:33 UTC) | Coding agent (audit fixes): Python `urllib` and Git, read-only, normal TLS, both addresses ([saved comparison](screenshots/audit-fixes-2026-10-29/public-served-files.json)) | All 11 four-page site files returned 200 on both addresses, byte-identical to committed `f66977d`; working-tree HTML and `method.js` differ (the undeployed refresh). `/favicon.svg` 200; direct `/favicon.ico` 404; `/api/state` 404; the four headers present. Served `style.css` no longer matches `2a1ffb0`. No dashboard check, so the built commit is not named. The [checklist above](#verify-a-deployment) was also run in zsh and bash: 22 of 22 "200 match" |
| October 30, about 01:23–01:40 IST (19:53–20:10 UTC on October 29) | Coding agent (T-E9): Python `urllib`, Git and headless Chrome 156 over the DevTools protocol, read-only, normal TLS and DNS, both addresses ([evidence](screenshots/public-deploy-04407eb-2026-10-30/README.md)) | All 11 site files 200 and byte-identical to `04407eb` on both addresses; `/api/state` 404; `/favicon.svg` 200 and `/favicon.ico` 404 (not requested by any page); the four headers on `/` and all four pages; `/data/evidence.json` `no-cache`. `method.html#project-evidence` dated October 30 with both archived CI reports; the run guide current; 114 links 200, internal anchors resolve. Classic scrollbars: no overflow in 72 measurements (four pages, nine widths, two addresses); runs, stages, keys, Previous/Next, diagram/list and six answers work at 1280 and 375 px; only same-origin site requests; no console, page or CSP errors. Seven viewport screenshots. The built commit was not confirmed in the dashboard |

The screenshots show what the browser displayed; they do not establish HTTP status codes. Screenshot 15 has extra characters after `/api/state` in its URL and is **not** evidence of the clean `/api/state` check, which comes from `curl`. Screenshots 09 and 10 are identical and both kept.

## Verify the T-E7 fix after deployment

1. In the Render dashboard, confirm that a deploy of the commit containing the `site/style.css` change finished and is live. Note its commit hash.
2. Compare the served stylesheet with the committed one (from the repository root):

   ```sh
   curl -s https://ghostcache-walkthrough.onrender.com/style.css | shasum -a 256
   shasum -a 256 site/style.css           # in October 2026, the T-E7 fix: 035e46ec…bc488027
   ```

   *Note, October 29, 2026:* the redesign (D-21) replaced that stylesheet, so `site/style.css` no longer hashes to `035e46ec…`. The T-E7 file is still available as `git show 2a1ffb0:site/style.css`. For a future stylesheet change, compare against the commit you deployed, as in [Verify a deployment](#verify-a-deployment).

3. Repeat the [Verify a deployment](#verify-a-deployment) checks (status codes and headers).
4. On the public URL, measure `document.documentElement.clientWidth` and `scrollWidth` at 320, 360, 375, 390, 414, 768, 980, 981 px and a desktop width, and confirm that the command block and timing table scroll inside themselves.
5. Record the deployed commit, the hash comparison and the measurements in the verification record above and in TESTING.md; only then mark T-E7 done.

*Done for `2a1ffb0` (October 28–29, 2026):*
- **Step 1:** the user's dashboard screenshots, which were not saved.
- **Steps 2 and 3:** the coding agent's read-only checks. Both passed.
- **Step 4:** the user's manual DevTools checks; the agent did not repeat them in a browser.
- **Step 5:** this record. T-E7 is complete.

The steps stay here for any future stylesheet change.

## Known issues and gaps

- **Resolved: horizontal overflow on narrow screens (found October 28, 2026; fix live in `2a1ffb0`).** In headless Chrome emulation, at the tested 375 px viewport, the document's scrollWidth was 573 px, while the layout viewport stayed 375 px, so the page scrolled sideways. The cause is in `site/style.css`: below 980 px it sets `.explainers` to `grid-template-columns:1fr`, and the `white-space:pre` command block in "Run it yourself" held that column at about 557 px. The exact width at which overflow starts can vary with browser and font metrics, and no real phone was tested. This contradicts the earlier local T-E2 check, which reported no overflow at the 375×812 preset. Fix and recheck: T-E7 in [tasks.md](tasks.md).
  *Resolution in progress (October 28, 2026, about 22:30 IST): fixed and verified locally on October 28, 2026; awaiting deployment.* Two rules in `site/style.css` changed: `.explainers` uses `minmax(0,1fr)` below 980 px, and `.tiny-label` may wrap below 650 px (a second, smaller offender at 320 px). Served locally, `scrollWidth` equalled `clientWidth` at every tested width from 320 to 1280 px, and the command block scrolls inside itself. The public site keeps the old stylesheet until the change is pushed and Render rebuilds it. See [TESTING.md](TESTING.md), "Narrow-screen overflow fix T-E7", and [screenshots/mobile-overflow-fix/](screenshots/mobile-overflow-fix/README.md).
  *Resolved (deployed in `2a1ffb0`; verified October 28–29, 2026).* The served `style.css` is byte-identical to the fixed file. The user's DevTools checks on the public URL found no horizontal overflow from 320 to 1280 px. See "Verification record" above, TESTING.md "T-E7 deployed verification", and [screenshots/mobile-overflow-fix/deployed-2a1ffb0/](screenshots/mobile-overflow-fix/deployed-2a1ffb0/README.md). A real phone and other browsers remain unchecked (next item).
  *Later, October 29, 2026:* the four-page redesign replaced that stylesheet. The served `style.css` now matches `f66977d`, not `2a1ffb0`, so the byte comparison above is a dated record of T-E7, not a description of the current file. The redesigned stylesheet's narrow-width behaviour was measured locally with normal scrollbars ([TESTING.md](TESTING.md#ui-content-refresh-october-29-2026), [audit-fix evidence](screenshots/audit-fixes-2026-10-29/README.md)); on the public site it has been byte-compared, not measured in a browser.
- **Favicon (T-E8).** *Original issue, October 28, 2026:* there was no favicon; browsers requested `/favicon.ico`, which returned 404 and logged one console error. Cosmetic only. *Resolved, October 29, 2026:* every page links `favicon.svg`, which both public addresses serve with status 200, byte-identical to `site/favicon.svg`. A direct `/favicon.ico` request still returns 404, but headless Chrome loading the four public pages made no such request and logged no console error ([audit-fix evidence](screenshots/audit-fixes-2026-10-29/README.md)).
- **Not checked:** a real phone, browsers other than Chrome, and assistive technology (T-E6). The click-throughs pressed each button once; they did not try every combination of run, stage and question.
- **No live inference by design.** The page cannot show a new Gemma run. To see one, run GhostCache locally (README.md, "Run it with local Gemma").
