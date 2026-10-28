# T-E7 deployed-site evidence (commit 2a1ffb0)

Evidence that the narrow-screen overflow fix (T-E7) is live on <https://ghostcache-walkthrough.onrender.com/>. The local before/after captures one level up ([../README.md](../README.md)) are unchanged and remain the record of the original failure and the local fix.

This folder holds three kinds of evidence. Keep them apart:

1. **CSS comparison, checked by the coding agent (read-only).** [css-comparison.json](css-comparison.json). On October 28, 2026 at 18:45:49 UTC (October 29, 00:15:49 IST), `GET /style.css` returned 200 with 9,935 bytes, SHA-256 `035e46ec0210e14951f1e0c8cda9748ded207f9d1cdd73ee7a65126bbc488027`. That is byte-identical to `site/style.css` at `2a1ffb0`, at the fix commit `08e0524` and in the working tree, and differs from the pre-fix file (`86b4876204f567996900d44154d86340d7deffa54517fd618d02a889100b0927`, at `3cc0814`). Both fixed rules are present in the served file. The served `index.html`, `walkthrough.js` and `data/evidence.json` are byte-identical to `2a1ffb0`. This proves which bytes were served at that moment. It does not by itself say which commit Render built.
2. **User-reported manual results.** [user-reported-manual-results.json](user-reported-manual-results.json). The user's own Chrome DevTools responsive-emulation checks (reported height 812 px) at nine widths, and five functional checks, all as reported. The coding agent did not reproduce them.
3. **Screenshots supplied by the user** (table below). The eight full-window captures (01–08) are published as **cropped** copies with the browser window's own interface removed (see "Cropping"); the two command-block images (09–10) were already cropped by the user and are copied byte-for-byte. They are Chrome DevTools responsive emulation on a desktop browser, not a physical phone, Safari, Firefox or an accessibility tool.

**Deployed commit.** The Render dashboard screenshots supplied by the user show `2a1ffb0` as successfully deployed. Those screenshots could not be saved (see "Unavailable sources"), so in this folder that statement rests on the user's report. Independently, Git shows `08e0524` (the CSS fix) is an ancestor of `2a1ffb0`, no commit between them touched `site/` or `render.yaml`, and GitHub's `refs/heads/main` was `2a1ffb0` at 18:48:30 UTC. The served stylesheet's `Last-Modified` header was `Wed, 28 Oct 2026 17:21:42 UTC`, after both commits (22:50–22:51 IST, 17:20–17:21 UTC).

| File | Shows | Size (px) | Source file name |
| --- | --- | --- | --- |
| [01-devtools-responsive-360x812-console-no-overflow-cropped.png](01-devtools-responsive-360x812-console-no-overflow-cropped.png) | Public site in DevTools Responsive 360 × 812; console: `viewportWidth` 360, `pageWidth` 360, `horizontalOverflow` false | 2047 × 1115 (cropped) | codex-clipboard-83e753bb-43c1-43c9-a559-9654278da13f.png |
| [02-devtools-responsive-375x404-console-no-overflow-cropped.png](02-devtools-responsive-375x404-console-no-overflow-cropped.png) | Responsive **375 × 404** (the toolbar shows 404, not the reported 812); console: 375, 375, false | 2047 × 1115 (cropped) | codex-clipboard-25d5a762-d60e-4b57-a04c-05eea2437646.png |
| [03-devtools-responsive-390x812-console-no-overflow-cropped.png](03-devtools-responsive-390x812-console-no-overflow-cropped.png) | Responsive 390 × 812; console: 390, 390, false | 2047 × 1115 (cropped) | codex-clipboard-8a2f0621-18d7-4324-93bc-87ef809d73f9.png |
| [04-devtools-responsive-414x812-console-no-overflow-cropped.png](04-devtools-responsive-414x812-console-no-overflow-cropped.png) | Responsive 414 × 812; console: 414, 414, false | 2047 × 1115 (cropped) | codex-clipboard-174e3fd1-968e-425c-a85e-16d2f5b7e747.png |
| [05-devtools-responsive-768x812-console-no-overflow-cropped.png](05-devtools-responsive-768x812-console-no-overflow-cropped.png) | Responsive 768 × 812; console: 768, 768, false | 2047 × 1115 (cropped) | codex-clipboard-bea71450-cbc9-4c7e-b126-12617e0b7156.png |
| [06-devtools-responsive-980x812-console-no-overflow-cropped.png](06-devtools-responsive-980x812-console-no-overflow-cropped.png) | Responsive 980 × 812; console: 980, 980, false | 2047 × 1115 (cropped) | codex-clipboard-b7576b11-316e-415b-becd-f193541574c9.png |
| [07-devtools-responsive-981x812-console-no-overflow-cropped.png](07-devtools-responsive-981x812-console-no-overflow-cropped.png) | Responsive 981 × 812 (two-column hero, three run cards); console: 981, 981, false | 2047 × 1115 (cropped) | codex-clipboard-247734e8-f524-4cf4-b611-5463524ca1cb.png |
| [08-devtools-responsive-1280x812-console-no-overflow-cropped.png](08-devtools-responsive-1280x812-console-no-overflow-cropped.png) | Responsive 1280 × 812; console: 1280, 1280, false | 2047 × 1115 (cropped) | codex-clipboard-6d29dffb-5af1-49ca-b2c2-51209d8008d4.png |
| [09-command-box-scrolled-to-start.png](09-command-box-scrolled-to-start.png) | Cropped: "Run it yourself" command block at its left edge (`python3.12 -m ghostcache serve --port 8765`), clipped at its own border | 478 × 556 | codex-clipboard-9b4206c7-c6c3-4582-897d-3cb21993c85d.png |
| [10-command-box-scrolled-right.png](10-command-box-scrolled-right.png) | Cropped: the same block scrolled right (`… --output results/my-run.json` visible) while the surrounding text stays in place | 444 × 626 | codex-clipboard-8efb7e4d-bc0d-48c5-a9a4-573e714b484e.png |

