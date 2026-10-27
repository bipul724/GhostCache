import contextlib
import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ghostcache import app as app_module
from ghostcache.app import Experiment, QUESTIONS, StorageError, evaluate
from ghostcache.providers import FixtureProvider, OllamaProvider, ProviderError
from ghostcache.store import Store


class ScriptedLive(FixtureProvider):
    """Deterministic stand-in for local Ollama that can fail on a chosen call."""

    mode = "live"
    model = "scripted-live"

    def __init__(self, fail_on=None, error=ProviderError, available=True):
        self.fail_on, self.error, self.available, self.calls = fail_on, error, available, []

    def status(self):
        return {"available": self.available, "model": self.model,
                "message": "ok" if self.available else "scripted model unavailable"}

    def _call(self, kind):
        self.calls.append(kind)
        if self.fail_on == (kind, self.calls.count(kind)):
            raise self.error(f"scripted {kind} failure")

    def summarize(self, artifacts):
        self._call("summary")
        return super().summarize(artifacts)

    def answer(self, question, artifacts):
        self._call("answer")
        return super().answer(question, artifacts)


class PublicationFailure(Exception):
    """Raised from inside SQLite's backup loop to abort a real publication."""


@contextlib.contextmanager
def failing_publication(step=2):
    """Run the real backup one page at a time and abort it on ``step``."""
    real = Store.replace_contents
    remaining = []

    def progress(_status, pages_left, _total):
        remaining.append(pages_left)
        if len(remaining) == step:
            raise PublicationFailure("injected mid-publication failure")

    def replace_contents(store, source, **_kwargs):
        remaining.clear()
        real(store, source, pages=1, progress=progress)

    with patch.object(Store, "replace_contents", replace_contents):
        yield remaining


class TrackedConnection(sqlite3.Connection):
    closed = False

    def close(self):
        self.closed = True
        super().close()


@contextlib.contextmanager
def tracked_connections():
    """Record (path, connection) for every SQLite connection a Store opens."""
    real = sqlite3.connect
    opened = []

    def connect(database, *args, **kwargs):
        connection = real(database, *args, factory=TrackedConnection, **kwargs)
        opened.append((database, connection))
        return connection

    with patch("ghostcache.store.sqlite3.connect", connect):
        yield opened


class ExperimentTests(unittest.TestCase):
    def setUp(self):
        self.app = Experiment()
        # Unit tests require no network, including the optional provider banner.
        self.status = patch.object(OllamaProvider, "status", return_value={
            "available": False, "model": "not-running", "message": "offline"})
        self.status.start()

    def tearDown(self):
        self.app.close()
        self.status.stop()

    def test_complete_fixture_demonstrates_leak_and_cleanup(self):
        initial = self.app.reset()
        self.assertEqual(5, sum(a["kind"] == "document" for a in initial["artifacts"]))
        canary = initial["scenario"]["canary"]
        self.assertIn(canary, self.app.ask(QUESTIONS["secret"])["answer"])
        incomplete = self.app.delete("source_only")
        self.assertGreater(incomplete["audit"]["stale_descendants"], 0)
        self.assertGreater(incomplete["audit"]["matched_canary"], 0)
        self.assertIn(canary, self.app.ask(QUESTIONS["paraphrase"])["answer"])
        cleaned = self.app.delete("cascade")
        self.assertEqual(0, cleaned["audit"]["matched_canary"])
        self.assertEqual(0, cleaned["audit"]["stale_descendants"])
        self.assertTrue(self.app.verify()["passed"])

    def test_cleanup_rebuilds_only_from_surviving_roots(self):
        initial = self.app.reset()
        old_canary = initial["scenario"]["canary"]
        state = self.app.delete("cascade")
        rebuilt = [a for a in state["artifacts"] if a["id"].startswith("s-rebuilt")]
        self.assertEqual(1, len(rebuilt))
        self.assertNotIn("d-vault", rebuilt[0]["source_ids"])
        self.assertNotIn(old_canary, rebuilt[0]["body"])
        self.assertIn("07:40", rebuilt[0]["body"])
        self.assertIn("Lantern Hall", self.app.ask(QUESTIONS["shared"])["answer"])

    def test_reset_uses_fresh_marker_and_discards_prior_context(self):
        first = self.app.reset()["scenario"]["canary"]
        second = self.app.reset()["scenario"]["canary"]
        self.assertNotEqual(first, second)
        self.assertEqual(0, self.app.store.audit(first)["matched_canary"])

    def test_verify_does_not_pass_before_cleanup(self):
        self.app.reset()
        self.assertFalse(self.app.verify()["passed"])
        self.app.delete("source_only")
        self.assertFalse(self.app.verify()["passed"])

    def test_repeated_cleanup_does_not_rebuild_or_change_survivors(self):
        self.app.reset()
        self.app.delete("cascade")
        before = self.app.store.list_artifacts()
        again = self.app.delete("cascade")
        self.assertEqual([], again["deletion"]["affected_ids"])
        self.assertEqual(before, self.app.store.list_artifacts())

    def test_live_request_never_silently_uses_fixture(self):
        with self.assertRaises(ProviderError):
            self.app.reset("live")
        self.app.reset()
        self.app.provider = OllamaProvider()
        with patch.object(self.app.provider, "answer", side_effect=ProviderError("offline")):
            with self.assertRaises(ProviderError):
                self.app.ask(QUESTIONS["secret"])

    def test_deletion_during_generation_prevents_stale_commit(self):
        self.app.reset()
        parents = [self.app.store.get_artifact("s-vault")]
        result = FixtureProvider().summarize(parents)
        self.app.store.delete_source_only("d-vault")
        with self.assertRaises(ValueError):
            self.app._commit_generation("summary", "Late answer", parents, result)

    def test_evaluation_labels_fixture_and_preserves_positive_controls(self):
        report = evaluate("fixture")
        self.assertTrue(report["passed"])
        self.assertEqual("fixture", report["mode"])
        self.assertEqual(10, len(report["checks"]))
        self.assertEqual(0, report["stages"]["cleaned_audit"]["matched_canary"])


