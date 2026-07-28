import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import {
  LookupTrustResolver,
  MemoryReplayCache,
  OatiLookupClient,
  encodeOatiHeader,
  httpRequestDigest,
  signDocument,
  verifyDocument,
} from "../sdk/typescript/dist/index.js"

const mode = process.argv[2]
const port = Number(process.env.PORT ?? (mode === "transit" ? 8200 : 8080))
const gatewayOrigin = process.env.GATEWAY_ORIGIN ?? "http://envoy:8080"
const lookupUrl = process.env.LOOKUP_URL ?? "http://lookup:8080/oati/v1"
const buyerIssuer = "oati:issuer:integration:buyer"
const buyerKey = "oati:key:integration:buyer-1"
const buyerAgent = "oati:agent:integration:buyer"
const gatewayIssuer = "oati:issuer:integration:gateway"
const gatewayKey = "oati:key:integration:gateway-1"
const mandateId = "oati:mandate:integration:gateway"
const privateJwk = JSON.parse(await readFile("/app/fixtures/ed25519-private.jwk.json", "utf8"))
const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x }

function send(response, status, value, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers })
  response.end(JSON.stringify(value))
}

async function jsonBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}
}

function listen(name, handler) {
  createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
      if (url.pathname === "/health") return send(response, 200, { status: "ok", service: name })
      await handler(request, response, url)
    } catch (error) {
      send(response, 500, { error: { code: "INTEGRATION_FIXTURE_ERROR", message: error instanceof Error ? error.message : "fixture failed" } })
    }
  }).listen(port, "0.0.0.0", () => console.log(`${name} listening on :${port}`))
}

function publicRecord(type, id, issuer, controller) {
  const issued = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  if (type === "issuer") return { type, id, display_name: id, status: "active", issuer: id, issued_at: issued, expires_at: expires, proof_status: "verified", public_attributes: {} }
  return { type, id, display_name: id, status: "active", issuer, issued_at: issued, expires_at: expires, proof_status: "verified",
    public_attributes: { controller, algorithm: "EdDSA", public_key_jwk: JSON.stringify(publicJwk) } }
}

async function authority(sequence) {
  const created = new Date(Date.now() - 2_000)
  const expires = new Date(Date.now() + 5 * 60 * 1000)
  const sign = (document, nonce) => signDocument(document, { algorithm: "EdDSA", verificationMethod: buyerKey, privateKey: privateJwk,
    audience: gatewayOrigin, nonce, created, expires })
  const mandate = await sign({
    oati_version: "1.0", id: mandateId, issuer: buyerIssuer, subject: buyerAgent, purpose: "Read the protected weather API",
    actions: ["forecast.read"], resources: ["oati:service:integration:weather"], limits: { max_calls: 1 },
    not_before: created.toISOString(), expires_at: expires.toISOString(), status: "active", delegation: { allowed: false, max_depth: 0 },
  }, `integration-mandate-${sequence}-${crypto.randomUUID()}`)
  const target = `${gatewayOrigin}/protected?city=Berlin`
  const requestDigest = await httpRequestDigest(new Request(target))
  const envelope = await sign({
    oati_version: "1.0", id: `oati:tx:integration:gateway-${sequence}`, agent_id: buyerAgent,
    organisation_id: "oati:org:integration:buyer", mandate_id: mandateId, action: "forecast.read",
    resource: "oati:service:integration:weather", purpose: "Read the protected weather API", protocol: "http",
    request_digest: requestDigest, issued_at: new Date().toISOString(), nonce: `integration-envelope-object-${sequence}`,
  }, `integration-envelope-${sequence}-${crypto.randomUUID()}`)
  return { mandate, envelope, headers: { "OATI-Mandate": encodeOatiHeader(mandate), "OATI-Envelope": encodeOatiHeader(envelope) } }
}

async function lookupService() {
  let unavailable = false
  const records = [
    publicRecord("issuer", buyerIssuer, buyerIssuer, buyerIssuer),
    publicRecord("key", buyerKey, buyerIssuer, buyerAgent),
    publicRecord("issuer", gatewayIssuer, gatewayIssuer, gatewayIssuer),
    publicRecord("key", gatewayKey, gatewayIssuer, gatewayIssuer),
  ]
  listen("lookup-fixture", async (request, response, url) => {
    if (request.method === "GET" && url.pathname === "/oati/v1/status") return send(response, unavailable ? 503 : 200, { status: unavailable ? "unavailable" : "ok" })
    if (request.method === "POST" && url.pathname === "/test/unavailable") { unavailable = true; return send(response, 200, { unavailable }) }
    if (request.method === "GET" && url.pathname === "/test/authority") return send(response, 200, await authority(url.searchParams.get("sequence") ?? "1"))
    if (request.method === "GET" && url.pathname === "/oati/v1/lookup") {
      if (unavailable) return send(response, 503, { error: { code: "LOOKUP_UNAVAILABLE", message: "integration outage" } })
      const type = url.searchParams.get("type"), id = url.searchParams.get("id")
      if (type === "revocation" && url.searchParams.has("target")) return send(response, 404, { error: { code: "LOOKUP_NOT_FOUND", message: "no revocation" } })
      const record = records.find((item) => item.type === type && item.id === id)
      if (!record) return send(response, 404, { error: { code: "LOOKUP_NOT_FOUND", message: "record not found" } })
      return send(response, 200, record, { "cache-control": "no-store" })
    }
    send(response, 404, { error: { code: "LOOKUP_NOT_FOUND", message: "route not found" } })
  })
}

