"""FlareSolverr-API-compatible proxy for the InkDrop source workers that hit
Cloudflare-fronted sites directly (Buzzheavier, ComicsCodes, GetComics).

Scoped narrowly to those three today, but the calling convention here --
`cloudflare_bypass_proxy_url()` to check whether it's configured,
`resolve_via_cloudflare_bypass_proxy()` to fetch through it -- is meant to be
reused as-is by a future fourth consumer without a rework.
"""
from __future__ import annotations

import ipaddress
import json
import re
import time
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest


PROXY_URL_SETTING_KEY = "automation.direct_download_cloudflare_proxy_url"

# Hosts allowed to use the proxy fallback. Buzzheavier and ComicsCodes are
# confirmed blocked by Cloudflare without it; GetComics doesn't need it
# today but gets the same resilience fallback per the approved scope.
CLOUDFLARE_BYPASS_HOSTS = frozenset(
    {
        "comics.codes",
        "www.comics.codes",
        "buzzheavier.com",
        "www.buzzheavier.com",
        "getcomics.org",
        "www.getcomics.org",
    }
)

_CHALLENGE_TEXT_MARKERS = ("challenges.cloudflare.com", "cf-mitigated", "attention required")
_STRONG_CHALLENGE_TEXT_MARKERS = (
    "attention required",
    "just a moment",
    "cf_chl_",
    "cf-chl-",
    "/cdn-cgi/challenge-platform/",
    "challenge-form",
    "checking your browser",
)

_MAX_PROXY_RESPONSE_BYTES = 8 * 1024 * 1024
_PROXY_REASON_CODES = frozenset(
    {
        "proxy_not_configured",
        "unsupported_method_for_proxy",
        "proxy_http_error",
        "proxy_unreachable",
        "proxy_solve_failed",
        "proxy_solution_missing",
        "proxy_solution_status_invalid",
        "proxy_solution_empty",
        "proxy_challenge_not_solved",
        "proxy_target_url_invalid",
        "proxy_target_hosts_required",
        "proxy_target_scheme_not_allowed",
        "proxy_target_credentials_rejected",
        "proxy_target_fragment_rejected",
        "proxy_target_port_invalid",
        "proxy_target_host_internal",
        "proxy_target_host_not_allowed",
        "proxy_final_url_invalid",
        "proxy_final_scheme_not_allowed",
        "proxy_final_credentials_rejected",
        "proxy_final_fragment_rejected",
        "proxy_final_port_invalid",
        "proxy_final_host_internal",
        "proxy_final_host_not_allowed",
        "proxy_failed",
    }
)
_PROXY_STATUS_REASON_RE = re.compile(
    r"^(proxy_http_error|proxy_challenge_not_solved_http|proxy_target_http_error)_([1-5][0-9]{2})(?:$|[\s:;,])"
)
_PROXY_EXCEPTION_REASON_RE = re.compile(
    r"^(proxy_request_failed|proxy_response_read_failed|proxy_response_not_json)_"
    r"([A-Za-z][A-Za-z0-9_]{0,63})(?:$|[\s:;,])"
)


def _safe_exception_name(exc):
    name = re.sub(r"[^A-Za-z0-9_]", "_", type(exc).__name__)[:64]
    return name or "Exception"


def _stable_proxy_reason_code(value):
    """Reduce proxy-controlled detail to a finite credential-free code."""
    text = str(value or "").strip()
    status_match = _PROXY_STATUS_REASON_RE.match(text)
    if status_match:
        return f"{status_match.group(1)}_{status_match.group(2)}"
    exception_match = _PROXY_EXCEPTION_REASON_RE.match(text)
    if exception_match:
        return f"{exception_match.group(1)}_{exception_match.group(2)}"
    for code in sorted(_PROXY_REASON_CODES, key=len, reverse=True):
        if text == code or text.startswith(f"{code}:") or text.startswith(f"{code} "):
            return code
    return "proxy_failed"


def _normalized_host(value):
    text = str(value or "").strip().lower().rstrip(".")
    if not text:
        return ""
    try:
        return text.encode("idna").decode("ascii")
    except (UnicodeError, ValueError):
        return ""


def _host_is_internal(host):
    host = _normalized_host(host)
    if not host:
        return True
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".lan", ".home.arpa")):
        return True
    if "." not in host:
        return True
    try:
        return not ipaddress.ip_address(host).is_global
    except ValueError:
        return False


