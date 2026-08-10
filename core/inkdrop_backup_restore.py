#!/usr/bin/env python3
"""InkDrop config/state backup and restore helpers.

The public install path needs a small, boring way to move InkDrop state between
config roots without copying secrets into support exports. This module creates a
zip archive containing:

- a SQLite state backup,
- a redacted config/settings export,
- a secret-reference manifest without secret values,
- a restore manifest with schema and path-availability warnings.

It does not copy user media, staging downloads, reader databases, or live
external-service state.
"""

from __future__ import annotations
import sys as _sys
from pathlib import Path as _Path
_ROOT = _Path(__file__).resolve().parents[1]
if str(_ROOT) not in _sys.path:
    _sys.path.insert(0, str(_ROOT))


import argparse
import base64
import calendar
import contextlib
import hashlib
import hmac
import json
import math
import os
import re
import shutil
import sqlite3
import tempfile
import time
import zipfile
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

from core import inkdrop_runtime_config
from core import inkdrop_auth
from core import inkdrop_settings_registry
from core import inkdrop_state
from core import inkdrop_version


BACKUP_RESTORE_SCHEMA_VERSION = 1
PORTABLE_SETTINGS_SCHEMA = "inkdrop.portable_settings.v1"
PORTABLE_SETTINGS_PRODUCT = "InkDrop"
PORTABLE_SETTINGS_MAX_BYTES = 1024 * 1024
PORTABLE_SETTINGS_MAX_COUNT = 1000
PROTOTYPE_KEYS = {"__proto__", "prototype", "constructor"}
INVALID_STORED_VALUE = object()
STATE_DB_ARCHIVE_NAME = "state/inkdrop-state.sqlite3"
AUTH_DB_ARCHIVE_NAME = "state/inkdrop-auth.sqlite3"
CONFIG_EXPORT_ARCHIVE_NAME = "config/inkdrop-config-export.json"
SECRET_REFS_ARCHIVE_NAME = "config/inkdrop-secret-refs.json"
MANIFEST_ARCHIVE_NAME = "manifest.json"
SECRET_KEY_MARKERS = ("API_KEY", "PASSWORD", "TOKEN", "SECRET", "USERNAME")
CREDENTIAL_PASSPHRASE_MIN_LENGTH = 8
CREDENTIAL_KDF_ITERATIONS = 480_000
CREDENTIAL_TABLES = ("provider_configs", "notification_connectors")
# Naming-format templates hold tokens like "{Series Title} ({Year})", never
# host paths; comic_issue_format already exports, this keeps its sibling from
# being excluded for having FOLDER in its name.
PORTABLE_NAMING_TEMPLATE_KEYS = frozenset({"media_management.series_folder_format"})
PATH_ENV_KEYS = (
    "INKDROP_CONFIG_DIR",
    "INKDROP_STATE_DIR",
    "INKDROP_LOG_DIR",
    "INKDROP_CACHE_DIR",
    "INKDROP_BACKUP_DIR",
    "INKDROP_STAGING_DIR",
    "INKDROP_MANUAL_INBOX_DIR",
    "INKDROP_QUARANTINE_DIR",
    "INKDROP_COMIC_ROOT",
    "INKDROP_MANGA_ROOT",
)


def _secure_backup_directory(path):
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name == "posix":
        os.chmod(path, 0o700)
        if path.stat().st_mode & 0o077:
            raise PermissionError(f"backup directory permissions are not private: {path}")


def _verify_sensitive_archive_mode(path):
    if os.name == "posix":
        os.chmod(path, 0o600)
        if path.stat().st_mode & 0o077:
            raise PermissionError(f"backup archive permissions are not private: {path}")


def utc_stamp(ts=None):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(float(ts if ts is not None else time.time())))


def compact_stamp(ts=None):
    return time.strftime("%Y%m%d-%H%M%S", time.gmtime(float(ts if ts is not None else time.time())))


def path_text(path):
    return str(Path(path)).replace("\\", "/")


def is_secret_key(key):
    normalized = str(key or "").upper()
    return any(marker in normalized for marker in SECRET_KEY_MARKERS)


def sanitized_provider_settings(settings):
    """Split provider settings into exportable values and dropped credential fields.

    Shared by the portability JSON export and the full backup archive's raw
    state-DB redaction pass (see redact_provider_secrets below) so both code
    paths that ship a copy of provider_configs.settings_json agree on exactly
    which fields are credentials.
    """
    kept = {}
    removed = []
    # Fields the provider itself declared secret are dropped first: names like
    # discord_webhook_url carry credentials without matching any credential
    # name pattern.
    declared = settings.get("secret_fields") if isinstance(settings, dict) else None
    declared = {str(name) for name in declared} if isinstance(declared, list) else set()
    for key in sorted(settings or {}, key=str):
        name = str(key)
        if name == "secret_ref":
            kept[name] = str(settings[key] or "")
            continue
        if name in declared:
            removed.append(name)
            continue
        if is_secret_key(name):
            removed.append(name)
            continue
        value = settings[key]
        if isinstance(value, (dict, list)):
            # Nested provider settings are rare and may bury credentials one
            # level down; drop them rather than guessing which leaves are safe.
            removed.append(name)
            continue
        kept[name] = value
    return kept, removed


def redacted_config_export(environ=None):
    env = environ if environ is not None else os.environ
    values = {}
    secret_refs = {}
    for key in sorted(key for key in env if key.startswith("INKDROP_")):
        raw = str(env.get(key) or "")
        if is_secret_key(key):
            values[key] = "<set>" if raw else "<unset>"
            if raw:
                secret_refs[key] = {"configured": True, "value": "<redacted>"}
        else:
            values[key] = raw
    return {
        "schema_version": BACKUP_RESTORE_SCHEMA_VERSION,
        "exported_at": utc_stamp(),
        "values": values,
        "secret_refs": secret_refs,
    }


def _canonical_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True, allow_nan=False)


def _settings_checksum(document):
    payload = {key: value for key, value in dict(document or {}).items() if key != "checksum"}
    return "sha256:" + hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def _reject_duplicate_object(pairs):
    out = {}
    for key, value in pairs:
        key = str(key)
        if key in out:
            raise ValueError(f"duplicate JSON key: {key}")
        if key.lower() in PROTOTYPE_KEYS:
            raise ValueError(f"reserved JSON key: {key}")
        out[key] = value
    return out


def _reject_nonfinite_constant(value):
    raise ValueError(f"non-finite JSON number is not allowed: {value}")


def _require_finite_json(value, *, label="value"):
    if type(value) is float and not math.isfinite(value):
        raise ValueError(f"{label} contains a non-finite number")
    if isinstance(value, list):
        for index, item in enumerate(value):
            _require_finite_json(item, label=f"{label}[{index}]")
    elif isinstance(value, dict):
        for key, item in value.items():
            _require_finite_json(item, label=f"{label}.{key}")
    return value


def _load_stored_json(raw):
    value = json.loads(raw or "null", parse_constant=_reject_nonfinite_constant)
    return _require_finite_json(value, label="stored setting")


