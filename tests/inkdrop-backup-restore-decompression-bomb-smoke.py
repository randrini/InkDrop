#!/usr/bin/env python3
"""Regression for the decompression-bomb guard in restore_backup_archive().

A backup archive's central directory can declare any uncompressed size it
likes -- zipfile never enforces that a member actually decompresses to the
size it claims. Before this guard, restore_backup_archive(apply=False) --
which runs automatically on every archive upload, before any restore is
confirmed -- would happily decompress a member straight to disk with no
upper bound, so a small crafted or corrupted archive could exhaust the
container's disk during preview alone. This proves the guard actually stops
extraction once a member decompresses past its allowed cap, and that the
partial temp file it was writing does not survive the rejection.
"""

from __future__ import annotations

import io
import sys
import tempfile
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from core import inkdrop_backup_restore as backup_restore


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def _build_archive(archive_path, *, state_db_payload):
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(backup_restore.MANIFEST_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.CONFIG_EXPORT_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.SECRET_REFS_ARCHIVE_NAME, "{}")
        zf.writestr(backup_restore.STATE_DB_ARCHIVE_NAME, state_db_payload)


def main():
    # Highly repetitive payload -- DEFLATE collapses it to a tiny compressed
    # size, so a low ratio cap trips well before the floor would.
    bomb_payload = b"A" * (2 * 1024 * 1024)  # 2 MiB of the same byte

    original_ratio = backup_restore._MEMBER_DECOMPRESSION_RATIO_LIMIT
    original_floor = backup_restore._MEMBER_DECOMPRESSION_FLOOR_BYTES
    try:
        # Tight enough that the 2 MiB payload's real compressed size (well
        # under 1 KiB for solid-byte input) times the ratio is far smaller
        # than the decompressed payload -- this is what a genuine bomb looks
        # like relative to its declared/actual size, just scaled down so the
        # test runs in milliseconds instead of needing gigabytes of data.
        backup_restore._MEMBER_DECOMPRESSION_RATIO_LIMIT = 50
        backup_restore._MEMBER_DECOMPRESSION_FLOOR_BYTES = 1024  # 1 KiB

        with tempfile.TemporaryDirectory(prefix="inkdrop-decompbomb-") as tmp:
            root = Path(tmp)
            archive_path = root / "bomb.zip"
            _build_archive(archive_path, state_db_payload=bomb_payload)

            target_dir = root / "stage"
            target_dir.mkdir()
            raised = False
            with zipfile.ZipFile(archive_path, "r") as zf:
                try:
                    backup_restore._stage_archive_member(zf, backup_restore.STATE_DB_ARCHIVE_NAME, target_dir)
                except ValueError as exc:
                    raised = True
                    require("decompressed past" in str(exc), f"unexpected message: {exc}")
            require(raised, "oversized member was staged without being rejected")

            leftover = list(target_dir.iterdir())
            require(not leftover, f"rejected member left a partial file behind: {leftover}")

            # restore_backup_archive's own preview path must surface the
            # same rejection, not just the helper in isolation.
            try:
                backup_restore.restore_backup_archive(archive_path, apply=False)
                raised_from_restore = False
            except ValueError as exc:
                raised_from_restore = True
                require("decompressed past" in str(exc), f"unexpected message: {exc}")
            require(raised_from_restore, "restore_backup_archive(apply=False) accepted an oversized member")

            # A payload comfortably inside the (still-patched) cap must still
            # restore normally -- the guard should not be so tight it rejects
            # legitimate small archives.
            small_archive_path = root / "small.zip"
            _build_archive(small_archive_path, state_db_payload=b"not-actually-sqlite-but-small")
            with zipfile.ZipFile(small_archive_path, "r") as zf:
                staged = backup_restore._stage_archive_member(zf, backup_restore.STATE_DB_ARCHIVE_NAME, target_dir)
            require(staged.exists(), "small member should have staged successfully")
            require(staged.read_bytes() == b"not-actually-sqlite-but-small", "staged content mismatch")
    finally:
        backup_restore._MEMBER_DECOMPRESSION_RATIO_LIMIT = original_ratio
        backup_restore._MEMBER_DECOMPRESSION_FLOOR_BYTES = original_floor

    print("inkdrop-backup-restore-decompression-bomb-smoke: PASS")


if __name__ == "__main__":
    main()
