#!/bin/sh
set -eu
export PYTHONDONTWRITEBYTECODE=1
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

(cd "$ROOT/sdk/typescript" && pnpm build >/dev/null)
node "$ROOT/conformance/run.mjs" --suite "$ROOT/conformance/suite-v0.4.json" --implementation-version 0.8.0-dev.0 --output "$ROOT/conformance/reports/typescript-sdk-0.8.0-dev.0-suite-0.4.0.json"
python3 "$ROOT/sdk/python/conformance.py" --suite "$ROOT/conformance/suite-v0.4.json" --implementation-version 0.2.0-dev.0 --output "$ROOT/conformance/reports/python-sdk-0.2.0-dev.0-suite-0.4.0.json"
(cd "$ROOT/sdk/go" && GOCACHE="${GOCACHE:-/tmp/oati-go-sdk-cache}" go run ./cmd/conformance --suite "$ROOT/conformance/suite-v0.4.json" --implementation-version 0.2.0-dev.0 --output "$ROOT/conformance/reports/go-sdk-0.2.0-dev.0-suite-0.4.0.json")

node "$ROOT/conformance/check-reports.mjs" \
  "$ROOT/conformance/reports/typescript-sdk-0.8.0-dev.0-suite-0.4.0.json" \
  "$ROOT/conformance/reports/python-sdk-0.2.0-dev.0-suite-0.4.0.json" \
  "$ROOT/conformance/reports/go-sdk-0.2.0-dev.0-suite-0.4.0.json"
