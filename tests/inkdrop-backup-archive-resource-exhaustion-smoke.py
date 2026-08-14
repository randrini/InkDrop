#!/usr/bin/env python3
"""Regression for the backup-archive resource-exhaustion surface beyond the
single-member decompression cap (see
inkdrop-backup-restore-decompression-bomb-smoke.py for that one).

restore_backup_archive() previews every uploaded archive automatically,
before any restore is confirmed. Before this branch it trusted a lot more
than one member's declared size: zipfile.ZipFile() would materialize the
full central directory with no bound on member count or a forged/oversized
directory; manifest.json and the config export were read with an unbounded
zf.read(); nothing capped how much every member's staging could add up to in
aggregate, checked that against free disk space, or bounded how long
validation could run. This proves each of those gaps is actually closed, and
that a legitimately produced archive still previews cleanly under the same
checks.
"""

from __future__ import annotations

import json
import struct
import sys
import tempfile
import time
import warnings
import zipfile
from pathlib import Path
from types import SimpleNamespace

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from core import inkdrop_backup_restore as backup_restore
from core import inkdrop_state


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def require_raises(label, fn, *, expect_substring):
    try:
        fn()
    except ValueError as exc:
        require(expect_substring in str(exc), f"{label}: unexpected message: {exc}")
        return
    raise AssertionError(f"{label}: expected a ValueError containing {expect_substring!r}, nothing was raised")


def _write_valid_archive(archive_path, *, extra_state_db_bytes=b"", auth=False):
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(backup_restore.MANIFEST_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.CONFIG_EXPORT_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.SECRET_REFS_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.STATE_DB_ARCHIVE_NAME, b"not-actually-sqlite" + extra_state_db_bytes)
        if auth:
            zf.writestr(backup_restore.AUTH_DB_ARCHIVE_NAME, b"not-actually-sqlite-auth")


def _eocd_offset_and_fields(archive_path):
    data = archive_path.read_bytes()
    idx = data.rfind(backup_restore._ZIP_EOCD_SIGNATURE)
    fields = list(struct.unpack(backup_restore._ZIP_EOCD_STRUCT, data[idx : idx + backup_restore._ZIP_EOCD_SIZE]))
    return idx, fields


def _rewrite_eocd(archive_path, idx, fields):
    with archive_path.open("r+b") as handle:
        handle.seek(idx)
        handle.write(struct.pack(backup_restore._ZIP_EOCD_STRUCT, *fields))


class _FakeZipFile:
    """Duck-types just enough of zipfile.ZipFile for _safe_zip_members(),
    so member-level checks (compression method, symlink, directory,
    encryption) can be tested against a hand-built ZipInfo without needing
    to fight zipfile's writer into producing bytes it doesn't support
    writing (there is no public API to write an encrypted entry)."""

    def __init__(self, infos):
        self._infos = infos

    def infolist(self):
        return self._infos


def _member_info(name, *, compress_type=zipfile.ZIP_DEFLATED, flag_bits=0, external_attr=0):
    info = zipfile.ZipInfo(name)
    info.compress_type = compress_type
    info.flag_bits = flag_bits
    info.external_attr = external_attr
    return info


