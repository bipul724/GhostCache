import http.client
import io
import json
import sqlite3
import tempfile
import unittest
import urllib.error
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ghostcache.__main__ import make_handler
from ghostcache.app import Experiment, StorageError
from ghostcache.providers import OllamaProvider
from ghostcache.store import Store

SENTINEL = "SENTINEL-not-a-real-key-7f3a"

# Transport failures whose text carries the sentinel, with the category to report.
TRANSPORT_FAILURES = {
    "URLError": (lambda: urllib.error.URLError(SENTINEL), "transport error"),
    "URLError refused": (lambda: urllib.error.URLError(ConnectionRefusedError(61, SENTINEL)),
                         "connection failed"),
    "HTTPError": (lambda: urllib.error.HTTPError("http://127.0.0.1:11434/api/chat", 503, SENTINEL, {},
                                                 io.BytesIO(SENTINEL.encode())), "HTTP status 503"),
    "OSError": (lambda: OSError(SENTINEL), "transport error"),
    "TimeoutError": (lambda: TimeoutError(SENTINEL), "timed out"),
    "ConnectionRefusedError": (lambda: ConnectionRefusedError(61, SENTINEL), "connection failed"),
    "IncompleteRead": (lambda: http.client.IncompleteRead(SENTINEL.encode()), "invalid HTTP response"),
    "BadStatusLine": (lambda: http.client.BadStatusLine(SENTINEL), "invalid HTTP response"),
    "RemoteDisconnected": (lambda: http.client.RemoteDisconnected(SENTINEL), "connection failed"),
}


def failing_transport(factory):
    def urlopen(*_args, **_kwargs):
        raise factory()
    return patch("urllib.request.urlopen", side_effect=urlopen)


class SocketFixture:
    """Exercise the real HTTP handler without binding a network socket."""

    def __init__(self, incoming):
        self.incoming = io.BytesIO(incoming)
        self.outgoing = bytearray()

    def makefile(self, *_args):
        return self.incoming

    def sendall(self, data):
        self.outgoing.extend(data)


class HandlerCase(unittest.TestCase):
    """Drive the real handler for self.app through an in-memory socket."""

    def request(self, path, data=None, headers=None, raw_body=None):
        method = "POST" if data is not None or raw_body is not None else "GET"
        body = raw_body if raw_body is not None else (json.dumps(data).encode() if data is not None else b"")
        fields = {"Host": "127.0.0.1:8765", "Content-Type": "application/json",
                  "Content-Length": str(len(body)), **(headers or {})}
        raw = f"{method} {path} HTTP/1.1\r\n".encode()
        raw += "".join(f"{k}: {v}\r\n" for k, v in fields.items()).encode()
        request = SocketFixture(raw + b"\r\n" + body)
        self.handler(request, ("127.0.0.1", 12345), SimpleNamespace())
        head, response = bytes(request.outgoing).split(b"\r\n\r\n", 1)
        return int(head.split(b" ")[1]), head, response


class HTTPTests(HandlerCase):
    def setUp(self):
        self.status = patch.object(OllamaProvider, "status", return_value={
            "available": False, "model": "offline", "message": "offline"})
        self.status.start()
        self.app = Experiment()
        self.app.reset()
        self.handler = make_handler(self.app)
        self.handler.log_message = lambda *_args: None

    def tearDown(self):
        self.app.close()
        self.status.stop()

    def test_state_and_static_assets_have_no_store_headers(self):
        status, headers, body = self.request("/api/state")
        self.assertEqual(200, status)
        self.assertIn(b"Cache-Control: no-store", headers)
        self.assertEqual("fixture", json.loads(body)["mode"])
        status, headers, body = self.request("/")
        self.assertEqual(200, status)
        self.assertIn(b"frame-ancestors 'none'", headers)
        self.assertIn(b"GhostCache", body)

    def test_api_workflow_exposes_failure_then_passes_cleanup(self):
        status, _, body = self.request("/api/delete", {"mode": "source_only"})
        self.assertEqual(200, status)
        self.assertGreater(json.loads(body)["audit"]["matched_canary"], 0)
        status, _, body = self.request("/api/verify", {})
        self.assertEqual(200, status)
        self.assertFalse(json.loads(body)["passed"])
        status, _, body = self.request("/api/delete", {"mode": "cascade"})
        self.assertEqual(200, status)
        self.assertEqual(0, json.loads(body)["audit"]["matched_canary"])
        status, _, body = self.request("/api/verify", {})
        self.assertTrue(json.loads(body)["passed"])

    def test_cross_origin_and_dns_rebinding_requests_do_not_mutate(self):
        for headers in ({"Origin": "https://example.com"}, {"Host": "example.com"},
                        {"Origin": "http://127.0.0.1:9999"}):
            status, _, _ = self.request("/api/delete", {"mode": "cascade"}, headers)
            self.assertEqual(403, status)
        self.assertEqual("active", self.app.store.get_artifact("d-vault")["status"])

    def test_bad_requests_are_rejected_without_a_traceback(self):
        self.assertEqual(400, self.request("/api/reset", {"mode": "unknown"})[0])
        self.assertEqual(400, self.request("/api/ask", {"question": {}})[0])
        self.assertEqual(400, self.request("/api/ask", raw_body=b"{bad")[0])
        self.assertEqual(415, self.request("/api/reset", {}, {"Content-Type": "text/plain"})[0])
        self.assertEqual(404, self.request("/../ghostcache/app.py")[0])

    def test_malformed_live_output_is_a_502_without_fixture_fallback(self):
        self.app.provider = OllamaProvider("mock-model")
        before = self.app.store.list_artifacts()
        content = json.dumps({"message": {"content": "[]"}}).encode()
        with patch("urllib.request.urlopen", side_effect=lambda *_a, **_k: io.BytesIO(content)):
            status, _, body = self.request("/api/ask", {"question": "What is the observatory vault passphrase?"})
        error = json.loads(body)
        self.assertEqual(502, status)
        self.assertEqual("live", error["mode"])
        self.assertIn("must be a JSON object", error["error"])
        self.assertNotIn(self.app.scenario["canary"], body.decode())
        self.assertEqual(before, self.app.store.list_artifacts())

    def test_missing_live_model_is_an_error_not_a_successful_fixture_reset(self):
        status, _, body = self.request("/api/reset", {"mode": "live"})
        self.assertEqual(502, status)
        self.assertIn("offline", json.loads(body)["error"])


