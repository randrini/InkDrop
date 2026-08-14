#!/usr/bin/env python3
"""Real HTTP-level regression for the full-backup import/restore flow this
branch adds: /api/inkdrop-settings/backup/archives/upload,
.../restore/preview, and .../restore/apply.

Before this branch, InkDrop could create, list, download, and delete a full
backup archive from the UI, but there was no way to actually restore one --
and no way to bring in an archive from outside InkDrop's own backups
directory (a copy from another host, an older install). This proves
uploading an arbitrary archive validates it before keeping it (and rejects a
bad one without ever adding it to the list).

restore/apply itself is disabled (SIXH-20260812-RESTORE-P0-01): applying a
restore in-process replaces the live state DB, auth DB, and config/secret
files with no web/worker quiescence, no maintenance lease, and no rollback
if a later step fails, so a failure partway through can leave the install
split across state/auth/config epochs with no recovery path. This proves
apply refuses every call outright -- known archive, unknown archive, with or
without confirm=true -- and never touches the live state database, while
preview/create/list/download/upload keep working.
"""

import json
import os
import sys
import tempfile
import threading
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from core import inkdrop_auth
from core import inkdrop_state
from core import inkdrop_web

TESTING_MODE = {
    "INKDROP_AUTH_MODE": "disabled",
    "INKDROP_AUTH_ALLOW_DISABLED": "1",
    "INKDROP_TRUSTED_LAN_TESTING": "1",
}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def request(port, path, *, method="GET", body=None, content_type=None):
    if isinstance(body, (bytes, bytearray)):
        data = bytes(body)
        headers = {"Content-Type": content_type or "application/octet-stream"}
    elif body is not None:
        data = json.dumps(body).encode("utf-8")
        headers = {"Content-Type": "application/json"}
    else:
        data = None
        headers = {}
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return response.status, response, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc, exc.read()


