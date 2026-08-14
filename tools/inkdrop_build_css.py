#!/usr/bin/env python3
"""Generate the served stylesheet from its source modules.

`web/static/css/inkdrop.css` is served by a single route that reads one file,
so the shipped stylesheet stays a single bundle. The editable sources live in
`web/static/css/src/` and are concatenated here in filename order.

The modules are contiguous slices of the original stylesheet, so order is the
cascade: renaming a module changes where its rules land. The numeric prefix is
the contract, not decoration.

Usage:
    python tools/inkdrop_build_css.py            # regenerate the bundle
    python tools/inkdrop_build_css.py --check    # verify without writing
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "web" / "static" / "css" / "src"
BUNDLE = ROOT / "web" / "static" / "css" / "inkdrop.css"


def source_files() -> list[Path]:
    return sorted(SOURCE_DIR.glob("*.css"))


def build() -> bytes:
    """Concatenate the source modules exactly, normalizing only line endings.

    Sources are pinned to LF by .gitattributes, but a stray CRLF checkout must
    not silently change the bundle's bytes, so normalize on read.
    """
    parts: list[bytes] = []
    for path in source_files():
        parts.append(path.read_bytes().replace(b"\r\n", b"\n"))
    return b"".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if the bundle does not match the sources instead of rewriting it",
    )
    args = parser.parse_args()

    modules = source_files()
    if not modules:
        print(f"no CSS source modules found in {SOURCE_DIR}", file=sys.stderr)
        return 2

    generated = build()
    current = BUNDLE.read_bytes().replace(b"\r\n", b"\n") if BUNDLE.exists() else None

    if args.check:
        if current == generated:
            print(f"inkdrop.css matches its {len(modules)} source modules ({len(generated)} bytes)")
            return 0
        print(
            "inkdrop.css is out of sync with web/static/css/src/.\n"
            "Run: python tools/inkdrop_build_css.py",
            file=sys.stderr,
        )
        if current is not None:
            print(f"  bundle:    {len(current)} bytes", file=sys.stderr)
            print(f"  generated: {len(generated)} bytes", file=sys.stderr)
        return 1

    if current == generated:
        print(f"inkdrop.css already current ({len(generated)} bytes)")
        return 0
    BUNDLE.write_bytes(generated)
    print(f"wrote {BUNDLE.relative_to(ROOT)} from {len(modules)} modules ({len(generated)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
