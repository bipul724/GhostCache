"""SQLite-backed artifact provenance for the GhostCache demonstration.

Deletion here covers managed ``body`` and ``title`` fields, not secure disk
erasure. Identifiers and provenance edges are retained nonsensitive metadata.
"""

from __future__ import annotations

import json
import re
import sqlite3
import threading
import uuid
from collections import Counter
from pathlib import Path
from typing import Any


KINDS = frozenset({"document", "chunk", "summary", "conversation"})
_STOP_WORDS = frozenset(
    "a an and are as at be by did do does for from had has have how i in is it "
    "me my of on or please that the their them there these they this to was "
    "were what when where which who why with would you your".split()
)


class Store:
    """Own an append-only provenance DAG with mutable body/status fields.

    A document is an independent root. Derived artifacts capture their roots
    from their actual parents; callers and language models cannot supply them.
    Public operations are serialized on this instance's SQLite connection.
    """

    def __init__(self, path: str | Path = ":memory:", *, create_schema: bool = True) -> None:
        """Open ``path``; ``create_schema=False`` only connects, writing nothing.

        Publication uses ``create_schema=False`` for a target that
        ``replace_contents`` will overwrite, so a failed copy leaves its bytes
        unchanged.
        """
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        try:
            self._setup(create_schema)
        except BaseException:
            # Never leak the connection; the file itself is left to its owner.
            self._conn.close()
            raise

    def _setup(self, create_schema: bool) -> None:
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        if not create_schema:
            return
        with self._conn:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS artifacts (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    id TEXT NOT NULL UNIQUE,
                    kind TEXT NOT NULL CHECK (
                        kind IN ('document', 'chunk', 'summary', 'conversation')
                    ),
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (
                        status IN ('active', 'deleted', 'invalidated')
                    ),
                    source_ids TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS provenance (
                    parent_id TEXT NOT NULL REFERENCES artifacts(id),
                    child_id TEXT NOT NULL REFERENCES artifacts(id),
                    position INTEGER NOT NULL,
                    PRIMARY KEY (parent_id, child_id),
                    CHECK (parent_id != child_id)
                );
                CREATE INDEX IF NOT EXISTS provenance_child
                    ON provenance(child_id);
                """
            )

    def _row(self, artifact_id: str) -> sqlite3.Row | None:
        return self._conn.execute(
            "SELECT * FROM artifacts WHERE id = ?", (artifact_id,)
        ).fetchone()

    def _record(self, row: sqlite3.Row) -> dict[str, Any]:
        parents = self._conn.execute(
            "SELECT parent_id FROM provenance WHERE child_id = ? ORDER BY position",
            (row["id"],),
        ).fetchall()
        return {
            "id": row["id"],
            "kind": row["kind"],
            "title": row["title"],
            "body": row["body"],
            "status": row["status"],
            "parent_ids": [parent["parent_id"] for parent in parents],
            "source_ids": json.loads(row["source_ids"]),
        }

    @staticmethod
    def _check_text(value: str, name: str, *, nonempty: bool = False) -> None:
        if not isinstance(value, str) or (nonempty and not value.strip()):
            raise ValueError(f"{name} must be {'a nonempty string' if nonempty else 'a string'}")

    def add_document(self, doc_id: str, title: str, body: str) -> dict[str, Any]:
        return self.add_artifact("document", title, body, [], artifact_id=doc_id)

    def add_artifact(
        self,
        kind: str,
        title: str,
        body: str,
        parent_ids: list[str],
        artifact_id: str | None = None,
    ) -> dict[str, Any]:
        if kind not in KINDS:
            raise ValueError(f"Unsupported artifact kind: {kind!r}")
        self._check_text(title, "title")
        self._check_text(body, "body")
        if not isinstance(parent_ids, list):
            raise ValueError("parent_ids must be a list of artifact IDs")
        for parent_id in parent_ids:
            self._check_text(parent_id, "parent ID", nonempty=True)
        parents = list(dict.fromkeys(parent_ids))
        if kind == "document" and parents:
            raise ValueError("Documents are independent roots and cannot have parents")
        if kind != "document" and not parents:
            raise ValueError("Derived artifacts require at least one parent")
        artifact_id = artifact_id if artifact_id is not None else f"{kind}-{uuid.uuid4().hex}"
        self._check_text(artifact_id, "artifact_id", nonempty=True)
        if artifact_id in parents:
            raise ValueError("An artifact cannot be its own parent")

        with self._lock, self._conn:
            if self._row(artifact_id) is not None:
                raise ValueError(f"Artifact ID already exists: {artifact_id}")
            roots: set[str] = set()
            for parent_id in parents:
                parent = self._row(parent_id)
                if parent is None:
                    raise ValueError(f"Unknown parent: {parent_id}")
                if parent["status"] != "active":
                    raise ValueError(f"Cannot derive from inactive parent: {parent_id}")
                roots.update(json.loads(parent["source_ids"]))
            for root_id in roots:
                root = self._row(root_id)
                if root is None or root["status"] != "active":
                    raise ValueError(f"Cannot derive from deleted source: {root_id}")
            if kind == "document":
                roots.add(artifact_id)
            # Existing parents plus immutable, new child IDs make cycles impossible.
            self._conn.execute(
                "INSERT INTO artifacts (id, kind, title, body, status, source_ids) "
                "VALUES (?, ?, ?, ?, 'active', ?)",
                (artifact_id, kind, title, body, json.dumps(sorted(roots))),
            )
            self._conn.executemany(
                "INSERT INTO provenance (parent_id, child_id, position) VALUES (?, ?, ?)",
                [(parent_id, artifact_id, i) for i, parent_id in enumerate(parents)],
            )
            return self._record(self._row(artifact_id))

    def list_artifacts(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM artifacts ORDER BY sequence").fetchall()
            return [self._record(row) for row in rows]

    def get_artifact(self, artifact_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._row(artifact_id)
            return self._record(row) if row is not None else None

    def lineage(self) -> dict[str, Any]:
        with self._lock:
            edges = self._conn.execute(
                "SELECT parent_id, child_id FROM provenance ORDER BY rowid"
            ).fetchall()
            return {
                "nodes": self.list_artifacts(),
                "edges": [
                    {"source": edge["parent_id"], "target": edge["child_id"]}
                    for edge in edges
                ],
            }

    def descendants(self, source_id: str) -> list[str]:
        with self._lock:
            rows = self._conn.execute(
                """WITH RECURSIVE downstream(id) AS (
                       SELECT child_id FROM provenance WHERE parent_id = ?
                       UNION
                       SELECT p.child_id FROM provenance p
                       JOIN downstream d ON p.parent_id = d.id
                   )
                   SELECT a.id FROM artifacts a JOIN downstream d ON a.id = d.id
                   ORDER BY a.sequence""",
                (source_id,),
            ).fetchall()
            return [row["id"] for row in rows]

    def _require_document(self, doc_id: str) -> sqlite3.Row:
        row = self._row(doc_id)
        if row is None or row["kind"] != "document":
            raise ValueError(f"Expected an existing document source: {doc_id}")
        return row

    def _retained_roots(self, ids: list[str], deleted_source: str) -> list[str]:
        roots: set[str] = set()
        for artifact_id in ids:
            for root_id in json.loads(self._row(artifact_id)["source_ids"]):
                root = self._row(root_id)
                if root_id != deleted_source and root is not None and root["status"] == "active":
                    roots.add(root_id)
        return sorted(roots)

    def delete_source_only(self, doc_id: str) -> dict[str, Any]:
        """Intentionally unsafe demo: erase the source, retain its active copies."""
        with self._lock, self._conn:
            row = self._require_document(doc_id)
            descendants = self.descendants(doc_id)
            changed = (
                row["status"] != "deleted"
                or bool(row["body"])
                or row["title"] != "Withdrawn document"
            )
            self._conn.execute(
                "UPDATE artifacts SET body = '', title = 'Withdrawn document', "
                "status = 'deleted' WHERE id = ?", (doc_id,)
            )
            return {
                "source_id": doc_id,
                "affected_ids": [doc_id] if changed else [],
                "targeted_ids": [doc_id],
                "deleted_ids": [doc_id],
                "invalidated_ids": [],
                "descendant_ids": descendants,
                "retained_root_ids": self._retained_roots(descendants, doc_id),
            }

    def purge_derived(self, doc_id: str) -> dict[str, Any]:
        """Atomically erase a source and every descendant, retaining lineage."""
        with self._lock, self._conn:
            self._require_document(doc_id)
            descendants = self.descendants(doc_id)
            retained_roots = self._retained_roots(descendants, doc_id)
            targets = [doc_id, *descendants]
            changed = [
                artifact_id
                for artifact_id in targets
                if (
                    self._row(artifact_id)["status"]
                    != ("deleted" if artifact_id == doc_id else "invalidated")
                    or self._row(artifact_id)["body"]
                    or self._row(artifact_id)["title"]
                    != (
                        "Withdrawn document" if artifact_id == doc_id
                        else f"Purged {self._row(artifact_id)['kind']}"
                    )
                )
            ]
            self._conn.execute(
                "UPDATE artifacts SET body = '', title = 'Withdrawn document', "
                "status = 'deleted' WHERE id = ?", (doc_id,)
            )
            self._conn.executemany(
                "UPDATE artifacts SET body = '', title = 'Purged ' || kind, "
                "status = 'invalidated' WHERE id = ?",
                [(artifact_id,) for artifact_id in descendants],
            )
            return {
                "source_id": doc_id,
                "affected_ids": changed,
                "targeted_ids": targets,
                "deleted_ids": [doc_id],
                "invalidated_ids": descendants,
                "descendant_ids": descendants,
                "retained_root_ids": retained_roots,
            }

    @staticmethod
    def _tokens(text: str) -> list[str]:
        return re.findall(r"\w+", text.casefold())

    def _inactive_roots(self) -> set[str]:
        return {
            row["id"]
            for row in self._conn.execute(
                "SELECT id FROM artifacts WHERE kind = 'document' AND status != 'active'"
            )
        }

    def retrieve(
        self, query: str, limit: int = 6, exclude_stale: bool = False
    ) -> list[dict[str, Any]]:
        self._check_text(query, "query")
        if not isinstance(limit, int) or limit < 0:
            raise ValueError("limit must be a nonnegative integer")
        terms = set(self._tokens(query)) - _STOP_WORDS
        if not terms or limit == 0:
            return []
        with self._lock:
            inactive_roots = self._inactive_roots()
            ranked: list[tuple[int, int, int, sqlite3.Row]] = []
            rows = self._conn.execute(
                "SELECT * FROM artifacts WHERE status = 'active' AND body != '' ORDER BY sequence"
            ).fetchall()
            for row in rows:
                if exclude_stale and inactive_roots.intersection(json.loads(row["source_ids"])):
                    continue
                counts = Counter(self._tokens(f"{row['title']} {row['body']}"))
                matched = terms.intersection(counts)
                if matched:
                    ranked.append((len(matched), sum(counts[t] for t in matched), -row["sequence"], row))
            ranked.sort(key=lambda item: item[:3], reverse=True)
            return [self._record(item[3]) for item in ranked[:limit]]

    def audit(self, canary: str | None = None) -> dict[str, Any]:
        if canary is not None:
            self._check_text(canary, "canary", nonempty=True)
        with self._lock:
            artifacts = self.list_artifacts()
            inactive_roots = self._inactive_roots()
            active = [a for a in artifacts if a["status"] == "active"]
            stale = [a["id"] for a in active if inactive_roots.intersection(a["source_ids"])]
            matched = [
                a["id"] for a in artifacts
                if canary is not None and (
                    canary.casefold() in a["body"].casefold()
                    or canary.casefold() in a["title"].casefold()
                )
            ]
            return {
                "total_artifacts": len(artifacts),
                "active_artifacts": len(active),
                "active_ids": [a["id"] for a in active],
                "deleted_artifacts": sum(a["status"] == "deleted" for a in artifacts),
                "invalidated_artifacts": sum(a["status"] == "invalidated" for a in artifacts),
                "stale_descendants": len(stale),
                "stale_ids": stale,
                "matched_canary": len(matched),
                "matched_canary_ids": matched,
                "scope": "Managed artifact body and title fields only; not secure disk erasure or model unlearning.",
            }

    def replace_contents(self, source: "Store", *, pages: int = -1, progress=None) -> None:
        """Replace this database's contents with ``source`` through SQLite online backup.

        The copy uses this store's existing connection, so a file database is
        rewritten in place (same path and inode). SQLite commits the
        destination only when the backup completes; an aborted backup is
        rolled back and leaves the previous contents. ``pages`` and
        ``progress`` exist so tests can inject a real mid-copy failure.
        """
        with self._lock, source._lock:
            source._conn.backup(self._conn, pages=pages, progress=progress)

    def check_writable(self) -> None:
        """Raise ``sqlite3.Error`` unless this connection can still write.

        Inserts a throwaway row inside a savepoint, then rolls the whole
        transaction back, so rows and file bytes stay unchanged. (``ROLLBACK
        TO`` plus ``RELEASE`` would commit an empty transaction and rewrite
        the file header.) Unlike ``BEGIN IMMEDIATE``, this detects a
        connection whose database file was replaced or moved.
        """
        with self._lock:
            if self._conn.in_transaction:
                raise RuntimeError("check_writable needs an idle connection")
            self._conn.execute("SAVEPOINT ghostcache_write_probe")
            try:
                self._conn.execute(
                    "INSERT INTO artifacts (id, kind, title, body, status, source_ids) "
                    "VALUES (?, 'document', '', '', 'active', '[]')",
                    (f"probe-{uuid.uuid4().hex}",),
                )
            finally:
                self._conn.rollback()

    def close(self) -> None:
        with self._lock:
            self._conn.close()
