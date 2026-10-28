"""Export recorded live-Gemma evaluation reports into public data for the static walkthrough.

Standard library only. Reads exactly the reports listed in RUNS (never a model, the
database or .env), keeps an allowlist of fields, checks the result against a few selected
private-string patterns (see FORBIDDEN; not comprehensive), and writes deterministic JSON to
site/data/evidence.json. `--check` fails if that file is out of date.

    python3.12 scripts/export_site_data.py           # write site/data/evidence.json
    python3.12 scripts/export_site_data.py --check   # verify it matches the reports
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "site" / "data" / "evidence.json"
MODEL = "gemma4:e2b-it-qat"

# The only evidence the walkthrough shows. Dates are not stored in the reports; they come
# from the dated records named in date_source. Each run is exported separately and never merged.
RUNS = (
    {"id": "cold", "file": "results/sentry-live-cold.json", "date": "2026-10-28",
     "label": "October 28 · first run after starting Ollama (cold)",
     "date_source": "TESTING.md, \"Real Sentry traces T-D3\" (report written 09:18:11 IST)",
     "sentry_trace": "dd21f76b3293450b84b0ad5ca45961dd"},
    {"id": "warm", "file": "results/sentry-live-warm.json", "date": "2026-10-28",
     "label": "October 28 · run straight afterwards (warm)",
     "date_source": "TESTING.md, \"Real Sentry traces T-D3\" (report written 09:19:33 IST)",
     "sentry_trace": "fb1530272ecd481399aa77f95d505dfa"},
    {"id": "oct27", "file": "results/live-gemma.json", "date": "2026-10-27",
     "label": "October 27 · first recorded live run",
     "date_source": "EVALUATION.md, \"Recorded verification — October 27, 2026\"",
     "sentry_trace": None},
)

# Explanatory legend: the seed step in ghostcache/app.py creates the same five documents,
# one chunk per document, and three summaries in every run. The titles are fixed text;
# document bodies (which hold the per-run marker) are not exported.
SEED_LEGEND = {
    "source": "ghostcache/app.py, Experiment._seed (identical in every run)",
    "documents": {"d-vault": "Vault access note", "d-garden": "Roof garden timetable",
                  "d-archive": "Independent archive directory",
                  "d-maintenance": "Telescope maintenance plan", "d-shuttle": "Visitor shuttle guide"},
    "chunk_rule": "Each document d-<name> is split into one search chunk c-<name> derived from it.",
}

ANSWER_KEYS = ("before", "source_only", "secret", "paraphrase", "retained", "shared")
# Which recorded question each answer used (ghostcache/app.py, evaluate and verify).
ANSWER_QUESTION = {"before": "secret", "source_only": "paraphrase", "secret": "secret",
                   "paraphrase": "paraphrase", "retained": "retained", "shared": "shared"}
STAGES = ("initial_audit", "source_only_audit", "cleaned_audit")
STAGE_COUNTS = ("total_artifacts", "active_artifacts", "deleted_artifacts",
                "invalidated_artifacts", "stale_descendants", "matched_canary")
STAGE_IDS = ("active_ids", "stale_ids", "matched_canary_ids")
EVENT_FIELDS = ("name", "time", "mode", "provider", "duration_ms", "input_tokens", "output_tokens",
                "artifact_id", "parent_ids", "affected_ids", "documents", "baseline_exposed")
ID_PATTERN = re.compile(r"^(d|c|s)-[a-z0-9-]+$|^conversation-[0-9a-f]{32}$")
# An additional pattern-based safeguard on the allowlisted output: render() refuses text that
# matches selected patterns (certain machine paths, local endpoints, Sentry and credential-like
# strings, email addresses). It does not detect every private path, service address or secret,
# so it is not comprehensive secret detection and does not replace reviewing the public data.
FORBIDDEN = re.compile(r"/Users/|/home/|[A-Za-z]:\\|\.local/|\.sqlite\b|127\.0\.0\.1|localhost|:11434|"
                       r"sentry\.io|ingest\.|SENTRY_DSN|\.env\b|api[_-]?key|password|token=|"
                       r"[\w.+-]+@[\w-]+\.[\w.]+", re.IGNORECASE)


class EvidenceError(ValueError):
    """A selected report is missing, unreadable, or not the expected live report."""


def _require(condition: bool, path: str, problem: str) -> None:
    if not condition:
        raise EvidenceError(f"{path}: {problem}")


def _ids(value: Any, path: str, field: str) -> list[str]:
    _require(isinstance(value, list) and all(isinstance(x, str) and ID_PATTERN.match(x) for x in value),
             path, f"{field} must be a list of artifact IDs")
    return list(value)


def _int(value: Any, path: str, field: str, *, optional: bool = False) -> int | None:
    if optional and value is None:
        return None
    _require(isinstance(value, int) and not isinstance(value, bool) and value >= 0,
             path, f"{field} must be a non-negative integer")
    return value


def load_report(relative: str, root: Path = ROOT) -> tuple[dict[str, Any], str]:
    """Return (report, sha256) for one selected report, or raise EvidenceError."""
    path = root / relative
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        raise EvidenceError(f"{relative}: evidence file not found") from None
    try:
        report = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise EvidenceError(f"{relative}: not valid JSON") from None
    _require(isinstance(report, dict), relative, "report must be a JSON object")
    return report, hashlib.sha256(raw).hexdigest()


def export_run(spec: dict[str, Any], root: Path = ROOT) -> dict[str, Any]:
    path = spec["file"]
    report, digest = load_report(path, root)
    _require(report.get("project") == "GhostCache", path, "project must be GhostCache")
    _require(report.get("mode") == "live", path, "mode must be live; fixture output is not shown as recorded AI output")
    _require(report.get("model") == MODEL, path, f"model must be {MODEL}")
    _require(isinstance(report.get("passed"), bool), path, "passed must be true or false")

    checks = report.get("checks")
    _require(isinstance(checks, list) and checks, path, "checks must be a non-empty list")
    out_checks = []
    for check in checks:
        _require(isinstance(check, dict) and isinstance(check.get("name"), str)
                 and isinstance(check.get("passed"), bool) and isinstance(check.get("detail"), str),
                 path, "every check needs name, passed and detail")
        out_checks.append({k: check[k] for k in ("name", "passed", "detail")})

    oracle = report.get("oracle")
    _require(isinstance(oracle, dict), path, "oracle must be an object")
    questions = oracle.get("questions")
    _require(isinstance(questions, dict) and all(isinstance(questions.get(k), str) for k in set(ANSWER_QUESTION.values())),
             path, "oracle.questions must hold the four recorded questions")
    _require(isinstance(oracle.get("canary"), str) and oracle["canary"].startswith("MOTH-"),
             path, "oracle.canary must be the fictional MOTH- marker")

    stages = report.get("stages")
    _require(isinstance(stages, dict), path, "stages must be an object")
    out_stages = {}
    for name in STAGES:
        stage = stages.get(name)
        _require(isinstance(stage, dict), path, f"stages.{name} is missing")
        out_stages[name] = {**{k: _int(stage.get(k), path, f"stages.{name}.{k}") for k in STAGE_COUNTS},
                            **{k: _ids(stage.get(k), path, f"stages.{name}.{k}") for k in STAGE_IDS}}
        _require(len(out_stages[name]["active_ids"]) == out_stages[name]["active_artifacts"],
                 path, f"stages.{name}: active_ids does not match active_artifacts")

    answers = report.get("answers")
    _require(isinstance(answers, dict) and all(isinstance(answers.get(k), dict) for k in ANSWER_KEYS),
             path, "answers must include " + ", ".join(ANSWER_KEYS))
    out_answers = {}
    for key in ANSWER_KEYS:
        answer, trace = answers[key], answers[key].get("trace")
        _require(isinstance(answer.get("answer"), str) and answer.get("mode") == "live"
                 and answer.get("provider") == MODEL and isinstance(trace, dict),
                 path, f"answers.{key} must be a live {MODEL} answer with a trace")
        out_answers[key] = {
            "question_key": ANSWER_QUESTION[key], "question": questions[ANSWER_QUESTION[key]],
            "answer": answer["answer"], "mode": answer["mode"], "provider": answer["provider"],
            "citations": _ids(answer.get("citations"), path, f"answers.{key}.citations"),
            "context_ids": _ids(trace.get("parent_ids"), path, f"answers.{key}.trace.parent_ids"),
            "duration_ms": _int(trace.get("duration_ms"), path, f"answers.{key}.trace.duration_ms"),
            "input_tokens": _int(trace.get("input_tokens"), path, f"answers.{key}.input_tokens", optional=True),
            "output_tokens": _int(trace.get("output_tokens"), path, f"answers.{key}.output_tokens", optional=True),
            "contains_marker": oracle["canary"] in answer["answer"],
        }

    events = report.get("events")
    _require(isinstance(events, list) and events, path, "events must be a non-empty list")
    by_context = {tuple(a["context_ids"]): key for key, a in out_answers.items()}
    out_events = []
    for event in events:
        _require(isinstance(event, dict) and isinstance(event.get("name"), str) and isinstance(event.get("time"), str),
                 path, "every event needs a name and time")
        item = {k: event[k] for k in EVENT_FIELDS if k in event}
        for field in ("parent_ids", "affected_ids"):
            if field in item:
                _ids(item[field], path, f"events.{field}")
        if "duration_ms" in item:
            _int(item["duration_ms"], path, "events.duration_ms")
            _require(item.get("mode") == "live" and item.get("provider") == MODEL, path,
                     "every model-call event must be a live call to " + MODEL)
        if item["name"] == "answer.generated":
            # Join to the answer with the same recorded context; the one unmatched answer is
            # the seeding answer that reset() saves to memory as the conversation artifact.
            item["answer_key"] = by_context.get(tuple(item.get("parent_ids", [])), "seeded_conversation")
        out_events.append(item)

    model_calls = [e["duration_ms"] for e in out_events if "duration_ms" in e]
    return {
        "id": spec["id"], "label": spec["label"], "date": spec["date"], "date_source": spec["date_source"],
        "source_file": path, "source_sha256": digest, "sentry_trace": spec["sentry_trace"],
        "kind": "recorded", "mode": report["mode"], "model": report["model"], "passed": report["passed"],
        "marker": oracle["canary"], "source_id": oracle.get("source_id"),
        "shared_source_id": oracle.get("shared_source_id"), "questions": {k: questions[k] for k in sorted(questions)},
        "checks": out_checks, "stages": out_stages, "answers": out_answers, "events": out_events,
        "model_call_count": len(model_calls), "model_call_total_ms": sum(model_calls),
        "scope": report.get("scope") if isinstance(report.get("scope"), str) else None,
    }


def build(root: Path = ROOT) -> dict[str, Any]:
    return {
        "schema": 1,
        "notice": "Recorded local Gemma evaluations. This page performs no inference and stores nothing.",
        "repository": "https://github.com/bipul724/GhostCache",
        "seed_legend": SEED_LEGEND,
        "runs": [export_run(spec, root) for spec in RUNS],
    }


def render(data: dict[str, Any]) -> str:
    text = json.dumps(data, indent=1, ensure_ascii=False, sort_keys=True) + "\n"
    leaked = FORBIDDEN.search(text)
    if leaked:
        raise EvidenceError(f"public data would contain a private or service string ({leaked.group(0)!r})")
    return text


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="fail if the committed data is out of date")
    args = parser.parse_args(argv)
    try:
        text = render(build())
    except EvidenceError as exc:
        print(f"Evidence check failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.is_file() else None
        if current != text:
            print(f"{OUTPUT.relative_to(ROOT)} is out of date; run scripts/export_site_data.py", file=sys.stderr)
            return 1
        print(f"{OUTPUT.relative_to(ROOT)} matches the selected reports.")
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(text, encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} from {len(RUNS)} recorded reports.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
