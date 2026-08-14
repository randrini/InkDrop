#!/usr/bin/env python3
"""A user's removal of a MangaDex companion outranks any automated repair.

A MangaDex companion is the raw-chapter bridge for a canonical ComicVine
series that only catalogs official collected volumes. Restoring one is a
real fix -- without it, chapter candidates are correctly rejected as "not
the volume this series collects" and new chapters are never grabbed. But
restoring one that a user *removed* is a different act entirely:

  * it clears removed_by_user, which is what series_id_user_removed() reads
    at every queue/wanted-item creation guard, so acquisition turns back on;
  * the restored companion runs in discovery_only mode, which hides it from
    the series list *and* from the removed view, so nothing on screen shows
    the removal was reversed.

An earlier build ran exactly that reversal as an unconditional schema-init
step, keyed on one hardcoded provider series id -- fine for the one
installation it was written for, silent data damage for any other
installation that happened to have linked and then removed that same
series. This file pins the contract that replaced it:

1. Schema init never revives a removed companion. Upgrading a database that
   has one leaves removal, monitoring, Wanted, queue, and the
   series_id_user_removed() download-authority guard exactly as they were.
2. restore_manga_companion_discovery() refuses a removed companion by
   default and writes nothing, reporting requires_confirmation.
3. The same call with allow_reactivating_user_removal=True -- the operator-
   confirmed repair path -- still performs the full restore, including
   clearing the removal keys that would otherwise leave a row claiming to
   be restored while every acquisition guard still refused to act on it.
4. A restored companion is genuinely discovery_only: out of the series
   list, cards, and duplicate-title detection, still fully live for
   search/acquisition, and that visibility survives a catalog refresh.
"""
import json
import re
import sqlite3
import tempfile
from pathlib import Path

from core import inkdrop_state


REMOVED_COMPANION_ID = "mangadex:11111111-2222-3333-4444-555555555555"


def _set_companion_raw(db_path, series_id, *, monitored, extra_raw):
    con = sqlite3.connect(db_path)
    try:
        row = con.execute("select raw_json from series where id=?", (series_id,)).fetchone()
        raw = json.loads(row[0] or "{}")
        raw.update(extra_raw)
        con.execute(
            "update series set monitored=?, monitor_new=?, raw_json=? where id=?",
            (int(monitored), int(monitored), json.dumps(raw), series_id),
        )
        con.commit()
    finally:
        con.close()


def _real_removal_shaped_raw():
    # The shape a genuine series_remove action leaves behind -- removed_by_user
    # plus the parked/guard breadcrumbs, files kept. Not the hand-written
    # series_shadow_retired shape that heal_zombie_manga_companion_links()
    # auto-heals; this one is a user's decision.
    return {
        "automation_parked": True,
        "automation_parked_reason": "user_removed",
        "automation_parked_message": "Series removed by user",
        "automation_parked_at": 1785379673.93,
        "automation_parked_at_iso": "2026-07-30T02:47:53Z",
        "removed_by_user": True,
        "removed_at": 1785379673.93,
        "removed_at_iso": "2026-07-30T02:47:53Z",
        "removed_preserved_from_sync": True,
        "removed_preserved_at": 1786403561.54,
        "removed_preserved_at_iso": "2026-08-10T23:12:41Z",
        "parked_reason": "user_removed",
        "parked_at": 1786400177.68,
        "parked_at_iso": "2026-08-10T22:16:17Z",
        "parked_context": {"operator_action": "series_remove", "keep_files": True, "remove_files": False},
        "parked_preserved_from_sync": True,
        "parked_preserved_at": 1786403561.54,
        "parked_preserved_at_iso": "2026-08-10T23:12:41Z",
        "series_removed_guard": True,
        "series_removed_guard_at": 1786400177.68,
        "series_removed_guard_at_iso": "2026-08-10T22:16:17Z",
        "series_removed_guard_message": "Series removed by user",
        "series_removed_guard_source": "sync_queue_removed_series",
    }


