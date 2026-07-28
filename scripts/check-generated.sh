#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export PYTHONDONTWRITEBYTECODE=1
(cd "$ROOT/sdk/typescript" && pnpm run docs >/dev/null)
"$ROOT/conformance/run-all.sh"
git -C "$ROOT" diff --exit-code -- \
  sdk/typescript/src/generated-schemas.ts \
  sdk/typescript/docs/api \
  conformance/reports
echo "Generated files are current"
