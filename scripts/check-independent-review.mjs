#!/usr/bin/env node
import crypto from "node:crypto"
import fs from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"

export const REQUIRED_REVIEW_AREAS = [
  "protocol-design", "typescript-sdk", "go-sdk-and-cli", "python-sdk",
  "http-middleware", "protocol-adapters", "conformance", "private-platform",
]

const commitPattern = /^[0-9a-f]{40}$/
const digestPattern = /^[0-9a-f]{64}$/

export function validateIndependentReview(status, { requireCompleted = false, now = new Date() } = {}) {
  const errors = []
  const add = (condition, message) => { if (!condition) errors.push(message) }
  add(status?.$schema === "./status.schema.json", "status must reference ./status.schema.json")
  add(status?.schema_version === 2, "unsupported status schema")
  add(["awaiting-independent-review", "in-review", "remediation", "completed", "expired"].includes(status?.status), "invalid status")
  for (const key of ["engagement", "scope", "reports", "open_findings", "verification", "approvals"]) add(object(status?.[key]), `${key} must be an object`)
  exactKeys(status, ["$schema", "schema_version", "status", "production_security_claim_eligible", "engagement", "scope", "reports", "open_findings", "verification", "approvals"], "status", errors)
  exactKeys(status?.engagement, ["id", "reviewer_organisation", "independence_attested", "conflicts_disclosed", "started_at", "completed_at", "valid_until"], "engagement", errors)
  exactKeys(status?.scope, ["review_commit", "remediation_commit", "platform_review_commit", "public_manifest_sha256", "required_areas"], "scope", errors)
  exactKeys(status?.reports, ["final", "retest", "finding_dispositions"], "reports", errors)
  for (const name of ["final", "retest", "finding_dispositions"]) exactKeys(status?.reports?.[name], ["url", "sha256"], `reports.${name}`, errors)
  exactKeys(status?.open_findings, ["critical", "high", "medium", "low"], "open_findings", errors)
  exactKeys(status?.verification, ["retest_passed", "conformance_suite_version", "all_required_conformance_passed"], "verification", errors)
  exactKeys(status?.approvals, ["security_maintainer", "release_maintainer", "approved_at"], "approvals", errors)
  add(typeof status?.production_security_claim_eligible === "boolean", "production_security_claim_eligible must be boolean")
  for (const field of ["independence_attested", "conflicts_disclosed"]) add(typeof status?.engagement?.[field] === "boolean", `engagement.${field} must be boolean`)
  for (const field of ["started_at", "completed_at", "valid_until"]) add(nullableInstant(status?.engagement?.[field]), `engagement.${field} must be null or a date-time`)
  for (const field of ["review_commit", "remediation_commit", "platform_review_commit"]) add(status?.scope?.[field] === null || commitPattern.test(status?.scope?.[field] ?? ""), `scope.${field} must be null or a pinned Git commit`)
  add(status?.scope?.public_manifest_sha256 === null || digestPattern.test(status?.scope?.public_manifest_sha256 ?? ""), "scope.public_manifest_sha256 must be null or SHA-256")
  add(Array.isArray(status?.scope?.required_areas) && new Set(status.scope.required_areas).size === status.scope.required_areas.length, "scope.required_areas must be a unique array")
  for (const name of ["final", "retest", "finding_dispositions"]) {
    const evidence = status?.reports?.[name]
    add(evidence?.url === null || httpsUrl(evidence?.url), `reports.${name}.url must be null or HTTPS`)
    add(evidence?.sha256 === null || digestPattern.test(evidence?.sha256 ?? ""), `reports.${name}.sha256 must be null or SHA-256`)
  }
  for (const severity of ["critical", "high", "medium", "low"]) add(status?.open_findings?.[severity] === null || nonNegativeInteger(status?.open_findings?.[severity]), `open_findings.${severity} must be null or non-negative`)
  for (const field of ["retest_passed", "all_required_conformance_passed"]) add(typeof status?.verification?.[field] === "boolean", `verification.${field} must be boolean`)
  add(status?.approvals?.approved_at === null || instant(status?.approvals?.approved_at) !== undefined, "approvals.approved_at must be null or a date-time")

  if (status?.status !== "completed") {
    add(status?.production_security_claim_eligible === false, "pre-completion status cannot be eligible for a production security claim")
    if (requireCompleted) errors.push(`release blocked: independent review status is ${status?.status ?? "missing"}`)
    return errors
  }

  add(status.production_security_claim_eligible === true, "completed review must explicitly enable claim eligibility")
  const engagement = status.engagement ?? {}
  for (const field of ["id", "reviewer_organisation", "started_at", "completed_at", "valid_until"]) add(nonEmpty(engagement[field]), `completed review requires engagement.${field}`)
  add(engagement.independence_attested === true, "reviewer independence must be attested")
  add(engagement.conflicts_disclosed === true, "reviewer conflicts and subcontractors must be disclosed")
  const started = instant(engagement.started_at), completed = instant(engagement.completed_at), validUntil = instant(engagement.valid_until)
  add(started !== undefined && completed !== undefined && started <= completed, "engagement dates are invalid")
  add(validUntil !== undefined && completed !== undefined && validUntil > completed, "review validity must end after completion")
  add(validUntil !== undefined && validUntil.getTime() > now.getTime(), "independent review is expired")
  if (validUntil && completed) add(validUntil.getTime() - completed.getTime() <= 366 * 24 * 60 * 60 * 1000, "review validity may not exceed 366 days")

  const scope = status.scope ?? {}
  for (const field of ["review_commit", "remediation_commit", "platform_review_commit"]) add(commitPattern.test(scope[field] ?? ""), `scope.${field} must be a pinned 40-character Git commit`)
  add(digestPattern.test(scope.public_manifest_sha256 ?? ""), "scope.public_manifest_sha256 must be a SHA-256 digest")
  add(Array.isArray(scope.required_areas) && new Set(scope.required_areas).size === scope.required_areas.length, "scope.required_areas must be unique")
  for (const area of REQUIRED_REVIEW_AREAS) add(scope.required_areas?.includes(area), `review scope omitted ${area}`)

  for (const name of ["final", "retest", "finding_dispositions"]) {
    const evidence = status.reports?.[name] ?? {}
    add(httpsUrl(evidence.url), `reports.${name}.url must use HTTPS`)
    add(digestPattern.test(evidence.sha256 ?? ""), `reports.${name}.sha256 must be a SHA-256 digest`)
  }
  for (const severity of ["critical", "high", "medium", "low"]) add(nonNegativeInteger(status.open_findings?.[severity]), `open_findings.${severity} must be a non-negative integer`)
  for (const severity of ["critical", "high", "medium"]) add(status.open_findings?.[severity] === 0, `${severity} findings must be closed or reviewer-dispositioned`)

  add(status.verification?.retest_passed === true, "independent remediation retest must pass")
  add(status.verification?.all_required_conformance_passed === true, "required cross-language conformance must pass on the remediation scope")
  add(/^\d+\.\d+\.\d+$/.test(status.verification?.conformance_suite_version ?? ""), "a semantic conformance suite version is required")
  const approvals = status.approvals ?? {}
  add(nonEmpty(approvals.security_maintainer) && nonEmpty(approvals.release_maintainer), "security and release maintainer approvals are required")
  add(approvals.security_maintainer !== approvals.release_maintainer, "security and release approvals must be separated")
  const approved = instant(approvals.approved_at)
  add(approved !== undefined && completed !== undefined && approved >= completed, "approval must follow review completion")
  return errors
}

