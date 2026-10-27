import contextlib
import http.client
import io
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from ghostcache.__main__ import main
from ghostcache.providers import OllamaProvider, ProviderError


MARK = "MOTH-0123456789AB"
CONTEXT = [{"id": "c-a", "body": f"The passphrase is {MARK}."}, {"id": "c-b", "body": "Garden opens 07:40."}]


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        self.close()


def transport(raw: bytes):
    """Mock Ollama transport: every call returns these exact bytes."""
    return patch("urllib.request.urlopen", side_effect=lambda *_a, **_k: Response(raw))


def chat(content, **extra) -> bytes:
    return json.dumps({"message": {"role": "assistant", "content": content}, **extra}).encode()


SENTINEL = "SENTINEL-not-a-real-key-7f3a"


def http_error(code):
    return urllib.error.HTTPError("http://127.0.0.1:11434/api/chat", code, SENTINEL,
                                  {"X-Echo": SENTINEL}, io.BytesIO(SENTINEL.encode()))


# Transport failures whose text carries the sentinel, with the category to report.
TRANSPORT_FAILURES = {
    "URLError": (lambda: urllib.error.URLError(SENTINEL), "transport error"),
    "URLError refused": (lambda: urllib.error.URLError(ConnectionRefusedError(61, SENTINEL)),
                         "connection failed"),
    "URLError timeout": (lambda: urllib.error.URLError(TimeoutError(SENTINEL)), "timed out"),
    "HTTPError": (lambda: http_error(500), "HTTP status 500"),
    "HTTPError invalid code": (lambda: http_error(SENTINEL), "HTTP error"),
    "OSError": (lambda: OSError(SENTINEL), "transport error"),
    "TimeoutError": (lambda: TimeoutError(SENTINEL), "timed out"),
    "ConnectionRefusedError": (lambda: ConnectionRefusedError(61, SENTINEL), "connection failed"),
    "IncompleteRead": (lambda: http.client.IncompleteRead(SENTINEL.encode()), "invalid HTTP response"),
    "BadStatusLine": (lambda: http.client.BadStatusLine(SENTINEL), "invalid HTTP response"),
    # Both a ConnectionResetError and a BadStatusLine; the connection check comes first.
    "RemoteDisconnected": (lambda: http.client.RemoteDisconnected(SENTINEL), "connection failed"),
}


def failing_transport(factory):
    def urlopen(*_args, **_kwargs):
        raise factory()
    return patch("urllib.request.urlopen", side_effect=urlopen)


class IncompleteResponse(Response):
    """A response whose body read fails partway, inside json.load."""

    def read(self, *_args):
        raise http.client.IncompleteRead(SENTINEL.encode(), 512)


def incomplete_transport():
    return patch("urllib.request.urlopen", side_effect=lambda *_a, **_k: IncompleteResponse())


def offline_cli(argv):
    """Run main() with the network patched; return (code, stdout, stderr)."""
    stdout, stderr = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = main(argv)
    return code, stdout.getvalue(), stderr.getvalue()


class OllamaResponseTests(unittest.TestCase):
    def setUp(self):
        self.provider = OllamaProvider("mock-model")

    def assert_rejected(self, raw: bytes):
        with transport(raw), self.assertRaises(ProviderError) as caught:
            self.provider.answer(f"What is {MARK}?", CONTEXT)
        message = str(caught.exception)
        # Errors name the structural problem; they never echo model output or markers.
        self.assertNotIn(MARK, message)
        self.assertIn("No fixture fallback was used.", message)

    def test_non_object_outer_responses_raise_provider_error(self):
        for raw in (b"[]", json.dumps(MARK).encode(), b"null", b"7", b"not json", b"\xff\xfe"):
            with self.subTest(raw=raw):
                self.assert_rejected(raw)

    def test_missing_or_invalid_message_structure_raises_provider_error(self):
        for outer in ({}, {"error": "model crashed"}, {"message": None}, {"message": MARK},
                      {"message": {}}, {"message": {"content": None}},
                      {"message": {"content": {"text": MARK, "citations": []}}}):
            with self.subTest(outer=outer):
                self.assert_rejected(json.dumps(outer).encode())

    def test_content_that_is_not_a_json_object_raises_provider_error(self):
        for content in ("", "{not json", "[]", json.dumps(MARK), "null", "42", "true"):
            with self.subTest(content=content):
                self.assert_rejected(chat(content))

    def test_invalid_answer_fields_and_unknown_citations_raise_provider_error(self):
        for parsed in ({"citations": []}, {"text": "", "citations": []}, {"text": "   ", "citations": []},
                       {"text": 5, "citations": []}, {"text": MARK},
                       {"text": MARK, "citations": "c-a"}, {"text": MARK, "citations": [1]},
                       {"text": MARK, "citations": ["c-a", "c-unknown"]}):
            with self.subTest(parsed=parsed):
                self.assert_rejected(chat(json.dumps(parsed)))

    def test_valid_response_still_succeeds(self):
        content = json.dumps({"text": f"It is {MARK}.", "citations": ["c-a", "c-a"]})
        with transport(chat(content, prompt_eval_count=12, eval_count=5)):
            result = self.provider.answer("What is the passphrase?", CONTEXT)
        self.assertEqual(f"It is {MARK}.", result["text"])
        self.assertEqual(["c-a"], result["citations"])
        self.assertEqual(("live", "mock-model", 12, 5),
                         (result["mode"], result["provider"], result["input_tokens"], result["output_tokens"]))
        # Malformed token counts are dropped, not trusted.
        with transport(chat(content, prompt_eval_count="12", eval_count=True)):
            result = self.provider.summarize(CONTEXT)
        self.assertEqual((None, None), (result["input_tokens"], result["output_tokens"]))

    def test_transport_failures_raise_provider_error(self):
        for error in (urllib.error.URLError("connection refused"), TimeoutError("timed out")):
            with self.subTest(error=error), patch("urllib.request.urlopen", side_effect=error):
                with self.assertRaises(ProviderError):
                    self.provider.answer("question", CONTEXT)

    def test_malformed_model_list_reports_live_mode_unavailable(self):
        for payload in ([], {"models": "mock-model"}, {"models": [{"name": 5}, "mock-model"]}):
            with self.subTest(payload=payload), transport(json.dumps(payload).encode()):
                status = self.provider.status()
            self.assertFalse(status["available"])


