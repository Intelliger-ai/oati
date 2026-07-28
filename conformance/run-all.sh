#!/bin/sh
set -eu
export PYTHONDONTWRITEBYTECODE=1
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

(cd "$ROOT/sdk/typescript" && pnpm build >/dev/null)
node "$ROOT/conformance/run.mjs" --implementation-version 0.8.0-dev.0 --output "$ROOT/conformance/reports/typescript-sdk-0.8.0-dev.0.json"
python3 "$ROOT/sdk/python/conformance.py" --suite "$ROOT/conformance/suite-v0.1.json" --implementation-version 0.2.0-dev.0 --output "$ROOT/conformance/reports/python-sdk-0.2.0-dev.0.json"
(cd "$ROOT/sdk/go" && GOCACHE="${GOCACHE:-/tmp/oati-go-sdk-cache}" go run ./cmd/conformance --suite "$ROOT/conformance/suite-v0.1.json" --implementation-version 0.2.0-dev.0 --output "$ROOT/conformance/reports/go-sdk-0.2.0-dev.0.json")

node - "$ROOT" <<'NODE'
const fs = require("node:fs")
const root = process.argv[2]
const files = ["typescript-sdk-0.8.0-dev.0.json", "python-sdk-0.2.0-dev.0.json", "go-sdk-0.2.0-dev.0.json"]
const reports = files.map((file) => JSON.parse(fs.readFileSync(root + "/conformance/reports/" + file, "utf8")))
const expected = reports[0].results.map((item) => item.id).join("\n")
for (const report of reports) {
  if (report.summary.failed || report.results.map((item) => item.id).join("\n") !== expected) throw new Error(report.implementation.language + " did not execute the exact shared case set")
}
console.log("Cross-SDK conformance passed: " + reports.map((report) => report.implementation.language + " " + report.summary.passed + "/" + report.summary.total).join(", "))
NODE
