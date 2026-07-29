import assert from "node:assert/strict"
import test from "node:test"
import { checkConformanceReports } from "./check-reports.mjs"

const result = { id: "core.example", category: "core", status: "pass", expected_outcome: "pass", observed_outcome: "pass", codes: [] }
function report(language) { return { report_version: "1.0", suite_version: "0.4.0", standard_version: "1.0", implementation: { name: language, version: "test", language }, summary: { total: 1, passed: 1, failed: 0 }, results: [structuredClone(result)] } }

test("report checker requires exact cross-language results", () => {
  assert.deepEqual(checkConformanceReports([report("typescript"), report("python"), report("go")], 1), { languages: ["typescript", "python", "go"], total: 1, standardVersion: "1.0", suiteVersion: "0.4.0" })
  const mismatch = report("go"); mismatch.results[0].codes = ["DIFFERENT"]
  assert.throws(() => checkConformanceReports([report("typescript"), mismatch], 1), /differ/)
  const wrongSuite = report("go"); wrongSuite.suite_version = "0.3.0"
  assert.throws(() => checkConformanceReports([report("typescript"), wrongSuite], 1), /different standard or suite/)
})

test("report checker rejects inconsistent summaries and duplicate languages", () => {
  const inconsistent = report("python"); inconsistent.summary.passed = 0
  assert.throws(() => checkConformanceReports([report("typescript"), inconsistent], 1), /summary/)
  assert.throws(() => checkConformanceReports([report("go"), report("go")], 1), /duplicate/)
})
