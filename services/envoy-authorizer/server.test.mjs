import assert from "node:assert/strict"
import crypto from "node:crypto"
import http from "node:http"
import test from "node:test"
import {
  MemoryReplayCache,
  StaticTrustResolver,
  encodeOatiHeader,
  httpRequestDigest,
  signDocument,
} from "../../sdk/typescript/dist/index.js"
import { configuration, createApplication } from "./server.mjs"

const valid = {
  OATI_GATEWAY_EXTERNAL_ORIGIN: "https://api.customer.example",
  OATI_GATEWAY_EXPECTED_AUDIENCE: "https://api.customer.example",
  OATI_GATEWAY_RECEIPT_ISSUER: "oati:issuer:customer:gateway",
  OATI_GATEWAY_RECEIPT_VERIFICATION_METHOD: "oati:key:customer:gateway-1",
  OATI_GATEWAY_TRUST_ANCHORS: "oati:issuer:intelliger:production",
  OATI_LOOKUP_RESOLVER_URLS: "https://api.intelliger.ai/oati/v1",
  VALKEY_URL: "redis://valkey:6379/1",
  VALKEY_PASSWORD_FILE: "/run/secrets/valkey-password",
  OATI_TRANSIT_ADDR: "https://openbao:8200",
  OATI_GATEWAY_TRANSIT_KEY_NAME: "customer-gateway-receipts",
  OATI_GATEWAY_TRANSIT_KEY_VERSION: "1",
  OATI_TRANSIT_TOKEN_FILE: "/run/secrets/token",
}

test("production configuration requires authorizer mTLS", () => {
  assert.throws(() => configuration({ ...valid, OATI_ENVIRONMENT: "production" }), /requires mTLS/)
})

test("trust anchors and audiences come only from deployment configuration", () => {
  const config = configuration(valid)
  assert.deepEqual(config.trustAnchors, ["oati:issuer:intelliger:production"])
  assert.equal(config.expectedAudience, "https://api.customer.example")
  assert.equal(config.externalOrigin, "https://api.customer.example")
  assert.equal(config.maxBodyBytes, 1_048_576)
})

test("production rejects a plaintext external origin", () => {
  assert.throws(() => configuration({
    ...valid,
    OATI_ENVIRONMENT: "production",
    VALKEY_URL: "rediss://valkey:6379/1",
    OATI_GATEWAY_EXTERNAL_ORIGIN: "http://api.customer.example",
    OATI_GATEWAY_TLS_CERT_FILE: "/tls/server.crt",
    OATI_GATEWAY_TLS_KEY_FILE: "/tls/server.key",
    OATI_GATEWAY_TLS_CLIENT_CA_FILE: "/tls/ca.crt",
  }), /must use HTTPS/)
})

test("production requires an authenticated Valkey ACL identity", () => {
  assert.throws(() => configuration({
    ...valid,
    OATI_ENVIRONMENT: "production",
    VALKEY_URL: "rediss://valkey:6379/1",
    OATI_GATEWAY_TLS_CERT_FILE: "/tls/server.crt",
    OATI_GATEWAY_TLS_KEY_FILE: "/tls/server.key",
    OATI_GATEWAY_TLS_CLIENT_CA_FILE: "/tls/ca.crt",
    OATI_GATEWAY_INVALIDATION_TOKEN_FILE: "/run/secrets/invalidation-token",
  }), /Valkey ACL username/)
})

test("production rejects plaintext trust dependencies", () => {
  const production = {
    ...valid,
    OATI_ENVIRONMENT: "production",
    VALKEY_URL: "rediss://oati-gateway@gateway-valkey:6379/0",
    OATI_GATEWAY_TLS_CERT_FILE: "/tls/server.crt",
    OATI_GATEWAY_TLS_KEY_FILE: "/tls/server.key",
    OATI_GATEWAY_TLS_CLIENT_CA_FILE: "/tls/ca.crt",
    OATI_GATEWAY_INVALIDATION_TOKEN_FILE: "/run/secrets/invalidation-token",
  }
  assert.throws(() => configuration({ ...production, OATI_LOOKUP_RESOLVER_URLS: "http://lookup-api:8080/oati/v1" }), /lookup resolvers must use HTTPS/)
  assert.throws(() => configuration({ ...production, OATI_TRANSIT_ADDR: "http://openbao:8200" }), /Transit endpoint must use HTTPS/)
  assert.throws(() => configuration({ ...production, VALKEY_URL: "redis://oati-gateway@gateway-valkey:6379/0" }), /TLS-protected Valkey/)
})

