"""Optional, metadata-only Sentry tracing (DECISIONS.md D-17).

Tracing is off unless GHOSTCACHE_SENTRY_DSN is set, and sentry_sdk is imported
only then, so the core stays standard-library only. Sentry does not filter
manually set span data, so ALLOWED_KEYS is the privacy boundary: no document
text, title, question, answer or marker may ever be set on a span.
"""

from __future__ import annotations

import contextlib
import os
from typing import Any, Iterator


DSN_VARIABLE = "GHOSTCACHE_SENTRY_DSN"
MISSING_SDK = ("GHOSTCACHE_SENTRY_DSN is set but sentry-sdk is not installed; "
               "install the optional `sentry` extra")
ENABLED_MESSAGE = "Sentry tracing enabled (metadata only)"

ALLOWED_KEYS = frozenset({
    "gen_ai.operation.name", "gen_ai.agent.name", "gen_ai.provider.name", "gen_ai.request.model",
    "gen_ai.response.model", "gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens",
    "gen_ai.usage.total_tokens", "gen_ai.request.temperature", "gen_ai.request.max_tokens",
    "gen_ai.memory.store.id", "gen_ai.memory.record.id", "gen_ai.memory.record.count",
    "error.type", "ghostcache.mode", "ghostcache.stage", "ghostcache.question_kind",
    "ghostcache.context_ids", "ghostcache.citation_count", "ghostcache.persisted",
    "ghostcache.exclude_stale", "ghostcache.answer_contains_marker", "ghostcache.affected_count",
    "ghostcache.retained_root_count", "ghostcache.rebuild_failed", "ghostcache.checks_passed",
    "ghostcache.checks_total", "ghostcache.matched_marker_rows", "ghostcache.stale_descendants",
    "ghostcache.error.category",
})

_sdk: Any = None  # the sentry_sdk module while tracing is enabled


class TelemetryError(RuntimeError):
    """Tracing was requested but cannot start. The message never contains the DSN."""


def init(mode: str, *, transport: Any = None) -> bool:
    """Enable tracing when GHOSTCACHE_SENTRY_DSN is set; return whether it is on."""
    global _sdk
    dsn = os.environ.get(DSN_VARIABLE, "").strip()
    if not dsn:
        return False
    if _sdk is not None:
        return True  # already enabled in this process; keep that client and transport
    try:
        import sentry_sdk
    except ImportError:
        raise TelemetryError(MISSING_SDK) from None
    sentry_sdk.init(
        dsn=dsn, traces_sample_rate=1.0, send_default_pii=False,
        # No automatic spans (they would record the Ollama URL), logging,
        # excepthook or atexit integrations; flush() replaces the atexit flush.
        default_integrations=False, include_local_variables=False, max_breadcrumbs=0,
        server_name="ghostcache-local",  # instead of this machine's hostname
        release="ghostcache@0.1.0", environment=f"local-{mode}",
        before_send=lambda _event, _hint: None,  # traces only: drop every error event
        transport=transport)
    _sdk = sentry_sdk
    return True


def enabled() -> bool:
    return _sdk is not None


def shutdown() -> None:
    """Close the Sentry client and disable tracing (used by tests)."""
    global _sdk
    if _sdk is not None:
        sdk, _sdk = _sdk, None
        with contextlib.suppress(Exception):
            sdk.get_client().close()


def set(span: Any, key: str, value: Any) -> None:
    """Set one allowlisted metadata attribute; None values are skipped.

    Raises ValueError for any other key or for a value that is not a str, int,
    float or bool. Encode lists of IDs as JSON strings first.
    """
    if key not in ALLOWED_KEYS:
        raise ValueError(f"Span attribute {key!r} is not in telemetry.ALLOWED_KEYS.")
    if value is None:
        return
    if not isinstance(value, (str, int, float, bool)):
        raise ValueError(f"Span attribute {key!r} must be a str, int, float or bool.")
    if span is not None:
        span.set_data(key, value)


def set_conversation(conversation_id: str | None) -> None:
    """Group the following gen_ai spans under a random per-experiment ID."""
    if _sdk is not None and conversation_id:
        _sdk.get_current_scope().set_conversation_id(conversation_id)


@contextlib.contextmanager
def span(op: str, name: str, data: dict[str, Any] | None = None, *,
         root: bool = False) -> Iterator[Any]:
    """A Sentry span (a transaction when root=True), or a no-op while disabled.

    op and name must be fixed strings. Exceptions mark the span as an error with
    their class name and propagate unchanged. A failing exporter never changes
    the application's result.
    """
    if _sdk is None:
        yield None
        return
    current = (_sdk.start_transaction if root else _sdk.start_span)(op=op, name=name)
    current.__enter__()
    try:
        for key, value in (data or {}).items():
            set(current, key, value)
        yield current
    except BaseException as exc:
        current.set_status("internal_error")
        set(current, "error.type", type(exc).__name__)
        _finish(current, exc)
        raise
    _finish(current, None)


def _finish(current: Any, exc: BaseException | None) -> None:
    try:
        current.__exit__(type(exc) if exc else None, exc, exc.__traceback__ if exc else None)
    except Exception:
        pass


def flush(timeout: float = 5.0) -> None:
    if _sdk is not None:
        with contextlib.suppress(Exception):
            _sdk.flush(timeout=timeout)