def _host_allowed(host, allowed_hosts):
    host = _normalized_host(host)
    for raw in allowed_hosts or ():
        allowed = _normalized_host(str(raw or "").removeprefix("*."))
        if not allowed:
            continue
        if str(raw or "").strip().startswith("*."):
            if host.endswith(f".{allowed}"):
                return True
        elif host == allowed:
            return True
    return False


def _validated_target_url(value, allowed_hosts, *, stage):
    reason_prefix = "proxy_target" if stage == "target" else "proxy_final"
    text = str(value or "").strip()
    try:
        parsed = urlparse.urlsplit(text)
    except (TypeError, ValueError):
        return "", f"{reason_prefix}_url_invalid"
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc or not parsed.hostname:
        reason = f"{reason_prefix}_scheme_not_allowed" if parsed.scheme else f"{reason_prefix}_url_invalid"
        return "", reason
    if parsed.username is not None or parsed.password is not None:
        return "", f"{reason_prefix}_credentials_rejected"
    if parsed.fragment:
        return "", f"{reason_prefix}_fragment_rejected"
    try:
        parsed.port
    except ValueError:
        return "", f"{reason_prefix}_port_invalid"
    host = _normalized_host(parsed.hostname)
    if _host_is_internal(host):
        return "", f"{reason_prefix}_host_internal"
    if not _host_allowed(host, allowed_hosts):
        return "", f"{reason_prefix}_host_not_allowed"
    return text, ""


def _cloudflare_challenge_markers(headers, text):
    headers = headers if isinstance(headers, dict) else {}
    mitigated = str(headers.get("Cf-Mitigated") or headers.get("cf-mitigated") or "").lower()
    server = str(headers.get("Server") or headers.get("server") or "").lower()
    snippet = str(text or "")[:2000].lower()
    if "challenge" in mitigated:
        return True
    if "cloudflare" in server and "challenge" in snippet:
        return True
    return any(marker in snippet for marker in _CHALLENGE_TEXT_MARKERS)


def _strong_residual_challenge_markers(headers, text):
    headers = headers if isinstance(headers, dict) else {}
    mitigated = str(headers.get("Cf-Mitigated") or headers.get("cf-mitigated") or "").lower()
    server = str(headers.get("Server") or headers.get("server") or "").lower()
    snippet = str(text or "")[:4000].lower()
    if "challenge" in mitigated:
        return True
    strong_marker = any(marker in snippet for marker in _STRONG_CHALLENGE_TEXT_MARKERS)
    if strong_marker:
        return True
    return "cloudflare" in server and "challenge page" in snippet


def cloudflare_bypass_proxy_url(db_path):
    """Read the configured proxy base URL. Empty string means disabled --
    every caller here must treat that as a strict no-op, not an error."""
    if not db_path:
        return ""
    try:
        from core import inkdrop_state
    except ImportError:
        import inkdrop_state
    try:
        value = inkdrop_state.app_setting_value(db_path, PROXY_URL_SETTING_KEY, "")
    except Exception:
        return ""
    url = str(value or "").strip()
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return ""
    return url.rstrip("/")


def cloudflare_bypass_failure_reason(result):
    """Stable, credential-free source-status text for a proxy failure."""
    result = result if isinstance(result, dict) else {}
    return f"cloudflare_bypass_proxy_failed: {_stable_proxy_reason_code(result.get('reason'))}"


def cloudflare_bypass_status_hint(last_error):
    """Human-readable one-liner for a stored source-status `last_error`,
    when it's one of this module's own Cloudflare-shaped codes -- so a
    Source Health card can point an operator at the fix instead of
    surfacing a bare internal reason code. Returns "" for anything else,
    so callers keep showing their own text unchanged."""
    text = str(last_error or "").strip()
    if text == "cloudflare_or_host_challenge":
        return (
            "Cloudflare is blocking this source; set a Cloudflare-Bypass Proxy URL "
            "in Settings > Download Sources (a FlareSolverr-API-compatible proxy) to get past it."
        )
    if text.startswith("cloudflare_bypass_proxy_failed"):
        code = text.split(":", 1)[-1].strip() or "unknown"
        return (
            f"The configured Cloudflare-Bypass Proxy didn't clear the challenge ({code}); "
            "check the proxy container is reachable and solving."
        )
    return ""


def cloudflare_challenge_detected(status_code, headers, text):
    """Same signal ComicsCodes discovery already used for its own backoff,
    generalized so every scoped source shares one detector."""
    try:
        status_code = int(status_code)
    except (TypeError, ValueError):
        status_code = 0
    if status_code not in {401, 403, 429, 503}:
        return False
    return _cloudflare_challenge_markers(headers, text)


