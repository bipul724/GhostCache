import contextlib
import io
import json
import os
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ghostcache.__main__ import make_handler
from ghostcache.app import Experiment, QUESTIONS
from ghostcache.providers import OllamaProvider
from ghostcache.store import Store


ROOT = Path(__file__).resolve().parent.parent
HARNESS = ROOT / "tests" / "ui" / "app_contract.js"
NODE = shutil.which("node")


class NodeCase(unittest.TestCase):
    """Run web/app.js under node:vm with a fake DOM and fetch; no browser or server."""

    def run_case(self, case, states=None):
        if NODE is None:
            self.skipTest("Node.js is not on PATH; the web/app.js contract tests need `node`.")
        # GHOSTCACHE_APP_JS runs the same cases against another copy of web/app.js (for comparisons).
        command = [NODE, str(HARNESS), case, *filter(None, [os.environ.get("GHOSTCACHE_APP_JS")])]
        env = dict(os.environ)
        if states is not None:
            directory = tempfile.TemporaryDirectory()
            self.addCleanup(directory.cleanup)
            env["GHOSTCACHE_STATES"] = str(Path(directory.name) / "states.json")
            Path(env["GHOSTCACHE_STATES"]).write_text(json.dumps(states))
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60, env=env)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)


class UIContractTests(NodeCase):
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

    def test_graph_kinds_lineage_and_tombstones(self):
        self.run_case("graph_kinds_lineage_and_tombstones")

    def test_list_view_alternative(self):
        self.run_case("list_view_alternative")

    def test_storage_failed_state(self):
        self.run_case("storage_failed_state")

    def test_rebuild_failure_is_reported(self):
        self.run_case("rebuild_failure_is_reported")

    def test_rebuild_failure_survives_reload(self):
        self.run_case("rebuild_failure_survives_reload")

    def test_rebuild_warning_survives_thirteen_verifications(self):
        self.run_case("rebuild_warning_survives_thirteen_verifications")

    def test_rebuild_outcome_follows_server_state(self):
        self.run_case("rebuild_outcome_follows_server_state")

    def test_storage_failure_discards_the_rebuild_warning(self):
        self.run_case("storage_failure_discards_the_rebuild_warning")

    def test_thread_ends_meet_their_knots(self):
        self.run_case("thread_ends_meet_their_knots")

    def test_unavailable_model_and_marker_labels(self):
        self.run_case("unavailable_model_and_marker_labels")

    def test_failed_reconciliation_keeps_the_original_error(self):
        self.run_case("failed_reconciliation_keeps_the_original_error")

    def test_unchanged_state_after_a_failed_deletion_keeps_results(self):
        self.run_case("unchanged_state_after_a_failed_deletion_keeps_results")

    def test_failed_question_does_not_read_state(self):
        self.run_case("failed_question_does_not_read_state")

    def test_failed_mode_switch_keeps_the_confirmed_mode(self):
        self.run_case("failed_mode_switch_keeps_the_confirmed_mode")

    def test_successful_mode_switch(self):
        self.run_case("successful_mode_switch")

    def test_paraphrase_fallback_matches_backend_question(self):
        # The no-state fallback in app.js must stay the controller's own paraphrase.
        self.assertIn(f"paraphrase:{json.dumps(QUESTIONS['paraphrase'])}",
                      (ROOT / "web" / "app.js").read_text())


class _Socket:
    """An in-memory socket for the real HTTP handler; no port is bound."""

    def __init__(self, raw):
        self.incoming, self.outgoing = io.BytesIO(raw), bytearray()

    def makefile(self, *_args):
        return self.incoming

    def sendall(self, data):
        self.outgoing.extend(data)


class CleanupFailureReconciliationTests(NodeCase):
    """A cleanup whose purge committed before storing the rebuilt summary failed (simulated by
    patching Store.add_artifact; no model): the real controller and HTTP handler produce the
    states and the error response, and the real web/app.js must show the server's state."""

    def call(self, path, data=None):
        body = json.dumps(data).encode() if data is not None else b""
        head = (f"{'POST' if data is not None else 'GET'} {path} HTTP/1.1\r\nHost: 127.0.0.1:8765\r\n"
                f"Content-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n")
        socket = _Socket(head.encode() + body)
        with contextlib.redirect_stderr(io.StringIO()):  # the handler logs only the class name
            self.handler(socket, ("127.0.0.1", 12345), SimpleNamespace())
        status, payload = bytes(socket.outgoing).split(b"\r\n\r\n", 1)
        return int(status.split(b" ")[1]), json.loads(payload)

    def failed_cleanup(self, error):
        with patch.object(OllamaProvider, "status", return_value={"available": False, "model": "offline", "message": "offline"}):
            app = Experiment()
            self.addCleanup(app.close)
            app.reset()
            self.handler = make_handler(app)
            self.handler.log_message = lambda *_args: None
            self.assertEqual(200, self.call("/api/delete", {"mode": "source_only"})[0])
            status, before = self.call("/api/state")
            summarize = patch.object(app.provider, "summarize", wraps=app.provider.summarize)
            with summarize as model, patch.object(Store, "add_artifact", side_effect=error):
                status, reply = self.call("/api/delete", {"mode": "cascade"})
            self.assertEqual(1, model.call_count, "one rebuild attempt, not retried")
            _, after = self.call("/api/state")
        # The purge stayed committed and the outcome names only a fixed category.
        self.assertEqual(("source_only", "cleaned"), (before["stage"], after["stage"]))
        self.assertGreater(before["audit"]["stale_descendants"], 0)
        self.assertEqual((0, 0), (after["audit"]["matched_canary"], after["audit"]["stale_descendants"]))
        self.assertEqual({"status": "failed", "parent_ids": after["rebuild"]["parent_ids"], "error_category": "not_stored"},
                         after["rebuild"])
        self.assertNotIn("SENTINEL", json.dumps(after))
        return {"before": before, "after": after, "status": status, "reply": reply}

    def test_save_failure_after_purge_is_a_500_and_the_lab_shows_the_server_state(self):
        states = self.failed_cleanup(sqlite3.OperationalError("SENTINEL injected save failure"))
        self.assertEqual((500, {"error": "Unexpected server error; inspect the local tests."}),
                         (states["status"], states["reply"]))
        self.run_case("cleanup_failure_reconciles_with_server_state", states)

    def test_validation_failure_after_purge_is_a_400_and_the_lab_shows_the_server_state(self):
        states = self.failed_cleanup(ValueError("Cannot derive from inactive parent: d-garden"))
        self.assertEqual((400, {"error": "Cannot derive from inactive parent: d-garden"}),
                         (states["status"], states["reply"]))
        self.run_case("cleanup_failure_reconciles_with_server_state", states)


if __name__ == "__main__":
    unittest.main()