def test_json_member_bomb_rejected(tmp_root):
    # The audit's own reproduction: a small archive whose manifest.json
    # claims roughly a thousand times its compressed size once expanded.
    archive_path = tmp_root / "manifest-bomb.zip"
    bomb = b"0" * (33 * 1024 * 1024)
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(backup_restore.MANIFEST_ARCHIVE_NAME, bomb)
        zf.writestr(backup_restore.CONFIG_EXPORT_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.SECRET_REFS_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.STATE_DB_ARCHIVE_NAME, b"x")
    require(archive_path.stat().st_size < 1024 * 1024, "test archive itself should stay small (DEFLATE should collapse it)")
    require_raises(
        "manifest bomb via restore_backup_archive",
        lambda: backup_restore.restore_backup_archive(archive_path, apply=False),
        expect_substring="decompressed past",
    )

    archive_path2 = tmp_root / "config-bomb.zip"
    with zipfile.ZipFile(archive_path2, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(backup_restore.MANIFEST_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.CONFIG_EXPORT_ARCHIVE_NAME, bomb)
        zf.writestr(backup_restore.SECRET_REFS_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.STATE_DB_ARCHIVE_NAME, b"x")
    require_raises(
        "config export bomb via restore_backup_archive",
        lambda: backup_restore.restore_backup_archive(archive_path2, apply=False),
        expect_substring="decompressed past",
    )


def test_duplicate_and_aliased_member_rejected(tmp_root):
    archive_path = tmp_root / "dup.zip"
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with zipfile.ZipFile(archive_path, "w") as zf:
            zf.writestr(backup_restore.MANIFEST_ARCHIVE_NAME, "{}")
            zf.writestr(backup_restore.CONFIG_EXPORT_ARCHIVE_NAME, "{}")
            zf.writestr(backup_restore.SECRET_REFS_ARCHIVE_NAME, "{}")
            zf.writestr(backup_restore.STATE_DB_ARCHIVE_NAME, "decoy, never read")
            # A second, real entry with the same name: zipfile resolves
            # getinfo()/open() by name to whichever definition it kept last,
            # so without a duplicate-name guard the decoy above is what a
            # human skimming an archive listing would see, while this one is
            # what actually gets staged.
            zf.writestr(backup_restore.STATE_DB_ARCHIVE_NAME, "real bomb payload")
    require_raises(
        "duplicate/aliased member",
        lambda: backup_restore.restore_backup_archive(archive_path, apply=False),
        expect_substring="duplicate archive member",
    )


def test_unsupported_compression_method_rejected():
    info = _member_info(backup_restore.MANIFEST_ARCHIVE_NAME, compress_type=zipfile.ZIP_BZIP2)
    require_raises(
        "unsupported compression method",
        lambda: backup_restore._safe_zip_members(_FakeZipFile([info]), expected_count=1),
        expect_substring="unsupported compression method",
    )


def test_symlink_member_rejected():
    symlink_mode = 0o120777 << 16  # S_IFLNK
    info = _member_info(backup_restore.MANIFEST_ARCHIVE_NAME, external_attr=symlink_mode)
    require_raises(
        "symlink member",
        lambda: backup_restore._safe_zip_members(_FakeZipFile([info]), expected_count=1),
        expect_substring="symlink",
    )


def test_directory_member_rejected():
    info = _member_info("some-directory/")
    require_raises(
        "directory member",
        lambda: backup_restore._safe_zip_members(_FakeZipFile([info]), expected_count=1),
        expect_substring="directory",
    )


def test_encrypted_member_rejected():
    info = _member_info(backup_restore.MANIFEST_ARCHIVE_NAME, flag_bits=0x1)
    require_raises(
        "encrypted member",
        lambda: backup_restore._safe_zip_members(_FakeZipFile([info]), expected_count=1),
        expect_substring="encrypted",
    )


def test_too_many_members_rejected(tmp_root):
    archive_path = tmp_root / "many-members.zip"
    with zipfile.ZipFile(archive_path, "w") as zf:
        for index in range(backup_restore._ARCHIVE_MAX_MEMBERS + 5):
            zf.writestr(f"member-{index}.txt", "x")
    require_raises(
        "too many members",
        lambda: backup_restore._admit_zip_central_directory(archive_path),
        expect_substring="member limit",
    )


def test_forged_eocd_central_directory_bounds_rejected(tmp_root):
    archive_path = tmp_root / "forged-cd-offset.zip"
    with zipfile.ZipFile(archive_path, "w") as zf:
        zf.writestr("a.txt", "one")
        zf.writestr("b.txt", "two")
    idx, fields = _eocd_offset_and_fields(archive_path)
    fields[6] = 999_999  # cd_offset -> points nowhere near the real directory
    _rewrite_eocd(archive_path, idx, fields)
    require_raises(
        "forged EOCD central directory offset",
        lambda: backup_restore._admit_zip_central_directory(archive_path),
        expect_substring="forged EOCD",
    )


def test_eocd_entry_count_mismatch_rejected(tmp_root):
    # entries_on_disk disagreeing with total_entries is the classic
    # multi-disk/ZIP64 mismatch signature: a genuine single-disk archive
    # always has the two agree.
    archive_path = tmp_root / "count-mismatch.zip"
    with zipfile.ZipFile(archive_path, "w") as zf:
        zf.writestr("a.txt", "one")
        zf.writestr("b.txt", "two")
    idx, fields = _eocd_offset_and_fields(archive_path)
    fields[3] = 1  # entries_on_disk, total_entries (index 4) left at 2
    _rewrite_eocd(archive_path, idx, fields)
    require_raises(
        "EOCD entry count mismatch",
        lambda: backup_restore._admit_zip_central_directory(archive_path),
        expect_substring="do not agree",
    )

    # A total_entries inflated past what the (unchanged) central directory
    # size could actually hold, but still under the member cap, must be
    # rejected on that basis instead of silently admitted.
    archive_path2 = tmp_root / "count-inflated.zip"
    with zipfile.ZipFile(archive_path2, "w") as zf:
        zf.writestr("a.txt", "one")
        zf.writestr("b.txt", "two")
    idx2, fields2 = _eocd_offset_and_fields(archive_path2)
    fields2[3] = 10
    fields2[4] = 10
    _rewrite_eocd(archive_path2, idx2, fields2)
    require_raises(
        "EOCD count too large for central directory size",
        lambda: backup_restore._admit_zip_central_directory(archive_path2),
        expect_substring="too small for its declared member count",
    )


def test_zip64_entry_count_mismatch_rejected(tmp_root):
    # Force every entry to use the ZIP64 EOCD/locator regardless of size, so
    # the ZIP64 parsing path in _admit_zip_central_directory can be exercised
    # without needing a multi-gigabyte fixture.
    archive_path = tmp_root / "zip64-mismatch.zip"
    original_limit = zipfile.ZIP64_LIMIT
    try:
        zipfile.ZIP64_LIMIT = 0
        with zipfile.ZipFile(archive_path, "w", allowZip64=True) as zf:
            zf.writestr("a.txt", "one")
            zf.writestr("b.txt", "two")
    finally:
        zipfile.ZIP64_LIMIT = original_limit
    # A well-formed ZIP64 archive must admit cleanly first.
    admitted = backup_restore._admit_zip_central_directory(archive_path)
    require(admitted == 2, f"expected 2 admitted members from a valid ZIP64 archive, got {admitted}")

    locator_offset = archive_path.stat().st_size - backup_restore._ZIP_EOCD_SIZE - backup_restore._ZIP64_LOCATOR_SIZE
    data = bytearray(archive_path.read_bytes())
    require(bytes(data[locator_offset : locator_offset + 4]) == backup_restore._ZIP64_LOCATOR_SIGNATURE, "test fixture assumption about ZIP64 locator position broke")
    _lsig, _ldisk, zip64_eocd_offset, _ldisks = struct.unpack(
        backup_restore._ZIP64_LOCATOR_STRUCT, bytes(data[locator_offset : locator_offset + backup_restore._ZIP64_LOCATOR_SIZE])
    )
    zip64_fields = list(
        struct.unpack(
            backup_restore._ZIP64_EOCD_STRUCT,
            bytes(data[zip64_eocd_offset : zip64_eocd_offset + backup_restore._ZIP64_EOCD_FIXED_SIZE]),
        )
    )
    zip64_fields[6] = 1  # entries_on_disk left disagreeing with total_entries (index 7)
    data[zip64_eocd_offset : zip64_eocd_offset + backup_restore._ZIP64_EOCD_FIXED_SIZE] = struct.pack(
        backup_restore._ZIP64_EOCD_STRUCT, *zip64_fields
    )
    archive_path.write_bytes(bytes(data))
    require_raises(
        "ZIP64 entry count mismatch",
        lambda: backup_restore._admit_zip_central_directory(archive_path),
        expect_substring="do not agree",
    )


def test_aggregate_expansion_cap_rejected(tmp_root):
    archive_path = tmp_root / "aggregate.zip"
    # Each member actually decompresses to a couple thousand real bytes --
    # individually nowhere near any per-member floor/ratio cap -- but the
    # three read/staged before the aggregate cap fires (manifest, config
    # export, state db) sum past a tighter aggregate cap as they're actually
    # read, proving the running aggregate tracker catches what no single
    # member's own budget would, using real bytes rather than a worst-case
    # compressed-size*ratio estimate that would also reject a legitimate
    # archive of this size.
    padding = "x" * 2500
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(backup_restore.MANIFEST_ARCHIVE_NAME, json.dumps({"pad": padding}))
        zf.writestr(backup_restore.CONFIG_EXPORT_ARCHIVE_NAME, json.dumps({"pad": padding}))
        zf.writestr(backup_restore.SECRET_REFS_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.STATE_DB_ARCHIVE_NAME, ("not-actually-sqlite" + padding).encode())
    original_aggregate_cap = backup_restore._ARCHIVE_MAX_AGGREGATE_EXPANDED_BYTES
    try:
        backup_restore._ARCHIVE_MAX_AGGREGATE_EXPANDED_BYTES = 6000
        require_raises(
            "aggregate expansion cap",
            lambda: backup_restore.restore_backup_archive(archive_path, apply=False),
            expect_substring="aggregate limit",
        )
    finally:
        backup_restore._ARCHIVE_MAX_AGGREGATE_EXPANDED_BYTES = original_aggregate_cap


def test_large_legitimate_archive_not_rejected_by_aggregate_cap(tmp_root):
    # A real backup's state DB commonly compresses at double-digit ratios
    # (mostly-zeroed freelist pages, WAL churn, etc). A member whose
    # compressed size alone, times the per-member worst-case ratio, would
    # blow past the aggregate cap must still pass when its real decompressed
    # size does not -- this is exactly the regression the aggregate cap must
    # not reintroduce.
    archive_path = tmp_root / "large_legit.zip"
    real_size = 8 * 1024 * 1024
    # Highly compressible content (like a real DB's freelist) keeps this
    # archive small on disk while still exercising real_size real bytes
    # through the aggregate tracker.
    state_db_content = b"\x00" * real_size
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(backup_restore.MANIFEST_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.CONFIG_EXPORT_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.SECRET_REFS_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.STATE_DB_ARCHIVE_NAME, state_db_content)
    original_aggregate_cap = backup_restore._ARCHIVE_MAX_AGGREGATE_EXPANDED_BYTES
    original_ratio_limit = backup_restore._MEMBER_DECOMPRESSION_RATIO_LIMIT
    try:
        # Compressed size of state_db_content is tiny (a handful of bytes,
        # deflate collapses a run of zeros almost entirely), so
        # compressed_size * ratio_limit is nowhere near real_size -- but set
        # a small aggregate cap that real_size alone would still clear, and
        # confirm the worst-case-budget math (compressed*ratio, which would
        # be minuscule here) is not what gates this.
        backup_restore._ARCHIVE_MAX_AGGREGATE_EXPANDED_BYTES = real_size * 2
        try:
            backup_restore.restore_backup_archive(archive_path, apply=False)
        except ValueError as exc:
            if "aggregate limit" in str(exc):
                raise AssertionError(f"legitimate archive rejected by aggregate cap: {exc}") from exc
            # Any other ValueError (e.g. "not a valid SQLite database" for
            # this fixture's placeholder content) is expected and fine --
            # only the aggregate-cap rejection is what this test guards.
    finally:
        backup_restore._ARCHIVE_MAX_AGGREGATE_EXPANDED_BYTES = original_aggregate_cap
        backup_restore._MEMBER_DECOMPRESSION_RATIO_LIMIT = original_ratio_limit


def test_insufficient_free_space_rejected(tmp_root):
    archive_path = tmp_root / "lowspace.zip"
    _write_valid_archive(archive_path)
    original_disk_usage = backup_restore.shutil.disk_usage
    try:
        backup_restore.shutil.disk_usage = lambda path: SimpleNamespace(total=0, used=0, free=0)
        require_raises(
            "insufficient free space",
            lambda: backup_restore.restore_backup_archive(archive_path, apply=False),
            expect_substring="not enough free space",
        )
    finally:
        backup_restore.shutil.disk_usage = original_disk_usage


def test_validation_deadline_rejected(tmp_root):
    archive_path = tmp_root / "deadline.zip"
    _write_valid_archive(archive_path)
    original_deadline_fn = backup_restore._validation_deadline
    try:
        backup_restore._validation_deadline = lambda: time.monotonic() - 1
        require_raises(
            "validation deadline",
            lambda: backup_restore.restore_backup_archive(archive_path, apply=False),
            expect_substring="time limit",
        )
    finally:
        backup_restore._validation_deadline = original_deadline_fn


def test_valid_archive_still_previews(tmp_root):
    # A legitimately produced archive, built the same way create_backup_archive()
    # builds one (real SQLite state DB, real JSON members), must still
    # preview successfully under every default (unpatched) limit above.
    config_dir = tmp_root / "config"
    state_dir = tmp_root / "state"
    backup_dir = tmp_root / "backups"
    state_dir.mkdir()
    db_path = state_dir / "inkdrop-state.sqlite3"
    with inkdrop_state.connect(db_path) as con:
        inkdrop_state.init_schema(con)
        con.execute(
            "insert into app_settings(key, value_json, source, updated_at) values "
            "('media_management.series_folder_format', '\"{Series Title}\"', 'user', 0)"
        )
        con.commit()
    created = backup_restore.create_backup_archive(
        config_dir=config_dir,
        state_db_path=db_path,
        backup_dir=backup_dir,
        label="resource-exhaustion-smoke",
    )
    require(created["ok"], created)
    result = backup_restore.restore_backup_archive(Path(created["archive_path"]), apply=False)
    require(result["ok"], result)
    require(result["dry_run"] is True, result)
    require(result["database_validation"]["state_db"]["quick_check"] == "ok", result)


def main():
    with tempfile.TemporaryDirectory(prefix="inkdrop-backup-resource-exhaustion-", ignore_cleanup_errors=True) as tmp:
        tmp_root = Path(tmp)

        test_json_member_bomb_rejected(tmp_root)
        test_duplicate_and_aliased_member_rejected(tmp_root)
        test_unsupported_compression_method_rejected()
        test_symlink_member_rejected()
        test_directory_member_rejected()
        test_encrypted_member_rejected()
        test_too_many_members_rejected(tmp_root)
        test_forged_eocd_central_directory_bounds_rejected(tmp_root)
        test_eocd_entry_count_mismatch_rejected(tmp_root)
        test_zip64_entry_count_mismatch_rejected(tmp_root)
        test_aggregate_expansion_cap_rejected(tmp_root)
        test_large_legitimate_archive_not_rejected_by_aggregate_cap(tmp_root)
        test_insufficient_free_space_rejected(tmp_root)
        test_validation_deadline_rejected(tmp_root)
        test_valid_archive_still_previews(tmp_root)

    print("inkdrop-backup-archive-resource-exhaustion-smoke: PASS")


if __name__ == "__main__":
    main()
