#!/usr/bin/env python3
"""Single accessor for the current library root paths.

comic_root/manga_root/kavita_*_root/manual_*_inbox are configured through the
Library Paths and Manual Inboxes settings cards, which persist to
provider_configs and are mirrored into app_settings. inkdrop_completed_import
owns the actual settings read (apply_path_provider_settings()); this module
is the one place every other reader should call through, instead of each
keeping its own frozen env-var snapshot and its own refresh-and-fallback
wrapper. See the settings-registry gap noted in PR #493.
"""
import sys as _sys
from pathlib import Path as _Path

_ROOT = _Path(__file__).resolve().parents[1]
if str(_ROOT) not in _sys.path:
    _sys.path.insert(0, str(_ROOT))

import os

try:
    from core import inkdrop_completed_import as _completed_import
except Exception:
    _completed_import = None


def _env_path(name, default):
    raw = str(os.environ.get(name) or "").strip()
    return _Path(raw) if raw else _Path(default)


def _env_text(name, default):
    return str(os.environ.get(name) or "").strip() or default


def _fallback_paths():
    return {
        "comic_root": _env_path("INKDROP_COMIC_ROOT", "/library/comics"),
        "manga_root": _env_path("INKDROP_MANGA_ROOT", "/library/manga"),
        "kavita_comic_root": _env_text("INKDROP_KAVITA_COMIC_ROOT", "/data/comics"),
        "kavita_manga_root": _env_text("INKDROP_KAVITA_MANGA_ROOT", "/data/manga"),
        "manual_comics_inbox": _env_path("INKDROP_MANUAL_COMICS_INBOX", "/manual-inbox/comics"),
        "manual_ebooks_inbox": _env_path("INKDROP_MANUAL_EBOOKS_INBOX", "/manual-inbox/ebooks"),
    }


def current_paths(*, refresh=True):
    """Return the current effective library path settings as a dict.

    One accessor for comic_root/manga_root/kavita_comic_root/
    kavita_manga_root/manual_comics_inbox/manual_ebooks_inbox -- the six
    settings that used to be kept as independent frozen env-var globals in
    each of inkdrop_manual_source_autoresolve, inkdrop_series_autopilot,
    inkdrop_slskd_source_probe, inkdrop_mangadex_direct, and
    inkdrop_manga_metadata_guard. Pass refresh=False only when the caller
    already refreshed earlier in the same invocation (e.g. once per scan) and
    wants to avoid a second settings read.
    """
    if _completed_import is None:
        return _fallback_paths()
    if refresh:
        try:
            _completed_import.apply_path_provider_settings()
        except Exception:
            pass
    return {
        "comic_root": _Path(_completed_import.COMIC_ROOT),
        "manga_root": _Path(_completed_import.MANGA_ROOT),
        "kavita_comic_root": str(_completed_import.KAVITA_COMIC_ROOT),
        "kavita_manga_root": str(_completed_import.KAVITA_MANGA_ROOT),
        "manual_comics_inbox": _Path(_completed_import.MANUAL_COMIC_SOURCES[0]),
        "manual_ebooks_inbox": _Path(_completed_import.MANUAL_EBOOK_SOURCES[0]),
    }
