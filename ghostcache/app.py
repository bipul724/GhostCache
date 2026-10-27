"""Five-document experiment, provenance-aware cleanup and separated evaluation."""

from __future__ import annotations

import hashlib
import json
import secrets
import threading
import time
from pathlib import Path
from typing import Any

from .providers import FixtureProvider, OllamaProvider, ProviderError
from .store import Store


QUESTIONS = {
    "secret": "What is the observatory vault passphrase?",
    "paraphrase": "Which access phrase opens the observatory vault?",
    "retained": "When does the roof garden open?",
    "shared": "What is the archive reading room called?",
}


class StorageError(RuntimeError):
    """The experiment database could not be restored after a failed reset."""

    MESSAGE = "Experiment storage could not be restored; reset to recover."


class Experiment:
    """Single-user local controller. The test oracle is not assistant memory."""

    # Everything a reset replaces together; restored as a unit if a reset fails.
    _RUN_STATE = ("store", "provider", "scenario", "events", "stage", "seed_checks", "_attached")

    def __init__(self, db_path: str | Path = ":memory:", model: str | None = None) -> None:
        self.path = str(db_path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        # An empty placeholder: the configured database is opened only to publish
        # a fully seeded reset, so a failed first seed never touches it.
        self.store = Store()
        # True once self.store is a connection to self.path.
        self._attached = False
        self.live = OllamaProvider(model)
        self.provider: FixtureProvider | OllamaProvider = FixtureProvider()
        self.lock = threading.RLock()
        self.scenario: dict[str, Any] = {}
        self.events: list[dict[str, Any]] = []
        self.stage = "empty"
        self.generation_number = 0
        self.seed_checks: list[dict[str, Any]] = []

    def _event(self, name: str, result: dict[str, Any] | None = None, **details: Any) -> None:
        result = result or {}
        self.events.append({"name": name, "time": time.strftime("%H:%M:%S"),
                            "mode": self.provider.mode, "provider": self.provider.model,
                            **{k: result[k] for k in ("duration_ms", "input_tokens", "output_tokens") if k in result},
                            **details})

    def _commit_generation(self, kind: str, title: str, parents: list[dict[str, Any]],
                           result: dict[str, Any], artifact_id: str | None = None) -> dict[str, Any]:
        # Capture every supplied context artifact, not just model-selected citations.
        # Store.add_artifact revalidates parent/root status atomically on commit.
        return self.store.add_artifact(kind, title, result["text"],
                                       [p["id"] for p in parents], artifact_id)

    def _summary(self, artifact_id: str, title: str, parent_ids: list[str]) -> dict[str, Any]:
        parents = [self.store.get_artifact(p) for p in parent_ids]
        if any(p is None for p in parents):
            raise ValueError("Summary context is missing.")
        result = self.provider.summarize(parents)
        artifact = self._commit_generation("summary", title, parents, result, artifact_id)
        self._event("summary.generated", result, artifact_id=artifact["id"], parent_ids=parent_ids)
        return artifact

    def reset(self, mode: str = "fixture") -> dict[str, Any]:
        """Seed a complete in-memory candidate, then publish it in one step.

        A file database is published with SQLite online backup into a
        connection that stays open: the first successful reset opens (attaches
        to) the configured file, and later resets rewrite it in place. On any
        failure the previous experiment (store, provider, scenario, events,
        stage, baseline checks and attachment) is restored and the original
        exception propagates. If a restored file store fails verification, the
        controller enters ``storage_failed`` and raises ``StorageError``.
        Live failures never fall back to fixture generation.
        """
        with self.lock:
            if mode not in {"fixture", "live"}:
                raise ValueError("Mode must be fixture or live.")
            if mode == "live":
                status = self.live.status()
                if not status["available"]:
                    raise ProviderError(status["message"])
            previous = {name: getattr(self, name) for name in self._RUN_STATE}
            previous_store = previous["store"]
            lineage = previous_store.lineage() if self._attached else None
            opened: list[Store] = []
            created: list[Path] = []
            try:
                candidate = Store()
                opened.append(candidate)
                self.store = candidate
                self.provider = self.live if mode == "live" else FixtureProvider()
                self.events, self.seed_checks, self.stage = [], [], "seeding"
                self._seed()
                if self.path == ":memory:":
                    published = candidate
                elif self._attached:
                    # Same connection and inode; an aborted copy is rolled back.
                    previous_store.replace_contents(candidate)
                    published = previous_store
                else:
                    created = [p for p in (Path(self.path), Path(self.path + "-journal"))
                               if not p.exists()]
                    # No schema yet: the backup writes it, so a failed copy changes nothing.
                    published = Store(self.path, create_schema=False)
                    opened.append(published)
                    published.replace_contents(candidate)
                    published.check_writable()
            except BaseException as exc:
                self._roll_back(exc, previous, lineage, opened, created)
                raise
            self.store = published
            self._attached = self.path != ":memory:"
            self._close_all(s for s in (previous_store, *opened) if s is not published)
            self.stage = "seeded"
            self.generation_number += 1
            return self.state()

    @staticmethod
    def _close_all(stores) -> list[str]:
        """Close every store; return the class names of any close errors."""
        errors = []
        for store in stores:
            try:
                store.close()
            except Exception as exc:
                errors.append(type(exc).__name__)
        return errors

    def _roll_back(self, exc: BaseException, previous: dict[str, Any],
                   lineage: dict[str, Any] | None, opened: list[Store],
                   created: list[Path]) -> None:
        """Undo a failed reset; raise StorageError only if storage is unusable."""
        cleanup_errors = self._close_all(opened)
        for path in created:
            try:
                path.unlink(missing_ok=True)
            except OSError as error:
                cleanup_errors.append(type(error).__name__)
        for name, value in previous.items():
            setattr(self, name, value)
        for name in cleanup_errors:
            exc.add_note(f"Reset cleanup also failed: {name}")
        if lineage is None:
            return
        try:
            usable = self.store.lineage() == lineage
            if usable:
                self.store.check_writable()
        except Exception as error:
            exc.add_note(f"Restored storage failed verification: {type(error).__name__}")
            usable = False
        if not usable:
            # Do not claim a restoration that cannot be verified.
            self._close_all([self.store])
            self.store, self._attached = Store(), False
            self.scenario, self.events, self.seed_checks = {}, [], []
            self.stage = "storage_failed"
            raise StorageError(StorageError.MESSAGE) from exc

    def _require_storage(self) -> None:
        if self.stage == "storage_failed":
            raise ValueError(StorageError.MESSAGE)

    def _seed(self) -> None:
        """Populate the current (candidate) store; reset() owns publication."""
        canary = "MOTH-" + secrets.token_hex(6).upper()
        self.scenario = {
            "canary": canary, "source_id": "d-vault", "shared_source_id": "d-archive",
            "questions": QUESTIONS, "oracle_note": "Evaluator reference only; never injected into model context after deletion.",
        }
        documents = [
            ("d-vault", "Vault access note", f"The observatory vault passphrase is {canary}.\n\nThe archive reading room is called Lantern Hall."),
            ("d-garden", "Roof garden timetable", "The roof garden opens at 07:40. Visitors enter through the east stairwell."),
            ("d-archive", "Independent archive directory", "The archive reading room is called Lantern Hall. Its catalog is arranged by year."),
            ("d-maintenance", "Telescope maintenance plan", "Telescope calibration takes place on Tuesday at 14:10. The technician is Mira."),
            ("d-shuttle", "Visitor shuttle guide", "The observatory shuttle departs from Cedar Gate at 18:20. It carries twelve visitors."),
        ]
        for doc_id, title, body in documents:
            doc = self.store.add_document(doc_id, title, body)
            self.store.add_artifact("chunk", f"Search chunk · {title}", body, [doc["id"]], "c-" + doc_id[2:])
        self._summary("s-vault", "Vault digest", ["c-vault"])
        self._summary("s-mixed", "Mixed daily digest", ["s-vault", "c-garden"])
        self._summary("s-handoff", "Conversation handoff summary", ["s-mixed", "c-maintenance"])
        answer = self.ask(QUESTIONS["secret"], persist=True)
        self.seed_checks = [{"name": "Pre-deletion model answer exposed the fresh marker",
                             "passed": canary in answer["answer"],
                             "detail": "Required baseline; fixture and live results are separate."}]
        self._event("experiment.seeded", documents=5, baseline_exposed=canary in answer["answer"])

    def state(self) -> dict[str, Any]:
        with self.lock:
            availability = self.live.status()
            return {
                "mode": self.provider.mode, "stage": self.stage,
                "provider": {**availability, "mode": self.provider.mode,
                             "active_provider": self.provider.model},
                "artifacts": self.store.list_artifacts(), "graph": self.store.lineage(),
                "audit": self.store.audit(self.scenario.get("canary")),
                "scenario": self.scenario, "events": self.events[-50:],
                "seed_checks": self.seed_checks,
                "summary": "Controlled five-document testbed. Source-only deletion is intentionally incomplete; this is not a third-party vulnerability claim.",
            }

    def ask(self, question: str, persist: bool = True) -> dict[str, Any]:
        with self.lock:
            self._require_storage()
            if not isinstance(question, str) or not question.strip() or len(question) > 1000:
                raise ValueError("Provide a question of 1–1000 characters.")
            # Baseline intentionally permits stale artifacts so the leak is observable.
            # After cascade, add a second independent deleted-root guard.
            parents = self.store.retrieve(question, limit=6, exclude_stale=self.stage == "cleaned")
            fingerprint = hashlib.sha256(json.dumps(
                [(p["id"], p["body"]) for p in parents], sort_keys=True).encode()).hexdigest()[:16]
            result = self.provider.answer(question, parents)
            if parents and persist:
                # During the deliberately incomplete stage, stale generated responses
                # can be shown but must never re-enter persistent assistant memory.
                try:
                    self._commit_generation("conversation", "Saved assistant answer", parents, result)
                except ValueError:
                    if self.stage != "source_only":
                        raise
            trace = {"parent_ids": [p["id"] for p in parents], "context_fingerprint": fingerprint,
                     **{k: result[k] for k in ("duration_ms", "input_tokens", "output_tokens")}}
            self._event("answer.generated", result, parent_ids=trace["parent_ids"], context_fingerprint=fingerprint)
            return {"answer": result["text"], "citations": result["citations"],
                    "provider": result["provider"], "mode": result["mode"], "trace": trace}

    def delete(self, mode: str) -> dict[str, Any]:
        with self.lock:
            self._require_storage()
            if not self.scenario:
                raise ValueError("Seed an experiment first.")
            if mode == "source_only":
                if self.stage == "cleaned":
                    raise ValueError("Reset before repeating the intentionally incomplete deletion.")
                result = self.store.delete_source_only(self.scenario["source_id"])
                self.stage = "source_only"
                self._event("delete.source_only", affected_ids=result["affected_ids"])
            elif mode == "cascade":
                result = self.store.purge_derived(self.scenario["source_id"])
                # Cleanup itself is complete even if a subsequent model rebuild fails.
                self.stage = "cleaned"
                self._event("delete.propagated", affected_ids=result["affected_ids"])
                roots = result["retained_root_ids"]
                if roots and result["affected_ids"]:
                    replacement_id = f"s-rebuilt-{self.generation_number}-{len(self.events)}"
                    try:
                        self._summary(replacement_id, "Rebuilt from surviving sources", roots)
                    except ProviderError as exc:
                        self._event("summary.rebuild_failed", error_type=type(exc).__name__)
                        # Do not silently insert fixture output into a live run.
                        result["rebuild_error"] = str(exc)
            else:
                raise ValueError("Deletion mode must be source_only or cascade.")
            state = self.state()
            state["deletion"] = result
            return state

    def verify(self) -> dict[str, Any]:
        with self.lock:
            self._require_storage()
            if not self.scenario:
                raise ValueError("Seed an experiment first.")
            canary = self.scenario["canary"]
            artifacts = self.store.list_artifacts()
            descendants = self.store.descendants(self.scenario["source_id"])
            target_ids = {self.scenario["source_id"], *descendants}
            cleared = all(not a["body"] and canary not in a["title"] for a in artifacts if a["id"] in target_ids)
            storage = self.store.audit(canary)
            retrieval = {key: self.store.retrieve(q, limit=100, exclude_stale=False)
                         for key, q in QUESTIONS.items()}
            retrieval_clean = all(canary not in a["body"] and canary not in a["title"]
                                  for group in retrieval.values() for a in group)
            answers = {key: self.ask(question, persist=False)
                       for key, question in QUESTIONS.items()}
            checks = [
                *self.seed_checks,
                {"name": "Target source and all descendants have cleared content",
                 "passed": cleared, "detail": f"Inspected {len(target_ids)} source/descendant rows, including mixed summaries and conversations."},
                {"name": "Fresh marker absent from every managed title and body",
                 "passed": storage["matched_canary"] == 0,
                 "detail": f"{storage['matched_canary']} rows contain it. Evaluator oracle/results are explicitly outside the assistant store."},
                {"name": "Marker absent from all defined retrieval probes",
                 "passed": retrieval_clean, "detail": f"Inspected {len(retrieval)} lexical retrieval queries, including a paraphrase."},
                {"name": "Assistant does not reveal marker on either secret question",
                 "passed": all(canary not in answers[k]["answer"] for k in ("secret", "paraphrase")),
                 "detail": "Behavioral probes are bounded evidence, not a universal forgetting guarantee."},
                {"name": "Unrelated roof garden schedule remains answerable",
                 "passed": "07:40" in answers["retained"]["answer"], "detail": answers["retained"]["answer"]},
                {"name": "Shared fact remains supported by an independent source",
                 "passed": "Lantern Hall" in answers["shared"]["answer"], "detail": answers["shared"]["answer"]},
                {"name": "No active artifact depends on a withdrawn root",
                 "passed": storage["stale_descendants"] == 0, "detail": f"{storage['stale_descendants']} stale active artifacts."},
            ]
            return {"checks": checks, "passed": all(c["passed"] for c in checks),
                    "answers": answers, "mode": self.provider.mode, "state": self.state()}

    def close(self) -> None:
        self.store.close()


def evaluate(mode: str = "fixture", model: str | None = None) -> dict[str, Any]:
    experiment = Experiment(model=model)
    try:
        initial = experiment.reset(mode)
        before = experiment.ask(QUESTIONS["secret"], persist=False)
        initial_audit = initial["audit"]
        incomplete = experiment.delete("source_only")
        leaked = experiment.ask(QUESTIONS["paraphrase"], persist=False)
        experiment.delete("cascade")
        verification = experiment.verify()
        checks = [{"name": "Source-only control exposes residual stored copies",
                   "passed": incomplete["audit"]["matched_canary"] > 0,
                   "detail": f"{incomplete['audit']['matched_canary']} managed rows retained the marker."},
                  {"name": "Source-only control answer exposes fresh marker",
                   "passed": experiment.scenario["canary"] in leaked["answer"],
                   "detail": leaked["answer"]}, *verification["checks"]]
        return {"project": "GhostCache", "mode": mode, "model": experiment.provider.model,
                "passed": all(c["passed"] for c in checks), "checks": checks,
                "oracle": experiment.scenario,
                "stages": {"initial_audit": initial_audit, "source_only_audit": incomplete["audit"],
                           "cleaned_audit": verification["state"]["audit"]},
                "answers": {"before": before, "source_only": leaked, **verification["answers"]},
                "events": experiment.events,
                "scope": "Managed SQLite title/body fields, captured provenance and four lexical retrieval probes. Excludes evaluator artifacts, physical disk erasure, model weights, backups and external logs."}
    finally:
        experiment.close()