test("authenticated invalidation clears exact trust and revocation target caches", async (context) => {
  const cleared = []
  const lookup = {
    clearCache: (type, id) => cleared.push([type, id]),
    clearRevocationTargetCache: () => cleared.push(["revocation-targets"]),
  }
  const config = {
    ...configuration(valid), lookup, invalidationToken: "cache-invalidation-secret-1234567890",
    valkey: { command: async () => "PONG" }, signer: { ready: async () => {} },
  }
  const server = http.createServer(createApplication(config))
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/invalidate-cache`
  const body = JSON.stringify({ reason: "key_revoked", records: [
    { type: "key", id: "oati:key:test:production-1" },
    { type: "revocation", id: "oati:revocation:test:production" },
  ] })
  assert.equal((await fetch(url, { method: "POST", body, headers: { "content-type": "application/json" } })).status, 401)
  const response = await fetch(url, { method: "POST", body, headers: {
    "content-type": "application/json", authorization: "Bearer cache-invalidation-secret-1234567890",
  } })
  assert.equal(response.status, 200, await response.clone().text())
  assert.deepEqual(cleared, [
    ["key", "oati:key:test:production-1"],
    ["revocation", "oati:revocation:test:production"],
    ["revocation-targets"],
  ])
})

test("authorizer bounds bodies and reports dependency outages without invoking policy", async (context) => {
  let signerCalls = 0
  const config = {
    ...configuration(valid), maxBodyBytes: 16, invalidationToken: "cache-invalidation-secret-1234567890",
    lookup: { clearCache: () => {}, clearRevocationTargetCache: () => {} },
    valkey: { command: async () => { throw new Error("Valkey unavailable") } },
    signer: { ready: async () => { signerCalls++; throw new Error("signer unavailable") } },
  }
  const server = http.createServer(createApplication(config))
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  const oversized = await fetch(`${base}/authorize/upload`, { method: "POST", body: "x".repeat(17) })
  assert.equal(oversized.status, 413)
  assert.deepEqual(await oversized.json(), { error: "request_too_large" })
  const readiness = await fetch(`${base}/readyz`)
  assert.equal(readiness.status, 503)
  assert.equal(signerCalls, 0, "readiness must short-circuit after Valkey failure")
  config.valkey.command = async () => "PONG"
  const signerReadiness = await fetch(`${base}/readyz`)
  assert.equal(signerReadiness.status, 503)
  assert.equal(signerCalls, 1)
  const invalidation = await fetch(`${base}/invalidate-cache`, { method: "POST", body: "x".repeat(65_537), headers: { authorization: "Bearer cache-invalidation-secret-1234567890" } })
  assert.equal(invalidation.status, 400)
})

test("HTTP authorizer verifies authority, returns a pending Receipt, and rejects replay", async (context) => {
  const pair = await crypto.webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])
  const publicKeyJwk = await crypto.webcrypto.subtle.exportKey("jwk", pair.publicKey)
  const now = new Date()
  const created = new Date(now.getTime() - 10_000)
  const expires = new Date(now.getTime() + 300_000)
  let nonce = 0
  const sign = (document) => signDocument(document, {
    algorithm: "EdDSA",
    verificationMethod: "oati:key:test:gateway-1",
    privateKey: pair.privateKey,
    audience: valid.OATI_GATEWAY_EXPECTED_AUDIENCE,
    nonce: `gateway-test-nonce-${String(++nonce).padStart(8, "0")}`,
    created,
    expires,
  })
  const mandate = await sign({
    oati_version: "1.0",
    id: "oati:mandate:test:gateway-1",
    issuer: "oati:org:test",
    subject: "oati:agent:test:buyer",
    purpose: "weather",
    actions: ["forecast.read"],
    resources: ["oati:service:test:weather"],
    not_before: created.toISOString(),
    expires_at: expires.toISOString(),
    status: "active",
  })
  const target = "https://api.customer.example/weather?city=Berlin"
  const requestDigest = await httpRequestDigest(new Request(target))
  const envelope = await sign({
    oati_version: "1.0",
    id: "oati:tx:test:gateway-1",
    agent_id: "oati:agent:test:buyer",
    organisation_id: "oati:org:test",
    mandate_id: mandate.id,
    action: "forecast.read",
    resource: "oati:service:test:weather",
    purpose: "weather",
    protocol: "http",
    request_digest: requestDigest,
    issued_at: now.toISOString(),
    nonce: "gateway-envelope-object-0001",
  })
  const resolver = new StaticTrustResolver([{
    id: "oati:key:test:gateway-1",
    controller: "oati:agent:test:buyer",
    issuer: "oati:org:test",
    algorithm: "EdDSA",
    publicKeyJwk,
    status: "active",
    validFrom: created.toISOString(),
    validUntil: expires.toISOString(),
  }], [])
  const config = {
    ...configuration(valid),
    trustAnchors: ["oati:org:test"],
    resolver,
    replayCache: new MemoryReplayCache(),
    usageStore: { load: async () => ({}), compareAndSet: async () => true },
    valkey: { command: async () => "1-0" },
    signer: {
      ready: async () => {},
      signAndVerify: async (input) => new Uint8Array(await crypto.webcrypto.subtle.sign("Ed25519", pair.privateKey, input)),
    },
  }
  const server = http.createServer(createApplication(config))
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const port = server.address().port
  const headers = { "OATI-Mandate": encodeOatiHeader(mandate), "OATI-Envelope": encodeOatiHeader(envelope) }

  const allowed = await fetch(`http://127.0.0.1:${port}/authorize/weather?city=Berlin`, { headers })
  assert.equal(allowed.status, 200, await allowed.clone().text())
  assert.equal(allowed.headers.get("x-oati-decision"), "allow")
  const receipt = JSON.parse(Buffer.from(allowed.headers.get("x-oati-receipt"), "base64url").toString("utf8"))
  assert.equal(receipt.outcome, "pending")

  const replay = await fetch(`http://127.0.0.1:${port}/authorize/weather?city=Berlin`, { headers })
  assert.equal(replay.status, 401)
  assert.match((await replay.json()).code, /MIDDLEWARE_REPLAY/)
})