def resolve_via_cloudflare_bypass_proxy(
    url,
    *,
    proxy_url,
    method="GET",
    timeout_seconds=60,
    allowed_target_hosts=None,
):
    """Fetch `url` through a FlareSolverr-API-compatible proxy.

    Never raises -- any transport, timeout, or solve failure comes back as
    {"ok": False, "reason": "..."} so a caller can fail just that one source
    gracefully instead of taking down an unrelated search.
    """
    result = {"ok": False, "status_code": None, "headers": {}, "text": "", "reason": ""}
    proxy_url = str(proxy_url or "").strip().rstrip("/")
    if not proxy_url:
        result["reason"] = "proxy_not_configured"
        return result
    if str(method or "GET").strip().upper() != "GET":
        result["reason"] = "unsupported_method_for_proxy"
        return result

    if not allowed_target_hosts:
        result["reason"] = "proxy_target_hosts_required"
        return result
    raw_target_url = str(url or "").strip()
    target_url, target_error = _validated_target_url(raw_target_url, allowed_target_hosts, stage="target")
    if target_error:
        result["reason"] = target_error
        return result

    command = {
        "cmd": "request.get",
        "url": target_url,
        "maxTimeout": max(5, min(int(timeout_seconds or 60), 120)) * 1000,
    }
    body = json.dumps(command).encode("utf-8")
    request = urlrequest.Request(
        f"{proxy_url}/v1",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    start = time.time()
    try:
        response = urlrequest.urlopen(request, timeout=max(10, min(int(timeout_seconds or 60), 120) + 15))
    except urlerror.HTTPError as exc:
        try:
            status = int(exc.code)
        except (TypeError, ValueError):
            status = 0
        result["reason"] = f"proxy_http_error_{status}" if 100 <= status <= 599 else "proxy_http_error"
        return result
    except urlerror.URLError:
        result["reason"] = "proxy_unreachable"
        return result
    except Exception as exc:
        result["reason"] = f"proxy_request_failed_{_safe_exception_name(exc)}"
        return result
    try:
        raw = response.read(_MAX_PROXY_RESPONSE_BYTES)
    except Exception as exc:
        result["reason"] = f"proxy_response_read_failed_{_safe_exception_name(exc)}"
        return result
    finally:
        close = getattr(response, "close", None)
        if callable(close):
            close()

    try:
        payload = json.loads(raw.decode("utf-8", errors="replace"))
    except Exception as exc:
        result["reason"] = f"proxy_response_not_json_{_safe_exception_name(exc)}"
        return result
    if not isinstance(payload, dict) or str(payload.get("status") or "").lower() != "ok":
        result["reason"] = "proxy_solve_failed"
        return result
    solution = payload.get("solution") if isinstance(payload.get("solution"), dict) else None
    if not solution:
        result["reason"] = "proxy_solution_missing"
        return result
    status_code = solution.get("status")
    try:
        status_code = int(status_code)
    except (TypeError, ValueError):
        result["reason"] = "proxy_solution_status_invalid"
        return result
    headers = solution.get("headers") if isinstance(solution.get("headers"), dict) else {}
    text = str(solution.get("response") or "")
    if not 200 <= status_code < 300:
        if _cloudflare_challenge_markers(headers, text):
            result["reason"] = f"proxy_challenge_not_solved_http_{status_code}"
        else:
            result["reason"] = f"proxy_target_http_error_{status_code}"
        result["status_code"] = status_code
        return result
    if _strong_residual_challenge_markers(headers, text):
        result["reason"] = "proxy_challenge_not_solved"
        result["status_code"] = status_code
        return result
    if not text.strip():
        result["reason"] = "proxy_solution_empty"
        result["status_code"] = status_code
        return result
    # This validates what the proxy reports after its fetch. It contains the
    # response and prevents InkDrop from trusting an out-of-scope final URL,
    # but it cannot undo a redirect the proxy already followed. Deployments
    # must still confine proxy network egress away from private/runtime roots.
    final_url, final_error = _validated_target_url(
        solution.get("url") or target_url,
        allowed_target_hosts,
        stage="final",
    )
    if final_error:
        result["reason"] = final_error
        result["status_code"] = status_code
        return result
    result.update(
        {
            "ok": True,
            "status_code": status_code,
            "headers": headers,
            "text": text,
            "elapsed_ms": int((time.time() - start) * 1000),
            "final_url": final_url,
        }
    )
    return result
