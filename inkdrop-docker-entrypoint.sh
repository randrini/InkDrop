#!/bin/sh
# Container entrypoint: optional PUID/PGID support, LinuxServer.io-style.
#
# The image still starts as root by default so this script *can* create/
# remap a runtime account and fix mount ownership before dropping privilege.
# If Compose already started the container as a non-root user (a `user:`
# directive or `docker run --user`), Docker enforces that before this script
# ever runs -- there is no root left to create accounts or chown anything,
# so that path always wins over PUID/PGID and we just exec the command as-is.
set -eu

RUN_USER=inkdrop
RUN_GROUP=inkdrop
# Fallback used only to fill in the *other* value when an operator sets just
# one of PUID/PGID -- never applied unless at least one was explicitly set.
DEFAULT_PUID=1000
DEFAULT_PGID=1000

# Read from the same INKDROP_* variables core/inkdrop_runtime_config.py
# resolves paths from, with matching fallback defaults, so this stays correct
# whether InkDrop is started via the documented docker-compose.yml mounts
# (/config, /state, /staging, /manual-inbox, /library/...) or a plain
# `docker run` relying on the Dockerfile's own baked-in ENV defaults.
#
# INKDROP_STATE_DIR is the one variable where those two scenarios genuinely
# differ: docker-compose.yml explicitly passes it through blank by default
# (`${INKDROP_STATE_DIR:-}`), which -- unlike a truly *unset* variable --
# overrides the Dockerfile's own `ENV INKDROP_STATE_DIR=/config/state` with
# an empty string. inkdrop_runtime_config.state_dir() treats that blank value
# as "unconfigured" and falls back to its own default of /state, not the
# Dockerfile's /config/state. Use the same "/state" fallback here so a blank
# (compose) value resolves the same directory Python resolves it to; a plain
# `docker run` still sees the Dockerfile's real, non-blank /config/state and
# both this script and Python read that value directly instead.
#
# InkDrop's own working directories: safe to fix recursively, since they hold
# InkDrop's database/config/logs, not an operator's media collection.
CHOWN_RECURSIVE_DIRS="${INKDROP_CONFIG_DIR:-/config} ${INKDROP_STATE_DIR:-/state}"
# Roots that can hold a large, operator-owned media library or a lot of
# transient files. Only each root itself is touched (not walked recursively)
# so InkDrop can create new subdirectories under it with correct ownership;
# existing library content is left alone on purpose -- InkDrop only needs the
# containing directory to be writable to add new files, and a recursive
# chown here could walk hundreds of thousands of comic/manga files for no
# functional benefit.
CHOWN_SHALLOW_DIRS="${INKDROP_STAGING_DIR:-/downloads/staging} ${INKDROP_MANUAL_INBOX_DIR:-/config/manual-inbox} ${INKDROP_COMIC_ROOT:-/data/comics} ${INKDROP_MANGA_ROOT:-/data/manga}"

# `docker compose run`/`exec` do not reliably keep a container's stdout and
# stderr as separate streams from the caller's point of view -- scripted
# callers that pipe container output straight into a JSON parser (this
# repo's own release tooling does exactly that) would otherwise see this
# script's own status lines break the parse. Stay silent on the routine path
# by default; INKDROP_ENTRYPOINT_VERBOSE=1 opts back into status lines for
# interactive troubleshooting. The two invalid-input cases below always log,
# since they already abort with a non-zero exit and no JSON was ever coming.
verbose_log() {
    if [ "${INKDROP_ENTRYPOINT_VERBOSE:-0}" = "1" ]; then
        printf '[inkdrop-entrypoint] %s\n' "$*" >&2
    fi
}

fatal_log() {
    printf '[inkdrop-entrypoint] %s\n' "$*" >&2
}

# Unlike verbose_log, warnings about a partially-failed privilege drop must
# always be visible -- silently swallowing a failed chown would leave an
# operator with no way to tell why writes into a mount started failing.
warn_log() {
    printf '[inkdrop-entrypoint] %s\n' "$*" >&2
}

current_uid="$(id -u)"

