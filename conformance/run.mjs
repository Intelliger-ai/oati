#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { isDeepStrictEqual } from "node:util"
import {
  MemoryReplayCache, StaticTrustResolver, canonicalJson, evaluateAuthority,
  projectPublicRecord, validateSchema, verifyDocument,
} from "../sdk/typescript/dist/index.js"

const here = dirname(fileURLToPath(import.meta.url))
const args = parseArgs(process.argv.slice(2))
const manifestPath = resolve(args.suite ?? resolve(here, "suite-v0.3.json"))
const base = dirname(manifestPath)
const suiteManifest = await json(manifestPath)
const suiteCheck = validateSchema("conformanceSuite", suiteManifest)
if (!suiteCheck.valid) throw new Error(`invalid conformance manifest: ${suiteCheck.issues.map((issue) => issue.code).join(", ")}`)
const suite = await expandSuite(suiteManifest, manifestPath, new Set())
const results = []

for (const testCase of suite.cases) {
  try {
    const observed = await execute(testCase, base)
    const expectedCodes = [...testCase.expected.codes].sort()
    const codes = [...new Set(observed.codes)].sort()
    const matches = observed.outcome === testCase.expected.outcome && JSON.stringify(codes) === JSON.stringify(expectedCodes)
    results.push(result(testCase, matches ? "pass" : "fail", observed.outcome, codes))
  } catch (error) {
    results.push(result(testCase, "fail", "fail", ["RUNNER_ERROR", error instanceof Error ? error.message : String(error)]))
  }
}

const passed = results.filter((entry) => entry.status === "pass").length
const report = {
  report_version: "1.0", suite_version: suite.suite_version, standard_version: suite.standard_version,
  implementation: {
    name: args.name ?? "@intelliger/oati", version: args.version ?? "0.4.0-dev.0", language: args.language ?? "typescript",
  },
  summary: { total: results.length, passed, failed: results.length - passed }, results,
}
const reportCheck = validateSchema("conformanceReport", report)
if (!reportCheck.valid) throw new Error(`invalid conformance report: ${reportCheck.issues.map((issue) => issue.code).join(", ")}`)
const rendered = `${JSON.stringify(report, null, 2)}\n`
if (args.output) await writeFile(resolve(args.output), rendered)
else process.stdout.write(rendered)
if (report.summary.failed > 0) process.exitCode = 1

async function execute(testCase, baseDir) {
  const input = await json(resolve(baseDir, testCase.input))
  if (testCase.operation === "schema") {
    const checked = validateSchema(testCase.schema, input)
    return { outcome: checked.valid ? "pass" : "fail", codes: checked.issues.map((issue) => issue.code) }
  }
  if (testCase.operation === "canonicalize") {
    const expected = (await readFile(resolve(baseDir, testCase.auxiliary), "utf8")).trimEnd()
    return canonicalJson(input) === expected ? ok() : failed("CANONICALIZATION_MISMATCH")
  }
  if (testCase.operation === "verify" || testCase.operation === "verify-replay") {
    const trust = await json(resolve(baseDir, testCase.auxiliary))
    const replayCache = new MemoryReplayCache()
    const policy = verificationPolicy(trust, testCase.options, replayCache)
    if (testCase.operation === "verify-replay") {
      const first = await verifyDocument(input, policy)
      if (!first.verified) return { outcome: "fail", codes: first.issues.map((issue) => issue.code) }
    }
    const checked = await verifyDocument(input, policy)
    return { outcome: checked.verified ? "pass" : "fail", codes: checked.issues.map((issue) => issue.code) }
  }
  if (testCase.operation === "evaluate-suite") {
    const selected = testCase.options?.case_names
      ? input.cases.filter((vector) => testCase.options.case_names.includes(vector.name)) : input.cases
    if (selected.length !== (testCase.options?.case_names?.length ?? input.cases.length)) return failed("EVALUATOR_CASE_NOT_FOUND")
    for (const vector of selected) {
      const actual = evaluateAuthority(vector.request)
      if (actual.decision !== vector.expected.decision
        || !isDeepStrictEqual(actual.reason_codes, vector.expected.reason_codes)
        || (vector.expected.next_usage !== undefined && !isDeepStrictEqual(actual.next_usage, vector.expected.next_usage))) return failed(`EVALUATOR_MISMATCH:${vector.name}`)
    }
    return ok()
  }
  if (testCase.operation === "public-project") {
    const expected = await json(resolve(baseDir, testCase.auxiliary))
    const projected = projectPublicRecord(input)
    const schema = validateSchema("publicRecord", projected)
    if (!schema.valid) return { outcome: "fail", codes: schema.issues.map((issue) => issue.code) }
    return canonicalJson(projected) === canonicalJson(expected) ? ok() : failed("PUBLIC_PROJECTION_MISMATCH")
  }
  if (testCase.operation === "discover") {
    const federation = await json(resolve(baseDir, testCase.auxiliary))
    return discoveryResult(input, federation, testCase.options)
  }
  throw new Error(`unknown operation ${testCase.operation}`)
}

