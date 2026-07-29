import assert from "node:assert/strict"
import test from "node:test"
import { runProductionLookupSmoke } from "../scripts/production-lookup-smoke.mjs"

const now = new Date("2026-07-28T12:00:00.000Z")
const future = "2027-07-28T12:00:00.000Z"
const organisationId = "oati:org:smoke"
const issuer = "oati:issuer:smoke:production"
const entries = [
  ["organisation", organisationId],
  ["agent", "oati:agent:smoke:buyer"],
  ["passport", "oati:agent:smoke:buyer"],
  ["mandate", "oati:mandate:smoke:purchase-001"],
  ["receipt", "oati:receipt:smoke:purchase-001"],
  ["issuer", issuer],
  ["key", "oati:key:smoke:production-1"],
  ["revocation", "oati:revocation:smoke:production"],
  ["service", "oati:service:smoke:lookup"],
  ["profile", "oati:profile:smoke:commerce-v1"],
]

function discoveryDocument(type, id) {
  const common = { oati_version: "1.0", id, organisation_id: organisationId, issuer, status: "active", issued_at: now.toISOString(), expires_at: future }
  if (type === "service") return { ...common, display_name: "Smoke lookup", endpoints: [{ id: "lookup", url: "https://lookup.example.test/oati/v1", protocol: "http", audience: "oati:smoke:lookup" }], accepted_profiles: ["oati:profile:smoke:commerce-v1"] }
  return { ...common, name: "Smoke Commerce", version: "1.0", schema_uri: "https://schemas.example.test/commerce.json", digest: `sha256:${"0".repeat(64)}` }
}

function record(type, id) {
  const signedDocument = type === "service" || type === "profile" ? discoveryDocument(type, id) : { id, proof: {} }
  const publicAttributes = { signed_document: JSON.stringify(signedDocument) }
  if (type === "key") Object.assign(publicAttributes, { controller: issuer, algorithm: "EdDSA", public_key_jwk: JSON.stringify({ kty: "OKP", crv: "Ed25519", x: "AA" }) })
  if (type === "revocation") Object.assign(publicAttributes, { target: issuer, revocation_status: "good" })
  if (type === "service" || type === "profile") publicAttributes.document = JSON.stringify(discoveryDocument(type, id))
  return { type, id, display_name: `${type} smoke record`, status: "active", issuer, organisation_id: organisationId,
    issued_at: now.toISOString(), expires_at: future, proof_status: "verified", public_attributes: publicAttributes }
}

const records = new Map(entries.map(([type, id]) => [`${type}\0${id}`, record(type, id)]))
const manifest = {
  schema_version: "1.0", resolver_url: "https://lookup.example.test/oati/v1", cors_origin: "https://intelliger.ai",
  organisation_id: organisationId, trust_anchors: [issuer],
  records: entries.map(([type, id]) => ({ type, id, statuses: ["active"], audience: `oati:smoke:${type}`,
    ...(type === "revocation" ? { target: issuer, revocation_status: "good" } : {}),
    ...(["organisation", "agent", "passport", "mandate", "issuer", "key", "service", "profile"].includes(type) ? { require_future_expiry: true } : {}) })),
  discovery: { service_ids: ["oati:service:smoke:lookup"], profile_ids: ["oati:profile:smoke:commerce-v1"] },
}

function headers(cache = false) {
  return { "content-type": "application/json", "oati-version": "1.0", "x-request-id": "request-smoke", "access-control-allow-origin": manifest.cors_origin,
    "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "OATI-Version, Accept",
    ...(cache ? { "cache-control": "public, max-age=60", etag: '"smoke"', "x-ratelimit-limit": "60", "x-ratelimit-remaining": "59", "x-ratelimit-reset": "60" } : {}) }
}
function json(value, status = 200, cache = false) { return new Response(JSON.stringify(value), { status, headers: headers(cache) }) }
function problem(status, code) { return new Response(JSON.stringify({ error: { status, code, message: code, request_id: "request-smoke", retryable: false } }), { status, headers: { ...headers(), "content-type": "application/problem+json" } }) }

