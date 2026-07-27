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
  evaluateAuthority,
  MemoryReplayCache,
  projectPublicRecord,
  signDocument,
  StaticTrustResolver,
  verifyDocument,
  getSchema,
  schemaNames,
  validateSchema,
} from "../dist/index.js"

const example = async (path) => JSON.parse(await readFile(new URL(`../../../examples/${path}`, import.meta.url), "utf8"))
const cryptoVector = async (path) => JSON.parse(await readFile(new URL(`../../../conformance/crypto/${path}`, import.meta.url), "utf8"))

test("all published SDK schemas are bundled", () => {
  assert.deepEqual(schemaNames, [
    "proof", "verificationKey", "issuer", "revocation", "evaluationRequest", "evaluationResult", "publicRecord", "conformanceSuite", "conformanceReport",
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
  assert.ok(result.issues.every((issue) => issue.code.startsWith("SCHEMA_") && issue.path && issue.keyword && issue.message && issue.schemaPath))
  assert.throws(() => assertSchema("passport", { id: "bad" }), OatiValidationError)
})

test("public projection uses a strict privacy allowlist", async () => {
  const source = JSON.parse(await readFile(new URL("../../../conformance/privacy/private-registry-record.json", import.meta.url), "utf8"))
  const expected = JSON.parse(await readFile(new URL("../../../conformance/privacy/expected-public-record.json", import.meta.url), "utf8"))
  const projected = projectPublicRecord(source)
  assert.deepEqual(projected, expected)
  assert.equal("private_attributes" in projected, false)
  assert.equal("tenant_id" in projected, false)
  assert.equal(validateSchema("publicRecord", projected).valid, true)
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

const cryptoFixture = async (algorithm = "EdDSA", overrides = {}) => {
  const generated = algorithm === "EdDSA"
    ? await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])
    : await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", generated.publicKey)
  const key = {
    id: `oati:key:test:${algorithm.toLowerCase()}:1`, controller: "oati:org:test", issuer: "oati:issuer:root",
    algorithm, publicKeyJwk, status: "active", validFrom: "2026-07-27T11:00:00Z", proofStatus: "verified",
    ...overrides,
  }
  const document = { oati_version: "1.0", id: "oati:receipt:test:crypto", issuer: "oati:org:test", occurred_at: "2026-07-27T12:00:00Z" }
  const signed = await signDocument(document, {
    algorithm, verificationMethod: key.id, privateKey: generated.privateKey,
    audience: "https://merchant.example", nonce: `nonce-${algorithm}-00000000001`,
    created: "2026-07-27T12:00:00Z", expires: "2026-07-27T12:05:00Z",
  })
  return { signed, key }
}

const policyFor = (key, options = {}) => ({
  resolver: new StaticTrustResolver([key], []), trustAnchors: ["oati:issuer:root"],
  expectedAudience: "https://merchant.example", replayCache: new MemoryReplayCache(),
  now: new Date("2026-07-27T12:01:00Z"), ...options,
})

test("Ed25519 detached JWS verifies with trust, time, audience, and replay checks", async () => {
  const { signed, key } = await cryptoFixture()
  const policy = policyFor(key)
  const verified = await verifyDocument(signed, policy)
  assert.equal(verified.verified, true, JSON.stringify(verified.issues))
  assert.equal(verified.algorithm, "EdDSA")
  const replayed = await verifyDocument(signed, policy)
  assert.equal(replayed.verified, false)
  assert.ok(replayed.issues.some((issue) => issue.code === "REPLAY_DETECTED"))
})

test("ES256 signing and verification uses the same canonical proof profile", async () => {
  const { signed, key } = await cryptoFixture("ES256")
  const verified = await verifyDocument(signed, policyFor(key))
  assert.equal(verified.verified, true, JSON.stringify(verified.issues))
  assert.equal(signed.proof.signature.split(".")[1], "")
})

test("verification detects tampering and audience mismatch", async () => {
  const { signed, key } = await cryptoFixture()
  const tampered = { ...signed, issuer: "oati:org:attacker" }
  const invalid = await verifyDocument(tampered, policyFor(key))
  assert.equal(invalid.verified, false)
  assert.ok(invalid.issues.some((issue) => issue.code === "SIGNATURE_INVALID"))
  assert.ok(invalid.issues.some((issue) => issue.code === "KEY_INVALID"))

  const audience = await verifyDocument(signed, policyFor(key, { expectedAudience: "https://other.example" }))
  assert.ok(audience.issues.some((issue) => issue.code === "AUDIENCE_MISMATCH"))
})

test("retired rotation keys remain verifiable for their validity window", async () => {
  const { signed, key } = await cryptoFixture("EdDSA", { status: "retired", validUntil: "2026-07-27T12:02:00Z" })
  const verified = await verifyDocument(signed, policyFor(key))
  assert.equal(verified.verified, true, JSON.stringify(verified.issues))
})

test("revoked keys, documents, expired proofs, and untrusted issuers fail closed", async () => {
  const { signed, key } = await cryptoFixture()
  const revokedKey = await verifyDocument(signed, policyFor({ ...key, status: "revoked", revokedAt: "2026-07-27T12:00:30Z" }))
  assert.ok(revokedKey.issues.some((issue) => issue.code === "KEY_REVOKED"))

  const documentRevocation = new StaticTrustResolver([key], [], [{ target: signed.id, status: "revoked", effectiveAt: "2026-07-27T12:00:30Z" }])
  const revokedDocument = await verifyDocument(signed, policyFor(key, { resolver: documentRevocation }))
  assert.ok(revokedDocument.issues.some((issue) => issue.code === "DOCUMENT_REVOKED"))

  const expired = await verifyDocument(signed, policyFor(key, { now: new Date("2026-07-27T12:10:00Z") }))
  assert.ok(expired.issues.some((issue) => issue.code === "PROOF_EXPIRED"))

  const untrusted = await verifyDocument(signed, policyFor(key, { trustAnchors: ["oati:issuer:someone-else"] }))
  assert.ok(untrusted.issues.some((issue) => issue.code === "ISSUER_NOT_TRUSTED"))
})

test("TypeScript verifies the deterministic vector produced by the Go CLI", async () => {
  const signed = await cryptoVector("signed-envelope.json")
  const bundle = await cryptoVector("trust-bundle.json")
  const keys = bundle.keys.map((key) => ({
    id: key.id, controller: key.controller, issuer: key.issuer, algorithm: key.algorithm,
    publicKeyJwk: key.public_key_jwk, status: key.status, validFrom: key.valid_from,
    validUntil: key.valid_until, proofStatus: key.proof_status,
  }))
  const resolver = new StaticTrustResolver(keys, bundle.issuers, bundle.revocations)
  const verified = await verifyDocument(signed, {
    resolver, trustAnchors: bundle.trust_anchors, expectedAudience: "https://merchant.example",
    replayCache: new MemoryReplayCache(), now: new Date("2026-07-27T12:01:00Z"),
  })
  assert.equal(verified.verified, true, JSON.stringify(verified.issues))
  assert.equal(validateSchema("proof", signed.proof).valid, true)

  const tampered = await cryptoVector("tampered-envelope.json")
  const rejected = await verifyDocument(tampered, {
    resolver, trustAnchors: bundle.trust_anchors, expectedAudience: "https://merchant.example",
    replayCache: new MemoryReplayCache(), now: new Date("2026-07-27T12:01:00Z"),
  })
  assert.ok(rejected.issues.some((issue) => issue.code === "SIGNATURE_INVALID"))
})

test("deterministic evaluator satisfies every shared conformance case", async () => {
  const suite = JSON.parse(await readFile(new URL("../../../conformance/evaluator/cases.json", import.meta.url), "utf8"))
  for (const vector of suite.cases) {
    const result = evaluateAuthority(vector.request)
    assert.equal(result.decision, vector.expected.decision, vector.name)
    assert.deepEqual(result.reason_codes, vector.expected.reason_codes, vector.name)
    if (vector.expected.next_usage) assert.deepEqual(result.next_usage, vector.expected.next_usage, vector.name)
    assert.equal(validateSchema("evaluationRequest", vector.request).valid, true, vector.name)
    assert.equal(validateSchema("evaluationResult", result).valid, true, vector.name)
  }
})
