import contextlib
import importlib.util
import io
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import textwrap
import unittest
import urllib.error
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ghostcache import telemetry
from ghostcache.__main__ import main, make_handler
from ghostcache.app import QUESTIONS, Experiment
from ghostcache.providers import OllamaProvider, ProviderError


ROOT = Path(__file__).resolve().parent.parent
DSN = "https://public@example.invalid/1"
HAVE_SDK = importlib.util.find_spec("sentry_sdk") is not None  # does not import it
SENTINEL = "SENTINEL-not-a-real-key-7f3a"
OFFLINE = {"available": False, "model": "offline", "message": "offline"}
FORBIDDEN_KEYS = ("gen_ai.input.messages", "gen_ai.output.messages", "gen_ai.system_instructions",
                  "gen_ai.memory.query.text", "gen_ai.memory.records")


def offline_cli(argv):
    """Run main() offline; return (code, stdout, stderr)."""
    stdout, stderr = io.StringIO(), io.StringIO()
    with patch.object(OllamaProvider, "status", return_value=OFFLINE), \
            contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = main(argv)
    return code, stdout.getvalue(), stderr.getvalue()


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        self.close()


def transport(raw: bytes):
    """Mock Ollama transport: every call returns these exact bytes."""
    return patch("urllib.request.urlopen", side_effect=lambda *_a, **_k: Response(raw))


def failing_transport(factory):
    def urlopen(*_args, **_kwargs):
        raise factory()
    return patch("urllib.request.urlopen", side_effect=urlopen)


def chat(content, **extra) -> bytes:
    return json.dumps({"message": {"role": "assistant", "content": content}, **extra}).encode()


def capturing_transport(fail=False):
    from sentry_sdk.transport import Transport

    class Capture(Transport):
        """Keep every envelope in memory; nothing leaves the process."""

        def __init__(self):
            super().__init__()
            self.envelopes, self.calls = [], 0

        def capture_envelope(self, envelope):
            self.calls += 1
            if fail:
                raise RuntimeError("exporter down")
            self.envelopes.append(envelope)

    return Capture()


def post(app, path, data):
    """Drive the real HTTP handler through an in-memory socket; return (status, body)."""
    body = json.dumps(data).encode()
    raw = (f"POST {path} HTTP/1.1\r\nHost: 127.0.0.1:8765\r\nContent-Type: application/json\r\n"
           f"Content-Length: {len(body)}\r\n\r\n").encode() + body
    sock = SimpleNamespace(incoming=io.BytesIO(raw), outgoing=bytearray())
    sock.makefile = lambda *_args: sock.incoming
    sock.sendall = sock.outgoing.extend
    handler = make_handler(app)
    handler.log_message = lambda *_args: None
    handler(sock, ("127.0.0.1", 12345), SimpleNamespace())
    head, response = bytes(sock.outgoing).split(b"\r\n\r\n", 1)
    return int(head.split(b" ")[1]), json.loads(response)


def normalized(value):
    """Drop wall-clock fields and random artifact IDs so two runs of one case compare equal.

    context_fingerprint hashes artifact IDs, which include random conversation IDs.
    """
    if isinstance(value, dict):
        return {k: normalized(v) for k, v in value.items()
                if k not in {"time", "duration_ms", "context_fingerprint"}}
    if isinstance(value, (list, tuple)):
        return [normalized(v) for v in value]
    if isinstance(value, str):
        return re.sub(r"[0-9a-f]{32}", "<uuid>", value)
    return value


