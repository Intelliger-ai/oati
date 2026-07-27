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
  createOatiMiddleware,
  evaluateAuthority,
  encodeOatiHeader,
  httpRequestDigest,
  MemoryReplayCache,
  LookupTrustResolver,
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
  const notFound = new OatiLookupClient({ retry: { maxRetries: 0 }, fetch: async () => Response.json({ error: "record_not_found" }, { status: 404 }) })
  await assert.rejects(() => notFound.lookup("agent", "missing"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_NOT_FOUND" && error.status === 404)

  const limited = new OatiLookupClient({ retry: { maxRetries: 0 }, fetch: async () => Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "12", "X-RateLimit-Limit": "100", "X-RateLimit-Remaining": "0" } }) })
  await assert.rejects(() => limited.lookup("agent", "limited"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_RATE_LIMITED" && error.retryAfter === 12)
})

test("lookup client rejects malformed successful responses", async () => {
  const client = new OatiLookupClient({ fetch: async () => Response.json({ id: "incomplete" }) })
  await assert.rejects(() => client.lookup("agent", "incomplete"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_INVALID_RESPONSE")
})

test("lookup client enforces its timeout", async () => {
  const client = new OatiLookupClient({ timeoutMs: 5, retry: { maxRetries: 0 }, fetch: (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true })
  }) })
  await assert.rejects(() => client.lookup("agent", "slow"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_TIMEOUT")
})

test("lookup supports cancellation separately from timeout", async () => {
  const controller = new AbortController()
  const client = new OatiLookupClient({ retry: { maxRetries: 0 }, fetch: (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true })
  }) })
  const pending = client.lookup("agent", "cancelled", { signal: controller.signal })
  controller.abort("caller stopped")
  await assert.rejects(() => pending, (error) => error instanceof OatiLookupError && error.code === "LOOKUP_CANCELLED")
})

test("lookup retries transient failures, fails over resolvers, and reports rate limits", async () => {
  const calls = []
  const client = new OatiLookupClient({
    resolverUrls: ["https://primary.example/oati", "https://secondary.example/oati"],
    retry: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 },
    fetch: async (url) => {
      calls.push(String(url))
      if (String(url).startsWith("https://primary.example")) return Response.json({}, { status: 503 })
      return Response.json({ type: "agent", id: "oati:agent:test:failover", status: "active", issuer: "oati:issuer:test", proof_status: "verified", public_attributes: {} }, {
        headers: { "X-RateLimit-Limit": "100", "X-RateLimit-Remaining": "73" },
      })
    },
  })
  const response = await client.lookupDetailed("agent", "oati:agent:test:failover")
  assert.equal(calls.length, 3)
  assert.equal(response.resolverUrl, "https://secondary.example/oati")
  assert.deepEqual(response.rateLimit, { limit: 100, remaining: 73 })
})

test("lookup implements fresh cache hits, ETag revalidation, and cache bypass", async () => {
  let calls = 0
  const client = new OatiLookupClient({ fetch: async (_url, init) => {
    calls++
    if (init.headers["If-None-Match"] === '"v1"') return new Response(null, { status: 304, headers: { "Cache-Control": "max-age=60" } })
    return Response.json({ type: "agent", id: "oati:agent:test:cached", status: "active", issuer: "oati:issuer:test", proof_status: "verified", public_attributes: {} }, {
      headers: { "Cache-Control": "max-age=60", ETag: '"v1"' },
    })
  } })
  assert.equal((await client.lookupDetailed("agent", "oati:agent:test:cached")).cache, "miss")
  assert.equal((await client.lookupDetailed("agent", "oati:agent:test:cached")).cache, "hit")
  assert.equal((await client.lookupDetailed("agent", "oati:agent:test:cached", { cache: "reload" })).cache, "revalidated")
  assert.equal(calls, 2)
  await client.lookup("agent", "oati:agent:test:cached", { cache: "no-store" })
  assert.equal(calls, 3)
})