if [ "$current_uid" != "0" ]; then
    if [ -n "${PUID:-}" ] || [ -n "${PGID:-}" ]; then
        verbose_log "Container started as non-root UID ${current_uid} (Compose 'user:' or --user was set). Ignoring PUID/PGID -- a non-root process cannot create accounts or change file ownership. Make sure the mounted config/state/staging/manual-inbox/library directories are already owned by UID:GID ${current_uid}:$(id -g) on the host, or preflight will report them as unwritable."
    fi
    exec "$@"
fi

# PUID/PGID are opt-in only -- there is no default. InkDrop has only ever run
# as root; leaving both unset must keep that behavior unchanged (including on
# upgrade for every existing install, which will never have set them). Only
# remap identity when the operator explicitly sets at least one.
if [ -z "${PUID:-}" ] && [ -z "${PGID:-}" ]; then
    verbose_log "PUID/PGID not set; running as root (unchanged default behavior). Set both in .env to opt into a non-root runtime account."
    exec "$@"
fi

PUID="${PUID:-$DEFAULT_PUID}"
PGID="${PGID:-$DEFAULT_PGID}"

case "$PUID" in
    ''|*[!0-9]*) fatal_log "PUID must be a positive integer (got '$PUID'); refusing to start."; exit 1 ;;
esac
case "$PGID" in
    ''|*[!0-9]*) fatal_log "PGID must be a positive integer (got '$PGID'); refusing to start."; exit 1 ;;
esac

if [ "$PUID" = "0" ] || [ "$PGID" = "0" ]; then
    verbose_log "PUID=$PUID PGID=$PGID requested; running as root. This is not recommended for a Docker install -- prefer a non-zero PUID/PGID (e.g. 1000:1000) or a Compose 'user:' directive instead."
    exec "$@"
fi

existing_group_name="$(getent group "$PGID" 2>/dev/null | cut -d: -f1 || true)"
if [ -n "$existing_group_name" ] && [ "$existing_group_name" != "$RUN_GROUP" ]; then
    RUN_GROUP="$existing_group_name"
else
    groupmod -o -g "$PGID" "$RUN_GROUP" >/dev/null 2>&1
fi

usermod -o -u "$PUID" -g "$PGID" "$RUN_USER" >/dev/null 2>&1

verbose_log "Running as PUID=$PUID PGID=$PGID (user $RUN_USER, group $RUN_GROUP)"

for dir in $CHOWN_RECURSIVE_DIRS; do
    mkdir -p "$dir" 2>/dev/null || true
    if [ -d "$dir" ]; then
        chown -R "$PUID:$PGID" "$dir" 2>/dev/null || warn_log "warning: could not fully chown $dir -- check host mount permissions"
    fi
done

if [ "${INKDROP_SKIP_CHOWN:-0}" != "1" ]; then
    for dir in $CHOWN_SHALLOW_DIRS; do
        # mkdir -p first (still root here): some of these are subdirectories
        # InkDrop creates under a mount rather than the mount root itself (for
        # example the default /downloads/staging under a plain `docker run`
        # with no docker-compose.yml override), so the target may not exist
        # yet on a fresh mount. Creating it now means it's born with the
        # right ownership instead of being silently skipped.
        mkdir -p "$dir" 2>/dev/null || true
        if [ -d "$dir" ]; then
            chown "$PUID:$PGID" "$dir" 2>/dev/null || warn_log "warning: could not chown $dir -- check host mount permissions"
        fi
    done
else
    verbose_log "INKDROP_SKIP_CHOWN=1: leaving mount ownership untouched"
fi

if [ "${INKDROP_CHOWN_LIBRARY:-0}" = "1" ]; then
    for dir in "${INKDROP_COMIC_ROOT:-/data/comics}" "${INKDROP_MANGA_ROOT:-/data/manga}"; do
        if [ -d "$dir" ]; then
            verbose_log "INKDROP_CHOWN_LIBRARY=1: recursively fixing ownership under $dir -- this can take a long time on a large library"
            chown -R "$PUID:$PGID" "$dir" 2>/dev/null || warn_log "warning: could not fully chown $dir -- check host mount permissions"
        fi
    done
fi

exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups --no-new-privs -- "$@"