def _simulate_redeploy(db_path, *, drop_keys=()):
    key = str(Path(db_path).resolve())
    inkdrop_state.INIT_SCHEMA_READY_KEYS.discard(key)
    if drop_keys:
        con = sqlite3.connect(db_path)
        try:
            for schema_key in drop_keys:
                con.execute("delete from schema_meta where key=?", (schema_key,))
            con.commit()
        finally:
            con.close()
    with inkdrop_state.connect(db_path) as con:
        inkdrop_state.init_schema(con)


def _linked_companion(db_path, *, title, cv_provider_id, md_provider_id, mangadex_series_id=None):
    """A canonical ComicVine series plus its linked MangaDex companion."""
    cv = inkdrop_state.record_provider_series_catalog(
        db_path, provider="comicvine", provider_series_id=cv_provider_id, title=title,
        metadata={"mediaType": "manga", "publisher": "Shueisha"},
    )
    md = inkdrop_state.record_provider_series_catalog(
        db_path, provider="mangadex", provider_series_id=md_provider_id, title=title,
        metadata={"mediaType": "manga"},
    )
    if mangadex_series_id and mangadex_series_id != md["series_id"]:
        con = sqlite3.connect(db_path)
        try:
            con.execute("update series set id=? where id=?", (mangadex_series_id, md["series_id"]))
            con.commit()
        finally:
            con.close()
        md["series_id"] = mangadex_series_id
    link = inkdrop_state.upsert_manga_companion_link(
        db_path, comicvine_series_id=cv["series_id"], mangadex_series_id=md["series_id"],
        normalized_title=title,
    )
    assert link["ok"], link
    return cv, md


def _companion_state(db_path, series_id):
    con = sqlite3.connect(db_path)
    try:
        series = con.execute(
            "select monitored, monitor_new, raw_json from series where id=?", (series_id,)
        ).fetchone()
        discovery_mode = con.execute(
            "select discovery_mode from manga_companion_links where mangadex_series_id=?", (series_id,)
        ).fetchone()
        restore_events = con.execute(
            "select count(*) from history_events "
            "where event_type='manga_companion_discovery_restored' and series_id=?",
            (series_id,),
        ).fetchone()[0]
        wanted = con.execute("select count(*) from wanted_items where series_id=?", (series_id,)).fetchone()[0]
        queued = con.execute("select count(*) from queue_items where series_id=?", (series_id,)).fetchone()[0]
    finally:
        con.close()
    return {
        "monitored": series[0],
        "monitor_new": series[1],
        "raw_json": series[2],
        "discovery_mode": discovery_mode[0] if discovery_mode else None,
        "restore_events": restore_events,
        "wanted": wanted,
        "queued": queued,
    }