async function transitService() {
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "Ed25519" }, false, ["sign"])
  const verifyKey = await crypto.subtle.importKey("jwk", publicJwk, { name: "Ed25519" }, false, ["verify"])
  listen("transit-fixture", async (request, response, url) => {
    if (request.headers["x-vault-token"] !== "oati-integration-transit-token") return send(response, 403, { errors: ["forbidden"] })
    if (request.method === "GET" && url.pathname === "/v1/transit/keys/oati-integration-receipts") {
      return send(response, 200, { data: { keys: { "1": { public_key: JSON.stringify(publicJwk) } } } })
    }
    if (request.method === "POST" && url.pathname === "/v1/transit/sign/oati-integration-receipts") {
      const input = Buffer.from((await jsonBody(request)).input, "base64")
      const signature = Buffer.from(await crypto.subtle.sign("Ed25519", key, input)).toString("base64")
      return send(response, 200, { data: { signature: `vault:v1:${signature}` } })
    }
    if (request.method === "POST" && url.pathname === "/v1/transit/verify/oati-integration-receipts") {
      const payload = await jsonBody(request)
      const input = Buffer.from(payload.input, "base64"), signature = Buffer.from(String(payload.signature).split(":").at(-1), "base64")
      return send(response, 200, { data: { valid: await crypto.subtle.verify("Ed25519", verifyKey, signature, input) } })
    }
    send(response, 404, { errors: ["not found"] })
  })
}

async function applicationService() {
  listen("protected-application", async (request, response, url) => {
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => name.startsWith("oati-") || name.startsWith("x-oati-")))
    send(response, 200, { protected: true, method: request.method, path: `${url.pathname}${url.search}`, headers })
  })
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options)
  const value = await response.json().catch(() => ({}))
  return { response, value }
}

async function waitForGateway() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { const response = await fetch(`${gatewayOrigin}/ready-probe`); if (response.status) return }
    catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error("Envoy did not become reachable")
}

async function runner() {
  await waitForGateway()
  const firstAuthority = (await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/authority?sequence=1`)).value
  const maliciousHeaders = { ...firstAuthority.headers, "X-OATI-Decision": "attacker-forged" }
  const first = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: maliciousHeaders })
  if (first.response.status !== 200) throw new Error(`allowed request returned ${first.response.status}: ${JSON.stringify(first.value)}`)
  if (first.value.headers["x-oati-decision"] !== "allow" || first.value.headers["oati-envelope"] || first.value.headers["oati-mandate"]) {
    throw new Error(`Envoy header sanitization failed: ${JSON.stringify(first.value.headers)}`)
  }
  const encodedReceipt = first.response.headers.get("x-oati-receipt")
  if (!encodedReceipt) throw new Error("allowed response omitted x-oati-receipt")
  const receipt = JSON.parse(Buffer.from(encodedReceipt, "base64url").toString("utf8"))
  const receiptVerification = await verifyDocument(receipt, { resolver: new LookupTrustResolver(new OatiLookupClient({ resolverUrls: [lookupUrl], cache: false })),
    trustAnchors: [gatewayIssuer], expectedAudience: gatewayOrigin, replayCache: new MemoryReplayCache() })
  if (!receiptVerification.verified || receipt.outcome !== "pending") throw new Error(`Receipt verification failed: ${JSON.stringify(receiptVerification)}`)

  const replay = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: firstAuthority.headers })
  if (replay.response.status !== 401 || replay.value.code !== "MIDDLEWARE_REPLAY") throw new Error(`replay was not rejected: ${replay.response.status} ${JSON.stringify(replay.value)}`)

  const secondAuthority = (await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/authority?sequence=2`)).value
  const overLimit = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: secondAuthority.headers })
  if (overLimit.response.status !== 403 || !overLimit.value.reason_codes?.includes("CALL_LIMIT_EXCEEDED")) {
    throw new Error(`Valkey-backed usage limit was not enforced: ${overLimit.response.status} ${JSON.stringify(overLimit.value)}`)
  }

  await fetch(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/unavailable`, { method: "POST" })
  const thirdAuthority = (await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/authority?sequence=3`)).value
  const outage = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: thirdAuthority.headers })
  if (outage.response.status < 400) throw new Error("lookup outage failed open")

  console.log(JSON.stringify({ status: "passed", allow: first.response.status, replay: replay.response.status,
    usage_limit: overLimit.response.status, lookup_outage: outage.response.status, receipt_verified: true,
    upstream_headers_sanitized: true }, null, 2))
}

const modes = { lookup: lookupService, transit: transitService, application: applicationService, runner }
if (!modes[mode]) throw new Error(`unknown integration support mode ${mode ?? "(missing)"}`)
await modes[mode]()