test("lookup exposes not-found, invalid-proof, unknown, and unavailable states", async () => {
  let calls = 0
  const record = (id, proof_status) => ({ type: "key", id, status: "active", issuer: "oati:issuer:test", proof_status,
    public_attributes: { controller: "oati:org:test", issuer: "oati:issuer:test", algorithm: "EdDSA", public_key_jwk: "{}", valid_from: "2026-01-01T00:00:00Z" } })
  const client = new OatiLookupClient({ retry: { maxRetries: 0 }, fetch: async (url) => {
    calls++
    const id = new URL(url).searchParams.get("id")
    if (id === "missing") return Response.json({}, { status: 404 })
    if (id === "down") return Response.json({}, { status: 503 })
    return Response.json(record(id, id.endsWith("invalid") ? "invalid" : id.endsWith("proof-down") ? "unavailable" : "unknown"))
  } })
  assert.equal((await client.lookupState("key", "missing")).state, "not_found")
  const cachedMissing = await client.lookupState("key", "missing")
  assert.equal(cachedMissing.state, "not_found")
  assert.equal(cachedMissing.error.cache, "hit")
  assert.equal((await client.lookupState("key", "down")).state, "unavailable")
  assert.equal((await client.lookupState("key", "oati:key:test:invalid")).state, "invalid_proof")
  assert.equal((await client.lookupState("key", "oati:key:test:proof-down")).state, "unavailable")
  assert.equal((await client.lookupState("key", "oati:key:test:unknown")).state, "unknown")
  assert.equal(calls, 5)
})

test("lookup trust resolver maps typed key, issuer, and revocation records", async () => {
  const records = {
    key: { type: "key", id: "oati:key:test:1", status: "active", issuer: "oati:issuer:test", proof_status: "verified", public_attributes: {
      controller: "oati:org:test", issuer: "oati:issuer:test", algorithm: "EdDSA", public_key_jwk: '{"kty":"OKP","crv":"Ed25519","x":"abc"}', valid_from: "2026-01-01T00:00:00Z",
    } },
    issuer: { type: "issuer", id: "oati:issuer:test", status: "active", issuer: "oati:issuer:root", issued_at: "2026-01-01T00:00:00Z", proof_status: "verified", public_attributes: {} },
    revocation: { type: "revocation", id: "oati:target:test", status: "good", issuer: "oati:issuer:test", proof_status: "verified", public_attributes: { effective_at: "2026-01-01T00:00:00Z" } },
  }
  const client = new OatiLookupClient({ fetch: async (url) => Response.json(records[new URL(url).searchParams.get("type")]) })
  const resolver = new LookupTrustResolver(client)
  assert.equal((await resolver.resolveKey("oati:key:test:1")).algorithm, "EdDSA")
  assert.equal((await resolver.resolveIssuer("oati:issuer:test")).status, "active")
  assert.equal((await resolver.resolveRevocation("oati:target:test")).status, "good")
})

