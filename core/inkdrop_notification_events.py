#!/usr/bin/env python3
"""Read-only, diff-based event detection for the notifications system.

Turns raw pipeline/state-DB rows into notification events without touching
the pipeline: every query here is a plain read-only SELECT against tables
inkdrop_state.py owns, diffed against last-seen state kept in
inkdrop_notification_store's watch-state table. Nothing here writes to
queue_items / download_tasks / series / issues, calls into the matching or
candidate-acceptance pipeline, or imports inkdrop_state.py's write paths.

"grabbed" and "download_failed" are scoped deliberately narrow: download_tasks
is a per-attempt table with heavy internal retry churn (most "failed" rows are
routine, automatically-retried candidate attempts, not something a user should
be paged about). So the signal used here is a task actually reaching a
downloading state (grabbed), and -- only for tasks this module already
announced as grabbed -- that same task later reaching a terminal failed state
(retry_eligible=0). That pairing is what keeps this from turning into noise.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from core import inkdrop_notification_store as store
from core import inkdrop_notifications

DOWNLOAD_TASK_SCAN_LIMIT = 500
TASK_WATCH_PREFIX = "dt:"
TASK_WATCH_RETENTION_SECONDS = 30 * 86400

QUEUE_VERIFIED_SCAN_LIMIT = 500

# A queue in one of these states (or inactive) has no automatic path left --
# matches the same terminal-state vocabulary inkdrop_slskd_source_probe.py
# already uses to decide which queues are still worth reconciling. Anything
# else (searching, downloading, importing, retry-scheduled, etc.) means the
# canonical unit can still complete through another source or candidate, so
# a failed attempt there must not be announced as an item-level failure.
QUEUE_TERMINAL_STATES = {
    "verified", "satisfied", "superseded_duplicate", "removed",
    "ignored", "inactive", "needs_you", "blocked",
}

HEALTH_CHECK_PROVIDERS = (
    ("comicvine", "ComicVine"),
    ("kavita", "Kavita"),
    ("prowlarr", "Prowlarr"),
    ("qbittorrent", "qBittorrent"),
    ("sabnzbd", "SABnzbd"),
    ("slskd", "Soulseek (slskd)"),
)

UPDATE_NOTABLE_STATES = {"update_available", "newer_prerelease_available"}


def _read_only_connect(db_path):
    con = sqlite3.connect(f"file:{Path(db_path)}?mode=ro", uri=True, timeout=30.0)
    con.row_factory = sqlite3.Row
    return con


def _issue_label(issue_number, issue_title):
    parts = []
    if issue_number:
        parts.append(f"#{issue_number}")
    if issue_title:
        parts.append(str(issue_title))
    return " ".join(parts) or None


def scan_grabbed_and_download_failed(db_path):
    watermark_key = "scan:download_tasks:watermark"
    watermark = float(store.get_watch_state(db_path, watermark_key).get("updated_at") or 0)

    con = _read_only_connect(db_path)
    try:
        rows = con.execute(
            """
            select dt.id, dt.series_id, dt.issue_id, dt.queue_id, dt.state, dt.retry_eligible,
                   dt.failure_reason, dt.updated_at,
                   s.title as series_title, i.issue_number, i.title as issue_title,
                   q.active as queue_active, q.state as queue_state, q.retry_after as queue_retry_after,
                   (
                       select count(*) from download_tasks sib
                       where sib.queue_id = dt.queue_id
                         and sib.id <> dt.id
                         and sib.state in ('downloading', 'import_ready', 'importing', 'verified')
                   ) as active_sibling_tasks
            from download_tasks dt
            left join series s on s.id = dt.series_id
            left join issues i on i.id = dt.issue_id
            left join queue_items q on q.id = dt.queue_id
            where dt.state in ('downloading', 'failed') and dt.updated_at > ?
            order by dt.updated_at asc
            limit ?
            """,
            (watermark, DOWNLOAD_TASK_SCAN_LIMIT),
        ).fetchall()
    finally:
        con.close()

    fired = {"grabbed": 0, "download_failed": 0}
    max_seen = watermark
    for row in rows:
        max_seen = max(max_seen, float(row["updated_at"] or 0))
        task_key = f"{TASK_WATCH_PREFIX}{row['id']}"
        seen = store.get_watch_state(db_path, task_key)
        series_title = row["series_title"] or "A series"
        issue_label = _issue_label(row["issue_number"], row["issue_title"])

        if row["state"] == "downloading":
            if not seen.get("grabbed_announced"):
                inkdrop_notifications.notify_grabbed(
                    db_path, series=series_title, issue_label=issue_label,
                    series_id=row["series_id"], issue_id=row["issue_id"], task_id=row["id"],
                )
                fired["grabbed"] += 1
                seen["grabbed_announced"] = True
            store.set_watch_state(db_path, task_key, seen)
        elif row["state"] == "failed" and int(row["retry_eligible"] or 0) == 0:
            if seen.get("grabbed_announced") and not seen.get("failed_announced"):
                queue_active = row["queue_active"]
                queue_state = str(row["queue_state"] or "").strip().lower()
                # A missing queue_items row (queue_active is None -- the join
                # found nothing) means we can't prove the canonical unit is
                # still retryable, so default to terminal wording rather than
                # silently understating a real permanent failure.
                queue_terminal = (
                    queue_active is None
                    or int(queue_active or 0) == 0
                    or queue_state in QUEUE_TERMINAL_STATES
                )
                has_retry_scheduled = bool(row["queue_retry_after"])
                has_active_sibling = int(row["active_sibling_tasks"] or 0) > 0
                terminal = queue_terminal and not has_retry_scheduled and not has_active_sibling
                inkdrop_notifications.notify_download_failed(
                    db_path, series=series_title, issue_label=issue_label, reason=row["failure_reason"],
                    series_id=row["series_id"], issue_id=row["issue_id"], task_id=row["id"],
                    terminal=terminal,
                )
                fired["download_failed"] += 1
                seen["failed_announced"] = True
                store.set_watch_state(db_path, task_key, seen)

    if max_seen > watermark:
        store.set_watch_state(db_path, watermark_key, {"updated_at": max_seen})
    store.prune_watch_state(db_path, TASK_WATCH_PREFIX, older_than_seconds=TASK_WATCH_RETENTION_SECONDS)
    return fired


def scan_import_verified(db_path):
    """import_verified used to be fired ad hoc from just 2 of the ~11 code
    paths that can mark a queue item state='verified' -- everything else
    (sync_queue, pack imports, folder-presence backfills, duplicate-issue
    reconciliation, and more) went silent. Watching the shared 'verified'
    transition itself, the same way scan_grabbed_and_download_failed watches
    download_tasks instead of every call site that can grab or fail a task,
    makes the notification independent of which code path completed the
    import. notify_wanted_cleared() already dedupes repeat re-confirmations
    of the same issue via its own occurrence_key + 24h channel window, so no
    extra per-row "already announced" state is needed here -- the watermark
    alone is enough to avoid rescanning old rows."""
    watermark_key = "scan:queue_items:import_verified:watermark"
    watermark = float(store.get_watch_state(db_path, watermark_key).get("updated_at") or 0)

    con = _read_only_connect(db_path)
    try:
        rows = con.execute(
            """
            select q.id, q.series_id, q.issue_id, q.updated_at,
                   s.title as series_title, i.issue_number, i.title as issue_title
            from queue_items q
            left join series s on s.id = q.series_id
            left join issues i on i.id = q.issue_id
            where q.state = 'verified' and q.updated_at > ?
            order by q.updated_at asc
            limit ?
            """,
            (watermark, QUEUE_VERIFIED_SCAN_LIMIT),
        ).fetchall()
    finally:
        con.close()

    fired = 0
    max_seen = watermark
    for row in rows:
        max_seen = max(max_seen, float(row["updated_at"] or 0))
        try:
            inkdrop_notifications.notify_wanted_cleared(
                db_path,
                series=row["series_title"] or "A series",
                issue_title=row["issue_title"],
                issue_number=row["issue_number"],
                series_id=row["series_id"],
                issue_id=row["issue_id"],
            )
        except Exception:
            # notify() is documented to never raise -- this is defense in
            # depth, not a path that should ever trigger. It matters here
            # specifically because the watermark only advances after the
            # whole loop: an uncaught raise mid-batch would abort before
            # max_seen is ever persisted, so every row already notified
            # earlier in this same pass would be re-notified next time.
            pass
        fired += 1

    if max_seen > watermark:
        store.set_watch_state(db_path, watermark_key, {"updated_at": max_seen})
    return {"import_verified": fired}


def scan_health(db_path):
    """Diff each curated provider's on-demand health check against its
    last-seen state. Only a clean 'error' -> non-error (or the reverse)
    transition fires -- 'unavailable'/'disabled' aren't treated as an issue
    since those usually just mean "not configured yet", not "was working,
    now broken"."""
    from core import inkdrop_web

    checks = {
        "comicvine": lambda: inkdrop_web.comicvine_api_health(),
        "kavita": lambda: inkdrop_web.kavita_api_health(),
        "prowlarr": lambda: inkdrop_web.prowlarr_api_health(timeout=4.0),
        "qbittorrent": lambda: inkdrop_web.qbittorrent_api_health(),
        "sabnzbd": lambda: inkdrop_web.sabnzbd_api_health(),
        "slskd": lambda: inkdrop_web.slskd_api_health(timeout=4.0),
    }
    fired = {"health_issue": 0, "health_restored": 0}
    for provider_id, label in HEALTH_CHECK_PROVIDERS:
        check = checks.get(provider_id)
        if check is None:
            continue
        try:
            health = check() or {}
        except Exception:
            continue
        state = str(health.get("state") or "").strip().lower()
        if not state:
            continue
        is_error = state == "error"
        watch_key = f"health:{provider_id}"
        seen = store.get_watch_state(db_path, watch_key)
        was_error = bool(seen.get("is_error"))
        if is_error and not was_error:
            inkdrop_notifications.notify_health_issue(db_path, provider_label=label, detail=health.get("detail"))
            fired["health_issue"] += 1
        elif was_error and not is_error:
            inkdrop_notifications.notify_health_restored(db_path, provider_label=label)
            fired["health_restored"] += 1
        store.set_watch_state(db_path, watch_key, {"is_error": is_error, "state": state})
    return fired


def scan_application_update(db_path):
    from core import inkdrop_version

    try:
        status = inkdrop_version.update_status()
    except Exception:
        return {"application_update": 0}
    state = str((status or {}).get("state") or "").strip()
    if not state:
        return {"application_update": 0}
    watch_key = "application_update"
    seen = store.get_watch_state(db_path, watch_key)
    fired = 0
    if state in UPDATE_NOTABLE_STATES and seen.get("state") not in UPDATE_NOTABLE_STATES:
        inkdrop_notifications.notify_application_update(
            db_path, state=state, headline=status.get("label") or state, detail=status.get("detail"),
        )
        fired = 1
    store.set_watch_state(db_path, watch_key, {"state": state})
    return {"application_update": fired}


def run_scan(db_path):
    """Run every diff-based scanner once. Each is independently guarded --
    one raising doesn't stop the others."""
    results = {}
    for name, fn in (
        ("download_tasks", scan_grabbed_and_download_failed),
        ("import_verified", scan_import_verified),
        ("health", scan_health),
        ("application_update", scan_application_update),
    ):
        try:
            results[name] = fn(db_path)
        except Exception as exc:
            results[name] = {"error": f"{type(exc).__name__}: scan failed"}
    return results