async function fetcher(input, init = {}) {
  const url = new URL(input)
  if (init.method === "OPTIONS") return new Response(null, { status: 204, headers: headers() })
  if (url.pathname.endsWith("/status")) {
    if (init.headers?.["OATI-Version"] === "999") return problem(406, "unsupported_version")
    return json({ status: "operational", service: "oati-public-lookup", version: "test", checked_at: now.toISOString() })
  }
  if (url.pathname.endsWith("/discovery")) {
    return json({ organisation_id: organisationId, services: [records.get("service\0oati:service:smoke:lookup")], profiles: [records.get("profile\0oati:profile:smoke:commerce-v1")] })
  }
  if (!url.pathname.endsWith("/lookup")) return problem(404, "not_found")
  const type = url.searchParams.get("type")
  if (!url.searchParams.get("id") && !url.searchParams.get("target")) return problem(400, "invalid_request")
  const value = url.searchParams.get("target") === issuer
    ? records.get("revocation\0oati:revocation:smoke:production")
    : records.get(`${type}\0${url.searchParams.get("id")}`)
  if (!value) return problem(404, "record_not_found")
  if (init.headers?.["If-None-Match"] === '"smoke"') return new Response(null, { status: 304, headers: headers(true) })
  return json(value, 200, true)
}

test("hosted smoke covers the ten-record lookup and discovery contract", async () => {
  const report = await runProductionLookupSmoke({ manifest, fetcher, now, inspectTls: async () => ({ protocol: "TLSv1.3", valid_until: future }), verifySignedDocument: async () => ({ verified: true, issues: [] }) })
  assert.deepEqual(report.inventory, { expected: 10, resolved: 10 })
  assert.equal(report.summary.failed, 0, JSON.stringify(report.checks.filter((item) => item.status === "fail")))
  assert.equal(report.checks.some((item) => item.name === "discovery.organisation"), true)
  assert.equal(report.checks.some((item) => item.name === "tls.endpoint"), true)
  assert.equal(report.checks.some((item) => item.name === "api.cors-preflight"), true)
})

test("hosted smoke rejects an incomplete reviewed inventory", async () => {
  await assert.rejects(() => runProductionLookupSmoke({ manifest: { ...manifest, records: manifest.records.slice(1) }, fetcher, now }), /exactly 10 records/)
})

test("hosted smoke records a missing request ID as a contract failure", async () => {
  const withoutRequestId = async (input, init) => {
    const response = await fetcher(input, init)
    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete("x-request-id")
    return new Response(response.body, { status: response.status, headers: responseHeaders })
  }
  const report = await runProductionLookupSmoke({ manifest, fetcher: withoutRequestId, now, inspectTls: async () => ({ protocol: "TLSv1.3", valid_until: future }), verifySignedDocument: async () => ({ verified: true, issues: [] }) })
  assert.ok(report.summary.failed > 0)
  assert.match(report.checks.find((item) => item.name === "status.operational").error, /X-Request-ID/)
})

test("hosted smoke rejects unsigned discovery-document substitution", async () => {
  const substituted = structuredClone(records.get("service\0oati:service:smoke:lookup"))
  substituted.public_attributes.document = JSON.stringify({ ...discoveryDocument("service", substituted.id), display_name: "Substituted endpoint" })
  const divergentRecords = new Map(records)
  divergentRecords.set(`service\0${substituted.id}`, substituted)
  const divergentFetcher = async (input, init = {}) => {
    const url = new URL(input)
    if (url.pathname.endsWith("/lookup") && url.searchParams.get("type") === "service") return json(divergentRecords.get(`service\0${url.searchParams.get("id")}`), 200, true)
    if (url.pathname.endsWith("/discovery")) return json({ organisation_id: organisationId, services: [substituted], profiles: [records.get("profile\0oati:profile:smoke:commerce-v1")] })
    return fetcher(input, init)
  }
  const report = await runProductionLookupSmoke({ manifest, fetcher: divergentFetcher, now, inspectTls: async () => ({ protocol: "TLSv1.3", valid_until: future }), verifySignedDocument: async () => ({ verified: true, issues: [] }) })
  assert.match(report.checks.find((item) => item.name === "lookup.service").error, /differs from the signed document/)
})
