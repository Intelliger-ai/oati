import assert from "node:assert/strict"
import test from "node:test"
import { REQUIRED_REVIEW_AREAS, validateIndependentReview } from "./check-independent-review.mjs"

const now = new Date("2026-07-28T12:00:00Z")
const digest = "a".repeat(64)
const commit = "b".repeat(40)

function completedStatus() {
  return {
    $schema: "./status.schema.json",
    schema_version: 2,
    status: "completed",
    production_security_claim_eligible: true,
    engagement: {
      id: "review-2026-001", reviewer_organisation: "Independent Security Labs",
      independence_attested: true, conflicts_disclosed: true,
      started_at: "2026-06-01T00:00:00Z", completed_at: "2026-07-01T00:00:00Z", valid_until: "2027-07-01T00:00:00Z",
    },
    scope: { review_commit: commit, remediation_commit: commit, platform_review_commit: commit, public_manifest_sha256: digest, required_areas: [...REQUIRED_REVIEW_AREAS] },
    reports: {
      final: { url: "https://auditor.example/oati-final.pdf", sha256: digest },
      retest: { url: "https://auditor.example/oati-retest.pdf", sha256: digest },
      finding_dispositions: { url: "https://auditor.example/oati-findings.json", sha256: digest },
    },
    open_findings: { critical: 0, high: 0, medium: 0, low: 2 },
    verification: { retest_passed: true, conformance_suite_version: "0.3.0", all_required_conformance_passed: true },
    approvals: { security_maintainer: "security:alice", release_maintainer: "release:bob", approved_at: "2026-07-02T00:00:00Z" },
  }
}

test("a complete independent review satisfies the release metadata gate", () => {
  assert.deepEqual(validateIndependentReview(completedStatus(), { requireCompleted: true, now }), [])
})

test("development CI accepts an honest pending state while release CI fails closed", () => {
  const pending = completedStatus()
  pending.status = "awaiting-independent-review"
  pending.production_security_claim_eligible = false
  assert.deepEqual(validateIndependentReview(pending, { now }), [])
  assert.match(validateIndependentReview(pending, { requireCompleted: true, now }).join("\n"), /release blocked/)
})

test("release gate rejects expiry, findings, missing scope, and combined approval", () => {
  const status = completedStatus()
  status.engagement.valid_until = "2026-07-01T00:00:00Z"
  status.open_findings.high = 1
  status.scope.required_areas = status.scope.required_areas.filter((area) => area !== "protocol-adapters")
  status.approvals.release_maintainer = status.approvals.security_maintainer
  const errors = validateIndependentReview(status, { requireCompleted: true, now }).join("\n")
  for (const expected of ["expired", "high findings", "protocol-adapters", "approvals must be separated"]) assert.match(errors, new RegExp(expected))
})

test("release gate rejects mutable or incomplete evidence", () => {
  const status = completedStatus()
  status.reports.retest.url = "http://auditor.example/retest"
  status.reports.final.sha256 = "not-a-digest"
  status.engagement.independence_attested = false
  status.verification.retest_passed = false
  const errors = validateIndependentReview(status, { requireCompleted: true, now }).join("\n")
  for (const expected of ["HTTPS", "SHA-256", "independence", "retest must pass"]) assert.match(errors, new RegExp(expected))
})