const middlewareFixture = async () => {
  const generated = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", generated.publicKey)
  const key = {
    id: "oati:key:test:middleware:1", controller: "oati:agent:test:middleware", issuer: "oati:org:test",
    algorithm: "EdDSA", publicKeyJwk, status: "active", validFrom: "2026-07-27T11:00:00Z", proofStatus: "verified",
  }
  const sign = (document, nonce) => signDocument(document, {
    algorithm: "EdDSA", verificationMethod: key.id, privateKey: generated.privateKey,
    audience: "https://api.example", nonce, created: "2026-07-27T12:00:00Z", expires: "2026-07-27T12:10:00Z",
  })
  const mandate = await sign({
    oati_version: "1.0", id: "oati:mandate:test:middleware", issuer: "oati:org:test", subject: "oati:agent:test:middleware",
    purpose: "weather", actions: ["forecast.read"], resources: ["oati:service:test:weather"],
    not_before: "2026-07-27T11:00:00Z", expires_at: "2026-07-27T13:00:00Z", status: "active",
  }, "mandate-nonce-0000000001")
  const requestDigest = await httpRequestDigest(new Request("https://api.example/weather"))
  const envelope = await sign({
    oati_version: "1.0", id: "oati:tx:test:middleware:1", agent_id: "oati:agent:test:middleware", organisation_id: "oati:org:test",
    mandate_id: mandate.id, action: "forecast.read", resource: "oati:service:test:weather", purpose: "weather",
    protocol: "http", request_digest: requestDigest, issued_at: "2026-07-27T12:01:00Z", nonce: "envelope-object-nonce-01",
  }, "envelope-proof-nonce-001")
  const replayCache = new MemoryReplayCache()
  const options = {
    receiptIssuer: "oati:org:test", now: () => new Date("2026-07-27T12:02:00Z"),
    generateCorrelationId: () => "correlation-generated-1", generateReceiptId: () => "oati:receipt:test:middleware:1",
    verificationPolicy: () => ({ resolver: new StaticTrustResolver([key], []), trustAnchors: ["oati:org:test"],
      expectedAudience: "https://api.example", replayCache, now: new Date("2026-07-27T12:02:00Z") }),
    signReceipt: (draft) => sign({ ...draft, oati_version: "1.0" }, `receipt-proof-${Math.random().toString(36).padEnd(20, "0")}`),
  }
  const request = (signedEnvelope = envelope, signedMandate = mandate, extraHeaders = {}) => new Request("https://api.example/weather", { headers: {
    "OATI-Envelope": encodeOatiHeader(signedEnvelope), "OATI-Mandate": encodeOatiHeader(signedMandate), ...extraHeaders,
  } })
  return { sign, mandate, envelope, options, request }
}

test("reference middleware verifies, evaluates, correlates, and issues a signed receipt", async () => {
  const fixture = await middlewareFixture()
  const middleware = createOatiMiddleware(fixture.options)
  let context
  const response = await middleware(fixture.request(), (_request, value) => { context = value; return Response.json({ ok: true }) })
  assert.equal(response.status, 200)
  assert.equal(context.evaluation.decision, "allow")
  assert.equal(response.headers.get("OATI-Transaction-ID"), fixture.envelope.id)
  assert.equal(response.headers.get("OATI-Correlation-ID"), "correlation-generated-1")
  assert.equal(response.headers.get("OATI-Receipt-ID"), "oati:receipt:test:middleware:1")
  const encodedReceipt = response.headers.get("OATI-Receipt")
  const receipt = JSON.parse(Buffer.from(encodedReceipt, "base64url").toString("utf8"))
  assert.equal(receipt.outcome, "succeeded")
  assert.equal(validateSchema("receipt", receipt).valid, true)

  const replay = await middleware(fixture.request(), () => Response.json({ should_not_run: true }))
  assert.equal(replay.status, 401)
  assert.equal((await replay.json()).code, "MIDDLEWARE_REPLAY")
})

test("reference middleware binds the signed Envelope to the HTTP method, target, and body", async () => {
  const fixture = await middlewareFixture()
  const original = fixture.request()
  const mismatched = new Request("https://api.example/different-target", { headers: original.headers })
  const response = await createOatiMiddleware(fixture.options)(mismatched, () => Response.json({ should_not_run: true }))
  assert.equal(response.status, 401)
  const body = await response.json()
  assert.ok(body.reason_codes.includes("HTTP_REQUEST_DIGEST_MISMATCH"))
  assert.equal(body.receipt.outcome, "denied")
})

test("reference middleware denies authority and fails closed", async () => {
  const fixture = await middlewareFixture()
  const { proof: _oldEnvelopeProof, ...unsignedEnvelope } = fixture.envelope
  const deniedEnvelope = await fixture.sign({ ...unsignedEnvelope, id: "oati:tx:test:middleware:denied", action: "forecast.delete" }, "envelope-proof-nonce-002")
  const middleware = createOatiMiddleware(fixture.options)
  const denied = await middleware(fixture.request(deniedEnvelope), () => Response.json({ should_not_run: true }))
  assert.equal(denied.status, 403)
  const deniedBody = await denied.json()
  assert.ok(deniedBody.reason_codes.includes("ACTION_NOT_ALLOWED"))
  assert.equal(deniedBody.receipt.outcome, "denied")

  const malformed = await middleware(new Request("https://api.example/weather"), () => Response.json({ should_not_run: true }))
  assert.equal(malformed.status, 400)
  assert.equal((await malformed.json()).code, "MIDDLEWARE_BAD_REQUEST")

  const noReceipt = createOatiMiddleware({ ...fixture.options, signReceipt: async () => { throw new Error("signer offline") } })
  const signerFailure = await noReceipt(fixture.request(deniedEnvelope), () => Response.json({ should_not_run: true }))
  assert.equal(signerFailure.status, 503)
  assert.equal((await signerFailure.json()).code, "MIDDLEWARE_UNAVAILABLE")
})

