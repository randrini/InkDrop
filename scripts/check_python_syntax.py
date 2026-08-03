#!/usr/bin/env python3
"""Check Python files parse correctly."""
import ast
import glob
import sys

files = glob.glob("inkdrop*.py") + glob.glob("tools/*.py") + glob.glob("tests/*.py")
ok = True
for f in files:
    try:
        ast.parse(open(f).read(), filename=f)
    except SyntaxError as e:
        print(f"{f}: {e}", file=sys.stderr)
        ok = False
if not ok:
    sys.exit(1)
print("All Python files parse OK")