def parse_strict_json_object(raw, *, max_bytes, label="JSON document"):
    if isinstance(raw, bytes):
        data = raw
    else:
        data = str(raw or "").encode("utf-8")
    if not data or len(data) > int(max_bytes):
        raise ValueError(f"{label} has an invalid size")
    try:
        document = json.loads(
            data.decode("utf-8"),
            object_pairs_hook=_reject_duplicate_object,
            parse_constant=_reject_nonfinite_constant,
        )
    except UnicodeDecodeError as exc:
        raise ValueError(f"{label} must be UTF-8 JSON") from exc
    if not isinstance(document, dict):
        raise ValueError(f"{label} root must be an object")
    return _require_finite_json(document, label=label)


def parse_portable_settings_document(raw):
    return parse_strict_json_object(raw, max_bytes=PORTABLE_SETTINGS_MAX_BYTES, label="settings backup")


# --------------------------------------------------------------------------
# Optional encrypted credentials, opt-in at export time. The portable
# settings document above never carries these -- sanitized_provider_settings()
# strips them the same way redact_provider_secrets() does for the full backup
# archive. This is the one path that CAN include them, because a user
# rebuilding a fresh install from a settings export otherwise has to manually
# re-enter every download-client password and notification webhook by hand.
# They're encrypted with a passphrase set at export time (never derived from
# or stored alongside anything else InkDrop already knows), so the exported
# file is only as sensitive as that passphrase -- not plaintext-sensitive on
# its own, unlike everything else this module ever writes to disk.
# --------------------------------------------------------------------------

def _validate_credential_passphrase(passphrase):
    text = str(passphrase or "")
    if len(text) < CREDENTIAL_PASSPHRASE_MIN_LENGTH:
        raise ValueError(f"credentials passphrase must be at least {CREDENTIAL_PASSPHRASE_MIN_LENGTH} characters")
    return text


def _credential_fernet(passphrase, salt, iterations=CREDENTIAL_KDF_ITERATIONS):
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=int(iterations))
    return Fernet(base64.urlsafe_b64encode(kdf.derive(str(passphrase or "").encode("utf-8"))))


def _gather_credential_secrets(con):
    """{"provider_configs": {id: {field: value}}, "notification_connectors":
    {id: {field: value}}} for every credential-shaped field
    sanitized_provider_settings() (the same filter redact_provider_secrets()
    applies to the full backup archive) would otherwise strip. Tables/rows/
    fields with nothing secret are omitted entirely, not included empty.

    notification_connectors is created lazily by inkdrop_notification_store
    on first use, not by inkdrop_state.init_schema() -- an install that has
    never opened notification settings genuinely has no such table yet.
    Checking sqlite_master first (the same guard redact_provider_secrets()
    already uses for the full backup archive) keeps that a normal "nothing to
    gather" case instead of an unhandled OperationalError that would take the
    whole export down with it.
    """
    tables = {row[0] for row in con.execute("select name from sqlite_master where type='table'")}
    credentials = {}
    provider_rows = con.execute("select id, settings_json from provider_configs").fetchall() if "provider_configs" in tables else []
    provider_credentials = {}
    for provider_id, settings_json in provider_rows:
        try:
            settings = json.loads(settings_json or "{}")
        except (TypeError, ValueError):
            continue
        if not isinstance(settings, dict):
            continue
        _kept, removed = sanitized_provider_settings(settings)
        fields = {name: settings[name] for name in removed if name in settings}
        if fields:
            provider_credentials[str(provider_id)] = fields
    if provider_credentials:
        credentials["provider_configs"] = provider_credentials

    if "notification_connectors" not in tables:
        return credentials
    try:
        from core import inkdrop_notifications as notifications
    except Exception:
        notifications = None
    connector_credentials = {}
    connector_rows = con.execute("select id, type, settings_json from notification_connectors").fetchall()
    for connector_id, connector_type, settings_json in connector_rows:
        try:
            settings = json.loads(settings_json or "{}")
        except (TypeError, ValueError):
            continue
        if not isinstance(settings, dict):
            continue
        cls = notifications.PROVIDER_CLASSES.get(connector_type) if notifications else None
        declared = [field["key"] for field in cls.config_fields if field.get("secret")] if cls else []
        settings_with_declared = dict(settings)
        settings_with_declared["secret_fields"] = sorted(set(settings.get("secret_fields") or []) | set(declared))
        _kept, removed = sanitized_provider_settings(settings_with_declared)
        fields = {name: settings[name] for name in removed if name in settings}
        if fields:
            connector_credentials[str(connector_id)] = fields
    if connector_credentials:
        credentials["notification_connectors"] = connector_credentials
    return credentials


def _credential_count(credentials):
    return sum(len(fields) for table in (credentials or {}).values() for fields in table.values())


def encrypt_credentials_payload(credentials, passphrase):
    passphrase = _validate_credential_passphrase(passphrase)
    salt = os.urandom(16)
    ciphertext = _credential_fernet(passphrase, salt).encrypt(_canonical_json(credentials).encode("utf-8"))
    return {
        "kdf": "pbkdf2-sha256",
        "iterations": CREDENTIAL_KDF_ITERATIONS,
        "salt": base64.b64encode(salt).decode("ascii"),
        "ciphertext": ciphertext.decode("ascii"),
        "count": _credential_count(credentials),
    }


def decrypt_credentials_payload(blob, passphrase):
    """Raises ValueError with a message safe to show the user directly --
    never includes the passphrase, the ciphertext, or decrypted values."""
    if not isinstance(blob, dict):
        raise ValueError("credentials block is malformed")
    try:
        salt = base64.b64decode(str(blob.get("salt") or ""), validate=True)
        ciphertext = str(blob.get("ciphertext") or "").encode("ascii")
        iterations = int(blob.get("iterations") or 0)
    except Exception as exc:
        raise ValueError("credentials block is malformed") from exc
    if not salt or not ciphertext or iterations <= 0:
        raise ValueError("credentials block is malformed")
    fernet = _credential_fernet(passphrase, salt, iterations=iterations)
    try:
        plaintext = fernet.decrypt(ciphertext)
    except InvalidToken as exc:
        raise ValueError("incorrect passphrase, or the credentials in this file are corrupted") from exc
    try:
        credentials = json.loads(plaintext.decode("utf-8"))
    except (TypeError, ValueError, UnicodeDecodeError) as exc:
        raise ValueError("decrypted credentials are not valid JSON") from exc
    if not isinstance(credentials, dict) or any(table not in CREDENTIAL_TABLES for table in credentials):
        raise ValueError("decrypted credentials have an unexpected shape")
    return credentials


