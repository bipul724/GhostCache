import contextlib
import importlib.util
import io
import json
import re
import shutil
import subprocess
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
SPEC = importlib.util.spec_from_file_location("export_site_data", ROOT / "scripts" / "export_site_data.py")
export = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(export)
NODE = shutil.which("node")
PAGES = ("index.html", "walkthrough.html", "method.html", "run.html")
SCRIPTS = ("site.js", "home.js", "walkthrough.js", "method.js")
# The only external destinations the public pages link to.
EXTERNAL = ("https://github.com/bipul724/GhostCache", "https://ollama.com",
            "https://dev.to/vectorlinklabs/stale-rag-vs-expensive-rag-how-to-cache-rag-context-without-serving-outdated-answers-335f",
            "https://dev.to/fusionaldev/where-retrieval-assistants-leak-the-title-the-summary-and-the-cache-4po4")


class LocalRefs(HTMLParser):
    """Collects what the page tests check: links, ids, landmarks and anything the CSP would block."""

    def __init__(self):
        super().__init__()
        self.refs, self.ids, self.nav, self.blocked = [], set(), [], []
        self.h1 = 0
        self.current = []
        self._in_nav = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name in ("href", "src"):
            if attrs.get(name):
                self.refs.append(attrs[name])
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "h1":
            self.h1 += 1
        if tag == "nav":
            self._in_nav += 1
        if tag == "a" and self._in_nav and attrs.get("href"):
            self.nav.append(attrs["href"])
        if attrs.get("aria-current") == "page":
            self.current.append(attrs.get("href"))
        # The deployed CSP allows only same-origin scripts and stylesheets: no inline code or styles.
        if tag == "style" or "style" in attrs or (tag == "script" and not attrs.get("src")):
            self.blocked.append(tag)
        self.blocked.extend(f"{tag}[{name}]" for name in attrs if name.startswith("on"))
        if str(attrs.get("href", "")).startswith("javascript:"):
            self.blocked.append("javascript: link")

    def handle_endtag(self, tag):
        if tag == "nav":
            self._in_nav -= 1


def parse(path):
    parser = LocalRefs()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


class ExportTests(unittest.TestCase):
    """The public data is a faithful, allowlisted export of the selected recorded reports."""

    @classmethod
    def setUpClass(cls):
        cls.data = export.build()
        cls.runs = {run["id"]: run for run in cls.data["runs"]}

    def test_committed_data_matches_the_reports(self):
        self.assertEqual(export.render(self.data), (SITE / "data" / "evidence.json").read_text(encoding="utf-8"))
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(0, export.main(["--check"]))

    def test_export_is_deterministic(self):
        self.assertEqual(export.render(self.data), export.render(export.build()))

    def test_each_run_records_its_source_file_and_hash(self):
        for spec in export.RUNS:
            run = self.runs[spec["id"]]
            _, digest = export.load_report(spec["file"])
            self.assertEqual((spec["file"], digest), (run["source_file"], run["source_sha256"]))

    def test_stage_counts_match_the_cold_report(self):
        stages = self.runs["cold"]["stages"]
        self.assertEqual((14, 14, 6, 0), tuple(stages["initial_audit"][k] for k in
                         ("total_artifacts", "active_artifacts", "matched_canary", "stale_descendants")))
        self.assertEqual((14, 13, 5, 5, 1), tuple(stages["source_only_audit"][k] for k in
                         ("total_artifacts", "active_artifacts", "matched_canary", "stale_descendants", "deleted_artifacts")))
        self.assertEqual((15, 9, 0, 5), tuple(stages["cleaned_audit"][k] for k in
                         ("total_artifacts", "active_artifacts", "matched_canary", "invalidated_artifacts")))
        self.assertIn("c-vault", stages["source_only_audit"]["stale_ids"])
        self.assertIn("s-rebuilt-1-9", stages["cleaned_audit"]["active_ids"])

    def test_recorded_answers_are_copied_exactly(self):
        for spec in export.RUNS:
            report, _ = export.load_report(spec["file"])
            run = self.runs[spec["id"]]
            for key in export.ANSWER_KEYS:
                self.assertEqual(report["answers"][key]["answer"], run["answers"][key]["answer"])
                self.assertEqual(report["answers"][key]["citations"], run["answers"][key]["citations"])
            answers = run["answers"]
            self.assertTrue(answers["before"]["contains_marker"])
            self.assertTrue(answers["source_only"]["contains_marker"])
            self.assertFalse(answers["secret"]["contains_marker"] or answers["paraphrase"]["contains_marker"])
            self.assertIn("07:40", answers["retained"]["answer"])
            self.assertIn("Lantern Hall", answers["shared"]["answer"])
            self.assertEqual("Which access phrase opens the observatory vault?", answers["source_only"]["question"])
            self.assertEqual(11, run["model_call_count"])

    def test_cold_and_warm_first_call_timings(self):
        first = {rid: next(e for e in self.runs[rid]["events"] if "duration_ms" in e)["duration_ms"]
                 for rid in ("cold", "warm")}
        self.assertEqual({"cold": 40407, "warm": 2278}, first)
        self.assertEqual((61325, 22078), (self.runs["cold"]["model_call_total_ms"], self.runs["warm"]["model_call_total_ms"]))

    def test_every_answer_event_is_joined_to_a_recorded_answer(self):
        for run in self.runs.values():
            keys = [e["answer_key"] for e in run["events"] if e["name"] == "answer.generated"]
            self.assertEqual(["seeded_conversation", *export.ANSWER_KEYS], keys)

    def test_labels_are_recorded_live_runs_only(self):
        self.assertIn("no inference", self.data["notice"])
        for run in self.runs.values():
            self.assertEqual(("recorded", "live", export.MODEL), (run["kind"], run["mode"], run["model"]))
            for answer in run["answers"].values():
                self.assertEqual(("live", export.MODEL), (answer["mode"], answer["provider"]))
        for page in ("index.html", "walkthrough.html"):
            with self.subTest(page=page):
                self.assertIn("Recorded local Gemma evaluation — no live inference", (SITE / page).read_text(encoding="utf-8"))
        # The walkthrough keeps a persistent label while its recorded stages are on screen.
        walkthrough = (SITE / "walkthrough.html").read_text(encoding="utf-8")
        self.assertRegex(walkthrough, r'class="record-bar"[^>]*>\s*<div[^>]*>\s*<span[^>]*></span>\s*<strong>Recorded evaluation · No live inference</strong>')

    def test_fixture_reports_are_refused(self):
        with self.assertRaisesRegex(export.EvidenceError, "mode must be live"):
            export.export_run({**export.RUNS[0], "file": "results/fixture.json"})

    def test_seed_legend_matches_the_seed_code(self):
        source = (ROOT / "ghostcache" / "app.py").read_text(encoding="utf-8")
        for doc_id, title in export.SEED_LEGEND["documents"].items():
            self.assertIn(f'("{doc_id}", "{title}"', source)


