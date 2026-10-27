import hashlib
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

from ghostcache.store import Store


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.store = Store()
        self.addCleanup(self.store.close)

    def seed_chain(self):
        self.store.add_document("a", "Source A", "Alice's project passphrase is moon-otter-73.")
        self.store.add_artifact("chunk", "A chunk", "Alice uses moon-otter-73.", ["a"], "chunk")
        self.store.add_artifact("summary", "Working summary", "Alice: moon-otter-73.", ["chunk"], "summary")
        self.store.add_artifact("conversation", "Previous answer", "It is moon-otter-73.", ["summary"], "chat")

    def test_naive_deletion_keeps_stale_copies_but_filtered_retrieval_rejects_them(self):
        self.seed_chain()
        result = self.store.delete_source_only("a")
        self.assertEqual(result["affected_ids"], ["a"])
        self.assertEqual(self.store.get_artifact("a")["body"], "")
        self.assertEqual(self.store.get_artifact("a")["status"], "deleted")
        self.assertEqual(self.store.get_artifact("summary")["status"], "active")
        self.assertEqual(self.store.audit("moon-otter-73")["matched_canary"], 3)
        self.assertEqual(self.store.audit()["stale_descendants"], 3)
        self.assertTrue(self.store.retrieve("Alice passphrase"))
        self.assertEqual(self.store.retrieve("Alice passphrase", exclude_stale=True), [])

    def test_multi_hop_purge_erases_every_descendant_and_keeps_edges(self):
        self.seed_chain()
        before_edges = self.store.lineage()["edges"]
        self.assertEqual(self.store.descendants("a"), ["chunk", "summary", "chat"])
        self.store.delete_source_only("a")
        result = self.store.purge_derived("a")
        self.assertEqual(result["invalidated_ids"], ["chunk", "summary", "chat"])
        self.assertEqual(result["affected_ids"], ["chunk", "summary", "chat"])
        for artifact_id in result["targeted_ids"]:
            self.assertEqual(self.store.get_artifact(artifact_id)["body"], "")
        self.assertEqual(self.store.get_artifact("chat")["status"], "invalidated")
        self.assertEqual(self.store.get_artifact("chat")["source_ids"], ["a"])
        self.assertEqual(self.store.lineage()["edges"], before_edges)
        self.assertEqual(self.store.audit("moon-otter-73")["matched_canary"], 0)
        self.assertEqual(self.store.audit()["stale_descendants"], 0)
        self.assertEqual(self.store.purge_derived("a")["affected_ids"], [])

    def test_mixed_summary_invalidated_whole_but_independent_source_preserved(self):
        self.seed_chain()
        self.store.add_document("b", "Source B", "Bob's lunch preference is lentils.")
        self.store.add_artifact("chunk", "B chunk", "Bob prefers lentils.", ["b"], "b-chunk")
        self.store.add_artifact(
            "summary", "Mixed summary", "Alice: moon-otter-73. Bob: lentils.",
            ["summary", "b-chunk"], "mixed",
        )
        self.store.add_artifact("conversation", "Mixed response", "Both facts.", ["mixed"], "mixed-chat")
        result = self.store.purge_derived("a")
        self.assertEqual(result["retained_root_ids"], ["b"])
        self.assertEqual(self.store.get_artifact("mixed")["source_ids"], ["a", "b"])
        self.assertEqual(self.store.get_artifact("mixed")["body"], "")
        self.assertEqual(self.store.get_artifact("mixed-chat")["body"], "")
        self.assertEqual(self.store.get_artifact("b")["status"], "active")
        self.assertEqual(self.store.get_artifact("b-chunk")["body"], "Bob prefers lentils.")
        rebuilt = self.store.add_artifact("summary", "Rebuilt", "Bob: lentils.", ["b"], "rebuilt")
        self.assertEqual(rebuilt["source_ids"], ["b"])

    def test_independently_sourced_duplicate_fact_survives_and_audit_reports_it(self):
        self.seed_chain()
        self.store.add_document("independent", "Independent source", "Alice uses moon-otter-73.")
        self.store.add_artifact("summary", "Independent summary", "moon-otter-73", ["independent"], "copy")
        self.store.purge_derived("a")
        self.assertEqual(self.store.get_artifact("copy")["status"], "active")
        self.assertEqual(self.store.audit("moon-otter-73")["matched_canary_ids"], ["independent", "copy"])
        self.assertTrue(self.store.retrieve("moon-otter-73", exclude_stale=True))

    def test_titles_are_audited_and_scrubbed_alongside_bodies(self):
        self.store.add_document("a", "moon-otter-73 source", "Ordinary body")
        self.store.add_artifact("summary", "moon-otter-73 summary", "Ordinary body", ["a"], "summary")
        self.assertEqual(self.store.audit("moon-otter-73")["matched_canary_ids"], ["a", "summary"])
        self.store.delete_source_only("a")
        self.assertEqual(self.store.get_artifact("a")["title"], "Withdrawn document")
        self.assertEqual(self.store.audit("moon-otter-73")["matched_canary_ids"], ["summary"])
        self.store.purge_derived("a")
        self.assertEqual(self.store.get_artifact("summary")["title"], "Purged summary")
        self.assertEqual(self.store.audit("moon-otter-73")["matched_canary"], 0)

    def test_invalid_parents_and_cycles_cannot_be_inserted(self):
        self.store.add_document("a", "Source", "Safe text")
        for parents, artifact_id in [(["missing"], "new"), (["self"], "self"), (["a"], "a")]:
            with self.subTest(parents=parents, artifact_id=artifact_id):
                with self.assertRaises(ValueError):
                    self.store.add_artifact("summary", "Invalid", "text", parents, artifact_id)
        with self.assertRaises(ValueError):
            self.store.add_artifact("summary", "No provenance", "text", [])
        with self.assertRaises(ValueError):
            self.store.add_artifact("document", "Derived root", "text", ["a"])
        self.assertEqual(len(self.store.list_artifacts()), 1)

    def test_stale_active_parent_and_deleted_root_cannot_create_new_memories(self):
        self.seed_chain()
        self.store.delete_source_only("a")
        for parent in ("a", "chunk", "summary", "chat"):
            with self.subTest(parent=parent), self.assertRaises(ValueError):
                self.store.add_artifact("summary", "Forbidden", "text", [parent])
        self.store.purge_derived("a")
        with self.assertRaises(ValueError):
            self.store.add_artifact("conversation", "Forbidden", "text", ["chat"])

    def test_reopen_preserves_provenance_tombstones_and_erased_bodies(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "memory.sqlite3"
            first = Store(path)
            first.add_document("a", "Source A", "Private canary")
            first.add_document("b", "Source B", "Unaffected text")
            first.add_artifact("summary", "Mixed", "Private canary and other text", ["a", "b"], "mixed")
            first.purge_derived("a")
            first.close()
            second = Store(path)
            try:
                self.assertEqual(second.get_artifact("mixed")["parent_ids"], ["a", "b"])
                self.assertEqual(second.get_artifact("mixed")["source_ids"], ["a", "b"])
                self.assertEqual(second.get_artifact("mixed")["body"], "")
                self.assertEqual(second.get_artifact("a")["status"], "deleted")
                self.assertEqual(second.get_artifact("b")["body"], "Unaffected text")
                self.assertEqual(second.audit("Private canary")["matched_canary"], 0)
            finally:
                second.close()

    def test_lexical_retrieval_returns_only_matching_active_artifacts(self):
        self.store.add_document("a", "Breakfast", "Alice likes oatmeal.")
        self.store.add_document("b", "Lunch", "Bob likes lentils.")
        self.assertEqual([a["id"] for a in self.store.retrieve("What does Alice like?")], ["a"])
        self.assertEqual(self.store.retrieve("unrelated"), [])
        self.assertEqual(self.store.retrieve("Alice", limit=0), [])
        self.assertIsNone(self.store.get_artifact("missing"))
        self.assertEqual(self.store.descendants("missing"), [])


class PublicationPrimitiveTests(unittest.TestCase):
    """replace_contents and check_writable, used by Experiment.reset publication."""

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.directory = Path(directory.name)
        self.path = self.directory / "target.sqlite"
        self.target = Store(self.path)
        self.addCleanup(self.target.close)
        self.target.add_document("old", "Old run", "Kept unless a copy completes.")
        self.source = Store()
        self.addCleanup(self.source.close)
        for i in range(6):
            self.source.add_document(f"new-{i}", "New run", "Replacement body. " * 200)

    def digest(self):
        return hashlib.sha256(self.path.read_bytes()).hexdigest()

    def test_aborted_copy_leaves_bytes_and_writability_then_full_copy_replaces(self):
        before, steps = self.digest(), []

        def progress(_status, remaining, _total):
            steps.append(remaining)
            if len(steps) == 2:
                raise RuntimeError("injected")

        with self.assertRaises(RuntimeError):
            self.target.replace_contents(self.source, pages=1, progress=progress)
        self.assertGreater(steps[-1], 0)
        self.assertEqual(before, self.digest())
        self.assertEqual(["old"], [a["id"] for a in self.target.list_artifacts()])
        self.target.check_writable()
        self.target.replace_contents(self.source)
        self.assertEqual(self.source.lineage(), self.target.lineage())
        self.target.add_document("after", "After", "Still writable.")
        self.assertEqual(["target.sqlite"], sorted(p.name for p in self.directory.iterdir()))
        reopened = Store(self.path)
        try:
            self.assertEqual(7, len(reopened.list_artifacts()))
            self.assertIsNone(reopened.get_artifact("old"))
        finally:
            reopened.close()

    def test_write_probe_changes_nothing_and_detects_a_replaced_file(self):
        before, rows = self.digest(), self.target.list_artifacts()
        self.target.check_writable()
        self.assertEqual((before, rows), (self.digest(), self.target.list_artifacts()))
        other = self.directory / "other.sqlite"
        Store(other).close()
        os.replace(other, self.path)  # the old connection now points at an unlinked inode
        with self.assertRaises(sqlite3.OperationalError):
            self.target.check_writable()


if __name__ == "__main__":
    unittest.main()