def test_schema_init_never_revives_a_removed_companion(tmp_path):
    """The regression this file exists for. Upgrading a database that holds a
    removed companion -- including one carrying the exact provider series id
    a past build hardcoded -- must change nothing about it: still removed,
    still unmonitored, no Wanted or queue rows, and series_id_user_removed()
    (the guard every queue/wanted-item creation path checks before acting on
    a series) still refusing.
    """
    db_path = tmp_path / "state.sqlite3"
    _cv, md = _linked_companion(
        db_path, title="Zeta Manga", cv_provider_id="zeta-cv", md_provider_id="zeta-md",
        mangadex_series_id=REMOVED_COMPANION_ID,
    )
    _set_companion_raw(db_path, md["series_id"], monitored=False, extra_raw=_real_removal_shaped_raw())

    before = _companion_state(db_path, md["series_id"])
    assert before["monitored"] == 0 and before["monitor_new"] == 0
    assert before["discovery_mode"] is None
    with inkdrop_state.connect(db_path) as con:
        assert inkdrop_state.series_id_user_removed(con, md["series_id"]) is True

    # A fresh upgrade: drop every companion-repair marker so any migration
    # that wanted to fire gets its chance to.
    _simulate_redeploy(
        db_path,
        drop_keys=(
            "one_piece_manga_companion_discovery_restore_v1",
            "manga_companion_zombie_link_discovery_heal_v1",
        ),
    )

    after = _companion_state(db_path, md["series_id"])
    assert after["raw_json"] == before["raw_json"], "schema init rewrote a removed companion's raw_json"
    assert after["monitored"] == 0, "schema init re-enabled monitoring on a removed companion"
    assert after["monitor_new"] == 0, "schema init re-enabled monitor_new on a removed companion"
    assert after["discovery_mode"] is None, "schema init flipped a removed companion into discovery_only"
    assert after["restore_events"] == 0, "schema init recorded a restore of a removed companion"
    assert after["wanted"] == 0 and after["queued"] == 0, "schema init created acquisition rows for a removed companion"

    raw = json.loads(after["raw_json"])
    assert raw["removed_by_user"] is True
    assert raw["automation_parked_reason"] == "user_removed"
    assert "removed_reactivated_by_user" not in raw
    assert "manga_companion_discovery_only" not in raw

    with inkdrop_state.connect(db_path) as con:
        assert inkdrop_state.series_id_user_removed(con, md["series_id"]) is True

    # Still visible where a removed series belongs -- the removal was not
    # quietly converted into the hidden discovery_only state.
    con = sqlite3.connect(db_path)
    try:
        removed_count = con.execute(
            f"select count(*) from series s where s.id=? and {inkdrop_state.series_removed_sql('s')}",
            (md["series_id"],),
        ).fetchone()[0]
    finally:
        con.close()
    assert removed_count == 1


def test_restore_refuses_a_removed_companion_without_confirmation(tmp_path):
    """The public entry point defaults to preserving removal: it reports
    requires_confirmation and writes nothing at all.
    """
    db_path = tmp_path / "state.sqlite3"
    _cv, md = _linked_companion(
        db_path, title="Eta Manga", cv_provider_id="eta-cv", md_provider_id="eta-md",
    )
    _set_companion_raw(db_path, md["series_id"], monitored=False, extra_raw=_real_removal_shaped_raw())
    before = _companion_state(db_path, md["series_id"])

    result = inkdrop_state.restore_manga_companion_discovery(
        db_path, md["series_id"], source="test", reason="no confirmation supplied"
    )
    assert result["ok"] is False
    assert result["reason"] == "companion_removed_by_user"
    assert result["requires_confirmation"] is True

    after = _companion_state(db_path, md["series_id"])
    assert after == before, "a refused restore must not write anything"
    with inkdrop_state.connect(db_path) as con:
        assert inkdrop_state.series_id_user_removed(con, md["series_id"]) is True


def test_auto_heal_never_reaches_a_removed_companion(tmp_path):
    """heal_zombie_manga_companion_links() runs on every schema init. Even
    if a row somehow carried both the hand-written workaround signature and
    a genuine removal, the heal must fail closed rather than reverse it.
    """
    db_path = tmp_path / "state.sqlite3"
    _cv, md = _linked_companion(
        db_path, title="Theta Manga", cv_provider_id="theta-cv", md_provider_id="theta-md",
    )
    hybrid = _real_removal_shaped_raw()
    # The workaround signature the heal targets, on a row that is also a real
    # user removal -- ambiguous, so the safe answer is "leave it alone".
    hybrid["automation_parked_reason"] = "series_shadow_retired"
    _set_companion_raw(db_path, md["series_id"], monitored=False, extra_raw=hybrid)
    before = _companion_state(db_path, md["series_id"])

    _simulate_redeploy(db_path, drop_keys=("manga_companion_zombie_link_discovery_heal_v1",))

    after = _companion_state(db_path, md["series_id"])
    assert after["monitored"] == 0 and after["discovery_mode"] is None
    assert after["raw_json"] == before["raw_json"]
    with inkdrop_state.connect(db_path) as con:
        assert inkdrop_state.series_id_user_removed(con, md["series_id"]) is True