def _credential_restore_plan(con, credentials):
    """Never returns a decrypted value, only which provider/connector rows
    and field names would change -- the plan is shown in a preview response
    before Apply, and a plaintext credential has no business round-tripping
    back out over the network once it's been encrypted."""
    changes = []
    unknown = []
    existing_tables = _existing_credential_tables(con)
    for table in CREDENTIAL_TABLES:
        rows = credentials.get(table)
        if not isinstance(rows, dict):
            continue
        if table not in existing_tables:
            for row_id in rows:
                unknown.append({"table": table, "id": str(row_id), "reason": "table_not_present_on_this_install"})
            continue
        for row_id, fields in rows.items():
            if not isinstance(fields, dict):
                continue
            existing = con.execute(f"select settings_json from {table} where id=?", (str(row_id),)).fetchone()
            if not existing:
                unknown.append({"table": table, "id": str(row_id), "reason": "row_not_present_on_this_install"})
                continue
            try:
                existing_settings = json.loads(existing[0] or "{}")
            except (TypeError, ValueError):
                existing_settings = {}
            for field in sorted(fields):
                if not isinstance(existing_settings, dict) or field not in existing_settings:
                    unknown.append({"table": table, "id": str(row_id), "field": field, "reason": "field_not_present_on_this_install"})
                    continue
                changes.append({"table": table, "id": str(row_id), "field": field})
    return {"changes": changes, "unknown": unknown}


def _existing_credential_tables(con):
    tables = {row[0] for row in con.execute("select name from sqlite_master where type='table'")}
    return {table for table in CREDENTIAL_TABLES if table in tables}


def _apply_credential_restore(con, credentials, now):
    applied = 0
    existing_tables = _existing_credential_tables(con)
    for table in CREDENTIAL_TABLES:
        if table not in existing_tables:
            continue
        rows = credentials.get(table)
        if not isinstance(rows, dict):
            continue
        for row_id, fields in rows.items():
            if not isinstance(fields, dict):
                continue
            existing = con.execute(f"select settings_json from {table} where id=?", (str(row_id),)).fetchone()
            if not existing:
                continue
            try:
                existing_settings = json.loads(existing[0] or "{}")
            except (TypeError, ValueError):
                continue
            if not isinstance(existing_settings, dict):
                continue
            changed = False
            for field, value in fields.items():
                if field not in existing_settings:
                    continue
                existing_settings[field] = value
                changed = True
                applied += 1
            if changed:
                con.execute(
                    f"update {table} set settings_json=?, updated_at=? where id=?",
                    (_canonical_json(existing_settings), now, str(row_id)),
                )
    return applied


def _portable_exclusion_reason(key, value):
    key_text = str(key or "")
    if key_text.lower().startswith("auth."):
        return "security_or_identity"
    # Booleans, numbers, and closed choice sets cannot carry a host path or a
    # credential, whatever their name contains. Without this, policy settings
    # like media_management.apply_planned_path and setup.local_folder_only_mode
    # were dropped from every export for matching PATH/FOLDER by name.
    kind = inkdrop_settings_registry.field_schema(key_text).get("kind")
    if kind in {"boolean", "number", "choice"}:
        return ""
    if key_text in PORTABLE_NAMING_TEMPLATE_KEYS:
        return ""
    upper = key_text.upper()
    if any(marker in upper for marker in SECRET_KEY_MARKERS):
        return "secret_or_credential"
    if any(marker in upper for marker in ("PATH", "ROOT", "DIRECTORY", "FOLDER", "URL", "HOST", "ORIGIN", "PROXY")):
        return "private_or_host_specific"
    return ""


def _portable_rows(con):
    return con.execute("select key,value_json from app_settings order by key").fetchall()


def _portable_document_from_rows(rows, *, now=None, version=None, credentials_encrypted=None):
    now = time.time() if now is None else float(now)
    included = {}
    excluded = []
    for row in rows[:PORTABLE_SETTINGS_MAX_COUNT + 1]:
        key = str(row["key"] or "").strip()
        if not key or len(key) > 160 or key.lower() in PROTOTYPE_KEYS:
            excluded.append({"key": key[:160], "reason": "invalid_or_reserved_key"})
            continue
        try:
            value = _load_stored_json(row["value_json"])
        except (TypeError, ValueError):
            excluded.append({"key": key, "reason": "malformed_or_non_finite_stored_value"})
            continue
        if not inkdrop_settings_registry.is_defined_public_setting(key):
            excluded.append({"key": key, "reason": "unknown_or_deprecated"})
            continue
        reason = _portable_exclusion_reason(key, value)
        if reason:
            excluded.append({"key": key, "reason": reason, "value": "<not-exported>"})
            continue
        try:
            included[key] = inkdrop_auth.validate_setting_value(key, inkdrop_settings_registry.validate_value(key, value))
        except ValueError:
            excluded.append({"key": key, "reason": "invalid_stored_value"})
    if len(rows) > PORTABLE_SETTINGS_MAX_COUNT:
        raise ValueError("too many settings to export")
    metadata = inkdrop_version.build_metadata() if version is None else {"version": str(version)}
    document = {
        "schema": PORTABLE_SETTINGS_SCHEMA,
        "schema_version": 1,
        "product": PORTABLE_SETTINGS_PRODUCT,
        "product_version": str(metadata.get("version") or "dev")[:64],
        "exported_at": utc_stamp(now),
        "mode": "merge",
        "settings": included,
        "excluded": excluded,
        "contains": {
            "app_settings": True,
            "provider_credentials": bool(credentials_encrypted),
            "private_paths": False,
            "media": False,
            "tasks_history_users_sessions": False,
        },
    }
    if credentials_encrypted:
        document["credentials_encrypted"] = credentials_encrypted
    document["checksum"] = _settings_checksum(document)
    return document


def export_portable_settings(db_path, *, now=None, version=None, include_credentials=False, passphrase=None):
    with inkdrop_state.connect_read(db_path) as con:
        rows = _portable_rows(con)
        credentials_encrypted = None
        if include_credentials:
            credentials = _gather_credential_secrets(con)
            credentials_encrypted = encrypt_credentials_payload(credentials, passphrase)
    return _portable_document_from_rows(rows, now=now, version=version, credentials_encrypted=credentials_encrypted)


def portable_settings_filename(document):
    stamp = "".join(character for character in str((document or {}).get("exported_at") or "") if character.isdigit())[:14]
    return f"inkdrop-settings-{stamp or 'backup'}.json"


def _strict_portable_value(key, value):
    _require_finite_json(value, label=key)
    schema = inkdrop_settings_registry.field_schema(key)
    kind = schema.get("kind")
    if kind == "boolean" and type(value) is not bool:
        raise ValueError(f"{key} must be a JSON boolean")
    if kind == "array":
        if type(value) is not list or any(type(item) is not str for item in value):
            raise ValueError(f"{key} must be a JSON list of strings")
    elif kind == "number":
        if schema.get("integer"):
            if type(value) is not int:
                raise ValueError(f"{key} must be a JSON integer")
        elif type(value) not in {int, float}:
            raise ValueError(f"{key} must be a JSON number")
    elif kind in {"choice", "string"} and type(value) is not str:
        raise ValueError(f"{key} must be a JSON string")
    return inkdrop_auth.validate_setting_value(key, inkdrop_settings_registry.validate_value(key, value))