class TempDatabaseCase(unittest.TestCase):
    """A controller on a temporary file database, with the network patched out."""

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / "demo.sqlite"
        self.status = patch.object(OllamaProvider, "status", return_value={
            "available": False, "model": "not-running", "message": "offline"})
        self.status.start()
        self.addCleanup(self.status.stop)
        self.app = Experiment(self.path)
        self.addCleanup(self.app.close)

    def snapshot(self):
        state = self.app.state()
        disk = hashlib.sha256(self.path.read_bytes()).hexdigest() if self.path.exists() else None
        return ({k: state[k] for k in ("mode", "stage", "scenario", "artifacts", "events", "seed_checks")},
                self.app.generation_number, disk)

    def assert_no_candidate_files(self, *keep):
        """Only the database itself (and named unrelated files) may remain."""
        expected = sorted({*keep, *([self.path.name] if self.path.exists() else [])})
        self.assertEqual(expected, sorted(p.name for p in self.path.parent.iterdir()))

    def disk_store(self):
        store = Store(self.path)
        self.addCleanup(store.close)
        return store


class ResetFailureTests(TempDatabaseCase):
    """A failed seed must never publish partial state or another run's checks."""

    def test_failed_first_seed_publishes_nothing_and_leaves_no_database(self):
        self.app.live = ScriptedLive(fail_on=("summary", 1))
        with self.assertRaises(ProviderError):
            self.app.reset("live")
        state = self.app.state()
        self.assertEqual(("empty", "fixture", [], {}, [], []),
                         (state["stage"], state["mode"], state["artifacts"], state["scenario"],
                          state["events"], state["seed_checks"]))
        self.assertEqual(0, self.app.generation_number)
        self.assertFalse(self.path.exists())
        self.assert_no_candidate_files()
        for action in (self.app.verify, lambda: self.app.delete("cascade")):
            with self.assertRaises(ValueError):
                action()

    def test_failure_at_any_seed_step_keeps_previous_experiment(self):
        self.app.reset()
        before = self.snapshot()
        for fail_on, error in ((("summary", 1), ProviderError), (("summary", 2), ProviderError),
                               (("summary", 3), ProviderError), (("answer", 1), ProviderError),
                               (("summary", 2), RuntimeError)):
            with self.subTest(fail_on=fail_on, error=error.__name__):
                self.app.live = ScriptedLive(fail_on=fail_on, error=error)
                with self.assertRaises(error):
                    self.app.reset("live")
                self.assertEqual(fail_on[0], self.app.live.calls[-1])
                self.assertEqual(before, self.snapshot())
                self.assert_no_candidate_files()
        # The preserved experiment is still a complete, working one.
        canary = self.app.scenario["canary"]
        self.app.delete("source_only")
        self.assertIn(canary, self.app.ask(QUESTIONS["paraphrase"])["answer"])
        self.app.delete("cascade")
        self.assertTrue(self.app.verify()["passed"])

    def test_invalid_mode_and_unavailable_model_leave_state_untouched(self):
        self.app.reset()
        before = self.snapshot()
        with self.assertRaises(ValueError):
            self.app.reset("bogus")
        self.assertEqual(before, self.snapshot())
        self.app.live = ScriptedLive(available=False)
        with self.assertRaises(ProviderError):
            self.app.reset("live")
        self.assertEqual([], self.app.live.calls)
        self.assertEqual(before, self.snapshot())
        self.assert_no_candidate_files()

    def test_successful_reset_after_failure_replaces_all_run_state(self):
        old = self.app.reset()
        old_canary = old["scenario"]["canary"]
        self.app.live = ScriptedLive(fail_on=("summary", 2))
        with self.assertRaises(ProviderError):
            self.app.reset("live")
        self.app.live = ScriptedLive()
        state = self.app.reset("live")
        canary = state["scenario"]["canary"]
        self.assertNotEqual(old_canary, canary)
        self.assertEqual(("live", "seeded", 2), (state["mode"], state["stage"], self.app.generation_number))
        self.assertEqual(["summary", "summary", "summary", "answer"], self.app.live.calls)
        self.assertEqual([True], [check["passed"] for check in state["seed_checks"]])
        self.assertEqual(5, len(state["events"]))
        self.assertTrue(all(event["mode"] == "live" for event in state["events"]))
        self.assertEqual(14, state["audit"]["total_artifacts"])
        self.assertEqual(0, self.app.store.audit(old_canary)["matched_canary"])
        self.assert_no_candidate_files()
        # The published on-disk database holds exactly the new experiment.
        on_disk = Store(self.path)
        try:
            self.assertEqual(6, on_disk.audit(canary)["matched_canary"])
            self.assertEqual(0, on_disk.audit(old_canary)["matched_canary"])
        finally:
            on_disk.close()

    def test_failed_reset_does_not_modify_an_existing_database_file(self):
        earlier = Store(self.path)
        earlier.add_document("d-earlier", "Earlier run", "Kept until a reset succeeds.")
        earlier.close()
        digest = hashlib.sha256(self.path.read_bytes()).hexdigest()
        restarted = Experiment(self.path)
        self.addCleanup(restarted.close)
        restarted.live = ScriptedLive(fail_on=("answer", 1))
        with self.assertRaises(ProviderError):
            restarted.reset("live")
        self.assertEqual(digest, hashlib.sha256(self.path.read_bytes()).hexdigest())
        self.assertEqual([], restarted.state()["artifacts"])
        self.assert_no_candidate_files()