function object(value) { return typeof value === "object" && value !== null && !Array.isArray(value) }
function exactKeys(value, expected, label, errors) {
  if (!object(value)) return
  const actual = Object.keys(value)
  for (const key of expected) if (!actual.includes(key)) errors.push(`${label}.${key} is required`)
  for (const key of actual) if (!expected.includes(key)) errors.push(`${label}.${key} is not allowed`)
}
function nonEmpty(value) { return typeof value === "string" && value.trim() !== "" }
function nonNegativeInteger(value) { return Number.isInteger(value) && value >= 0 }
function instant(value) { if (!nonEmpty(value)) return undefined; const result = new Date(value); return Number.isNaN(result.getTime()) ? undefined : result }
function nullableInstant(value) { return value === null || instant(value) !== undefined }
function httpsUrl(value) { try { return new URL(value).protocol === "https:" } catch { return false } }

function currentManifestDigest(root) {
  const output = execFileSync(process.execPath, [path.join(root, "scripts/security-review-manifest.mjs")], { cwd: root, encoding: "utf8" })
  const manifest = JSON.parse(output)
  const expected = crypto.createHash("sha256").update(JSON.stringify(manifest.files)).digest("hex")
  if (manifest.content_sha256 !== expected) throw new Error("security review manifest content digest is internally inconsistent")
  return manifest.content_sha256
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const status = JSON.parse(fs.readFileSync(path.join(root, "security/independent-review/status.json"), "utf8"))
  const requireCompleted = process.argv.includes("--require-completed")
  const nowArgument = process.argv.find((value) => value.startsWith("--now="))?.slice(6)
  const now = nowArgument ? new Date(nowArgument) : new Date()
  const errors = validateIndependentReview(status, { requireCompleted, now })
  const rootReadme = fs.readFileSync(path.join(root, "README.md"), "utf8")
  const cryptoProfile = fs.readFileSync(path.join(root, "specification/CRYPTOGRAPHIC_PROFILE.md"), "utf8")
  if (status.status !== "completed") {
    if (!rootReadme.toLowerCase().includes("developer preview")) errors.push("README must retain developer-preview status")
    if (!cryptoProfile.toLowerCase().includes("requires independent specialist review")) errors.push("cryptographic profile must retain the independent-review warning")
  } else {
    try {
      if (currentManifestDigest(root) !== status.scope.public_manifest_sha256) errors.push("current security-sensitive source does not match the independently reviewed manifest")
    } catch (error) { errors.push(`could not reproduce reviewed manifest: ${error instanceof Error ? error.message : String(error)}`) }
  }
  if (errors.length) {
    for (const error of errors) console.error(`Independent review gate: ${error}`)
    process.exitCode = 1
  } else console.log(`Independent review gate: ${status.status}${requireCompleted ? " (release eligible)" : ""}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main()