def test_confirmed_repair_restores_a_removed_companion_fully(tmp_path):
    """The operator-confirmed path -- the sanctioned replacement for the
    hardcoded migration. With allow_reactivating_user_removal=True the
    restore must be complete: monitored, and no longer blocked by the
    series_id_user_removed() guard. Half a restore (monitored=1 with
    removed_by_user still true) is functionally inert, which is what made
    this worth a regression test in the first place.
    """
    db_path = tmp_path / "state.sqlite3"
    _cv, md = _linked_companion(
        db_path, title="Iota Manga", cv_provider_id="iota-cv", md_provider_id="iota-md",
    )
    _set_companion_raw(db_path, md["series_id"], monitored=False, extra_raw=_real_removal_shaped_raw())

    with inkdrop_state.connect(db_path) as con:
        assert inkdrop_state.series_id_user_removed(con, md["series_id"]) is True

    result = inkdrop_state.restore_manga_companion_discovery(
        db_path, md["series_id"], source="test",
        reason="operator confirmed this specific series should resume chapter discovery",
        allow_reactivating_user_removal=True,
    )
    assert result["ok"] is True

    con = sqlite3.connect(db_path)
    try:
        row = con.execute(
            "select monitored, monitor_new, raw_json from series where id=?", (md["series_id"],)
        ).fetchone()
        assert row[0] == 1 and row[1] == 1
        raw = json.loads(row[2])
        assert raw["removed_by_user"] is False
        assert raw.get("manga_companion_discovery_only") is True
        assert raw.get("removed_reactivated_by_user") is True
        for stale_key in (
            "removed_at", "removed_preserved_at", "parked_reason", "parked_at", "parked_context",
            "series_removed_guard", "series_removed_guard_source", "automation_parked_reason",
        ):
            assert stale_key not in raw, f"{stale_key} should have been cleared"
        assert con.execute(
            "select discovery_mode from manga_companion_links where mangadex_series_id=?", (md["series_id"],)
        ).fetchone() == ("discovery_only",)
        # The confirmed reversal is on the record, which is the only trace a
        # discovery_only companion leaves -- it shows in neither the series
        # list nor the removed view.
        assert con.execute(
            "select count(*) from history_events "
            "where event_type='manga_companion_discovery_restored' and series_id=?",
            (md["series_id"],),
        ).fetchone()[0] == 1
    finally:
        con.close()

    with inkdrop_state.connect(db_path) as con:
        # The actual functional proof: every queue/wanted-item creation guard
        # in inkdrop_state.py calls this exact function before acting on a
        # series. Still True here would mean the "restore" was fake.
        assert inkdrop_state.series_id_user_removed(con, md["series_id"]) is False

    # And a later upgrade leaves the confirmed restore alone.
    _simulate_redeploy(db_path)
    con = sqlite3.connect(db_path)
    try:
        assert con.execute(
            "select monitored, monitor_new from series where id=?", (md["series_id"],)
        ).fetchone() == (1, 1)
    finally:
        con.close()