class InvalidEvidenceTests(unittest.TestCase):
    """Missing or malformed evidence fails with a message that names the file and the problem."""

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        (self.root / "results").mkdir()
        self.spec = {**export.RUNS[0], "file": "results/report.json"}
        self.good = json.loads((ROOT / export.RUNS[0]["file"]).read_text())

    def write(self, value):
        text = value if isinstance(value, str) else json.dumps(value)
        (self.root / "results" / "report.json").write_text(text)

    def assert_fails(self, pattern):
        with self.assertRaisesRegex(export.EvidenceError, r"results/report\.json: " + pattern):
            export.export_run(self.spec, self.root)

    def test_missing_file(self):
        self.assert_fails("evidence file not found")

    def test_invalid_json_and_wrong_shapes(self):
        self.write("{not json")
        self.assert_fails("not valid JSON")
        self.write([])
        self.assert_fails("report must be a JSON object")

    def test_missing_or_inconsistent_fields(self):
        broken = dict(self.good, stages={k: v for k, v in self.good["stages"].items() if k != "cleaned_audit"})
        self.write(broken)
        self.assert_fails("stages.cleaned_audit is missing")
        broken = json.loads(json.dumps(self.good))
        broken["stages"]["initial_audit"]["active_artifacts"] = 99
        self.write(broken)
        self.assert_fails("stages.initial_audit: active_ids does not match")
        broken = json.loads(json.dumps(self.good))
        broken["answers"]["secret"]["mode"] = "fixture"
        self.write(broken)
        self.assert_fails("answers.secret must be a live")
        broken = json.loads(json.dumps(self.good))
        del broken["answers"]["shared"]
        self.write(broken)
        self.assert_fails("answers must include")

    def test_cli_reports_the_failure(self):
        bad_runs = ({**export.RUNS[0], "file": "results/does-not-exist.json"},)
        stderr = io.StringIO()
        with patch.object(export, "RUNS", bad_runs), contextlib.redirect_stderr(stderr):
            self.assertEqual(1, export.main(["--check"]))
        self.assertIn("Evidence check failed: results/does-not-exist.json: evidence file not found", stderr.getvalue())


