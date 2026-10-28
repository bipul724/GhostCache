# Deploying the public walkthrough

GhostCache has exactly one public deployment: the **static recorded walkthrough** in [site/](site/), hosted on Render. It replays three saved live Gemma reports. It runs **no inference**, cannot answer new questions, stores nothing and deletes nothing. The interactive app in `web/`, the Python server, the SQLite database and Ollama stay on the author's laptop and are never deployed (DECISIONS.md D-13).

Render is used only for hosting. It is not one of the submission's categories (Gemma, GitHub through Actions, Sentry).

## Current deployment

| Field | Value |
| --- | --- |
| Public URL | <https://ghostcache-walkthrough.onrender.com/> |
| Render service | `ghostcache-walkthrough`, a Blueprint-managed Render static site created from [render.yaml](render.yaml) |
| Initial deployment | October 28, 2026, from branch `main` at commit `8013d01`, as shown in the Render dashboard ([screenshot 00](screenshots/00-render-dashboard-live-8013d01.png)) |
| Deployed by | The repository owner, from their own Render account |

**Which commit is live now.** `8013d01` is the only deployment with direct evidence. The later commit `26a1c3e` (documentation and screenshots) changed nothing under `site/` and did not change `render.yaml`, so the served files match `site/` at both commits. Whether Render built `26a1c3e` was not checked in the dashboard. The site's `Last-Modified` header (October 28, 14:02:51 UTC) is earlier than that push (16:22 UTC), which is consistent with no redeploy but does not prove it. Check the dashboard's deploy list before naming any other commit as deployed.

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
python3.12 -m unittest tests.test_site -v       # 20 walkthrough tests
```

Commit `site/data/evidence.json` with the change and push `main`. Review the exported data before publishing: the export keeps an allowlist of fields and refuses text matching a few selected private-string patterns, but that pattern check is an additional safeguard, not comprehensive secret detection. See README.md, "Public recorded walkthrough".

Preview locally on a free port (check first with `lsof -nP -iTCP:8790 -sTCP:LISTEN`). This does not touch the app, its database or Ollama:

```sh
python3.12 -m http.server 8790 --bind 127.0.0.1 --directory site
```

## Verify a deployment

Read-only checks, run from the repository root:

```sh
URL=https://ghostcache-walkthrough.onrender.com
for p in / /data/evidence.json /api/state; do
  printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "$URL$p"
done                                   # expect 200, 200, 404
curl -sI "$URL/" | grep -iE '^(content-security-policy|x-content-type-options|referrer-policy|x-frame-options):'
curl -s "$URL/data/evidence.json" | shasum -a 256
shasum -a 256 site/data/evidence.json  # the two hashes should match
```

In a browser, also confirm:

- the banner reads "Recorded local Gemma evaluation — no live inference";
- the three run buttons, five stage buttons and six question buttons change the view;
- the network panel shows only `style.css`, `walkthrough.js` and `data/evidence.json` (plus the browser's own `/favicon.ico` request; see Known issues).

The screenshot evidence can be checked with `(cd screenshots && shasum -a 256 -c SHA256SUMS.txt)`. The manifest holds bare file names, so the command must run inside `screenshots/`.

## Verification record

Every check below was read-only. Full command tables are in [TESTING.md](TESTING.md), "Render deployment T-E3" and "Documentation audit".

| When (October 28, 2026) | Who and how | Result |
| --- | --- | --- |
| From about 19:35 IST (the dashboard screenshot's file name; browser screenshot times were not recorded) | The owner: Render dashboard and their own browser, recorded in [screenshots/](screenshots/README.md) | Dashboard shows the Blueprint-managed static site live from `8013d01` (00). The page and all three recorded runs (01–03), the source-only, leak, cleanup and verification views (04–07), recorded question answers including the preserved garden and archive facts (08, 09, 11, 12), the public `/data/evidence.json` (13) and a Not Found page for `/api` (14) |
| About 21:00 IST | Documentation update: `curl` and headless Chrome | `/` and `/data/evidence.json` returned 200 and the exact `/api/state` 404; all four security headers present; deployed files byte-identical to `site/` at `8013d01`; every run, stage and question button worked at 1280×900 |
| About 22:00 IST | Documentation audit: `curl` and headless Chrome | The same status codes and headers; `/style.css`, `/walkthrough.js` and `/index.html` 200; `/api` and `/favicon.ico` 404; deployed files byte-identical to `site/` at `26a1c3e`; the click-through repeated. A 375 px emulated viewport showed horizontal overflow (see Known issues) |

The screenshots show what the browser displayed; they do not establish HTTP status codes. Screenshot 15 has extra characters after `/api/state` in its URL and is **not** evidence of the clean `/api/state` check, which comes from `curl`. Screenshots 09 and 10 are identical and both kept.

## Verify the T-E7 fix after deployment

1. In the Render dashboard, confirm that a deploy of the commit containing the `site/style.css` change finished and is live. Note its commit hash.
2. Compare the served stylesheet with the committed one (from the repository root):

   ```sh
   curl -s https://ghostcache-walkthrough.onrender.com/style.css | shasum -a 256
   shasum -a 256 site/style.css           # the fixed file: 035e46ec…bc488027
   ```

3. Repeat the [Verify a deployment](#verify-a-deployment) checks (status codes and headers).
4. On the public URL, measure `document.documentElement.clientWidth` and `scrollWidth` at 320, 360, 375, 390, 414, 768, 980, 981 px and a desktop width, and confirm that the command block and timing table scroll inside themselves.
5. Record the deployed commit, the hash comparison and the measurements in the verification record above and in TESTING.md; only then mark T-E7 done.

## Known issues and gaps

- **Horizontal overflow on narrow screens (found October 28, 2026).** In headless Chrome emulation, at the tested 375 px viewport, the document's scrollWidth was 573 px, while the layout viewport stayed 375 px, so the page scrolled sideways. The cause is in `site/style.css`: below 980 px it sets `.explainers` to `grid-template-columns:1fr`, and the `white-space:pre` command block in "Run it yourself" held that column at about 557 px. The exact width at which overflow starts can vary with browser and font metrics, and no real phone was tested. This contradicts the earlier local T-E2 check, which reported no overflow at the 375×812 preset. Fix and recheck: T-E7 in [tasks.md](tasks.md).
  *Resolution in progress (October 28, 2026, about 22:30 IST): fixed and verified locally on October 28, 2026; awaiting deployment.* Two rules in `site/style.css` changed: `.explainers` uses `minmax(0,1fr)` below 980 px, and `.tiny-label` may wrap below 650 px (a second, smaller offender at 320 px). Served locally, `scrollWidth` equalled `clientWidth` at every tested width from 320 to 1280 px, and the command block scrolls inside itself. The public site keeps the old stylesheet until the change is pushed and Render rebuilds it. See [TESTING.md](TESTING.md), "Narrow-screen overflow fix T-E7", and [screenshots/mobile-overflow-fix/](screenshots/mobile-overflow-fix/README.md).
- **No favicon.** Browsers request `/favicon.ico`, which returns 404 and logs one console error. Cosmetic only (T-E8).
- **Not checked:** a real phone, browsers other than Chrome, and assistive technology (T-E6). The click-throughs pressed each button once; they did not try every combination of run, stage and question.
- **No live inference by design.** The page cannot show a new Gemma run. To see one, run GhostCache locally (README.md, "Run it with local Gemma").
