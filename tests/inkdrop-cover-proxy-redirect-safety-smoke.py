#!/usr/bin/env python3
"""The cover proxy must not be steerable off the provider it was pointed at.

Every case here runs with no network: a fake transport answers the fetch and a
fake resolver answers DNS, so the assertions are about the proxy's own rules --
which hops it will follow, which addresses it will talk to, what it hands back
when it refuses, and whether a refusal can leave anything in the cover cache.
"""

from __future__ import annotations

import os
import socket
import tempfile
from pathlib import Path

from core import inkdrop_web


CANARY = b"CANARY-INTERNAL"
IMAGE = b"\xff\xd8\xff\xe0-real-cover-bytes"
COVER = "https://uploads.mangadex.org/covers/9a/f1e2.jpg"
COMICVINE = "https://comicvine.gamespot.com/a/uploads/scale_large/1-2-3.jpg"
# Genuinely globally routable, because that is exactly what the proxy checks --
# the documentation ranges (203.0.113.0/24, 2001:db8::/32) are reserved and read
# as non-global, so they would make every case fail for the wrong reason.
PUBLIC_ADDRESSES = ["104.18.0.1", "2606:4700::6810:1"]


def require(value, message):
    if not value:
        raise AssertionError(message)


class FakeResponse:
    def __init__(self, url, status=200, headers=None, body=b"", peer=None):
        self.url = url
        self.status_code = status
        self.headers = dict(headers or {})
        self._body = bytes(body)
        self.closed = False
        self.raw = _FakeRaw(peer) if peer else None

    def iter_content(self, chunk_size=65536):
        for start in range(0, len(self._body), chunk_size):
            yield self._body[start:start + chunk_size]

    def close(self):
        self.closed = True


class _FakeSocket:
    def __init__(self, peer):
        self._peer = peer

    def getpeername(self):
        return (self._peer, 443)


class _FakeConnection:
    def __init__(self, peer):
        self.sock = _FakeSocket(peer)


class _FakeRaw:
    def __init__(self, peer):
        self._connection = _FakeConnection(peer)


class FakeTransport:
    """Answers by exact URL. An unrouted URL is a test bug, not a 404, so it
    raises -- a rule that silently stopped matching would otherwise pass."""

    def __init__(self, routes):
        self.routes = dict(routes)
        self.requested = []

    def get(self, url, **kwargs):
        require(kwargs.get("allow_redirects") is False, f"cover fetch followed redirects itself for {url}")
        require(kwargs.get("stream") is True, "cover fetch stopped streaming")
        self.requested.append(url)
        if url not in self.routes:
            raise AssertionError(f"cover proxy requested an unrouted url: {url}")
        return self.routes[url]


def image_response(url, body=IMAGE, peer=None):
    return FakeResponse(url, 200, {"Content-Type": "image/jpeg"}, body, peer=peer)


def redirect_response(url, location, status=302):
    return FakeResponse(url, status, {"Location": location})


def resolver_for(addresses):
    def resolve(host, port, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, port)) for address in addresses]

    return resolve


def failing_resolver(host, port, **kwargs):
    raise OSError("no such host")


def run_case(cache_dir, name, raw_url, routes, addresses=None, resolver=None):
    for stale in cache_dir.iterdir():
        stale.unlink()
    transport = FakeTransport(routes)
    payload = inkdrop_web.inkdrop_cover_proxy_response(
        raw_url,
        transport=transport,
        resolver=resolver if resolver is not None else resolver_for(addresses if addresses is not None else PUBLIC_ADDRESSES),
    )
    return payload, transport, sorted(path.name for path in cache_dir.iterdir())


