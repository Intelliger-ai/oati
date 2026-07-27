import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  OatiError,
  OatiLookupClient,
  OatiLookupError,
  OatiValidationError,
  assertSchema,
  canonicalJson,
  canonicalize,
  createDecision,
  createMandate,
  createPassport,
  createReceipt,
  createTransactionEnvelope,
  getSchema,
  schemaNames,
  validateSchema,
} from "../dist/index.js"

const example = async (path) => JSON.parse(await readFile(new URL(`../../../examples/${path}`, import.meta.url), "utf8"))

test("all published SDK schemas are bundled", () => {
  assert.deepEqual(schemaNames, [
    "passport", "mandate", "envelope", "decision", "receipt", "commerceOffer",
    "commerceMandate", "commerceReceipt", "rwaAsset", "rwaStateClaim", "rwaMandate", "rwaReceipt",
  ])
  assert.equal(getSchema("passport").$id, "https://schemas.intelliger.ai/oati/v1/passport.schema.json")
})

test("published core examples validate against bundled JSON Schemas", async () => {
  assert.equal(validateSchema("passport", await example("passport.json")).valid, true)
  assert.equal(validateSchema("envelope", await example("commerce/transaction-envelope.json")).valid, true)
  assert.equal(validateSchema("decision", await example("decision.json")).valid, true)
})

test("published Commerce and RWA examples validate", async () => {
  const fixtures = [
    ["commerceOffer", "commerce/merchant-service-profile.json"],
    ["commerceMandate", "commerce/purchase-mandate.json"],
    ["commerceReceipt", "commerce/commerce-receipt.json"],
    ["rwaAsset", "rwa/asset-profile.json"],
    ["rwaStateClaim", "rwa/asset-state-claim.json"],
    ["rwaMandate", "rwa/mint-mandate.json"],
    ["rwaReceipt", "rwa/rwa-receipt.json"],
  ]
  for (const [schema, path] of fixtures) {
    const result = validateSchema(schema, await example(path))
    assert.equal(result.valid, true, `${schema}: ${JSON.stringify(result.issues)}`)
  }
})

test("schema validation returns stable structured issues", () => {
  const result = validateSchema("passport", { oati_version: "2.0", id: "bad" })
  assert.equal(result.valid, false)
  assert.ok(result.issues.length > 1)
  assert.ok(result.issues.every((issue) => issue.path && issue.keyword && issue.message && issue.schemaPath))
  assert.throws(() => assertSchema("passport", { id: "bad" }), OatiValidationError)
})

test("core builders add the OATI version and preserve inputs", async () => {
  const passportInput = await example("passport.json")
  delete passportInput.oati_version
  const passport = createPassport(passportInput)
  assert.equal(passport.oati_version, "1.0")
  assert.equal(validateSchema("passport", passport).valid, true)

  const mandateExample = await example("commerce/purchase-mandate.json")
  const { oati_version: _version, profile: _profile, extensions: _extensions, ...mandateInput } = mandateExample
  const mandate = createMandate(mandateInput)
  assert.equal(validateSchema("mandate", mandate).valid, true)
  mandate.actions.push("changed")
  assert.notDeepEqual(mandate.actions, mandateInput.actions)
})

test("Envelope, Decision, and Receipt builders produce schema-valid objects", async () => {
  const envelopeExample = await example("commerce/transaction-envelope.json")
  const { oati_version: _envelopeVersion, ...envelopeInput } = envelopeExample
  const envelope = createTransactionEnvelope(envelopeInput)
  assert.equal(validateSchema("envelope", envelope).valid, true)

  const decision = createDecision({
    id: "oati:decision:test:1", transaction_id: envelope.id, decision: "allow",
    policy_digest: "sha256:policy", reason_codes: ["mandate_valid"],
    decided_at: "2026-07-27T12:00:00Z", issuer: "oati:org:intelliger",
  })
  assert.equal(validateSchema("decision", decision).valid, true)

  const receiptExample = await example("commerce/commerce-receipt.json")
  const { oati_version: _receiptVersion, profile: _receiptProfile, extensions: _receiptExtensions, ...receiptInput } = receiptExample
  const receipt = createReceipt(receiptInput)
  assert.equal(validateSchema("receipt", receipt).valid, true)
})

test("canonical JSON recursively sorts keys without mutating input", () => {
  const input = { z: 1, a: { d: 4, b: 2 }, list: [{ y: 2, x: 1 }] }
  assert.equal(canonicalJson(input), '{"a":{"b":2,"d":4},"list":[{"x":1,"y":2}],"z":1}')
  assert.deepEqual(Object.keys(input), ["z", "a", "list"])
  assert.deepEqual(canonicalize(input), { a: { b: 2, d: 4 }, list: [{ x: 1, y: 2 }], z: 1 })
})

test("canonical JSON rejects non-JSON and cyclic values with a structured error", () => {
  assert.throws(() => canonicalJson({ value: undefined }), (error) => error instanceof OatiError && error.code === "INVALID_CANONICAL_VALUE")
  const cyclic = {}; cyclic.self = cyclic
  assert.throws(() => canonicalJson(cyclic), (error) => error instanceof OatiError && error.code === "INVALID_CANONICAL_VALUE")
})

test("lookup client encodes input and returns a typed public record", async () => {
  let requested
  const client = new OatiLookupClient({
    baseUrl: "https://resolver.example/oati/v1/",
    fetch: async (url) => {
      requested = String(url)
      return Response.json({
        type: "agent", id: "oati:agent:buyer/a b", status: "active", issuer: "oati:org:test",
        proof_status: "verified", public_attributes: { protocol: "mcp" },
      })
    },
  })
  const record = await client.lookup("agent", "oati:agent:buyer/a b")
  assert.equal(record.proof_status, "verified")
  assert.equal(requested, "https://resolver.example/oati/v1/lookup?type=agent&id=oati%3Aagent%3Abuyer%2Fa+b")
})

test("lookup client maps resolver failures to stable error codes", async () => {
  const notFound = new OatiLookupClient({ fetch: async () => Response.json({ error: "record_not_found" }, { status: 404 }) })
  await assert.rejects(() => notFound.lookup("agent", "missing"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_NOT_FOUND" && error.status === 404)

  const limited = new OatiLookupClient({ fetch: async () => Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "12" } }) })
  await assert.rejects(() => limited.lookup("agent", "limited"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_RATE_LIMITED" && error.retryAfter === 12)
})

test("lookup client rejects malformed successful responses", async () => {
  const client = new OatiLookupClient({ fetch: async () => Response.json({ id: "incomplete" }) })
  await assert.rejects(() => client.lookup("agent", "incomplete"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_INVALID_RESPONSE")
})

test("lookup client enforces its timeout", async () => {
  const client = new OatiLookupClient({ timeoutMs: 5, fetch: (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true })
  }) })
  await assert.rejects(() => client.lookup("agent", "slow"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_TIMEOUT")
})
