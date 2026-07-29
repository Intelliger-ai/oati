import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  MemoryReplayCache,
  OatiError,
  OatiLookupClient,
  OatiLookupError,
  StaticTrustResolver,
  canonicalJson,
  canonicalize,
  createOatiMiddleware,
  evaluateAuthority,
  fromEnvoyCheckRequest,
  httpRequestDigest,
  schemaNames,
  validateSchema,
  verifyDocument,
  verifyDpopProof,
} from "../dist/index.js"

const fixture = async (path) => JSON.parse(await readFile(new URL(`../../../${path}`, import.meta.url), "utf8"))

function random(seed = 0x4f415449) {
  let state = seed >>> 0
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x1_0000_0000 }
}

function randomJson(next, depth = 0) {
  if (depth >= 5) return [null, false, true, Math.trunc(next() * 1_000_000), `s-${Math.trunc(next() * 1e9)}`][Math.trunc(next() * 5)]
  const kind = Math.trunc(next() * 6)
  if (kind < 3) return randomJson(next, 5)
  if (kind === 3) return Array.from({ length: Math.trunc(next() * 5) }, () => randomJson(next, depth + 1))
  const value = {}
  for (let index = 0; index < Math.trunc(next() * 5); index++) value[`k-${index}-${Math.trunc(next() * 100)}`] = randomJson(next, depth + 1)
  return value
}

test("bounded canonical JSON properties are deterministic and cycle-safe", () => {
  const next = random()
  for (let index = 0; index < 256; index++) {
    const value = randomJson(next)
    const first = canonicalJson(value), second = canonicalJson(structuredClone(value))
    assert.equal(first, second)
    assert.deepEqual(JSON.parse(first), canonicalize(value))
    assert.equal(canonicalJson(JSON.parse(first)), first)
  }
  const cycle = {}; cycle.self = cycle
  assert.throws(() => canonicalJson(cycle), (error) => error instanceof OatiError && error.code === "INVALID_CANONICAL_VALUE")
  let deep = null
  for (let index = 0; index < 256; index++) deep = { child: deep }
  assert.doesNotThrow(() => canonicalJson(deep))
  deep = { child: deep }
  assert.throws(() => canonicalJson(deep), (error) => error instanceof OatiError && error.code === "INVALID_CANONICAL_VALUE")
})

test("schema and crypto entry points reject a deterministic malformed corpus without hangs", async () => {
  const next = random(0x43525950)
  for (let index = 0; index < 128; index++) {
    const value = randomJson(next)
    for (const schema of schemaNames) {
      const result = validateSchema(schema, value)
      assert.equal(typeof result.valid, "boolean")
      assert.ok(result.issues.length < 1_000)
    }
  }
  const signed = await fixture("conformance/crypto/signed-envelope.json")
  const resolver = new StaticTrustResolver([], [])
  for (let index = 0; index < 96; index++) {
    const document = structuredClone(signed)
    document.proof.signature = `${Math.trunc(next() * 1e12).toString(36)}..${Math.trunc(next() * 1e12).toString(36)}`
    const result = await verifyDocument(document, { resolver, trustAnchors: ["oati:issuer:none"], expectedAudience: "https://merchant.example", now: new Date("2026-07-27T12:02:00Z") })
    assert.equal(result.verified, false)
    assert.ok(result.issues.length > 0 && result.issues.length < 32)
  }
})

test("evaluator mutations are deterministic and never amplify invalid authority", async () => {
  const suite = await fixture("conformance/evaluator/cases.json")
  const base = suite.cases.find((item) => item.expected.decision === "allow").request
  for (let index = 0; index < 128; index++) {
    const request = structuredClone(base)
    request.envelope.action = `unauthorised.${index}`
    request.envelope.resource = `oati:resource:unknown:${index}`
    const first = evaluateAuthority(request), second = evaluateAuthority(structuredClone(request))
    assert.deepEqual(first, second)
    assert.equal(first.decision, "deny")
    assert.ok(first.reason_codes.includes("ACTION_NOT_ALLOWED"))
  }
})

test("lookup bounds response memory and retry storms", async () => {
  const oversized = new OatiLookupClient({ maxResponseBytes: 128, retry: { maxRetries: 0 }, fetch: async () => new Response(`{"padding":"${"x".repeat(256)}"}`) })
  await assert.rejects(() => oversized.lookup("agent", "oati:agent:test"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_INVALID_RESPONSE")
  const declared = new OatiLookupClient({ maxResponseBytes: 128, retry: { maxRetries: 0 }, fetch: async () => new Response("{}", { headers: { "Content-Length": "129" } }) })
  await assert.rejects(() => declared.lookup("agent", "oati:agent:test"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_INVALID_RESPONSE")
  let calls = 0
  const storm = new OatiLookupClient({ resolverUrls: ["https://one.test", "https://two.test", "https://three.test"],
    retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 1 }, fetch: async () => { calls++; return new Response("{}", { status: 503 }) } })
  await assert.rejects(() => storm.lookup("agent", "oati:agent:test"), (error) => error instanceof OatiLookupError && error.code === "LOOKUP_UNAVAILABLE")
  assert.equal(calls, 9)
})

test("middleware and Envoy adapter reject oversized, smuggled, and malformed inputs", async () => {
  const middleware = createOatiMiddleware({ receiptIssuer: "oati:issuer:test", maxHeaderBytes: 64,
    verificationPolicy: () => { throw new Error("must not be reached") }, signReceipt: () => { throw new Error("must not be reached") } })
  for (const envelope of ["!not-base64!", "A".repeat(65), "e30", "eyJwcm9vZiI6"]) {
    const response = await middleware(new Request("https://api.example.test/protected", { headers: { "OATI-Envelope": envelope, "OATI-Mandate": "e30" } }), () => { throw new Error("must not run") })
    assert.equal(response.status, 400)
  }
  await assert.rejects(() => httpRequestDigest(new Request("https://api.example.test/upload", { method: "POST", body: "x".repeat(129) }), 128),
    (error) => error instanceof OatiError && error.code === "MIDDLEWARE_BAD_REQUEST")
  const base = { attributes: { request: { http: { method: "GET", path: "/", headers: {} } } } }
  for (const headers of [{ "x-test": "safe\r\nInjected: yes" }, { "OATI-Envelope": "e30", "oati-envelope": "e30" }, { "bad header": "value" }]) {
    assert.throws(() => fromEnvoyCheckRequest({ attributes: { request: { http: { ...base.attributes.request.http, headers } } } }), /Envoy CheckRequest/)
  }
  assert.throws(() => fromEnvoyCheckRequest({ attributes: { request: { http: { method: "POST", path: "/", body: "x".repeat(1_048_577), headers: {} } } } }), /body exceeds/)
})

test("DPoP parsing and replay storage fail closed under malformed input and races", async () => {
  const replayStore = new MemoryReplayCache(), expires = new Date(Date.now() + 60_000), now = new Date()
  const outcomes = await Promise.all(Array.from({ length: 64 }, async () => replayStore.checkAndStore("same-key", expires, now)))
  assert.equal(outcomes.filter(Boolean).length, 1)
  for (const proof of ["", ".", "a.b", "a.b.c.d", "%%%...", "a".repeat(65_537)]) {
    const result = await verifyDpopProof(proof, new Request("https://api.example.test/resource"), { accessToken: "token", replayStore })
    assert.equal(result.valid, false)
    assert.ok(result.issues.length > 0)
  }
})