def expect_refusal(cache_dir, name, raw_url, routes, *, reason, addresses=None, resolver=None, requests_made=None):
    payload, transport, cached = run_case(cache_dir, name, raw_url, routes, addresses, resolver)
    require(payload.get("ok") is False, f"{name}: proxy accepted a fetch it should have refused")
    require(payload.get("reason") == reason, f"{name}: refused with {payload.get('reason')!r}, expected {reason!r}")
    body = bytes(payload.get("body") or b"")
    require(CANARY not in body, f"{name}: refusal leaked the fetched body")
    require(b"://" not in body and b"mangadex" not in body.lower(), f"{name}: refusal body carried a url")
    require(body == reason.encode("ascii"), f"{name}: refusal body was not the stable reason code")
    require(not cached, f"{name}: refusal wrote {cached} into the cover cache")
    if requests_made is not None:
        require(
            len(transport.requested) == requests_made,
            f"{name}: made {len(transport.requested)} requests, expected {requests_made}",
        )
    return payload


def expect_success(cache_dir, name, raw_url, routes, *, addresses=None, body=IMAGE):
    payload, transport, cached = run_case(cache_dir, name, raw_url, routes, addresses)
    require(payload.get("ok") is True, f"{name}: proxy refused a legitimate cover ({payload.get('reason')})")
    require(bytes(payload.get("body") or b"") == body, f"{name}: returned the wrong bytes")
    require(payload.get("content_type") == "image/jpeg", f"{name}: returned the wrong content type")
    require(len(cached) == 1, f"{name}: expected one cache file, found {cached}")
    return payload


def check_url_gate():
    """The caller's own url is the first hop and gets the same rules."""

    accepted = inkdrop_web.cover_proxy_allowed_url(COVER)
    require(accepted == COVER, f"a plain mangadex cover url was rejected: {accepted!r}")
    require(inkdrop_web.cover_proxy_allowed_url(COMICVINE) == COMICVINE, "a plain comicvine cover url was rejected")
    require(
        inkdrop_web.cover_proxy_allowed_url("https://UPLOADS.MangaDex.org./covers/9a/f1e2.jpg") == COVER,
        "host case and a trailing dot did not normalize to the canonical url",
    )
    refused = {
        "credentials": "https://user:secret@uploads.mangadex.org/covers/9a/f1e2.jpg",
        "userinfo-only": "https://user@uploads.mangadex.org/covers/9a/f1e2.jpg",
        "fragment": "https://uploads.mangadex.org/covers/9a/f1e2.jpg#x",
        "alternate-port": "https://uploads.mangadex.org:8443/covers/9a/f1e2.jpg",
        "plain-http": "http://uploads.mangadex.org/covers/9a/f1e2.jpg",
        "dot-segment": "https://uploads.mangadex.org/covers/../a/uploads/9a.jpg",
        "encoded-dot-segment": "https://uploads.mangadex.org/covers/%2e%2e/%2e%2e/etc/passwd",
        "encoded-separator": "https://uploads.mangadex.org/covers/9a%2f..%2fetc/passwd",
        "empty-segment": "https://uploads.mangadex.org/covers//9a/f1e2.jpg",
        "wrong-directory": "https://uploads.mangadex.org/internal/9a/f1e2.jpg",
        "wrong-host": "https://uploads.mangadex.org.evil.example/covers/9a/f1e2.jpg",
        "loopback-literal": "https://127.0.0.1/covers/9a/f1e2.jpg",
        "metadata-literal": "https://169.254.169.254/covers/9a/f1e2.jpg",
        "control-character": "https://uploads.mangadex.org/covers/9a/f1\ne2.jpg",
        "empty": "",
    }
    for label, candidate in refused.items():
        require(
            inkdrop_web.cover_proxy_allowed_url(candidate) is None,
            f"the url gate accepted a {label} url",
        )