def main():
    with tempfile.TemporaryDirectory(prefix="inkdrop-backup-import-restore-", ignore_cleanup_errors=True) as tmp:
        db = Path(tmp) / "inkdrop-state.sqlite3"
        with inkdrop_state.connect(db) as con:
            inkdrop_state.init_schema(con)
            con.execute(
                "insert into app_settings(key, value_json, source, updated_at) values ('media_management.series_folder_format', '\"{Series Title}\"', 'user', 0)"
            )
            con.commit()

        original_db = inkdrop_web.INKDROP_STATE_DB
        original_env = {k: os.environ.get(k) for k in TESTING_MODE}
        os.environ.update(TESTING_MODE)
        os.environ["INKDROP_CONFIG_DIR"] = tmp
        os.environ["INKDROP_STATE_DIR"] = tmp
        os.environ["INKDROP_BACKUP_DIR"] = str(Path(tmp) / "backups")
        inkdrop_auth.clear_config_cache()
        inkdrop_web.clear_inkdrop_auth_status_cache()
        inkdrop_web.INKDROP_STATE_DB = db

        server = inkdrop_web.InkDropThreadingHTTPServer(("127.0.0.1", 0), inkdrop_web.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        port = server.server_address[1]
        try:
            # --- Baseline: create a real archive through the existing
            # create endpoint so preview/apply have something real to work
            # against.
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/create", method="POST", body={})
            require(status == 200, f"create must succeed: {status} {body}")
            payload = json.loads(body)
            archive_name = payload["archives"][0]["name"]

            # --- Unknown archive name must 404 for preview, matching the
            # existing download/delete guard.
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/restore/preview", method="POST", body={"name": "does-not-exist.zip"})
            require(status == 404, f"unknown archive preview must 404: {status} {body}")

            # --- Preview is read-only: must not touch the live state DB.
            db_mtime_before_preview = db.stat().st_mtime_ns
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/restore/preview", method="POST", body={"name": archive_name})
            require(status == 200, f"preview of a real archive must succeed: {status} {body}")
            preview_payload = json.loads(body)
            result = preview_payload["result"]
            require(result["dry_run"] is True, result)
            require(result["would_restore"]["state_db"] is True, result)
            require(result["database_validation"]["state_db"]["quick_check"] == "ok", result)
            require(db.stat().st_mtime_ns == db_mtime_before_preview, "preview must not modify the live state database")

            # --- Apply is disabled outright (SIXH-20260812-RESTORE-P0-01):
            # it must refuse every call -- known archive without confirm,
            # known archive with confirm=true, and an unknown archive name --
            # and must never touch the live state database.
            db_content_before_apply = db.read_bytes()
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/restore/apply", method="POST", body={"name": archive_name})
            require(status == 503, f"apply must be disabled: {status} {body}")
            require(json.loads(body)["error"] == "restore_apply_disabled", body)
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/restore/apply", method="POST", body={"name": archive_name, "confirm": True})
            require(status == 503, f"confirmed apply must still be disabled: {status} {body}")
            require(json.loads(body)["error"] == "restore_apply_disabled", body)
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/restore/apply", method="POST", body={"name": "does-not-exist.zip", "confirm": True})
            require(status == 503, f"apply for an unknown archive must also be disabled, not 404: {status} {body}")
            require(json.loads(body)["error"] == "restore_apply_disabled", body)
            require(db.read_bytes() == db_content_before_apply, "disabled apply must never modify the live state database")

            # --- Uploading a real archive (bytes copied from the one this
            # test already created) must validate and add it to the list
            # under InkDrop's own naming convention, without needing it to
            # have started out in the backups directory.
            backups_dir = Path(tmp) / "backups"
            source_archive_bytes = (backups_dir / archive_name).read_bytes()
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/upload", method="POST", body=source_archive_bytes, content_type="application/zip")
            require(status == 200, f"uploading a valid archive must succeed: {status} {body[:300]}")
            upload_payload = json.loads(body)
            uploaded_name = upload_payload["archive"]["name"]
            require(uploaded_name.startswith("inkdrop-backup-") and uploaded_name.endswith("-imported.zip"), uploaded_name)
            require(upload_payload["preview"]["would_restore"]["state_db"] is True, upload_payload)
            require(any(item["name"] == uploaded_name for item in upload_payload["archives"]), upload_payload["archives"])

            # --- The uploaded archive is a first-class archive: it can be
            # previewed exactly like a manually created one (apply is
            # disabled for all archives regardless of origin, tested above).
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/restore/preview", method="POST", body={"name": uploaded_name})
            require(status == 200, f"preview of an uploaded archive must succeed: {status} {body}")

            # --- Uploading garbage must be rejected and must never be kept
            # on disk or listed -- an invalid upload is not silently added.
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives")
            names_before_bad_upload = {item["name"] for item in json.loads(body)["archives"]}
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/upload", method="POST", body=b"this is not a zip file", content_type="application/zip")
            require(status == 400, f"uploading garbage must be rejected: {status} {body}")
            require(json.loads(body)["error"] == "invalid_backup_archive", body)
            on_disk_after_bad_upload = {p.name for p in backups_dir.iterdir()}
            require(
                not any(name.endswith("-imported.zip") and name not in {uploaded_name} for name in on_disk_after_bad_upload),
                f"a rejected upload must not leave a file behind: {on_disk_after_bad_upload}",
            )
            require(not any(name.endswith(".zip.tmp") for name in on_disk_after_bad_upload), f"temp upload file must be cleaned up: {on_disk_after_bad_upload}")
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives")
            names_after_bad_upload = {item["name"] for item in json.loads(body)["archives"]}
            require(names_after_bad_upload == names_before_bad_upload, "a rejected upload must not appear in the archive list")

            # --- Uploading a well-formed zip that is not an InkDrop backup
            # (no manifest / state DB member) must also be rejected.
            fake_zip_path = Path(tmp) / "not-a-backup.zip"
            with zipfile.ZipFile(fake_zip_path, "w") as zf:
                zf.writestr("hello.txt", "not a backup archive")
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/upload", method="POST", body=fake_zip_path.read_bytes(), content_type="application/zip")
            require(status == 400, f"a well-formed but foreign zip must still be rejected: {status} {body}")
            require(json.loads(body)["error"] == "invalid_backup_archive", body)

            # --- An empty upload must be rejected up front.
            status, _resp, body = request(port, "/api/inkdrop-settings/backup/archives/upload", method="POST", body=b"", content_type="application/zip")
            require(status == 400, f"an empty upload must be rejected: {status} {body}")
            require(json.loads(body)["error"] == "empty_upload", body)
        finally:
            server.shutdown()
            inkdrop_web.INKDROP_STATE_DB = original_db
            for key, value in original_env.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
            os.environ.pop("INKDROP_CONFIG_DIR", None)
            os.environ.pop("INKDROP_STATE_DIR", None)
            os.environ.pop("INKDROP_BACKUP_DIR", None)
            inkdrop_auth.clear_config_cache()
            inkdrop_web.clear_inkdrop_auth_status_cache()

    print("inkdrop-backup-archive-import-restore-smoke: PASS")


if __name__ == "__main__":
    main()
