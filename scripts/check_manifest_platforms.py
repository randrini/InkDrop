#!/usr/bin/env python3
"""Print manifest platforms from stdin JSON."""
import json
import sys

m = json.load(sys.stdin)
for platform in m.get("manifests", []):
    print(f"{platform['platform']['os']}/{platform['platform']['architecture']} -> {platform['digest']}")