def main():
    check_url_gate()
    with tempfile.TemporaryDirectory(prefix="inkdrop-cover-proxy-smoke-") as tmp:
        cache_dir = Path(tmp) / "cover-cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        original_cache_dir = inkdrop_web.COVER_CACHE_DIR
        inkdrop_web.COVER_CACHE_DIR = cache_dir
        try:
            expect_success(
                cache_dir,
                "direct fetch",
                COVER,
                {COVER: image_response(COVER)},
            )

            same_host = "https://uploads.mangadex.org/covers/9a/f1e2-2048.jpg"
            expect_success(
                cache_dir,
                "same-host relative redirect",
                COVER,
                {
                    COVER: redirect_response(COVER, "/covers/9a/f1e2-2048.jpg"),
                    same_host: image_response(same_host),
                },
            )

            hops = [f"https://uploads.mangadex.org/covers/9a/hop{index}.jpg" for index in range(5)]
            expect_success(
                cache_dir,
                "three redirects is inside the hop budget",
                COVER,
                {
                    COVER: redirect_response(COVER, hops[0]),
                    hops[0]: redirect_response(hops[0], hops[1]),
                    hops[1]: redirect_response(hops[1], hops[2]),
                    hops[2]: image_response(hops[2]),
                },
            )

            expect_refusal(
                cache_dir,
                "hop limit",
                COVER,
                {
                    COVER: redirect_response(COVER, hops[0]),
                    hops[0]: redirect_response(hops[0], hops[1]),
                    hops[1]: redirect_response(hops[1], hops[2]),
                    hops[2]: redirect_response(hops[2], hops[3]),
                    hops[3]: image_response(hops[3], CANARY),
                },
                reason="cover_redirect_limit",
                requests_made=4,
            )

            expect_refusal(
                cache_dir,
                "redirect loop",
                COVER,
                {
                    COVER: redirect_response(COVER, hops[0]),
                    hops[0]: redirect_response(hops[0], COVER),
                },
                reason="cover_redirect_loop",
                requests_made=2,
            )

            expect_refusal(
                cache_dir,
                "redirect off the approved host",
                COVER,
                {COVER: redirect_response(COVER, "https://internal.example.invalid/covers/9a/f1e2.jpg")},
                reason="cover_redirect_refused",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "redirect to a lookalike host",
                COVER,
                {COVER: redirect_response(COVER, "https://uploads.mangadex.org.evil.example/covers/9a/f1e2.jpg")},
                reason="cover_redirect_refused",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "redirect to a loopback literal",
                COVER,
                {COVER: redirect_response(COVER, "http://127.0.0.1/internal")},
                reason="cover_redirect_refused",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "redirect that escapes the cover directory",
                COVER,
                {COVER: redirect_response(COVER, "/covers/%2e%2e/%2e%2e/internal/secret")},
                reason="cover_redirect_refused",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "redirect out of the cover directory",
                COVER,
                {COVER: redirect_response(COVER, "https://uploads.mangadex.org/internal/secret.jpg")},
                reason="cover_redirect_refused",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "redirect that smuggles credentials",
                COVER,
                {COVER: redirect_response(COVER, "https://user:secret@uploads.mangadex.org/covers/9a/f1e2.jpg")},
                reason="cover_redirect_refused",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "redirect with a fragment",
                COVER,
                {COVER: redirect_response(COVER, "https://uploads.mangadex.org/covers/9a/f1e2.jpg#x")},
                reason="cover_redirect_refused",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "redirect to an alternate port",
                COVER,
                {COVER: redirect_response(COVER, "https://uploads.mangadex.org:9999/covers/9a/f1e2.jpg")},
                reason="cover_redirect_refused",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "redirect with no location",
                COVER,
                {COVER: FakeResponse(COVER, 302, {}, b"")},
                reason="cover_redirect_refused",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "final response url is not the url we asked for",
                COVER,
                {COVER: image_response("http://127.0.0.1/internal", CANARY)},
                reason="cover_response_url_mismatch",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "final response url is another approved host",
                COVER,
                {COVER: image_response(COMICVINE, CANARY)},
                reason="cover_response_url_mismatch",
                requests_made=1,
            )

            for label, address in (
                ("loopback", "127.0.0.1"),
                ("rfc1918 10/8", "10.0.0.5"),
                ("rfc1918 172.16/12", "172.16.4.5"),
                ("rfc1918 192.168/16", "192.168.44.5"),
                ("link-local", "169.254.1.1"),
                ("cloud metadata", "169.254.169.254"),
                ("carrier-grade nat", "100.64.0.1"),
                ("unspecified", "0.0.0.0"),
                ("ipv6 loopback", "::1"),
                ("ipv6 unique-local", "fd00::1"),
                ("ipv4-mapped loopback", "::ffff:127.0.0.1"),
            ):
                expect_refusal(
                    cache_dir,
                    f"provider name resolves to {label}",
                    COVER,
                    {COVER: image_response(COVER, CANARY)},
                    reason="cover_host_not_publicly_routable",
                    addresses=[address],
                    requests_made=0,
                )

            expect_refusal(
                cache_dir,
                "one private answer among public ones",
                COVER,
                {COVER: image_response(COVER, CANARY)},
                reason="cover_host_not_publicly_routable",
                addresses=["104.18.0.1", "10.1.2.3"],
                requests_made=0,
            )

            expect_refusal(
                cache_dir,
                "dns resolution fails",
                COVER,
                {COVER: image_response(COVER, CANARY)},
                reason="cover_host_not_publicly_routable",
                resolver=failing_resolver,
                requests_made=0,
            )

            expect_refusal(
                cache_dir,
                "redirect target rebinds to a private address",
                COVER,
                {
                    COVER: redirect_response(COVER, COMICVINE),
                    COMICVINE: image_response(COMICVINE, CANARY),
                },
                reason="cover_host_not_publicly_routable",
                resolver=lambda host, port, **kwargs: resolver_for(
                    PUBLIC_ADDRESSES if "mangadex" in host else ["10.9.9.9"]
                )(host, port),
                requests_made=1,
            )

            for name in ("HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy"):
                os.environ.pop(name, None)
            expect_refusal(
                cache_dir,
                "socket landed on an address dns never offered",
                COVER,
                {COVER: image_response(COVER, CANARY, peer="127.0.0.1")},
                reason="cover_peer_not_approved",
                requests_made=1,
            )

            expect_success(
                cache_dir,
                "socket landed on a resolved public address",
                COVER,
                {COVER: image_response(COVER, peer="104.18.0.1")},
            )

            # Behind an outbound proxy the socket lands on the proxy, so the peer
            # comparison stands down -- but the hop rules must not.
            os.environ["HTTPS_PROXY"] = "http://proxy.internal:3128"
            try:
                expect_success(
                    cache_dir,
                    "proxied deployment still serves covers",
                    COVER,
                    {COVER: image_response(COVER, peer="10.0.0.9")},
                )
                expect_refusal(
                    cache_dir,
                    "proxied deployment still refuses a bad redirect",
                    COVER,
                    {COVER: redirect_response(COVER, "http://127.0.0.1/internal")},
                    reason="cover_redirect_refused",
                    requests_made=1,
                )
            finally:
                os.environ.pop("HTTPS_PROXY", None)

            expect_refusal(
                cache_dir,
                "upstream answered with html",
                COVER,
                {COVER: FakeResponse(COVER, 200, {"Content-Type": "text/html"}, CANARY)},
                reason="cover_response_not_an_image",
                requests_made=1,
            )

            expect_refusal(
                cache_dir,
                "upstream errored",
                COVER,
                {COVER: FakeResponse(COVER, 500, {"Content-Type": "image/jpeg"}, CANARY)},
                reason="cover_fetch_failed",
                requests_made=1,
            )

            payload = inkdrop_web.inkdrop_cover_proxy_response(
                "https://user:secret@uploads.mangadex.org/covers/9a/f1e2.jpg",
                transport=FakeTransport({}),
                resolver=resolver_for(PUBLIC_ADDRESSES),
            )
            require(payload.get("status") == 400, "a credentialed url was not rejected before the fetch")
            require(payload.get("reason") == "unsupported_cover_url", "a credentialed url refused with the wrong reason")
            require(not list(cache_dir.iterdir()), "a rejected url wrote into the cover cache")
        finally:
            inkdrop_web.COVER_CACHE_DIR = original_cache_dir
    print("cover proxy redirect safety smoke passed")


if __name__ == "__main__":
    main()
