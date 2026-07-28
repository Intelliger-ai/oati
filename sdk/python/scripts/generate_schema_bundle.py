#!/usr/bin/env python3
"""Generate the schema resource shipped in the Python wheel and sdist."""
from __future__ import annotations

import json
from pathlib import Path

SDK_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_ROOT = SDK_ROOT.parents[1] / "schemas"
OUTPUT = SDK_ROOT / "src" / "oati" / "_schema_bundle.json"

bundle: dict[str, object] = {}
for path in sorted(SCHEMA_ROOT.rglob("*.json")):
    if path.name in bundle:
        raise SystemExit(f"duplicate schema filename cannot be bundled: {path.name}")
    bundle[path.name] = json.loads(path.read_text(encoding="utf-8"))

OUTPUT.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
print(f"Bundled {len(bundle)} schemas in {OUTPUT.relative_to(SDK_ROOT)}")