class TransportErrorTests(unittest.TestCase):
    """Transport failures report a fixed category and never echo their text."""

    def setUp(self):
        self.provider = OllamaProvider("mock-model")

    def assert_clean(self, text, category):
        self.assertNotIn(SENTINEL, text)
        self.assertIn(f"({category})", text)

    def test_generation_and_status_report_only_a_category(self):
        for name, (factory, category) in TRANSPORT_FAILURES.items():
            with self.subTest(name), failing_transport(factory):
                with self.assertRaises(ProviderError) as caught:
                    self.provider.answer(f"What is {MARK}?", CONTEXT)
                message = str(caught.exception)
                self.assert_clean(message, category)
                self.assertNotIn(MARK, message)
                self.assertTrue(message.endswith("No fixture fallback was used."))
                status = self.provider.status()
                self.assertFalse(status["available"])
                self.assert_clean(status["message"], category)
                self.assertEqual(f"Ollama is unavailable ({category}). Fixture mode still works.",
                                 status["message"])

    def test_cli_evaluate_and_serve_failures_print_only_a_category(self):
        for name, (factory, category) in TRANSPORT_FAILURES.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / "report.json"
                with patch.object(OllamaProvider, "status", return_value={
                        "available": True, "model": "mock-model", "message": "ok"}), \
                        failing_transport(factory):
                    code, stdout, _ = offline_cli(["evaluate", "--mode", "live", "--model", "mock-model",
                                                   "--output", str(output)])
                self.assertEqual(1, code)
                report = output.read_text()
                self.assertFalse(json.loads(report)["passed"])
                self.assert_clean(report, category)
                self.assert_clean(stdout, category)
                database = Path(directory) / "serve.sqlite"
                with failing_transport(factory):
                    code, stdout, stderr = offline_cli(["serve", "--mode", "live", "--database", str(database)])
                self.assertEqual(1, code)
                self.assert_clean(stderr, category)
                self.assertNotIn(SENTINEL, stdout)
                self.assertFalse(database.exists())

    def test_incomplete_body_read_is_a_provider_failure(self):
        with incomplete_transport(), self.assertRaises(ProviderError) as caught:
            self.provider.summarize(CONTEXT)
        self.assert_clean(str(caught.exception), "invalid HTTP response")
        with incomplete_transport():
            status = self.provider.status()
        self.assertFalse(status["available"])
        self.assert_clean(status["message"], "invalid HTTP response")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.json"
            with patch.object(OllamaProvider, "status", return_value={
                    "available": True, "model": "mock-model", "message": "ok"}), incomplete_transport():
                code, stdout, _ = offline_cli(["evaluate", "--mode", "live", "--model", "mock-model",
                                               "--output", str(output)])
            report = json.loads(output.read_text())
        self.assertEqual((1, False), (code, report["passed"]))
        self.assert_clean(report["error"], "invalid HTTP response")
        self.assertNotIn(SENTINEL, stdout)

    def test_non_transport_defects_still_propagate(self):
        with patch("urllib.request.urlopen", side_effect=RuntimeError("defect")):
            with self.assertRaises(RuntimeError):
                self.provider.answer("question", CONTEXT)
            with self.assertRaises(RuntimeError):
                self.provider.status()


class EvaluateCommandTests(unittest.TestCase):
    def test_malformed_model_output_exits_1_with_failed_report(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "nested" / "report.json"
            stdout = io.StringIO()
            with patch.object(OllamaProvider, "status", return_value={
                    "available": True, "model": "mock-model", "message": "ok"}), \
                    transport(chat("[]")), contextlib.redirect_stdout(stdout):
                code = main(["evaluate", "--mode", "live", "--model", "mock-model", "--output", str(output)])
            report = json.loads(output.read_text())
        self.assertEqual(1, code)
        self.assertFalse(report["passed"])
        self.assertEqual("live", report["mode"])
        self.assertIn("must be a JSON object", report["error"])
        self.assertIn("No silent switch to fixture mode.", report["note"])
        self.assertFalse(json.loads(stdout.getvalue())["passed"])


if __name__ == "__main__":
    unittest.main()