def _portable_settings_plan(document, rows):
    schema_version = document.get("schema_version")
    if document.get("schema") != PORTABLE_SETTINGS_SCHEMA or type(schema_version) is not int or schema_version != 1:
        raise ValueError("unsupported settings backup schema")
    if document.get("product") != PORTABLE_SETTINGS_PRODUCT:
        raise ValueError("settings backup belongs to another product")
    if not str(document.get("product_version") or "").strip() or len(str(document.get("product_version"))) > 64:
        raise ValueError("settings backup product version is invalid")
    supplied_checksum = str(document.get("checksum") or "")
    if not supplied_checksum or not hmac.compare_digest(supplied_checksum, _settings_checksum(document)):
        raise ValueError("settings backup checksum mismatch")
    settings = document.get("settings")
    if not isinstance(settings, dict) or len(settings) > PORTABLE_SETTINGS_MAX_COUNT:
        raise ValueError("settings backup has an invalid settings collection")
    current = {}
    for row in rows:
        key = str(row["key"])
        try:
            current[key] = _load_stored_json(row["value_json"])
        except (TypeError, ValueError):
            current[key] = INVALID_STORED_VALUE
    changes, unchanged, unknown, invalid = [], [], [], []
    validated = {}
    restart_required = []
    for key, value in sorted(settings.items()):
        key = str(key or "").strip()
        if not key or len(key) > 160 or key.lower() in PROTOTYPE_KEYS:
            invalid.append({"key": key[:160], "reason": "invalid_or_reserved_key"})
            continue
        if key not in current or not inkdrop_settings_registry.is_defined_public_setting(key):
            unknown.append({"key": key, "reason": "unknown_or_deprecated"})
            continue
        if _portable_exclusion_reason(key, value):
            invalid.append({"key": key, "reason": "non_portable_setting"})
            continue
        if current[key] is INVALID_STORED_VALUE:
            invalid.append({"key": key, "reason": "current_stored_value_is_malformed_or_non_finite"})
            continue
        try:
            parsed = _strict_portable_value(key, value)
        except ValueError as exc:
            invalid.append({"key": key, "reason": str(exc)[:240]})
            continue
        validated[key] = parsed
        if current[key] == parsed:
            unchanged.append(key)
        else:
            changes.append({"key": key, "from": current[key], "to": parsed})
        if inkdrop_settings_registry.augment_setting({"key": key}).get("restart_required"):
            restart_required.append(key)
    return {
        "ok": not invalid,
        "merge_only": True,
        "changes": changes,
        "unchanged": unchanged,
        "unknown": unknown,
        "invalid": invalid,
        "validated": validated,
        "restart_required": restart_required,
        "restart_guidance": (
            "Restart InkDrop after apply for: " + ", ".join(restart_required)
            if restart_required else "No restart is required for the portable settings in this backup."
        ),
    }


