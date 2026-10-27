import json
import shutil
import subprocess
import unittest
from pathlib import Path

from ghostcache.app import QUESTIONS


ROOT = Path(__file__).resolve().parent.parent
HARNESS = ROOT / "tests" / "ui" / "app_contract.js"
NODE = shutil.which("node")


class UIContractTests(unittest.TestCase):
    """Run web/app.js under node:vm with a fake DOM and fetch; no browser or server."""

    def run_case(self, case):
        if NODE is None:
            self.skipTest("Node.js is not on PATH; the web/app.js contract tests need `node`.")
        result = subprocess.run([NODE, str(HARNESS), case], cwd=ROOT, capture_output=True,
                                text=True, timeout=60)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_context_from_parent_ids(self):
        self.run_case("context_from_parent_ids")

    def test_context_empty_and_missing(self):
        self.run_case("context_empty_and_missing")

    def test_echo_sends_paraphrase(self):
        self.run_case("echo_sends_paraphrase")

    def test_fixture_banner_wording(self):
        self.run_case("fixture_banner_wording")

    def test_live_mode_label(self):
        self.run_case("live_mode_label")

    def test_reset_and_delete_clear_stale_display(self):
        self.run_case("reset_and_delete_clear_stale_display")

    def test_paraphrase_fallback_matches_backend_question(self):
        # The no-state fallback in app.js must stay the controller's own paraphrase.
        self.assertIn(f"paraphrase:{json.dumps(QUESTIONS['paraphrase'])}",
                      (ROOT / "web" / "app.js").read_text())


if __name__ == "__main__":
    unittest.main()
