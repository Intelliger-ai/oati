import fs from "node:fs"

const status = JSON.parse(fs.readFileSync(new URL("../security/independent-review/status.json", import.meta.url), "utf8"))
const rootReadme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8")
const cryptoProfile = fs.readFileSync(new URL("../specification/CRYPTOGRAPHIC_PROFILE.md", import.meta.url), "utf8")

function fail(message) { console.error(`Independent review gate: ${message}`); process.exitCode = 1 }
if (status.schema_version !== 1) fail("unsupported status schema")
if (!["awaiting-independent-review", "in-review", "remediation", "completed"].includes(status.status)) fail("invalid status")

if (status.status !== "completed") {
  if (status.production_security_claim_eligible !== false) fail("pre-completion status cannot be eligible for a production security claim")
  if (!rootReadme.toLowerCase().includes("developer preview")) fail("README must retain developer-preview status")
  if (!cryptoProfile.toLowerCase().includes("requires independent specialist review")) fail("cryptographic profile must retain the independent-review warning")
} else {
  if (status.production_security_claim_eligible !== true) fail("completed review must explicitly set claim eligibility")
  if (!/^[0-9a-f]{40}$/.test(status.review_commit ?? "")) fail("completed review requires a pinned public Git commit")
  if (!/^[0-9a-f]{40}$/.test(status.platform_review_commit ?? "")) fail("completed review requires a pinned private platform Git commit")
  for (const field of ["reviewer", "completed_at", "public_report_url", "retest_report_url"]) if (!status[field]) fail(`completed review requires ${field}`)
  for (const field of ["public_report_url", "retest_report_url"]) if (!String(status[field] ?? "").startsWith("https://")) fail(`${field} must use HTTPS`)
  if (status.open_findings?.critical !== 0 || status.open_findings?.high !== 0) fail("critical and high findings must be closed")
  if (status.open_findings?.medium !== 0) fail("medium findings require closure or reviewer-accepted disposition before setting completed")
}

if (!process.exitCode) console.log(`Independent review gate: ${status.status}`)