class DisabledTelemetryTests(unittest.TestCase):
    def test_disabled_by_default_never_imports_the_sdk_or_changes_the_report(self):
        script = textwrap.dedent("""
            import contextlib, io, json, sys, tempfile
            from pathlib import Path
            from unittest.mock import patch
            from ghostcache import telemetry
            from ghostcache.__main__ import main
            from ghostcache.providers import OllamaProvider
            enabled = telemetry.init("fixture")
            with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()), \\
                    patch.object(OllamaProvider, "status", return_value={
                        "available": False, "model": "offline", "message": "offline"}):
                code = main(["evaluate", "--output", f"{directory}/report.json"])
                report = json.loads(Path(f"{directory}/report.json").read_text())
            print(json.dumps({"enabled": enabled, "code": code, "loaded": "sentry_sdk" in sys.modules,
                              "keys": sorted(report), "checks": [c["name"] for c in report["checks"]]}))
        """)
        env = {k: v for k, v in os.environ.items() if k != telemetry.DSN_VARIABLE}
        result = subprocess.run([sys.executable, "-c", script], cwd=ROOT, env=env,
                                capture_output=True, text=True, timeout=60)
        self.assertEqual(0, result.returncode, result.stderr)
        outcome = json.loads(result.stdout.strip().splitlines()[-1])
        saved = json.loads((ROOT / "results" / "fixture.json").read_text())
        self.assertEqual((False, 0, False), (outcome["enabled"], outcome["code"], outcome["loaded"]))
        self.assertEqual(sorted(saved), outcome["keys"])
        self.assertEqual([c["name"] for c in saved["checks"]], outcome["checks"])
        self.assertNotIn("Sentry", result.stderr)

    def test_missing_sdk_exits_1_with_a_fixed_message_and_never_prints_the_dsn(self):
        dsn = f"https://{SENTINEL}@example.invalid/1"
        with tempfile.TemporaryDirectory() as directory, \
                patch.dict(os.environ, {telemetry.DSN_VARIABLE: dsn}), \
                patch.dict(sys.modules, {"sentry_sdk": None}), patch.object(telemetry, "_sdk", None), \
                patch("ghostcache.__main__.ThreadingHTTPServer",
                      side_effect=AssertionError("serve must stop before binding a port")):
            output = Path(directory) / "report.json"
            database = Path(directory) / "serve.sqlite"
            for argv in (["evaluate", "--output", str(output)], ["serve", "--database", str(database)]):
                with self.subTest(argv[0]):
                    code, stdout, stderr = offline_cli(argv)
                    self.assertEqual(1, code)
                    self.assertEqual(telemetry.MISSING_SDK + "\n", stderr)
                    self.assertNotIn(SENTINEL, stdout + stderr)
            self.assertFalse(output.exists())
            self.assertFalse(database.exists())

    def test_allowlist_rejects_unknown_keys_and_non_scalar_values(self):
        recorded = {}
        span = SimpleNamespace(set_data=recorded.__setitem__)
        for key in ("question", "ghostcache.answer", *FORBIDDEN_KEYS):
            with self.subTest(key), self.assertRaises(ValueError):
                telemetry.set(span, key, "x")
            self.assertNotIn(key, telemetry.ALLOWED_KEYS)
        for value in ({"id": "c-vault"}, ["c-vault"], ("c-vault",), b"c-vault"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                telemetry.set(span, "ghostcache.context_ids", value)
        telemetry.set(span, "ghostcache.context_ids", json.dumps(["d-vault", "c-vault"]))
        telemetry.set(span, "gen_ai.usage.input_tokens", None)
        telemetry.set(None, "ghostcache.mode", "fixture")  # disabled: validated, then ignored
        self.assertEqual({"ghostcache.context_ids": '["d-vault", "c-vault"]'}, recorded)
        with telemetry.span("ghostcache.verify", "verify deletion", {"ghostcache.checks_total": 8}) as current:
            self.assertIsNone(current)


@unittest.skipUnless(HAVE_SDK, "sentry-sdk not installed; optional extra")
class TracedCase(unittest.TestCase):
    fail_transport = False

    def setUp(self):
        self.patches = [patch.dict(os.environ, {telemetry.DSN_VARIABLE: DSN}),
                        patch.object(OllamaProvider, "status", return_value=OFFLINE)]
        for p in self.patches:
            p.start()
        self.transport = capturing_transport(fail=self.fail_transport)
        self.assertTrue(telemetry.init("fixture", transport=self.transport))

    def tearDown(self):
        telemetry.shutdown()
        for p in reversed(self.patches):
            p.stop()

    def raw(self) -> bytes:
        return b"".join(envelope.serialize() for envelope in self.transport.envelopes)

    def spans(self, envelopes=None):
        """Every captured span, from transaction events and standalone span items."""
        found = []
        for envelope in envelopes if envelopes is not None else self.transport.envelopes:
            for item in envelope.items:
                payload = item.payload.json
                if item.type == "transaction":
                    trace = payload["contexts"]["trace"]
                    found.append({"op": trace["op"], "name": payload["transaction"], "id": trace["span_id"],
                                  "parent": None, "data": trace.get("data", {}), "status": trace.get("status")})
                    found += [{"op": s["op"], "name": s["description"], "id": s["span_id"],
                               "parent": s.get("parent_span_id"), "data": s.get("data", {}),
                               "status": s.get("status")} for s in payload["spans"]]
                elif item.type == "span":
                    for s in payload["items"]:
                        data = {k: v["value"] for k, v in s.get("attributes", {}).items()}
                        found.append({"op": data.get("sentry.op"), "name": s["name"], "id": s["span_id"],
                                      "parent": s.get("parent_span_id"), "data": data, "status": s.get("status")})
        return found

    def assert_private(self, forbidden):
        raw = self.raw()
        self.assertTrue(raw)
        for text in {*forbidden, "MOTH-", *QUESTIONS.values(), socket.gethostname(),
                     str(Path.home()), "127.0.0.1:11434"}:
            if text:
                self.assertNotIn(text.encode(), raw, text)
                self.assertNotIn(json.dumps(text)[1:-1].encode(), raw, text)

    def traced_evaluation(self):
        """Run `evaluate` through the CLI; return (code, report, seeded artifacts)."""
        seeded, seed = [], Experiment._seed

        def recording_seed(experiment):
            seed(experiment)
            seeded.extend(experiment.store.list_artifacts())

        with tempfile.TemporaryDirectory() as directory, patch.object(Experiment, "_seed", recording_seed):
            output = Path(directory) / "report.json"
            code, _stdout, stderr = offline_cli(["evaluate", "--output", str(output)])
            report = json.loads(output.read_text())
        self.assertIn(telemetry.ENABLED_MESSAGE, stderr)
        self.assertNotIn("example.invalid", stderr)
        return code, report, seeded


class TracedEvaluationTests(TracedCase):
    def test_fixture_evaluation_emits_agent_memory_reset_and_verify_spans(self):
        code, report, _seeded = self.traced_evaluation()
        self.assertEqual((0, True), (code, report["passed"]))
        spans = self.spans()
        root = [s for s in spans if s["parent"] is None]
        self.assertEqual([("ghostcache.evaluate", "evaluate fixture")], [(s["op"], s["name"]) for s in root])
        ops = {s["op"] for s in spans}
        self.assertLessEqual({"gen_ai.invoke_agent", "gen_ai.chat", "gen_ai.memory.client",
                              "ghostcache.reset", "ghostcache.verify"}, ops)
        memory = {s["name"] for s in spans if s["op"] == "gen_ai.memory.client"}
        self.assertEqual({"search_memory", "create_memory", "delete_memory"}, memory)
        agents = {s["name"] for s in spans if s["op"] == "gen_ai.invoke_agent"}
        self.assertEqual({"invoke_agent ghostcache-assistant", "invoke_agent ghostcache-summarizer"}, agents)
        for s in spans:
            if s["op"].startswith("gen_ai."):
                self.assertIn("gen_ai.operation.name", s["data"], s["name"])
                self.assertEqual(32, len(s["data"]["gen_ai.conversation.id"]))
        verify = next(s for s in spans if s["op"] == "ghostcache.verify")
        self.assertEqual((8, 8, 0, 0), tuple(verify["data"][f"ghostcache.{k}"] for k in (
            "checks_passed", "checks_total", "matched_marker_rows", "stale_descendants")))

    def test_post_request_is_a_root_transaction(self):
        app = Experiment()
        try:
            app.reset()
            status, body = post(app, "/api/ask", {"question": QUESTIONS["retained"]})
        finally:
            app.close()
        self.assertEqual(200, status)
        self.assertIn("07:40", body["answer"])
        spans = self.spans()
        root = next(s for s in spans if s["parent"] is None)
        self.assertEqual(("ghostcache.request", "POST /api/ask"), (root["op"], root["name"]))
        agent = next(s for s in spans if s["op"] == "gen_ai.invoke_agent")
        self.assertEqual(root["id"], agent["parent"])
        self.assertEqual("retained", agent["data"]["ghostcache.question_kind"])
        children = [s["name"] for s in spans if s["parent"] == agent["id"]]
        self.assertEqual(["search_memory", "chat Deterministic fixture — no AI call", "create_memory"], children)

    def test_no_content_leaves_the_process(self):
        _code, report, seeded = self.traced_evaluation()
        app = Experiment()
        try:
            app.reset()
            custom = "Is the vault codeword written on the east stairwell?"
            post(app, "/api/ask", {"question": custom})
        finally:
            app.close()
        self.assertGreater(len(seeded), 10)
        forbidden = [report["oracle"]["canary"], app.scenario["canary"], custom,
                     *(a["title"] for a in seeded), *(a["body"] for a in seeded if a["body"]),
                     *(answer["answer"] for answer in report["answers"].values())]
        self.assert_private(forbidden)


class LiveTracingTests(TracedCase):
    def setUp(self):
        super().setUp()
        available = {"available": True, "model": "mock-model", "message": "ok"}
        self.patches.append(patch.object(OllamaProvider, "status", return_value=available))
        self.patches[-1].start()
        self.app = Experiment(model="mock-model")
        self.answer = f"{SENTINEL} model answer text"

    def tearDown(self):
        self.app.close()
        super().tearDown()

    def chat_spans(self):
        return [s for s in self.spans() if s["op"] == "gen_ai.chat"]

    def test_chat_spans_carry_token_usage_and_errors_carry_only_a_category(self):
        reply = chat(json.dumps({"text": self.answer, "citations": []}), prompt_eval_count=120, eval_count=30)
        with transport(reply), telemetry.span("ghostcache.request", "POST /api/reset", root=True):
            self.app.reset("live")
        spans = self.chat_spans()
        self.assertEqual(4, len(spans))  # three summaries and the baseline answer
        for s in spans:
            self.assertEqual("chat mock-model", s["name"])
            data = s["data"]
            self.assertEqual((120, 30, 150), (data["gen_ai.usage.input_tokens"], data["gen_ai.usage.output_tokens"],
                                              data["gen_ai.usage.total_tokens"]))
            self.assertTrue(all(type(data[f"gen_ai.usage.{k}_tokens"]) is int for k in ("input", "output")))
            self.assertEqual(("mock-model", "mock-model", "ollama", 0, 420), (
                data["gen_ai.response.model"], data["gen_ai.request.model"], data["gen_ai.provider.name"],
                data["gen_ai.request.temperature"], data["gen_ai.request.max_tokens"]))
        failures = {"timed out": failing_transport(lambda: TimeoutError(SENTINEL)),
                    "HTTP status 503": failing_transport(lambda: urllib.error.HTTPError(
                        "http://127.0.0.1:11434/api/chat", 503, SENTINEL, {}, io.BytesIO(SENTINEL.encode()))),
                    "invalid_output": transport(chat("[]"))}
        for category, mocked in failures.items():
            self.transport.envelopes.clear()
            with self.subTest(category), mocked, self.assertRaises(ProviderError), \
                    telemetry.span("ghostcache.request", "POST /api/ask", root=True):
                self.app.ask(QUESTIONS["secret"])
            failed = self.chat_spans()
            self.assertEqual(1, len(failed))
            self.assertNotEqual("ok", failed[0]["status"])
            self.assertEqual(("ProviderError", category), (failed[0]["data"]["error.type"],
                                                            failed[0]["data"]["ghostcache.error.category"]))
            self.assertNotIn(SENTINEL.encode(), self.raw())
        self.assert_private([self.answer, SENTINEL, self.app.scenario["canary"]])


class AnswerLeakFlagTests(TracedCase):
    def paraphrase_spans(self, envelope):
        spans = self.spans([envelope])
        agent = next(s for s in spans if s["op"] == "gen_ai.invoke_agent"
                     and s["data"].get("ghostcache.question_kind") == "paraphrase")
        search = next(s for s in spans if s["parent"] == agent["id"] and s["name"] == "search_memory")
        return agent["data"], json.loads(search["data"]["ghostcache.context_ids"])

    def test_marker_flag_follows_source_only_and_cascade_deletion(self):
        app = Experiment()
        try:
            app.reset()
            with telemetry.span("ghostcache.request", "POST /api/ask", root=True):
                app.delete("source_only")
                leaked = app.ask(QUESTIONS["paraphrase"], persist=False)
            with telemetry.span("ghostcache.request", "POST /api/ask", root=True):
                app.delete("cascade")
                clean = app.ask(QUESTIONS["paraphrase"], persist=False)
        finally:
            app.close()
        self.assertIn(app.scenario["canary"], leaked["answer"])
        self.assertNotIn(app.scenario["canary"], clean["answer"])
        before, after = self.transport.envelopes[-2:]
        agent, context = self.paraphrase_spans(before)
        self.assertEqual((True, "source_only"), (agent["ghostcache.answer_contains_marker"], agent["ghostcache.stage"]))
        self.assertIn("c-vault", context)
        agent, context = self.paraphrase_spans(after)
        self.assertEqual((False, "cleaned"), (agent["ghostcache.answer_contains_marker"], agent["ghostcache.stage"]))
        self.assertNotIn("c-vault", context)
        deletions = [s["data"] for s in self.spans() if s["name"] == "delete_memory"]
        self.assertEqual(["source_only", "cleaned"], [d["ghostcache.stage"] for d in deletions])
        self.assertEqual({"d-vault"}, {d["gen_ai.memory.record.id"] for d in deletions})
        self.assertEqual([False, False], [d["ghostcache.rebuild_failed"] for d in deletions])


class BrokenExporterTests(TracedCase):
    fail_transport = True

    def test_a_failing_sentry_transport_never_changes_results(self):
        fixed = patch("ghostcache.app.secrets.token_hex", return_value="0123456789ab")
        with fixed:
            code, report, _seeded = self.traced_evaluation()
            app = Experiment()
            try:
                app.reset()
                traced_ask = post(app, "/api/ask", {"question": QUESTIONS["secret"]})
            finally:
                app.close()
        # The exporter really was called, and raised, for both root transactions.
        self.assertEqual(2, self.transport.calls)
        telemetry.shutdown()
        with fixed, patch.dict(os.environ, {telemetry.DSN_VARIABLE: ""}):
            plain_code, plain_report, _seeded = self.traced_evaluation_untraced()
            app = Experiment()
            try:
                app.reset()
                plain_ask = post(app, "/api/ask", {"question": QUESTIONS["secret"]})
            finally:
                app.close()
        self.assertEqual((0, 0), (code, plain_code))
        self.assertEqual(normalized(plain_report), normalized(report))
        self.assertEqual(normalized(plain_ask), normalized(traced_ask))
        self.assertEqual(200, traced_ask[0])

    def traced_evaluation_untraced(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.json"
            code, _stdout, stderr = offline_cli(["evaluate", "--output", str(output)])
            report = json.loads(output.read_text())
        self.assertNotIn(telemetry.ENABLED_MESSAGE, stderr)
        return code, report, []


if __name__ == "__main__":
    unittest.main()