function discoveryResult(response, federation, options = {}) {
  const organisationId = options.organisation_id
  const now = Date.parse(options.now)
  if (!Array.isArray(federation.organisations) || !federation.organisations.includes(organisationId)) return failed("FEDERATION_ORGANISATION_MISMATCH")
  if (federation.expires_at && Date.parse(federation.expires_at) <= now) return failed("FEDERATION_EXPIRED")
  if (response.organisation_id !== organisationId || !Array.isArray(response.services) || !Array.isArray(response.profiles)) return failed("DISCOVERY_ORGANISATION_MISMATCH")
  const profiles = new Set(response.profiles.map((record) => record.id))
  for (const [type, records] of [["service", response.services], ["profile", response.profiles]]) {
    for (const record of records) {
      if (record.type !== type || record.status !== "active" || record.proof_status !== "verified") return failed("DISCOVERY_UNTRUSTED_RECORD")
      if (record.organisation_id !== organisationId) return failed("DISCOVERY_ORGANISATION_MISMATCH")
      let document
      try { document = JSON.parse(record.public_attributes?.document) } catch { return failed("DISCOVERY_DOCUMENT_INVALID") }
      if (document.id !== record.id || document.organisation_id !== record.organisation_id || document.issuer !== record.issuer || document.status !== record.status) return failed("DISCOVERY_DOCUMENT_MISMATCH")
      if ((record.expires_at && Date.parse(record.expires_at) <= now) || (document.expires_at && Date.parse(document.expires_at) <= now)) return failed("DISCOVERY_EXPIRED")
      const checked = validateSchema(type === "service" ? "serviceDiscovery" : "profileDiscovery", document)
      if (!checked.valid) return { outcome: "fail", codes: checked.issues.map((issue) => issue.code) }
      if (type === "service") for (const profile of document.accepted_profiles) if (!profiles.has(profile)) return failed("DISCOVERY_PROFILE_NOT_FOUND")
    }
  }
  return ok()
}

function verificationPolicy(bundle, options = {}, replayCache) {
  const keys = bundle.keys.map((key) => ({
    id: key.id, controller: key.controller, issuer: key.issuer, algorithm: key.algorithm,
    publicKeyJwk: key.public_key_jwk, status: key.status, validFrom: key.valid_from,
    ...(key.valid_until ? { validUntil: key.valid_until } : {}), ...(key.revoked_at ? { revokedAt: key.revoked_at } : {}),
    ...(key.proof_status ? { proofStatus: key.proof_status } : {}),
  }))
  const issuers = bundle.issuers.map((issuer) => ({
    id: issuer.id, status: issuer.status, ...(issuer.parent ? { parent: issuer.parent } : {}),
    ...(issuer.valid_from ? { validFrom: issuer.valid_from } : {}), ...(issuer.valid_until ? { validUntil: issuer.valid_until } : {}),
  }))
  const revocations = bundle.revocations.map((item) => ({ target: item.target, status: item.status, ...(item.effective_at ? { effectiveAt: item.effective_at } : {}) }))
  const baseResolver = new StaticTrustResolver(keys, issuers, revocations)
  const unavailable = new Set(bundle.unavailable_targets ?? [])
  const resolver = {
    resolveKey: (id) => baseResolver.resolveKey(id), resolveIssuer: (id) => baseResolver.resolveIssuer(id),
    resolveRevocation: (target) => unavailable.has(target) ? Promise.reject(new Error("revocation unavailable")) : baseResolver.resolveRevocation(target),
  }
  return { resolver, trustAnchors: bundle.trust_anchors,
    expectedAudience: options.audience, now: new Date(options.now), replayCache }
}

function result(testCase, status, observed, codes) {
  return { id: testCase.id, category: testCase.category, status, expected_outcome: testCase.expected.outcome, observed_outcome: observed, codes }
}
function ok() { return { outcome: "pass", codes: [] } }
function failed(code) { return { outcome: "fail", codes: [code] } }
async function json(path) { return JSON.parse(await readFile(path, "utf8")) }
async function expandSuite(suite, path, visited) {
  if (visited.has(path)) throw new Error(`cyclic conformance suite inheritance at ${path}`)
  visited.add(path)
  if (!suite.extends) return suite
  const parentPath = resolve(dirname(path), suite.extends)
  const parent = await json(parentPath); const checked = validateSchema("conformanceSuite", parent)
  if (!checked.valid || parent.standard_version !== suite.standard_version) throw new Error(`invalid inherited conformance suite ${suite.extends}`)
  const expanded = await expandSuite(parent, parentPath, visited)
  const ids = new Set(expanded.cases.map((item) => item.id))
  for (const item of suite.cases) if (ids.has(item.id)) throw new Error(`duplicate inherited conformance case ${item.id}`)
  return { ...suite, cases: [...expanded.cases, ...suite.cases] }
}
function parseArgs(values) {
  const parsed = {}
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]?.replace(/^--/, "").replaceAll("-", "_")
    if (!key || values[index + 1] === undefined) throw new Error(`expected --option value, received ${values[index] ?? "end of input"}`)
    parsed[key === "implementation_name" ? "name" : key === "implementation_version" ? "version" : key] = values[index + 1]
  }
  return parsed
}