The console screenshots all run the same expression: `scrollWidth > clientWidth` on `document.documentElement`. The two cropped command-block images do not show the emulated width.

## Cropping

The eight full-window captures (2047 × 1331) also showed the macOS title bar, Chrome's tabs, address bar, extension and profile icons and bookmarks bar. None of that is evidence, so the published copies remove the top 216 pixel rows (rows 0–215, everything above Chrome DevTools' device toolbar). Nothing else was changed: full width kept, and every remaining pixel row was checked to be identical to the original's row 216 onward. The PNG `sRGB` chunk was kept; the `eXIf` metadata chunk was dropped. Each cropped file name ends in `-cropped`.

What stays visible: the DevTools device toolbar (Responsive width × height), the emulated page and the console expression and result. The address bar is not visible in the crops, so the crops alone do not show the URL. That rests on the user's report and the separate CSS check above.

The original full-window files are kept outside this public repository by the owner, unchanged. Their SHA-256 values, for anyone given the originals:

| Original | SHA-256 |
| --- | --- |
| `01-devtools-responsive-360x812-console-no-overflow.png` | `93f879ff153d3d634993c9cdfe82083c731ec825cd6607565b01b1b41f84aefb` |
| `02-devtools-responsive-375x404-console-no-overflow.png` | `47179db0a2cd282cdc1801933a82c2789255bfccdf48f08776879168596a4615` |
| `03-devtools-responsive-390x812-console-no-overflow.png` | `1f76a29e409f0108c6edcadac6da52ab3573769a77b661c00794cffd722cdc6f` |
| `04-devtools-responsive-414x812-console-no-overflow.png` | `00fa72c6fb7845dac86a6cae41fb205052d903e996b17a2143b43cf5ffdf9070` |
| `05-devtools-responsive-768x812-console-no-overflow.png` | `63325f6f13f3137b36dfc9f7e07de560002a9ff3aec129d392199122e60f8e9c` |
| `06-devtools-responsive-980x812-console-no-overflow.png` | `c51f8603ae46a00350c765d5c3b6d674ca8cd2b03cb5e07f34456c8b469affcb` |
| `07-devtools-responsive-981x812-console-no-overflow.png` | `51e3d6df6e91018c39a30b82fcfba9d1ee4af473c0ba823d6f40de668195894f` |
| `08-devtools-responsive-1280x812-console-no-overflow.png` | `70788122cd392938a0ff96cee7f16c98a619abba1b01f3021ea2793af05ad448` |

## Unavailable sources

The user listed five more screenshots under macOS's temporary `TemporaryItems/NSIRD_screencaptureui_*` folders. When copying was attempted (October 29, 2026, about 00:18 IST), each exact path returned "No such file or directory". macOS removes these temporary capture files after a screenshot is saved or dismissed. They were **not saved**, and nothing here stands in for them:

| Listed screenshot | Described as |
| --- | --- |
| `Screenshot 2026-10-28 at 10.59.53 PM.png` | Render dashboard |
| `Screenshot 2026-10-28 at 11.11.25 PM.png` | Render deployment details |
| `Screenshot 2026-10-28 at 11.14.45 PM.png` | Phone-frame preview |
| `Screenshot 2026-10-28 at 11.14.53 PM.png` | Phone-frame preview |
| `Screenshot 2026-10-28 at 11.26.41 PM.png` | 320 px console result |

As a result, no saved image shows the Render deploy of `2a1ffb0`, the phone-frame previews, or the 320 px console result. These were not recreated or backdated. A different screenshot found on the Desktop was checked as a possible replacement for the dashboard capture; it shows a chat assistant's response, not Render's dashboard, so it is not used. The 320 px row and the deployed-commit statement rest on the user's report. The timing-table and selector results also have no dedicated screenshot here.

## Limitations

- DevTools responsive emulation in desktop Chrome only. No physical phone, Safari, Firefox, screen reader or automated accessibility check (T-E6, still open).
- Only the widths and checks listed above were reported. Other heights and view-state combinations were not reported for the deployed site; the local automated run covered 33 states per width (see [../../../TESTING.md](../../../TESTING.md), "Narrow-screen overflow fix T-E7").
- The `/favicon.ico` 404 is unrelated and still open (T-E8).

## Checksums

[SHA256SUMS.txt](SHA256SUMS.txt) covers the eight cropped captures, the two command-block images and the two JSON records (not this index, as in the parent folder). It was regenerated after cropping; the original full-window hashes are listed under "Cropping". From the repository root:

```sh
(cd screenshots/mobile-overflow-fix/deployed-2a1ffb0 && shasum -a 256 -c SHA256SUMS.txt)
```

The parent folder's manifest (`../SHA256SUMS.txt`, 15 local before/after files) and `screenshots/SHA256SUMS.txt` (16 original deployment screenshots) were not changed.
