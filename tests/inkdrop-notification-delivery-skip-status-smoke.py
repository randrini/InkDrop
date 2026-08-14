#!/usr/bin/env python3
"""Regression for the notification_deliveries "skipped" terminal status.

This is the real mechanism (added alongside the fix for the
scan_import_verified() cold-start flood -- see
core/inkdrop_notification_events.py's IMPORT_VERIFIED_STALE_SECONDS guard)
for retroactively clearing a backlog of already-queued deliveries that
should never be sent, without touching queued deliveries a real user still
wants delivered, and without a raw DB delete.

Confirms: update_delivery() accepts status="skipped"; a skipped delivery
drops out of due_queued_deliveries/claim_next_due_delivery (so it can never
be picked up and sent later); list_deliveries can filter on it; and
unrelated queued rows are untouched by transitioning one delivery.
"""

import tempfile
import time
from pathlib import Path

from core import inkdrop_state
from core import inkdrop_notification_store as store


def require(condition, message):
    if not condition:
        raise AssertionError(message)


with tempfile.TemporaryDirectory() as temp_dir:
    db_path = Path(temp_dir) / "state.sqlite3"
    with inkdrop_state.connect(db_path) as con:
        inkdrop_state.init_schema(con)

    require("skipped" in store.DELIVERY_STATUSES, "skipped must be a recognized delivery status")

    stale = store.record_delivery(
        db_path, event_type="import_verified", channel_id="pushover", occurrence_key="occ-stale",
        subject="stale", message="a backlog row nobody should get paged about",
        status="queued", queue_reason="rate_limit", attempt=0, max_attempts=1,
    )
    fresh = store.record_delivery(
        db_path, event_type="import_verified", channel_id="pushover", occurrence_key="occ-fresh",
        subject="fresh", message="a genuinely recent import still waiting to send",
        status="queued", queue_reason="rate_limit", attempt=0, max_attempts=1,
    )

    before = store.due_queued_deliveries(db_path, now=time.time() + 3600)
    require(len(before) == 2, f"both rows should be due before any skip: {before}")

    skipped = store.update_delivery(
        db_path, stale["id"], status="skipped",
        error_detail="cold-start backlog flood (scan_import_verified watermark bug) -- superseded, not delivered",
    )
    require(skipped["status"] == "skipped", f"update_delivery must apply the skipped status: {skipped}")
    require("backlog flood" in (skipped["error_detail"] or ""), f"the reason must be recorded: {skipped}")

    due_after = store.due_queued_deliveries(db_path, now=time.time() + 3600)
    require(len(due_after) == 1 and due_after[0]["id"] == fresh["id"],
            f"a skipped row must never be picked up by the queued-delivery drain: {due_after}")

    still_queued = store.list_deliveries(db_path, status="queued")
    require(len(still_queued) == 1 and still_queued[0]["id"] == fresh["id"],
            f"the untouched row must still read back as queued: {still_queued}")

    skipped_rows = store.list_deliveries(db_path, status="skipped")
    require(len(skipped_rows) == 1 and skipped_rows[0]["id"] == stale["id"],
            f"list_deliveries must be able to filter on the skipped status: {skipped_rows}")

    claimed = store.claim_next_due_delivery(db_path, now=time.time() + 3600, max_per_hour=0)
    require(claimed is not None and claimed["id"] == fresh["id"],
            f"claim_next_due_delivery must skip the skipped row and reach the still-queued one: {claimed}")

    try:
        store.update_delivery(db_path, fresh["id"], status="not_a_real_status")
        raise AssertionError("update_delivery must still reject unknown statuses")
    except ValueError:
        pass

    print("inkdrop-notification-delivery-skip-status-smoke: all checks passed")
