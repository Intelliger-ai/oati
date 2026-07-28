#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export PYTHONDONTWRITEBYTECODE=1
(cd "$ROOT/sdk/typescript" && pnpm run docs >/dev/null)
(cd "$ROOT/sdk/python" && python3 scripts/generate_schema_bundle.py >/dev/null)
"$ROOT/conformance/run-all.sh"
git -C "$ROOT" diff --exit-code -- \
  sdk/typescript/src/generated-schemas.ts \
  sdk/typescript/docs/api \
  sdk/python/src/oati/_schema_bundle.json \
  conformance/reports
echo "Generated files are current"