def test_discovery_only_hidden_from_series_list_but_not_from_acquisition(tmp_path):
    """discovery_mode='discovery_only' must keep a restored companion out of
    the series list, the card grid, and duplicate-title detection, without
    excluding it from wanted/queue rows or a direct series_item() lookup --
    it is still meant to be fully live for search and acquisition.
    """
    db_path = tmp_path / "state.sqlite3"
    cv, md = _linked_companion(
        db_path, title="Kappa Manga", cv_provider_id="kappa-cv", md_provider_id="kappa-md",
    )
    _set_companion_raw(db_path, md["series_id"], monitored=False, extra_raw=_real_removal_shaped_raw())

    restored = inkdrop_state.restore_manga_companion_discovery(
        db_path, md["series_id"], source="test", reason="discovery_only visibility check",
        allow_reactivating_user_removal=True,
    )
    assert restored["ok"] is True

    list_ids = {row["id"] for row in inkdrop_state.series_rows(db_path, 5000, series_filter="all")}
    assert md["series_id"] not in list_ids
    assert cv["series_id"] in list_ids

    card_ids = {row["id"] for row in inkdrop_state.series_compact_card_rows(db_path, 5000, series_filter="all")}
    assert md["series_id"] not in card_ids

    dup_ids = set(inkdrop_state.duplicate_series_title_ids(db_path))
    assert md["series_id"] not in dup_ids, "discovery_only companion must not resurface as a visible duplicate"

    options = inkdrop_state.series_filter_options(db_path)
    all_option = next(opt for opt in options if opt.get("value") == "all")
    con = sqlite3.connect(db_path)
    try:
        total_not_removed = con.execute(
            f"select count(*) from series s where {inkdrop_state.series_not_removed_sql('s')}"
        ).fetchone()[0]
    finally:
        con.close()
    assert all_option["count"] == total_not_removed

    # Still fully reachable directly -- discovery_only hides it from list
    # surfaces, not from the app.
    direct = inkdrop_state.series_item(db_path, md["series_id"])
    assert direct is not None and direct["id"] == md["series_id"]

    # The reason the predicate reads manga_companion_links.discovery_mode
    # rather than the series row's own raw_json flag: a routine catalog
    # refresh rebuilds raw_json from the fresh provider payload alone and
    # drops any custom key stamped onto the old one. Simulate that refresh
    # and prove visibility survives it.
    con = sqlite3.connect(db_path)
    try:
        raw = json.loads(con.execute("select raw_json from series where id=?", (md["series_id"],)).fetchone()[0])
        assert raw.get("manga_companion_discovery_only") is True
    finally:
        con.close()
    inkdrop_state.record_provider_series_catalog(
        db_path, provider="mangadex", provider_series_id="kappa-md", title="Kappa Manga",
        metadata={"mediaType": "manga"},
    )
    con = sqlite3.connect(db_path)
    try:
        refreshed_raw = json.loads(con.execute("select raw_json from series where id=?", (md["series_id"],)).fetchone()[0])
        # Pre-existing refresh behavior, documented here so the predicate
        # choice below is legible -- not something this fix changes.
        assert "manga_companion_discovery_only" not in refreshed_raw
    finally:
        con.close()
    list_ids_after_refresh = {row["id"] for row in inkdrop_state.series_rows(db_path, 5000, series_filter="all")}
    assert md["series_id"] not in list_ids_after_refresh, (
        "discovery_only visibility must survive a routine catalog refresh, "
        "since it is keyed off manga_companion_links.discovery_mode, not raw_json"
    )


def test_no_hardcoded_series_migration_remains():
    """The mechanism, not just its one instance: schema init must not carry a
    repair keyed on a specific provider series id.
    """
    source = Path(inkdrop_state.__file__).read_text(encoding="utf-8")
    literals = re.findall(r"[\"'](?:mangadex|comicvine):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[\"']", source)
    assert not literals, f"hardcoded provider series id in runtime state module: {sorted(set(literals))}"
    assert not hasattr(inkdrop_state, "restore_one_piece_manga_companion_discovery"), (
        "the install-specific one-shot repair is back in the runtime module"
    )


def main():
    with tempfile.TemporaryDirectory() as temp_dir:
        test_schema_init_never_revives_a_removed_companion(Path(temp_dir))
    with tempfile.TemporaryDirectory() as temp_dir:
        test_restore_refuses_a_removed_companion_without_confirmation(Path(temp_dir))
    with tempfile.TemporaryDirectory() as temp_dir:
        test_auto_heal_never_reaches_a_removed_companion(Path(temp_dir))
    with tempfile.TemporaryDirectory() as temp_dir:
        test_confirmed_repair_restores_a_removed_companion_fully(Path(temp_dir))
    with tempfile.TemporaryDirectory() as temp_dir:
        test_discovery_only_hidden_from_series_list_but_not_from_acquisition(Path(temp_dir))
    test_no_hardcoded_series_migration_remains()
    print("manga companion removal authority smoke: ok")


if __name__ == "__main__":
    main()