class TransportHTTPTests(HandlerCase):
    """Provider transport failures reach HTTP clients only as fixed categories."""

    def setUp(self):
        with patch.object(OllamaProvider, "status", return_value={
                "available": False, "model": "offline", "message": "offline"}):
            self.app = Experiment()
            self.app.reset()
        self.addCleanup(self.app.close)
        self.handler = make_handler(self.app)
        self.handler.log_message = lambda *_args: None

    def test_state_reset_and_ask_never_echo_transport_text(self):
        question = {"question": "What is the observatory vault passphrase?"}
        for name, (factory, category) in TRANSPORT_FAILURES.items():
            with self.subTest(name):
                with failing_transport(factory):
                    state_status, _, state = self.request("/api/state")
                    reset_status, _, reset = self.request("/api/reset", {"mode": "live"})
                    fixture, self.app.provider = self.app.provider, OllamaProvider("mock-model")
                    try:
                        ask_status, _, ask = self.request("/api/ask", question)
                    finally:
                        self.app.provider = fixture
                self.assertEqual((200, 502, 502), (state_status, reset_status, ask_status))
                provider = json.loads(state)["provider"]
                self.assertFalse(provider["available"])
                self.assertIn(f"({category})", provider["message"])
                self.assertIn(f"({category})", json.loads(reset)["error"])
                self.assertIn(f"({category}). No fixture fallback was used.", json.loads(ask)["error"])
                self.assertEqual("seeded", self.app.stage)
                for body in (state, reset, ask):
                    self.assertNotIn(SENTINEL, body.decode())

    def test_incomplete_body_read_during_ask_is_a_502(self):
        class IncompleteResponse(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *_exc):
                self.close()

            def read(self, *_args):
                raise http.client.IncompleteRead(SENTINEL.encode(), 512)

        self.app.provider = OllamaProvider("mock-model")
        before = self.app.store.list_artifacts()
        with patch("urllib.request.urlopen", side_effect=lambda *_a, **_k: IncompleteResponse()):
            status, _, body = self.request("/api/ask", {"question": "When does the roof garden open?"})
        self.assertEqual(502, status)
        self.assertIn("(invalid HTTP response)", json.loads(body)["error"])
        self.assertNotIn(SENTINEL, body.decode())
        self.assertEqual(before, self.app.store.list_artifacts())


class StorageFailureHTTPTests(HandlerCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / "demo.sqlite"
        status = patch.object(OllamaProvider, "status", return_value={
            "available": False, "model": "offline", "message": "offline"})
        status.start()
        self.addCleanup(status.stop)
        self.app = Experiment(self.path)
        self.addCleanup(self.app.close)
        self.handler = make_handler(self.app)
        self.handler.log_message = lambda *_args: None

    def test_unrestorable_storage_is_a_503_and_the_next_reset_recovers(self):
        self.assertEqual(200, self.request("/api/reset", {"mode": "fixture"})[0])
        old_canary = self.app.scenario["canary"]
        failure = sqlite3.OperationalError(SENTINEL)
        with patch.object(Store, "replace_contents", side_effect=failure), \
                patch.object(Store, "check_writable", side_effect=failure):
            status, _, body = self.request("/api/reset", {"mode": "fixture"})
        self.assertEqual(503, status)
        self.assertEqual({"error": StorageError.MESSAGE}, json.loads(body))
        self.assertEqual("storage_failed", json.loads(self.request("/api/state")[2])["stage"])
        for path, data in (("/api/ask", {"question": "When does the roof garden open?"}),
                           ("/api/delete", {"mode": "cascade"}), ("/api/verify", {})):
            status, _, body = self.request(path, data)
            self.assertEqual((400, StorageError.MESSAGE), (status, json.loads(body)["error"]))
        status, _, body = self.request("/api/reset", {"mode": "fixture"})
        self.assertEqual((200, "seeded"), (status, json.loads(body)["stage"]))
        canary = json.loads(body)["scenario"]["canary"]
        on_disk = Store(self.path)
        try:
            self.assertEqual((6, 0), (on_disk.audit(canary)["matched_canary"],
                                      on_disk.audit(old_canary)["matched_canary"]))
        finally:
            on_disk.close()


if __name__ == "__main__":
    unittest.main()
