"""Local-only HTTP UI and reproducible fixture/live evaluation commands."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from . import telemetry
from .app import Experiment, StorageError, evaluate
from .providers import ProviderError


ROOT = Path(__file__).resolve().parent.parent
POST_ROUTES = ("/api/reset", "/api/ask", "/api/delete", "/api/verify")


def make_handler(experiment: Experiment):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args) -> None:
            # Method/path/status only; never log requests, answers or synthetic markers.
            print(f"GhostCache: {fmt % args}", file=sys.stderr)

        def send(self, code: int, body: bytes, content_type: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(body)

        def send_json(self, code: int, value: object) -> None:
            self.send(code, json.dumps(value).encode(), "application/json; charset=utf-8")

        def host_allowed(self) -> bool:
            host = self.headers.get("Host", "").split(":")[0]
            return host in {"localhost", "127.0.0.1"}

        def do_GET(self) -> None:
            if not self.host_allowed():
                self.send_json(403, {"error": "This prototype serves localhost only."})
                return
            route = urlparse(self.path).path
            if route == "/api/state":
                self.send_json(200, experiment.state())
                return
            files = {"/": "index.html", "/index.html": "index.html",
                     "/app.js": "app.js", "/style.css": "style.css"}
            name = files.get(route)
            if not name:
                self.send_json(404, {"error": "Not found"})
                return
            path = ROOT / "web" / name
            if not path.is_file():
                self.send_json(503, {"error": "Web assets are not yet available."})
                return
            content_type = {".html": "text/html", ".css": "text/css", ".js": "text/javascript"}[path.suffix]
            self.send(200, path.read_bytes(), content_type + "; charset=utf-8")

        def do_POST(self) -> None:
            origin = self.headers.get("Origin")
            origin_url = urlparse(origin) if origin else None
            if (not self.host_allowed() or (origin_url and (
                    origin_url.netloc != self.headers.get("Host") or origin_url.scheme != "http"))):
                self.send_json(403, {"error": "Cross-origin requests are disabled."})
                return
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                self.send_json(415, {"error": "Use application/json."})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 16384:
                    raise ValueError("Request body must be 1–16384 bytes.")
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict):
                    raise ValueError("Request body must be a JSON object.")
                route = urlparse(self.path).path
                if route not in POST_ROUTES:
                    self.send_json(404, {"error": "Not found"})
                    return
                # The name is one of the fixed routes above, never request content.
                with telemetry.span("ghostcache.request", f"POST {route}", root=True):
                    if route == "/api/reset":
                        result = experiment.reset(payload.get("mode", "fixture"))
                    elif route == "/api/ask":
                        result = experiment.ask(payload.get("question", ""))
                        result["state"] = experiment.state()
                    elif route == "/api/delete":
                        result = experiment.delete(payload.get("mode", ""))
                    else:
                        result = experiment.verify()
                self.send_json(200, result)
            except ProviderError as exc:
                self.send_json(502, {"error": str(exc), "mode": experiment.provider.mode})
            except StorageError:
                self.send_json(503, {"error": StorageError.MESSAGE})
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                self.send_json(400, {"error": str(exc)})
            except Exception as exc:
                # Keep raw content/traceback out of HTTP responses and access logs.
                print(f"GhostCache error: {type(exc).__name__}", file=sys.stderr)
                self.send_json(500, {"error": "Unexpected server error; inspect the local tests."})
    return Handler


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="GhostCache local deletion testbed")
    commands = parser.add_subparsers(dest="command", required=True)
    server = commands.add_parser("serve", help="Run the single-user local UI")
    server.add_argument("--port", type=int, default=8765)
    server.add_argument("--model", default=None)
    server.add_argument("--mode", choices=("fixture", "live"), default="fixture")
    server.add_argument("--database", default=str(ROOT / ".local" / "assistant.sqlite"))
    evaluation = commands.add_parser("evaluate", help="Run one fresh, bounded end-to-end case")
    evaluation.add_argument("--mode", choices=("fixture", "live"), default="fixture")
    evaluation.add_argument("--model", default=None)
    evaluation.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    try:
        if telemetry.init(args.mode):
            # stderr, so that evaluate's stdout stays one JSON document. The DSN is never printed.
            print(telemetry.ENABLED_MESSAGE, file=sys.stderr, flush=True)
    except telemetry.TelemetryError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    if args.command == "evaluate":
        try:
            with telemetry.span("ghostcache.evaluate", f"evaluate {args.mode}",
                                {"ghostcache.mode": args.mode}, root=True):
                report = evaluate(args.mode, args.model)
        # Expected failures (model/provider errors, invalid input) become a failed
        # report. Anything else is a programming defect: let it raise with a
        # traceback and nonzero exit rather than disguise it as an evaluation result.
        except (ProviderError, ValueError) as exc:
            report = {"project": "GhostCache", "mode": args.mode, "passed": False,
                      "error": str(exc), "note": "No silent switch to fixture mode."}
        finally:
            telemetry.flush()
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps({"mode": report["mode"], "passed": report["passed"],
                          "model": report.get("model"), "error": report.get("error"),
                          "checks": [{"name": c["name"], "passed": c["passed"]}
                                     for c in report.get("checks", [])]}, indent=2))
        return 0 if report["passed"] else 1
    experiment = Experiment(args.database, args.model)
    try:
        experiment.reset(args.mode)
    except (ProviderError, StorageError, ValueError) as exc:
        # These messages are fixed text with allowlisted categories only.
        experiment.close()
        print(str(exc), file=sys.stderr)
        return 1
    except sqlite3.Error as exc:
        experiment.close()
        print(f"Could not open or write the demo database ({type(exc).__name__}). "
              "Choose a disposable --database path.", file=sys.stderr)
        return 1
    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(experiment))
    print(f"GhostCache listening at http://127.0.0.1:{args.port} ({args.mode} mode)", flush=True)
    print("Single-user synthetic testbed. Startup resets this demo's database.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        experiment.close()
        telemetry.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