class PublicSafetyTests(unittest.TestCase):
    def test_public_data_has_no_private_or_service_strings(self):
        text = (SITE / "data" / "evidence.json").read_text(encoding="utf-8")
        self.assertIsNone(export.FORBIDDEN.search(text))
        for bad in ({"path": "/Users/someone/ghostcache/.local/assistant.sqlite"}, {"dsn": "https://k@o1.ingest.sentry.io/1"},
                    {"url": "http://127.0.0.1:11434/api/chat"}, {"who": "person@example.com"}):
            with self.subTest(bad=bad), self.assertRaises(export.EvidenceError):
                export.render(bad)

    def test_site_contains_only_the_intended_files(self):
        files = sorted(str(p.relative_to(SITE)) for p in SITE.rglob("*") if p.is_file())
        self.assertEqual(sorted(["data/evidence.json", "favicon.svg", "style.css", *PAGES, *SCRIPTS]), files)

    def test_local_assets_and_anchors_exist_and_external_links_are_allowlisted(self):
        pages = {page: parse(SITE / page) for page in PAGES}
        for page, parser in pages.items():
            self.assertTrue(parser.refs, page)
            for ref in parser.refs:
                with self.subTest(page=page, ref=ref):
                    if ref.startswith("http"):
                        self.assertTrue(ref.startswith(EXTERNAL), ref)
                        continue
                    self.assertFalse(ref.startswith("/"), "use relative paths so the site works anywhere")
                    path, _, anchor = ref.partition("#")
                    target = page if not path else "index.html" if path == "./" else path
                    self.assertTrue((SITE / target).is_file(), ref)
                    if anchor:
                        self.assertIn(anchor, pages[target].ids, f"{target} has no id {anchor!r}")

    def test_pages_share_navigation_and_landmarks(self):
        for page in PAGES:
            with self.subTest(page=page):
                parser = parse(SITE / page)
                html = (SITE / page).read_text(encoding="utf-8")
                self.assertEqual(1, parser.h1)
                self.assertIn('<html lang="en">', html)
                self.assertIn('href="#main"', html)
                self.assertIn("main", parser.ids)
                self.assertIn('<link rel="icon" href="favicon.svg"', html)
                for link in ("walkthrough.html", "method.html", "run.html", "https://github.com/bipul724/GhostCache"):
                    self.assertIn(link, parser.nav)
                self.assertEqual([] if page == "index.html" else [page], parser.current)

    def test_pages_are_compatible_with_the_content_security_policy(self):
        for path in [*(SITE / page for page in PAGES), ROOT / "web" / "index.html"]:
            with self.subTest(page=str(path.relative_to(ROOT))):
                self.assertEqual([], parse(path).blocked)

    def test_design_tokens_are_shared_with_the_local_lab(self):
        def shared(path):
            text = path.read_text(encoding="utf-8")
            match = re.search(r"/\* <gc-shared>.*?/\* </gc-shared> \*/", text, re.DOTALL)
            self.assertIsNotNone(match, path)
            return match.group(0)
        self.assertEqual(shared(SITE / "style.css"), shared(ROOT / "web" / "style.css"))

    def test_scripts_fetch_only_the_static_evidence(self):
        code = "\n".join(re.sub(r"//[^\n]*", "", (SITE / name).read_text(encoding="utf-8")) for name in SCRIPTS)
        self.assertEqual(["DATA_URL"], re.findall(r"fetch\(\s*([^,)\s]+)", code))
        self.assertIn('const DATA_URL = "data/evidence.json";', code)
        for forbidden in ("/api/", "11434", "localhost", "127.0.0.1", "XMLHttpRequest", "WebSocket",
                          "localStorage", "sessionStorage", "innerHTML", "eval("):
            self.assertNotIn(forbidden, code)

    def test_script_syntax(self):
        if NODE is None:
            self.skipTest("Node.js is not on PATH; the syntax check needs `node`.")
        for name in SCRIPTS:
            with self.subTest(script=name):
                result = subprocess.run([NODE, "--check", str(SITE / name)], capture_output=True, text=True, timeout=60)
                self.assertEqual(0, result.returncode, result.stderr)


class SiteBehaviourTests(unittest.TestCase):
    """Run site/site.js under node:vm with a fake DOM and the real exported evidence (tests/ui/site_contract.js)."""

    def run_case(self, case):
        if NODE is None:
            self.skipTest("Node.js is not on PATH; the site.js behaviour tests need `node`.")
        result = subprocess.run([NODE, str(ROOT / "tests" / "ui" / "site_contract.js"), case], cwd=ROOT,
                                capture_output=True, text=True, timeout=60)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_inspector_relationships_follow_the_stage(self):
        self.run_case("inspector_relationships_follow_the_stage")

    def test_timing_tooltip_stays_inside_the_chart(self):
        self.run_case("timing_tooltip_stays_inside_the_chart")

    def test_thread_ends_meet_their_knots(self):
        self.run_case("thread_ends_meet_their_knots")

    def test_timing_chart_contains_its_tooltip(self):
        # site.js measures the tooltip from the chart box, so the box must be its containing block.
        css = (SITE / "style.css").read_text(encoding="utf-8")
        rules = dict(re.findall(r"^(\.timing(?:__tip)?)\{([^}]*)\}", css, re.MULTILINE))
        self.assertIn("position:relative", rules[".timing"])
        self.assertIn("position:absolute", rules[".timing__tip"])


class RenderBlueprintTests(unittest.TestCase):
    def test_static_site_only(self):
        text = (ROOT / "render.yaml").read_text(encoding="utf-8")
        for line in ("type: web", "runtime: static", "staticPublishPath: ./site", "buildCommand:"):
            self.assertIn(line, text)
        for forbidden in ("startCommand", "plan:", "envVars", "databases:", "region:", "fromDatabase", "sync: false"):
            self.assertNotIn(forbidden, text)
        self.assertIn("connect-src 'self'", text)
        self.assertEqual(1, text.count("- type:"))


if __name__ == "__main__":
    unittest.main()