test("reference middleware requires atomic usage storage for constrained Mandates", async () => {
  const fixture = await middlewareFixture()
  const { proof: _oldMandateProof, ...unsignedMandate } = fixture.mandate
  const { proof: _oldEnvelopeProof, ...unsignedEnvelope } = fixture.envelope
  const constrainedMandate = await fixture.sign({ ...unsignedMandate, limits: { max_calls: 2 } }, "mandate-nonce-0000000002")
  const constrainedEnvelope = await fixture.sign({ ...unsignedEnvelope, id: "oati:tx:test:middleware:usage", mandate_id: constrainedMandate.id }, "envelope-proof-nonce-003")
  const response = await createOatiMiddleware(fixture.options)(fixture.request(constrainedEnvelope, constrainedMandate), () => Response.json({ should_not_run: true }))
  assert.equal(response.status, 503)
  const body = await response.json()
  assert.equal(body.code, "MIDDLEWARE_UNAVAILABLE")
  assert.equal(body.receipt.outcome, "denied")
})

test("reference middleware atomically consumes usage and receipts conflicts and handler failures", async () => {
  const fixture = await middlewareFixture()
  const { proof: _oldMandateProof, ...unsignedMandate } = fixture.mandate
  const constrainedMandate = await fixture.sign({ ...unsignedMandate, limits: { max_calls: 2 } }, "mandate-nonce-0000000004")
  let committed
  const usageStore = { load: async () => ({ calls: 0 }), compareAndSet: async (_id, previous, next) => { committed = { previous, next }; return true } }
  const allowed = await createOatiMiddleware({ ...fixture.options, usageStore })(fixture.request(fixture.envelope, constrainedMandate), () => Response.json({ ok: true }))
  assert.equal(allowed.status, 200)
  assert.deepEqual(committed.previous, { calls: 0 })
  assert.equal(committed.next.calls, 1)

  const conflictFixture = await middlewareFixture()
  const { proof: _conflictMandateProof, ...conflictUnsignedMandate } = conflictFixture.mandate
  const { proof: _conflictEnvelopeProof, ...conflictUnsignedEnvelope } = conflictFixture.envelope
  const conflictMandate = await conflictFixture.sign({ ...conflictUnsignedMandate, limits: { max_calls: 2 } }, "mandate-nonce-0000000005")
  const conflictEnvelope = await conflictFixture.sign({ ...conflictUnsignedEnvelope, id: "oati:tx:test:middleware:conflict" }, "envelope-proof-nonce-005")
  const conflict = await createOatiMiddleware({ ...conflictFixture.options, usageStore: { load: async () => ({ calls: 0 }), compareAndSet: async () => false } })(conflictFixture.request(conflictEnvelope, conflictMandate), () => Response.json({ should_not_run: true }))
  assert.equal(conflict.status, 409)
  assert.equal((await conflict.json()).code, "MIDDLEWARE_USAGE_CONFLICT")

  const failureFixture = await middlewareFixture()
  const failed = await createOatiMiddleware(failureFixture.options)(failureFixture.request(), () => { throw new Error("handler failed") })
  assert.equal(failed.status, 500)
  const failedReceipt = JSON.parse(Buffer.from(failed.headers.get("OATI-Receipt"), "base64url").toString("utf8"))
  assert.equal(failedReceipt.outcome, "failed")
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