class PublicationTests(TempDatabaseCase):
    """Publication rewrites the attached database in place, completely or not at all."""

    def test_candidate_construction_failure_changes_nothing(self):
        for attached in (False, True):
            with self.subTest(attached=attached):
                if attached:
                    self.app.reset()
                before = self.snapshot()
                with patch.object(app_module, "Store", side_effect=sqlite3.OperationalError("injected")):
                    with self.assertRaises(sqlite3.OperationalError):
                        self.app.reset()
                self.assertEqual(before, self.snapshot())
                self.assertEqual(attached, self.path.exists())
                self.assert_no_candidate_files()
        self.app.ask(QUESTIONS["retained"])
        self.assertEqual(15, len(self.disk_store().list_artifacts()))

    def test_mid_publication_failure_keeps_attached_experiment_and_file(self):
        self.app.reset()
        old_canary = self.app.scenario["canary"]
        before = self.snapshot()
        with failing_publication() as remaining, self.assertRaises(PublicationFailure):
            self.app.reset()
        self.assertGreater(remaining[-1], 0, "the copy must abort with pages still to go")
        self.assertEqual(before, self.snapshot())
        self.assertEqual(self.app.store.list_artifacts(), self.disk_store().list_artifacts())
        self.assert_no_candidate_files()
        # The recovered experiment still writes to the same file and completes.
        self.app.ask(QUESTIONS["retained"])
        self.assertEqual(15, len(self.disk_store().list_artifacts()))
        self.app.delete("source_only")
        self.assertIn(old_canary, self.app.ask(QUESTIONS["paraphrase"])["answer"])
        self.app.delete("cascade")
        self.assertTrue(self.app.verify()["passed"])
        canary = self.app.reset()["scenario"]["canary"]
        on_disk = self.disk_store()
        self.assertEqual((6, 0), (on_disk.audit(canary)["matched_canary"],
                                  on_disk.audit(old_canary)["matched_canary"]))
        self.assert_no_candidate_files()

    def test_mid_publication_failure_on_first_attach(self):
        with failing_publication(), self.assertRaises(PublicationFailure):
            self.app.reset()
        state = self.app.state()
        self.assertEqual(("empty", [], {}, 0), (state["stage"], state["artifacts"],
                                                state["scenario"], self.app.generation_number))
        self.assertFalse(self.path.exists())
        self.assert_no_candidate_files()
        earlier = Store(self.path)
        earlier.add_document("d-earlier", "Earlier run", "Kept until a reset succeeds.")
        earlier.close()
        digest = hashlib.sha256(self.path.read_bytes()).hexdigest()
        restarted = Experiment(self.path)
        self.addCleanup(restarted.close)
        with failing_publication(), self.assertRaises(PublicationFailure):
            restarted.reset()
        self.assertEqual(digest, hashlib.sha256(self.path.read_bytes()).hexdigest())
        self.assertEqual(("empty", []), (restarted.stage, restarted.state()["artifacts"]))
        self.assert_no_candidate_files()
        restarted.reset()
        on_disk = self.disk_store()
        self.assertEqual(14, len(on_disk.list_artifacts()))
        self.assertIsNone(on_disk.get_artifact("d-earlier"))

    def test_publication_never_swaps_files_and_opens_the_database_once(self):
        swap = AssertionError("publication must not swap files")
        with tracked_connections() as opened, patch("os.replace", side_effect=swap), \
                patch("os.rename", side_effect=swap):
            self.app.reset()
            self.app.reset()
            with failing_publication(), self.assertRaises(PublicationFailure):
                self.app.reset()
            self.app.live = ScriptedLive(fail_on=("summary", 2))
            with self.assertRaises(ProviderError):
                self.app.reset("live")
            self.app.reset()
        database = [connection for path, connection in opened if path == str(self.path)]
        self.assertEqual(1, len(database))
        self.assertIs(database[0], self.app.store._conn)
        self.assertEqual(3, self.app.generation_number)

    def test_unverifiable_restore_enters_storage_failed_then_recovers(self):
        self.app.reset()
        old_canary = self.app.scenario["canary"]
        real_check, probes = Store.check_writable, []

        def flaky_check(store):
            probes.append(store)
            if len(probes) == 1:
                raise sqlite3.OperationalError("injected verification failure")
            real_check(store)

        with tracked_connections() as opened:
            with failing_publication(), patch.object(Store, "check_writable", flaky_check):
                with self.assertRaises(StorageError) as caught:
                    self.app.reset()
            self.assertIsInstance(caught.exception.__cause__, PublicationFailure)
            self.assertEqual(StorageError.MESSAGE, str(caught.exception))
            state = self.app.state()
            self.assertEqual(("storage_failed", {}, [], [], [], 1),
                             (state["stage"], state["scenario"], state["events"],
                              state["seed_checks"], state["artifacts"], self.app.generation_number))
            for action in (lambda: self.app.ask(QUESTIONS["secret"]),
                           lambda: self.app.delete("cascade"), self.app.verify):
                with self.assertRaisesRegex(ValueError, "reset to recover"):
                    action()
            canary = self.app.reset()["scenario"]["canary"]
            self.assertEqual([self.app.store._conn], [c for _, c in opened if not c.closed])
            self.assertEqual(1, sum(path == str(self.path) for path, _ in opened))
        self.assertEqual(("seeded", 2), (self.app.stage, self.app.generation_number))
        on_disk = self.disk_store()
        self.assertEqual((6, 0), (on_disk.audit(canary)["matched_canary"],
                                  on_disk.audit(old_canary)["matched_canary"]))

    def test_failed_target_construction_removes_only_files_it_created(self):
        unrelated = self.path.with_name(self.path.name + ".candidate")
        unrelated.write_bytes(b"unrelated user file")
        real_store = Store

        def failing_target(path=":memory:", **kwargs):
            if str(path) == ":memory:":
                return real_store(**kwargs)
            self.assertEqual({"create_schema": False}, kwargs)
            with open(path, "ab"):
                pass
            Path(f"{path}-journal").touch()
            raise sqlite3.OperationalError("injected target failure")

        with patch.object(app_module, "Store", failing_target), self.assertRaises(sqlite3.OperationalError):
            self.app.reset()
        self.assertFalse(self.path.exists())
        self.assertEqual("empty", self.app.stage)
        self.assert_no_candidate_files(unrelated.name)
        earlier = Store(self.path)
        earlier.add_document("d-earlier", "Earlier run", "Not created by the reset.")
        earlier.close()
        digest = hashlib.sha256(self.path.read_bytes()).hexdigest()
        restarted = Experiment(self.path)
        self.addCleanup(restarted.close)
        with patch.object(app_module, "Store", failing_target), self.assertRaises(sqlite3.OperationalError):
            restarted.reset()
        self.assertEqual(digest, hashlib.sha256(self.path.read_bytes()).hexdigest())
        self.assert_no_candidate_files(unrelated.name)
        restarted.live = ScriptedLive(fail_on=("answer", 1))
        with self.assertRaises(ProviderError):
            restarted.reset("live")
        restarted.reset()
        restarted.reset()
        self.assertEqual(b"unrelated user file", unrelated.read_bytes())
        self.assert_no_candidate_files(unrelated.name)

    def unrelated_sqlite_file(self):
        """A valid SQLite database that GhostCache did not create."""
        connection = sqlite3.connect(self.path)
        with connection:
            connection.execute("CREATE TABLE notes (body TEXT)")
            connection.execute("INSERT INTO notes VALUES ('not a GhostCache experiment')")
        connection.close()
        return hashlib.sha256(self.path.read_bytes()).hexdigest()

    def tables(self):
        connection = sqlite3.connect(self.path)
        try:
            return sorted(row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"))
        finally:
            connection.close()

    def test_failed_first_attach_does_not_write_to_an_unrelated_sqlite_file(self):
        digest = self.unrelated_sqlite_file()
        with tracked_connections() as opened:
            app = Experiment(self.path)
            self.addCleanup(app.close)
            with failing_publication() as remaining, self.assertRaises(PublicationFailure):
                app.reset()
            self.assertGreater(remaining[-1], 0)
            self.assertEqual([app.store._conn], [c for _, c in opened if not c.closed])
        self.assertEqual(digest, hashlib.sha256(self.path.read_bytes()).hexdigest())
        self.assertEqual(["notes"], self.tables())
        state = app.state()
        self.assertEqual(("empty", [], {}, 0), (state["stage"], state["artifacts"],
                                                state["scenario"], app.generation_number))
        self.assert_no_candidate_files()

    def test_successful_first_attach_replaces_an_unrelated_sqlite_file(self):
        self.unrelated_sqlite_file()
        canary = self.app.reset()["scenario"]["canary"]
        self.assertEqual(["artifacts", "provenance", "sqlite_sequence"], self.tables())
        self.assertEqual(6, self.disk_store().audit(canary)["matched_canary"])
        self.assert_no_candidate_files()

    def test_probe_failure_after_a_completed_first_copy_is_not_hidden(self):
        # The one failure after which an existing file's bytes differ: the copy
        # completed, so the file holds the new experiment, but nothing is attached.
        digest = self.unrelated_sqlite_file()
        with patch.object(Store, "check_writable", side_effect=sqlite3.OperationalError("probe")):
            with self.assertRaises(sqlite3.OperationalError):
                self.app.reset()
        self.assertNotEqual(digest, hashlib.sha256(self.path.read_bytes()).hexdigest())
        self.assertEqual(["artifacts", "provenance", "sqlite_sequence"], self.tables())
        self.assertEqual(("empty", [], False), (self.app.stage, self.app.state()["artifacts"],
                                                self.app._attached))
        canary = self.app.reset()["scenario"]["canary"]
        self.assertEqual(6, self.disk_store().audit(canary)["matched_canary"])

    def test_failed_and_successful_resets_close_every_other_connection(self):
        with tracked_connections() as opened:
            app = Experiment(self.path)
            self.addCleanup(app.close)
            app.live = ScriptedLive(fail_on=("summary", 1))
            with self.assertRaises(ProviderError):
                app.reset("live")
            with failing_publication(), self.assertRaises(PublicationFailure):
                app.reset()
            app.reset()
            with failing_publication(), self.assertRaises(PublicationFailure):
                app.reset()
            app.live = ScriptedLive(fail_on=("answer", 1))
            with self.assertRaises(ProviderError):
                app.reset("live")
            app.reset()
            self.assertEqual([app.store._conn], [c for _, c in opened if not c.closed])
            # Store.__init__ closes its own connection and keeps a file it did not create.
            bogus = self.path.with_name("not-a-database.sqlite")
            bogus.write_bytes(b"not a database " * 64)
            count = len(opened)
            with self.assertRaises(sqlite3.DatabaseError):
                Store(bogus)
            self.assertEqual(count + 1, len(opened))
            self.assertTrue(opened[-1][1].closed)
            other = Experiment(bogus)
            with self.assertRaises(sqlite3.DatabaseError):
                other.reset()
            self.assertEqual("empty", other.stage)
            other.close()
            self.assertEqual([app.store._conn], [c for _, c in opened if not c.closed])
        self.assertEqual(b"not a database " * 64, bogus.read_bytes())


if __name__ == "__main__":
    unittest.main()
