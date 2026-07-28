#!/usr/bin/env python3
"""Build and install the Python distribution in an isolated fresh virtualenv."""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SDK_ROOT = Path(__file__).resolve().parents[1]
CONSUMER = r'''
from oati import canonical_json, create_mandate, validate_schema

mandate = create_mandate({
    "id": "oati:mandate:fresh:install-1",
    "issuer": "oati:issuer:fresh",
    "subject": "oati:agent:fresh:buyer",
    "purpose": "Verify a clean package installation",
    "actions": ["api.call"],
    "resources": ["oati:service:fresh:test"],
    "not_before": "2026-01-01T00:00:00Z",
    "expires_at": "2027-01-01T00:00:00Z",
    "status": "active",
})
assert canonical_json({"b": 2, "a": 1}) == '{"a":1,"b":2}'
assert validate_schema("mandate", mandate) == []
print("fresh Python package consumer passed")
'''

def run(*command: str, cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    subprocess.run(command, cwd=cwd, env=env, check=True)

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--format", choices=("wheel", "sdist"), required=True)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="oati-python-install-") as temporary:
        root = Path(temporary)
        distributions = root / "dist"
        source = root / "source"
        shutil.copytree(SDK_ROOT, source, ignore=shutil.ignore_patterns(".venv", "build", "dist", "*.egg-info", "__pycache__", "*.pyc"))
        run(sys.executable, "-m", "build", f"--{args.format}", "--outdir", str(distributions), str(source))
        suffix = ".whl" if args.format == "wheel" else ".tar.gz"
        artifacts = list(distributions.glob(f"*{suffix}"))
        if len(artifacts) != 1:
            raise SystemExit(f"expected one {args.format} artifact, found {artifacts}")
        environment = root / "consumer"
        run(sys.executable, "-m", "venv", str(environment))
        python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        run(str(python), "-m", "pip", "install", "--disable-pip-version-check", "--no-deps", str(artifacts[0]))
        run(str(python), "-I", "-c", CONSUMER, cwd=root)

if __name__ == "__main__":
    main()