def _snapshot_existing_file(source, backup_dir, *, now=None):
    """Copy `source` aside into `backup_dir` before it gets overwritten, using
    the same atomic tempfile-then-replace pattern as _write_settings_snapshot.
    Returns the snapshot path, or None if there was nothing to snapshot yet
    (e.g. a first-ever restore onto an empty state dir)."""
    source = Path(source)
    if not source.exists():
        return None
    backup_dir = Path(backup_dir)
    _secure_backup_directory(backup_dir)
    target = backup_dir / f"{source.stem}-before-restore-{compact_stamp(now)}{source.suffix}"
    fd, temporary = tempfile.mkstemp(prefix=f".{source.stem}-", suffix=".tmp", dir=backup_dir)
    try:
        with os.fdopen(fd, "wb") as handle:
            with source.open("rb") as src:
                shutil.copyfileobj(src, handle)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
        _verify_sensitive_archive_mode(target)
        if os.name != "nt":
            directory_fd = os.open(str(backup_dir), os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
    except Exception:
        Path(temporary).unlink(missing_ok=True)
        raise
    return target


def _write_settings_snapshot(rows, backup_dir, *, now=None):
    backup_dir = Path(backup_dir)
    _secure_backup_directory(backup_dir)
    document = _portable_document_from_rows(rows, now=now)
    target = backup_dir / f"inkdrop-settings-before-restore-{compact_stamp(now)}.json"
    fd, temporary = tempfile.mkstemp(prefix=".inkdrop-settings-", suffix=".tmp", dir=backup_dir)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(document, handle, indent=2, ensure_ascii=False, sort_keys=True)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
        _verify_sensitive_archive_mode(target)
        if os.name != "nt":
            directory_fd = os.open(str(backup_dir), os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
    except Exception:
        Path(temporary).unlink(missing_ok=True)
        raise
    return target


def _apply_portable_setting(con, key, value, now):
    con.execute(
        "update app_settings set value_json=?,source='user',updated_at=? where key=?",
        (_canonical_json(value), now, key),
    )


def _credentials_plan_section(con, document, passphrase):
    """Never touches the DB. Returns a plan section safe to send back to the
    client as-is: counts and which rows/fields would change, never a
    decrypted value. `ok` gates whether Apply may proceed when credentials
    are present -- present-but-unverified must block Apply rather than
    silently apply settings while skipping credentials with no signal that
    anything was left out."""
    blob = document.get("credentials_encrypted")
    if not blob:
        return {"present": False, "count": 0, "passphrase_provided": False, "verified": False, "ok": True}
    count = int((blob or {}).get("count") or 0) if isinstance(blob, dict) else 0
    if not passphrase:
        return {"present": True, "count": count, "passphrase_provided": False, "verified": False, "ok": False}
    try:
        credentials = decrypt_credentials_payload(blob, passphrase)
    except ValueError as exc:
        return {"present": True, "count": count, "passphrase_provided": True, "verified": False, "ok": False, "error": str(exc)}
    row_plan = _credential_restore_plan(con, credentials)
    return {
        "present": True,
        "count": count,
        "passphrase_provided": True,
        "verified": True,
        "ok": True,
        "changes": row_plan["changes"],
        "unknown": row_plan["unknown"],
        "_credentials": credentials,
    }


def restore_portable_settings(db_path, raw_document, *, apply=False, backup_dir=None, now=None, passphrase=None):
    document = parse_portable_settings_document(raw_document)
    if not apply:
        with inkdrop_state.connect_read(db_path) as con:
            rows = _portable_rows(con)
            credentials_plan = _credentials_plan_section(con, document, passphrase)
        plan = _portable_settings_plan(document, rows)
        public_plan = {key: value for key, value in plan.items() if key != "validated"}
        public_plan["credentials"] = {key: value for key, value in credentials_plan.items() if key != "_credentials"}
        return {
            "ok": bool(plan["ok"]) and bool(credentials_plan["ok"]),
            "applied": False,
            "dry_run": True,
            "source": {"product_version": document.get("product_version"), "exported_at": document.get("exported_at"), "checksum": document.get("checksum")},
            "plan": public_plan,
        }
    timestamp = time.time() if now is None else float(now)
    with inkdrop_state.connect(db_path) as con:
        con.execute("begin immediate")
        rows = _portable_rows(con)
        plan = _portable_settings_plan(document, rows)
        credentials_plan = _credentials_plan_section(con, document, passphrase)
        public_plan = {key: value for key, value in plan.items() if key != "validated"}
        public_plan["credentials"] = {key: value for key, value in credentials_plan.items() if key != "_credentials"}
        result = {
            "ok": bool(plan["ok"]) and bool(credentials_plan["ok"]),
            "applied": False,
            "dry_run": False,
            "source": {"product_version": document.get("product_version"), "exported_at": document.get("exported_at"), "checksum": document.get("checksum")},
            "plan": public_plan,
        }
        if not plan["ok"] or not credentials_plan["ok"]:
            con.rollback()
            return result
        snapshot = _write_settings_snapshot(
            rows,
            backup_dir or inkdrop_runtime_config.backup_dir(),
            now=now,
        )
        changed_keys = [row["key"] for row in plan["changes"]]
        for key in changed_keys:
            _apply_portable_setting(con, key, plan["validated"][key], timestamp)
        credentials_applied = 0
        if credentials_plan.get("_credentials"):
            credentials_applied = _apply_credential_restore(con, credentials_plan["_credentials"], timestamp)
        inkdrop_state.record_settings_history(
            con,
            "settings_restore",
            "settings_backup",
            str(document.get("checksum") or "")[-16:],
            "settings",
            f"Restored {len(changed_keys)} portable setting(s)" + (f", {credentials_applied} credential(s)" if credentials_applied else ""),
            {
                "changed_keys": changed_keys,
                "changed_count": len(changed_keys),
                "unknown_count": len(plan["unknown"]),
                "source_schema": document.get("schema"),
                "credentials_applied": credentials_applied,
            },
            timestamp,
        )
        inkdrop_state.update_sync_meta(con, timestamp, "settings_restore")
        con.commit()
    inkdrop_state.clear_settings_caches()
    result.update({
        "ok": True,
        "applied": True,
        "snapshot": path_text(snapshot),
        "changed_count": len(changed_keys),
        "credentials_applied": credentials_applied,
    })
    return result


def _redact_notification_connectors(con, report):
    """Sibling pass for notification_connectors.settings_json -- Phase 1's
    per-instance connector table holds the exact same shape of raw,
    vault-less credentials (a Discord webhook URL, a Pushover token/key)
    that provider_configs holds, but under type-generic key names
    (webhook_url, api_token, user_key) that is_secret_key()'s naming
    heuristic doesn't catch. Rather than duplicate a second secret-field
    registry here, ask inkdrop_notifications' PROVIDER_CLASSES -- the one
    place a connector type's config_fields (and their secret=True flags)
    are actually declared -- which fields to drop for each row's type.
    """
    try:
        from core import inkdrop_notifications as notifications
    except Exception:
        return
    rows = con.execute("select id, type, settings_json from notification_connectors").fetchall()
    for connector_id, connector_type, settings_json in rows:
        report["rows_scanned"] += 1
        try:
            settings = json.loads(settings_json or "{}")
        except (TypeError, ValueError):
            continue
        if not isinstance(settings, dict):
            continue
        cls = notifications.PROVIDER_CLASSES.get(connector_type)
        declared = [field["key"] for field in cls.config_fields if field.get("secret")] if cls else []
        settings = dict(settings)
        settings["secret_fields"] = sorted(set(settings.get("secret_fields") or []) | set(declared))
        kept, removed = sanitized_provider_settings(settings)
        if not removed:
            continue
        con.execute(
            "update notification_connectors set settings_json=? where id=?",
            (_canonical_json(kept), connector_id),
        )
        report["rows_redacted"] += 1
        report["fields_redacted"] += len(removed)


def redact_provider_secrets(target_db: Path):
    """Null out credential-shaped provider_configs.settings_json fields (and
    notification_connectors.settings_json -- see _redact_notification_connectors)
    in a private backup copy, using the same field-name rules
    sanitized_provider_settings() already applies to the portability JSON
    export. Neither table has vault indirection like download_client_instances
    does -- callers store credentials (e.g. a Komga password, a Discord
    webhook URL) directly in settings_json -- so the raw SQLite copy embedded
    in the full backup archive must go through the same filter the JSON
    export already applies, or it ships them in plaintext.

    Runs against `target_db` in place. The copy may have inherited WAL mode
    from the live source, in which case a plain UPDATE would land in a
    `-wal` sibling file that create_backup_archive() never zips -- forcing
    `journal_mode=delete` first ensures the redaction is actually present in
    the single file that gets shipped.
    """
    report = {"ok": True, "rows_scanned": 0, "rows_redacted": 0, "fields_redacted": 0}
    with contextlib.closing(sqlite3.connect(target_db)) as con:
        con.execute("pragma journal_mode=delete")
        tables = {row[0] for row in con.execute("select name from sqlite_master where type='table'")}
        if "provider_configs" in tables:
            rows = con.execute("select id, settings_json from provider_configs").fetchall()
            for provider_id, settings_json in rows:
                report["rows_scanned"] += 1
                try:
                    settings = json.loads(settings_json or "{}")
                except (TypeError, ValueError):
                    continue
                if not isinstance(settings, dict):
                    continue
                kept, removed = sanitized_provider_settings(settings)
                if not removed:
                    continue
                con.execute(
                    "update provider_configs set settings_json=? where id=?",
                    (_canonical_json(kept), provider_id),
                )
                report["rows_redacted"] += 1
                report["fields_redacted"] += len(removed)
        if "notification_connectors" in tables:
            _redact_notification_connectors(con, report)
        con.commit()
    return report


def backup_sqlite_db(source_db: Path, target_db: Path):
    target_db.parent.mkdir(parents=True, exist_ok=True)
    if not source_db.exists():
        return {"ok": False, "reason": "state_db_missing", "source": path_text(source_db)}
    # sqlite3.Connection.backup() is the correct, WAL-safe hot-backup API --
    # it copies whatever is in the WAL along with the main file, unlike a raw
    # file copy, which would silently drop any transactions still sitting in
    # a WAL-mode source's -wal file at copy time (the live state DB runs in
    # WAL mode). A previous shutil.copy2() fallback ran on any sqlite3.Error,
    # which could ship a stale/torn snapshot with no indication anything was
    # wrong. A backup that might not be a coherent snapshot is worse than a
    # loud failure, so transient errors (e.g. SQLITE_BUSY lock contention)
    # get a few retries, and the backup fails closed rather than silently
    # degrading if the safe API still can't succeed.
    attempts = 3
    last_error = None
    for attempt in range(1, attempts + 1):
        target_db.unlink(missing_ok=True)
        try:
            with contextlib.closing(sqlite3.connect(f"file:{source_db}?mode=ro", uri=True)) as src, contextlib.closing(sqlite3.connect(target_db)) as dst:
                src.backup(dst)
                dst.commit()
            last_error = None
            break
        except sqlite3.Error as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(0.5)
    if last_error is not None:
        target_db.unlink(missing_ok=True)
        return {
            "ok": False,
            "reason": "sqlite_backup_failed",
            "source": path_text(source_db),
            "error": f"{type(last_error).__name__}: {last_error}",
            "attempts": attempts,
        }
    _validate_sqlite_database(target_db, label="state backup copy")
    auth_safety = inkdrop_auth.sanitize_auth_database_copy(target_db)
    if not auth_safety.get("ok"):
        target_db.unlink(missing_ok=True)
        raise ValueError("state backup credential-safety validation failed")
    provider_secret_redaction = redact_provider_secrets(target_db)
    return {
        "ok": True,
        "method": "sqlite_backup",
        "source": path_text(source_db),
        "bytes": target_db.stat().st_size,
        "auth_credential_safety": auth_safety,
        "provider_secret_redaction": provider_secret_redaction,
    }


def create_backup_archive(
    *,
    config_dir=None,
    state_db_path=None,
    backup_dir=None,
    environ=None,
    label="manual",
):
    env = environ if environ is not None else os.environ
    config_dir = Path(config_dir or inkdrop_runtime_config.config_dir(env))
    state_db_path = Path(state_db_path or inkdrop_runtime_config.state_db_path(env))
    backup_dir = Path(backup_dir or inkdrop_runtime_config.backup_dir(env))
    _secure_backup_directory(backup_dir)
    archive_path = backup_dir / f"inkdrop-backup-{compact_stamp()}-{label}.zip"
    fd, temp_archive_name = tempfile.mkstemp(prefix=".inkdrop-backup-", suffix=".tmp", dir=backup_dir)
    temp_archive = Path(temp_archive_name)
    try:
        if os.name == "posix":
            os.fchmod(fd, 0o600)
        os.close(fd)
        fd = -1
        with tempfile.TemporaryDirectory(prefix="inkdrop-backup-build-") as tmp:
            tmp_root = Path(tmp)
            temp_db = tmp_root / STATE_DB_ARCHIVE_NAME
            db_backup = backup_sqlite_db(state_db_path, temp_db)
            if not db_backup.get("ok"):
                raise ValueError(
                    f"state database backup failed: {db_backup.get('reason') or 'unknown_error'}"
                )
            # Logins, sessions, and API keys live in their own database next
            # to the state file; a backup that skipped it would restore a
            # library with last year's credentials.
            auth_db_path = inkdrop_auth.auth_store_path(state_db_path)
            temp_auth_db = tmp_root / AUTH_DB_ARCHIVE_NAME
            auth_db_backup = backup_sqlite_db(auth_db_path, temp_auth_db)
            config_export = redacted_config_export(env)
            secret_refs = {
            "schema_version": BACKUP_RESTORE_SCHEMA_VERSION,
            "exported_at": utc_stamp(),
            "secrets": config_export.get("secret_refs") or {},
            "note": "Secret values are not included. Recreate these values in the target environment.",
        }
            manifest = {
            "schema_version": BACKUP_RESTORE_SCHEMA_VERSION,
            "created_at": utc_stamp(),
            "label": str(label or "manual"),
            "contains": {
                "state_db": bool(db_backup.get("ok")),
                "auth_db": bool(auth_db_backup.get("ok")),
                "redacted_config_export": True,
                "secret_reference_manifest": True,
                "media_files": False,
                "reader_databases": False,
                "staging_downloads": False,
                "reusable_credentials": False,
            },
            "source": {
                "config_dir": path_text(config_dir),
                "state_db_path": path_text(state_db_path),
                "auth_db_path": path_text(auth_db_path),
                "backup_dir": path_text(backup_dir),
            },
            "state_db_backup": db_backup,
            "auth_db_backup": auth_db_backup,
            "credential_policy": "Authentication material in the state backup is cryptographically hashed; plaintext passwords, sessions, recovery tokens, and API keys are never exported. Provider credentials stored directly in provider settings (see state_db_backup.provider_secret_redaction) are redacted from the embedded state database copy the same way they are from the portability export.",
        }
            with zipfile.ZipFile(temp_archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.writestr(MANIFEST_ARCHIVE_NAME, json.dumps(manifest, indent=2, sort_keys=True))
                zf.writestr(CONFIG_EXPORT_ARCHIVE_NAME, json.dumps(config_export, indent=2, sort_keys=True))
                zf.writestr(SECRET_REFS_ARCHIVE_NAME, json.dumps(secret_refs, indent=2, sort_keys=True))
                if db_backup.get("ok"):
                    zf.write(temp_db, STATE_DB_ARCHIVE_NAME)
                if auth_db_backup.get("ok"):
                    zf.write(temp_auth_db, AUTH_DB_ARCHIVE_NAME)
        _verify_sensitive_archive_mode(temp_archive)
        with temp_archive.open("r+b") as handle:
            os.fsync(handle.fileno())
        os.replace(temp_archive, archive_path)
        _verify_sensitive_archive_mode(archive_path)
        if os.name == "posix":
            directory_fd = os.open(backup_dir, os.O_RDONLY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
    except Exception:
        temp_archive.unlink(missing_ok=True)
        raise
    finally:
        if fd >= 0:
            os.close(fd)
    return {
        "ok": True,
        "archive_path": path_text(archive_path),
        "manifest": manifest,
        "config_export": {
            "schema_version": config_export["schema_version"],
            "value_count": len(config_export.get("values") or {}),
            "secret_ref_count": len(config_export.get("secret_refs") or {}),
        },
    }


# inkdrop-backup-{YYYYmmdd-HHMMSS}-{label}.zip, matching compact_stamp()'s own
# format -- create_backup_archive() names every archive this way, so listing/
# pruning read the timestamp back out of the filename itself rather than
# keeping a separate index that could drift from what's actually on disk.
BACKUP_ARCHIVE_NAME_RE = re.compile(r"^inkdrop-backup-(\d{8}-\d{6})-(.+)\.zip$")


def _parsed_backup_archive(path):
    match = BACKUP_ARCHIVE_NAME_RE.match(path.name)
    if not match:
        return None
    try:
        created_at = calendar.timegm(time.strptime(match.group(1), "%Y%m%d-%H%M%S"))
    except ValueError:
        return None
    try:
        stat = path.stat()
    except OSError:
        return None
    return {
        "name": path.name,
        "label": match.group(2),
        "created_at": created_at,
        "created_at_iso": utc_stamp(created_at),
        "bytes": stat.st_size,
    }


def list_backup_archives(backup_dir=None):
    """Every recognized backup archive on disk, newest first.

    Reads the directory rather than any stored index, so a file dropped in or
    removed outside InkDrop (an operator's own cron, a manual scp) shows up
    correctly on the next call -- there is nothing else to keep in sync.
    """
    backup_dir = Path(backup_dir or inkdrop_runtime_config.backup_dir())
    if not backup_dir.is_dir():
        return []
    archives = []
    for entry in backup_dir.iterdir():
        if not entry.is_file():
            continue
        parsed = _parsed_backup_archive(entry)
        if parsed:
            archives.append(parsed)
    archives.sort(key=lambda item: item["created_at"], reverse=True)
    return archives


def prune_backup_archives(backup_dir=None, *, retention_days=28, label=None, now=None):
    """Delete archives older than retention_days, sonarr-style.

    Always keeps at least the single newest archive matching `label` (or the
    newest archive overall when label is None), even if it is itself past
    retention -- a misconfigured retention window (0, or a clock that jumped)
    must never delete every backup in the directory and leave none.
    """
    backup_dir = Path(backup_dir or inkdrop_runtime_config.backup_dir())
    now = float(now if now is not None else time.time())
    cutoff = now - max(0, int(retention_days)) * 86400
    archives = list_backup_archives(backup_dir)
    if label is not None:
        scoped = [item for item in archives if item["label"] == label]
    else:
        scoped = archives
    deleted = []
    kept = []
    for index, item in enumerate(scoped):
        if index == 0 or item["created_at"] >= cutoff:
            kept.append(item["name"])
            continue
        try:
            (backup_dir / item["name"]).unlink()
            deleted.append(item["name"])
        except OSError as exc:
            kept.append(item["name"])
            item["prune_error"] = f"{type(exc).__name__}: {exc}"
    return {"ok": True, "deleted": deleted, "kept": kept, "retention_days": int(retention_days)}


def run_scheduled_backup(*, config_dir=None, state_db_path=None, backup_dir=None, environ=None, interval_days=7, retention_days=28, now=None):
    """Create a new "scheduled" backup only once interval_days have passed
    since the last one, then prune -- the interval check only ever looks at
    prior "scheduled" archives, so a manual backup an operator triggers from
    the UI never delays or resets the automatic cadence.
    """
    now = float(now if now is not None else time.time())
    backup_dir = Path(backup_dir or inkdrop_runtime_config.backup_dir(environ if environ is not None else os.environ))
    existing = [item for item in list_backup_archives(backup_dir) if item["label"] == "scheduled"]
    due = not existing or (now - existing[0]["created_at"]) >= max(1, int(interval_days)) * 86400
    created = None
    if due:
        created = create_backup_archive(
            config_dir=config_dir,
            state_db_path=state_db_path,
            backup_dir=backup_dir,
            environ=environ,
            label="scheduled",
        )
    prune_result = prune_backup_archives(backup_dir, retention_days=retention_days, label="scheduled", now=now)
    return {"ok": True, "due": due, "created": created, "prune": prune_result}


def _safe_zip_members(zf):
    members = []
    for info in zf.infolist():
        name = info.filename.replace("\\", "/")
        if name.startswith("/") or ".." in Path(name).parts:
            raise ValueError(f"unsafe archive member path: {info.filename}")
        members.append(info)
    return members


def _validate_sqlite_database(database_path, *, label):
    """Reject non-databases and internally inconsistent SQLite snapshots."""
    try:
        with contextlib.closing(
            sqlite3.connect(f"file:{Path(database_path)}?mode=ro", uri=True)
        ) as con:
            quick_check = [row[0] for row in con.execute("pragma quick_check").fetchall()]
            foreign_key_violations = con.execute("pragma foreign_key_check").fetchall()
    except sqlite3.Error as exc:
        raise ValueError(f"{label} is not a valid SQLite database: {exc}") from exc
    if quick_check != ["ok"]:
        raise ValueError(f"{label} failed SQLite quick_check: {quick_check!r}")
    if foreign_key_violations:
        raise ValueError(
            f"{label} has {len(foreign_key_violations)} foreign-key violation(s)"
        )
    return {"quick_check": "ok", "foreign_key_violations": 0}


def _stage_archive_member(zf, archive_name, target_dir):
    """Copy a member to a durable sibling temp file for atomic replacement."""
    target_dir = Path(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    fd, staged_name = tempfile.mkstemp(prefix=".inkdrop-restore-", dir=target_dir)
    staged_path = Path(staged_name)
    try:
        with os.fdopen(fd, "wb") as dst, zf.open(archive_name) as src:
            fd = -1
            shutil.copyfileobj(src, dst)
            dst.flush()
            os.fsync(dst.fileno())
        return staged_path
    except Exception:
        staged_path.unlink(missing_ok=True)
        raise
    finally:
        if fd >= 0:
            os.close(fd)


def _clear_state_auth_generation(state_db_path):
    """Drop a restored state database's claim about which auth store it owns."""
    state_db_path = Path(state_db_path)
    if not state_db_path.exists():
        return
    try:
        with contextlib.closing(sqlite3.connect(state_db_path)) as con:
            con.execute("delete from app_settings where key='auth.store_generation'")
            con.commit()
    except sqlite3.Error:
        pass


def restore_backup_archive(
    archive_path,
    *,
    target_config_dir=None,
    target_state_dir=None,
    apply=False,
    backup_dir=None,
    preserve_current_auth=False,
):
    archive_path = Path(archive_path)
    target_config_dir = Path(target_config_dir or inkdrop_runtime_config.config_dir())
    target_state_dir = Path(target_state_dir or inkdrop_runtime_config.state_dir())
    backup_dir = Path(backup_dir or inkdrop_runtime_config.backup_dir())
    with zipfile.ZipFile(archive_path, "r") as zf:
        _safe_zip_members(zf)
        archive_names = set(zf.namelist())
        if STATE_DB_ARCHIVE_NAME not in archive_names:
            raise ValueError("backup archive does not contain the required state database")
        for required_name in (MANIFEST_ARCHIVE_NAME, CONFIG_EXPORT_ARCHIVE_NAME, SECRET_REFS_ARCHIVE_NAME):
            if required_name not in archive_names:
                raise ValueError(f"backup archive is missing required member: {required_name}")
        manifest = json.loads(zf.read(MANIFEST_ARCHIVE_NAME).decode("utf-8"))
        config_export = json.loads(zf.read(CONFIG_EXPORT_ARCHIVE_NAME).decode("utf-8"))
        source_values = config_export.get("values") if isinstance(config_export.get("values"), dict) else {}
        path_warnings = []
        for key in PATH_ENV_KEYS:
            value = str(source_values.get(key) or "").strip()
            if not value or value in {"<set>", "<unset>"}:
                continue
            if not Path(value).exists():
                path_warnings.append(
                    {
                        "key": key,
                        "source_path": value,
                        "reason": "path_missing_on_restore_host",
                        "next_action": "Update this setting after restore.",
                    }
                )
        # A dry run must prove the databases are usable, not merely that the
        # ZIP member names exist.  Extraction is isolated from restore targets.
        with tempfile.TemporaryDirectory(prefix="inkdrop-restore-preview-") as preview_dir:
            preview_root = Path(preview_dir)
            preview_state = _stage_archive_member(zf, STATE_DB_ARCHIVE_NAME, preview_root)
            database_validation = {
                "state_db": _validate_sqlite_database(preview_state, label="backup state database")
            }
            if AUTH_DB_ARCHIVE_NAME in archive_names:
                preview_auth = _stage_archive_member(zf, AUTH_DB_ARCHIVE_NAME, preview_root)
                database_validation["auth_db"] = _validate_sqlite_database(
                    preview_auth, label="backup auth database"
                )
        result = {
            "ok": True,
            "dry_run": not bool(apply),
            "archive_path": path_text(archive_path),
            "target_config_dir": path_text(target_config_dir),
            "target_state_dir": path_text(target_state_dir),
            "manifest": manifest,
            "database_validation": database_validation,
            "path_warnings": path_warnings,
            "would_restore": {
                "state_db": STATE_DB_ARCHIVE_NAME in archive_names,
                "auth_db": AUTH_DB_ARCHIVE_NAME in archive_names,
                "config_export": CONFIG_EXPORT_ARCHIVE_NAME in archive_names,
                "secret_refs": SECRET_REFS_ARCHIVE_NAME in archive_names,
            },
        }
        if not apply:
            return result
        target_config_dir.mkdir(parents=True, exist_ok=True)
        target_state_dir.mkdir(parents=True, exist_ok=True)
        staged_files = {}
        try:
            staged_files[STATE_DB_ARCHIVE_NAME] = _stage_archive_member(
                zf, STATE_DB_ARCHIVE_NAME, target_state_dir
            )
            _validate_sqlite_database(
                staged_files[STATE_DB_ARCHIVE_NAME], label="backup state database"
            )
            if AUTH_DB_ARCHIVE_NAME in archive_names:
                staged_files[AUTH_DB_ARCHIVE_NAME] = _stage_archive_member(
                    zf, AUTH_DB_ARCHIVE_NAME, target_state_dir
                )
                _validate_sqlite_database(
                    staged_files[AUTH_DB_ARCHIVE_NAME], label="backup auth database"
                )
            for archive_name in (CONFIG_EXPORT_ARCHIVE_NAME, SECRET_REFS_ARCHIVE_NAME):
                staged_files[archive_name] = _stage_archive_member(
                    zf, archive_name, target_config_dir
                )
        except Exception:
            for staged_path in staged_files.values():
                staged_path.unlink(missing_ok=True)
            raise
        # Snapshot whatever's already on disk before any restore write
        # overwrites it -- restore_portable_settings has always done this for
        # its own narrower scope (_write_settings_snapshot); this path never
        # did, so an operator restoring the wrong archive (or restoring twice)
        # had no automatic way back to what was there a moment before.
        pre_restore_snapshots = []
        try:
            state_target = target_state_dir / inkdrop_runtime_config.STATE_DB_NAME
            snapshot = _snapshot_existing_file(state_target, backup_dir)
            if snapshot:
                pre_restore_snapshots.append(path_text(snapshot))
            os.replace(staged_files.pop(STATE_DB_ARCHIVE_NAME), state_target)
            result["restored_state_db"] = path_text(state_target)
            auth_target = target_state_dir / inkdrop_auth.AUTH_STORE_DB_NAME
            if preserve_current_auth:
                # Explicitly requested: keep whatever credentials exist right
                # now and let the next open adopt them. The restored state
                # database must not claim a store generation it never met.
                _clear_state_auth_generation(target_state_dir / inkdrop_runtime_config.STATE_DB_NAME)
                result["auth_store"] = "preserved_current_auth"
            elif AUTH_DB_ARCHIVE_NAME in archive_names:
                snapshot = _snapshot_existing_file(auth_target, backup_dir)
                if snapshot:
                    pre_restore_snapshots.append(path_text(snapshot))
                os.replace(staged_files.pop(AUTH_DB_ARCHIVE_NAME), auth_target)
                for suffix in ("-wal", "-shm"):
                    Path(str(auth_target) + suffix).unlink(missing_ok=True)
                result["restored_auth_db"] = path_text(auth_target)
                result["auth_store"] = "restored_from_archive"
            elif auth_target.exists():
                # The archive predates the auth split. Leaving today's store
                # would mix old application state with current logins, so the
                # first open must rebuild it from the restored state database.
                snapshot = _snapshot_existing_file(auth_target, backup_dir)
                if snapshot:
                    pre_restore_snapshots.append(path_text(snapshot))
                auth_target.unlink()
                for suffix in ("-wal", "-shm"):
                    Path(str(auth_target) + suffix).unlink(missing_ok=True)
                result["auth_store"] = "removed_for_archive_epoch"
            else:
                result["auth_store"] = "absent"
            inkdrop_auth.reset_auth_store_cache()
            for archive_name, target_name in (
                (CONFIG_EXPORT_ARCHIVE_NAME, "inkdrop-config-export.json"),
                (SECRET_REFS_ARCHIVE_NAME, "inkdrop-secret-refs.json"),
            ):
                existing_target = target_config_dir / target_name
                snapshot = _snapshot_existing_file(existing_target, backup_dir)
                if snapshot:
                    pre_restore_snapshots.append(path_text(snapshot))
                os.replace(staged_files.pop(archive_name), existing_target)
        finally:
            for staged_path in staged_files.values():
                staged_path.unlink(missing_ok=True)
        result["restored_config_files"] = [
            path_text(target_config_dir / "inkdrop-config-export.json"),
            path_text(target_config_dir / "inkdrop-secret-refs.json"),
        ]
        result["pre_restore_snapshots"] = pre_restore_snapshots
        return result


def main(argv=None):
    parser = argparse.ArgumentParser(description="Create or restore an InkDrop config/state backup archive.")
    sub = parser.add_subparsers(dest="command", required=True)
    backup = sub.add_parser("backup", help="Create a config/state backup archive.")
    backup.add_argument("--config-dir")
    backup.add_argument("--state-db")
    backup.add_argument("--backup-dir")
    backup.add_argument("--label", default="manual")
    restore = sub.add_parser("restore", help="Preview or apply a config/state backup restore.")
    restore.add_argument("archive")
    restore.add_argument("--target-config-dir")
    restore.add_argument("--target-state-dir")
    restore.add_argument("--apply", action="store_true", help="Write restored state/config files.")
    restore.add_argument("--backup-dir", help="Where to snapshot existing state/config files before an --apply restore overwrites them.")
    restore.add_argument(
        "--preserve-current-auth",
        action="store_true",
        help="Keep today's logins and API keys instead of the archive's. Default restores auth from the same point in time as the rest of the archive.",
    )
    scheduled = sub.add_parser("scheduled-backup", help="Create a backup if the interval has elapsed, then prune by retention.")
    scheduled.add_argument("--config-dir")
    scheduled.add_argument("--state-db")
    scheduled.add_argument("--backup-dir")
    scheduled.add_argument("--interval-days", type=int, default=7)
    scheduled.add_argument("--retention-days", type=int, default=28)
    args = parser.parse_args(argv)
    if args.command == "backup":
        result = create_backup_archive(
            config_dir=args.config_dir,
            state_db_path=args.state_db,
            backup_dir=args.backup_dir,
            label=args.label,
        )
    elif args.command == "scheduled-backup":
        result = run_scheduled_backup(
            config_dir=args.config_dir,
            state_db_path=args.state_db,
            backup_dir=args.backup_dir,
            interval_days=args.interval_days,
            retention_days=args.retention_days,
        )
    else:
        result = restore_backup_archive(
            args.archive,
            backup_dir=args.backup_dir,
            target_config_dir=args.target_config_dir,
            target_state_dir=args.target_state_dir,
            apply=args.apply,
            preserve_current_auth=bool(args.preserve_current_auth),
        )
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
