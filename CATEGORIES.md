# GhostCache: expanded prize-category plan

Updated October 27, 2026; scope amended October 28, 2026 (three categories) and October 29, 2026 (four, adding Render). This replaces the category choices from the Recipe Séance plans for **GhostCache**. It is a build plan, not a claim that these integrations or entries already exist.

## Current scope (October 29, 2026)

GhostCache intends to enter **four** categories, each with working use and evidence (DECISIONS.md D-14, amendment of October 29, 2026):

| Official category | How GhostCache uses it | Main evidence |
| --- | --- | --- |
| **Best Use of Gemma** | Local `gemma4:e2b-it-qat` through Ollama answers and summarizes in the live experiment | Three saved live runs, 10/10 each ([results/](results/)) |
| **Best Use of GitHub Copilot** | Targeted through **GitHub Actions**, which the official description includes ("automate your project with GitHub Actions"). The workflow runs the test suite and a fresh fixture evaluation on every push. Copilot did not write this project, and the post must not say it did | Hosted runs #1 and #3 to #10 succeeded; run #3's report was downloaded and inspected |
| **Best Use of Sentry Agent Tracing** | Optional metadata-only spans for the agent, model calls, memory operations, reset and verify | Real traces, seven screenshots and two explained findings |
| **Best Use of Render** | Render hosts the public walkthrough of three recorded local Gemma evaluations (see [below](#best-use-of-render)) | [render.yaml](render.yaml), [DEPLOYMENT.md](DEPLOYMENT.md), deployment and T-E7 evidence |

The .tech domain, Backboard, Browserbase, ElevenLabs and Entire stay dropped; none has code or evidence.

**Intended is not entered.** As of October 29, 2026 no DEV post exists on DEV, as a draft or published, so no category has been entered. A category is entered only when the eventual DEV submission lists it. The official page says each submission "is automatically in the running for the overall prize and every partner category it qualifies for", so whether an entry qualifies is the organizers' decision. Editing these documents enters nothing. The remaining submission work is in [tasks.md](tasks.md), section I.

### Best Use of Render

**What Render does.**
- **Hosting.** Render hosts <https://ghostcache-walkthrough.onrender.com/>, a Blueprint-managed static site (`ghostcache-walkthrough`, from [render.yaml](render.yaml)).
- **What it shows.** The site is a walkthrough of three recorded local Gemma evaluations. Visitors switch between the runs, the five stages and six recorded questions. They can inspect the memory states, the leaked answer after source-only deletion, the provenance cleanup, the verification checks and the facts that survive cleanup.
- **What it does not do.** It performs no live inference and stores nothing. The Python backend, the SQLite experiment and Ollama stay on the laptop (DECISIONS.md D-13). Entering the category does not change what runs on Render.

**Evidence in this repository.**
- [render.yaml](render.yaml): one static site, publish directory `site/`, security headers, no secrets or environment variables.
- [DEPLOYMENT.md](DEPLOYMENT.md): the Blueprint, deploy steps and read-only verification record (status codes, headers, served files compared with `site/`).
- Initial deployment from commit `8013d01`: [screenshot 00](screenshots/00-render-dashboard-live-8013d01.png) (Render dashboard). The owner's browser screenshots of the public page are [indexed here](screenshots/README.md), for example the [leaked answer](screenshots/05-leaked-answer-and-supplied-context.png), [provenance cleanup](screenshots/06-provenance-cleanup-and-rebuilt-summary.png) and preserved [garden](screenshots/11-after-cleanup-garden-fact-preserved.png) and [archive](screenshots/12-after-cleanup-archive-fact-preserved.png) facts.
- The narrow-screen fix (T-E7) is live. The served stylesheet is byte-identical to the fixed file, and the user checked widths from 320 to 1280 px: [deployed-2a1ffb0/](screenshots/mobile-overflow-fix/deployed-2a1ffb0/README.md), [CSS comparison](screenshots/mobile-overflow-fix/deployed-2a1ffb0/css-comparison.json), TESTING.md "T-E7 deployed verification".

**Limits of that evidence.**
- **Later dashboard screenshots.** They show commit `2a1ffb0` deployed. They were supplied during the session but could not be archived, so that statement rests on the owner's report.
- **Stylesheet hashes.** They prove which bytes Render served. They do not independently prove which commit Render built.
- **Cropped screenshots.** The cropped DevTools screenshots omit the browser chrome and the address bar, so the URL is not visible in them.
- **T-E6 is still open.** A real phone, Safari or Firefox, and assistive technology are separate checks and are incomplete.

**Ready to copy into the DEV post.** Paste the paragraph and links as written, with nothing added:

> **Best Use of Render:** Render hosts GhostCache’s public interactive walkthrough of three recorded local Gemma evaluations. Visitors can inspect the leaked answer, provenance cleanup and preserved facts without installing the model. The walkthrough is static and performs no live inference.
>
> Live: <https://ghostcache-walkthrough.onrender.com/> · Blueprint: [render.yaml](https://github.com/bipul724/GhostCache/blob/main/render.yaml) · Deployment record: [DEPLOYMENT.md](https://github.com/bipul724/GhostCache/blob/main/DEPLOYMENT.md)

**Eligibility, an interpretation kept outside that paragraph.**
- **The wording checked.** The official category text, checked on October 29, 2026 at <https://dev.to/challenges/hf26>, reads: "Use Render as your project's AI runtime, to host an agent's front end, or to run Hermes or OpenClaw."
- **Which clause applies.** GhostCache relies on "to host an agent's front end". The walkthrough is the public front end for recorded runs of its local Gemma assistant.
- **Why it is not certain.** The wording does not explicitly address a static walkthrough of recorded runs with no live agent behind it. This is a reasonable intended entry, not organizer-confirmed eligibility, and acceptance is not guaranteed.

### Previous scope (October 28, 2026; superseded October 29, 2026)

*Kept as written. Render was added on October 29, 2026; the rest still applies.*


The submission enters **three** categories, the ones with working use and evidence: **Gemma**, **GitHub (through GitHub Actions)** and **Sentry Agent Tracing**. The .tech domain, Backboard, Browserbase, ElevenLabs and Entire targets are dropped; none has code or evidence (DECISIONS.md D-14 amendment). Render hosts the public recorded walkthrough ([render.yaml](render.yaml), D-13; deployed October 28, 2026 at <https://ghostcache-walkthrough.onrender.com/>) but is not added to the category list. The original seven-category plan below is kept as history.

**Readiness is not an entry.** As of October 28, 2026 no DEV post exists on DEV, as a draft or published, so no category has actually been entered. Each of the three has working use and evidence: Gemma (three saved live runs, 10/10 each), GitHub Actions (hosted runs #1 and #3 to #10 succeeded; run #3's report was inspected) and Sentry (real traces, seven screenshots and two findings). The remaining submission work is in [tasks.md](tasks.md), section I.

## Original target (October 27, 2026)

The original plan aimed for **seven partner categories**, with two optional additions. Keep the project focused on making residual AI-accessible information visible, tracing its origin, and verifying cleanup. Each category must have working use and evidence before it appears in the submission.

| Priority | Official category | Concrete contribution | Current status | Evidence needed |
| --- | --- | --- | --- | --- |
| 1 | Best Use of Gemma | Generate summaries and answer retrieval questions locally through Ollama. | Implemented; one recorded live evaluation passed 10/10 checks. *(October 28, 2026: three saved live evaluations, each 10/10; a recorded walkthrough of them is public.)* | Model identity, actual outputs, reproducible protocol, results including failures. |
| 2 | Best Use of GitHub Copilot | Use **GitHub Actions**, explicitly included in this challenge's category description, to run the deletion regression suite and save a fresh synthetic report on changes. | Workflow configured in `.github/workflows/checks.yml`; YAML parsed, 22 tests and fresh 10/10 fixture evaluation passed locally. Hosted [run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382) passed on October 28, 2026 (62 tests). The fixture report from [run #3](https://github.com/bipul724/GhostCache/actions/runs/40573873485) was downloaded and inspected: 10 of 10 checks passed. Every later run through #10 succeeded (run #2 was a cancelled duplicate). | Public repository, successful workflow link, uploaded fixture report. Describe Actions use accurately; do not claim Copilot generated existing code. |
| 3 | Best Use of Sentry Agent Tracing | Show retrieval, generation, deletion and rebuild spans; measure timings, tokens and failure classes; explain a finding in the post. | **Implemented, with real traces (October 28, 2026):** optional metadata-only spans for the agent, model calls, memory search/write/delete, reset and verify, with offline privacy tests (T-D2). Real traces from one fixture and two live evaluations, seven screenshots and two explained findings (T-D3): a 40.45 s first model call after an Ollama server start dominates the cold run (cause inferred, not measured), and the source-only leak is visible through `answer_contains_marker` and synthetic `context_ids`. Failure classes are visible too: a failed live run's root span carries `error.type: ProviderError`. Sent from a 14-day Sentry Business trial with no payment method; the runs used 120 of 100M spans (T-D1). The local ledger is not Sentry. | Actual Sentry traces/screenshots and explanation of an observed issue or bottleneck. |
| 4 | Best Use of Render | Host the public synthetic GhostCache interface and recorded evaluation evidence. | **Not entered (October 28, 2026).** A static recorded walkthrough (`site/`) and its Blueprint (`render.yaml`) are implemented, tested locally and deployed on Render (October 28, 2026: <https://ghostcache-walkthrough.onrender.com/>, recorded runs only). Hosting only. *(October 29, 2026: now an intended category, with Render's role unchanged; see [Best Use of Render](#best-use-of-render).)* | Render deployment and working public interface, with replay/simulation clearly distinguished from live inference. |
| 5 | Best Use of a .tech Domain | Serve that public project under a subdomain such as `ghostcache.bipulchamoli.tech`. | **Dropped October 28, 2026.** Never started. | Live HTTPS URL and the promo claim/registration evidence. Do not change the existing main-domain application. |
| 6 | Best Use of Backboard | Run a small, budget-capped comparison across 2–3 available open-weight models through one Backboard key, using the same synthetic corpus and deletion probes. | **Dropped October 28, 2026.** No API calls or results. | Model IDs, actual requests/results, latency, token/cost records, disclosure and retained-fact outcomes. |
| 7 | Best Use of Browserbase | Use Stagehand with a real browser to drive the hosted workflow: expose the marker, delete the source, observe residual information, propagate cleanup, and verify retained facts. | **Dropped October 28, 2026.** Never started. Local Chrome/CUA checks do not count as Browserbase use. | Actual Stagehand execution, browser session evidence and assertions; report whether it exercised simulation/replay or live inference. |

The official GitHub category includes “automate your project with GitHub Actions,” despite its Copilot name. Hosting an agent's front end is expressly included in Render's category ("Use Render as your project's AI runtime, to host an agent's front end, or to run Hermes or OpenClaw"; whether a static recorded walkthrough counts is an interpretation, see [Best Use of Render](#best-use-of-render)). These are legitimate uses when completed; installing a dependency or displaying a logo is insufficient evidence.

## Useful optional categories (dropped October 28, 2026; kept as history)

- **Best Use of ElevenLabs:** generate a short, accessible spoken walkthrough or demo narration explaining where the copies survive and how cleanup works. The official prompt expressly permits demo narration. The connected Hacktoberfest registration lists a three-month Creator-tier offer with no card, one code per account; it has **not** been claimed. The ordinary free plan also has a limited credit allowance. Use a stock voice and fictional narration; no voice cloning is needed.
- **Best Use of Entire:** capture upcoming development with real Entire checkpoints and explain important decisions using those records. Entire's current repository documents Codex integration, but compatibility with this exact desktop workflow still needs a successful checkpoint test. No Entire recording is currently configured. Do not retroactively present unrecorded work as captured.

The registered main Hacktoberfest event also lists official voice skills from `elevenlabs/skills` (including text-to-speech, speech-to-text and agents). No skill was installed. No offer was claimed. The Week 4 event's offer/skill listings were empty when checked; this does not imply the public Hacktoberfest promo page has no offers.

## Free options and practical limits

| Service | Verified free path | Constraint |
| --- | --- | --- |
| Gemma + Ollama | Already installed locally; the completed experiment used no hosted inference. | Laptop memory and model latency. |
| GitHub Actions | Standard hosted runners in a public repository are free. | Use CPU runners, no API secrets, no model downloads; keep report retention short. Larger/GPU runners are excluded. |
| Render | Free static sites or free web services. *October 28, 2026: GhostCache uses a static site only (`render.yaml`); not deployed yet.* *(Deployed later on October 28, 2026; see README.md, "Deployment record".)* | Free web services sleep after 15 idle minutes and lose local SQLite/files on restart. They cannot host this 4.3 GB Gemma model. Prefer a clearly labeled public replay/synthetic demo, with local live instructions and video. |
| Backboard | New-account $5 credit, valid 30 days, no payment information required. | Finite credit, not permanent free inference. Existing accounts may have used it. Check available models/prices and cap requests before a comparison. |
| Browserbase | $0 plan currently lists one browser hour, three concurrent browsers, 15 minutes per session, three managed agent runs and $5 model tokens. | Browser hours, managed agent runs and model tokens are separate allowances; confirm consumption before running. A cloud browser needs a reachable demo. |
| Sentry | Target the free Developer plan; confirm the account's current tracing allowance before enabling the integration. *Recorded October 28, 2026 (T-D1): the account used was on a 14-day Business Plan Trial with no payment method on file, not the Developer plan; usage period Oct 28 – Nov 10, 120 of 100M spans used.* | Do not promise unlimited traces or raw-payload capture. The Developer plan's limits and what happens when the trial ends were not checked. |
| .tech | Reuse the existing domain only if its promo claim qualifies. | The first year and renewal are different costs; do not register another domain just for this plan. |

## Execution order

1. Put the project in its own public repository and run the checked-in GitHub Actions workflow. *(Done October 28, 2026: [run #1](https://github.com/bipul724/GhostCache/actions/runs/40570510382).)* This makes the existing automated test suite and randomized fixture evaluation repeatable evidence. It does not replace live-model evaluation.
2. Add metadata-only Sentry instrumentation. Export operation names, durations, token counts, result counts and error categories. Do not export document bodies, questions, answers or the marker. *(Done October 28, 2026: implemented (T-D2), then real traces and two findings recorded (T-D3; README.md, "What the real traces showed"). The plan and usage were recorded the same day: a 14-day Business trial, 120 of 100M spans used (T-D1).)*
3. Build the public synthetic interface/replay for Render and connect the qualifying .tech subdomain. *(October 28, 2026: the recorded walkthrough and Render Blueprint are done locally (T-E2), not deployed; the .tech subdomain is dropped.)* *(The walkthrough was deployed on Render later on October 28, 2026 (T-E3), labelled as a recorded run.)* A replay must say **recorded run**; simulation must say **simulation**. Neither may imply a new Gemma call. Do not expose the existing single-user, resettable localhost server directly as a shared service without redesigning session/state isolation.
4. *(Dropped October 28, 2026.)* Add an optional Backboard evaluation provider. Preserve the local Ollama path. Use stateless calls with only explicitly supplied synthetic context; do not introduce opaque provider memory into the current deletion claim. Capture the full supplied-context lineage in the local store.
5. *(Dropped October 28, 2026.)* Compare actual model behavior on the same defined cases. Record whether the broken control exposed the marker, whether cleanup cleared managed content, whether secret answers changed, and whether unrelated facts remained answerable. Do not rank “model forgetting”: cleanup is an application operation and the benchmark is bounded.
6. *(Dropped October 28, 2026.)* Use Browserbase/Stagehand to exercise the public browser workflow and collect evidence. A test of a replay is a UI regression test, not another live-model experiment.
7. *(Dropped October 28, 2026.)* Add ElevenLabs narration or Entire checkpoints only after the six core targets have working evidence and the write-up is underway.

## Preserve the product's promise

Local mode keeps document processing and inference on the user's machine. Backboard comparisons, hosted synthetic demos, Browserbase sessions and narration are explicitly online features using fictional data. Sentry receives only deliberately exported metadata. Avoid claiming the whole expanded system is offline.

Browser recordings, evaluation reports and narration are separate evidence artifacts and may retain the fictional marker; they are outside the assistant-store cleanup claim. The current storage audit covers managed SQLite title/body fields, captured provenance and defined retrieval paths, not model weights, secure disk erasure or vendor-internal storage.

Defer Auth0, Temporal, TabPFN, MongoDB Atlas and Tiger Data for this version. They become useful with real multi-user authorization, distributed deletion jobs, or independently tested storage adapters; adding them without those needs would expand the claim and the work more than the demonstration.

## Entry rule

Only list categories genuinely used in the final project and write-up. A valid submission also enters consideration for the overall prize. The official page (checked October 29, 2026) says each submission "is automatically in the running for the overall prize and every partner category it qualifies for"; the organizers decide whether it qualifies. One submission can win only once in this challenge; entering several categories does not give independent winning chances. The official rubric weights writing quality most heavily.

## Sources

- [Week 4 challenge and judging criteria](https://dev.to/challenges/hacktoberfest-week4-2026-10-26)
- [Official partner category descriptions](https://dev.to/challenges/hf26) (Render, Gemma, GitHub Copilot and Sentry Agent Tracing wording rechecked October 29, 2026)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Render free services and limitations](https://render.com/docs/free)
- [Backboard credits, expiry and no-card policy](https://docs.backboard.io/faq)
- [Browserbase pricing and allowances](https://www.browserbase.com/pricing)
- [ElevenLabs text-to-speech free plan](https://elevenlabs.io/text-to-speech)
- [Entire CLI and supported integrations](https://github.com/entireio/cli)
- [Raju Dandigam: Keep Your AI Agent Traces on Your Machine: A Local-First Approach](https://dev.to/raju_dandigam/keep-your-ai-agent-traces-on-your-machine-a-local-first-approach-5b9l)

