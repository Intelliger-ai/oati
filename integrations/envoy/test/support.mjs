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
const evidenceUrl = process.env.EVIDENCE_URL ?? "http://evidence:8083"
const buyerIssuer = "oati:issuer:integration:buyer"
const rootIssuer = "oati:issuer:integration:root"
const buyerIssuerKey1 = "oati:key:integration:buyer-issuer-1"
const buyerIssuerKey2 = "oati:key:integration:buyer-issuer-2"
const buyerRuntimeKey = "oati:key:integration:buyer-runtime-1"
const buyerAgent = "oati:agent:integration:buyer"
const buyerOrganisation = "oati:org:integration:buyer"
const sellerOrganisation = "oati:org:integration:seller"
const commerceServiceID = "oati:service:integration:weather"
const commerceProfileID = "oati:profile:integration:commerce-v0.1"
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

function publicRecord(type, id, issuer, controller, jwk = publicJwk, attributes = {}) {
  const issued = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  if (type === "issuer") return { type, id, display_name: id, status: "active", issuer, issued_at: issued, expires_at: expires, proof_status: "verified", public_attributes: attributes }
  return { type, id, display_name: id, status: "active", issuer, issued_at: issued, expires_at: expires, proof_status: "verified",
    public_attributes: { controller, algorithm: "EdDSA", public_key_jwk: JSON.stringify(jwk), ...attributes } }
}

async function lookupService() {
  let unavailable = false
  let rotated = false
  const issuerKey1 = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])
  const issuerKey2 = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])
  const runtimeKey = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])
  const issuerJwk1 = await crypto.subtle.exportKey("jwk", issuerKey1.publicKey)
  const issuerJwk2 = await crypto.subtle.exportKey("jwk", issuerKey2.publicKey)
  const runtimeJwk = await crypto.subtle.exportKey("jwk", runtimeKey.publicKey)
  const issued = new Date(Date.now() - 5 * 60_000)
  const expires = new Date(Date.now() + 60 * 60 * 1000)
  const signIssuer = (document, keyID, privateKey, audience, nonce) => signDocument(document, {
    algorithm: "EdDSA", verificationMethod: keyID, privateKey, audience, nonce, created: issued, expires,
  })
  const passport = await signIssuer({
    oati_version: "1.0", id: buyerAgent, organisation_id: buyerOrganisation, issuer: buyerIssuer, status: "active",
    display_name: "Integration Buyer Agent", capabilities: ["commerce.purchase"], protocols: ["http"],
    assurance_level: "organisation-and-runtime-verified",
    verification_methods: [{ id: buyerRuntimeKey, type: "JsonWebKey2020", controller: buyerAgent, public_key_jwk: runtimeJwk }],
    issued_at: issued.toISOString(), expires_at: expires.toISOString(),
  }, buyerIssuerKey1, issuerKey1.privateKey, "oati:production:passport", `integration-passport-${crypto.randomUUID()}`)
  const profileDocument = {
    oati_version: "1.0", id: commerceProfileID, organisation_id: sellerOrganisation, issuer: gatewayIssuer,
    name: "Integration Commerce Profile", version: "0.1", schema_uri: "https://schemas.intelliger.ai/oati/profiles/commerce/v0.1/merchant-service-profile.schema.json",
    digest: `sha256:${"a".repeat(64)}`, status: "active", issued_at: issued.toISOString(), expires_at: expires.toISOString(),
  }
  const serviceDocument = {
    oati_version: "1.0", id: commerceServiceID, organisation_id: sellerOrganisation, issuer: gatewayIssuer,
    display_name: "Integration Weather Commerce API", endpoints: [{ id: "purchase", url: "https://seller.integration.example/protected", protocol: "http", audience: "https://seller.integration.example", actions: ["commerce.purchase"] }],
    accepted_profiles: [commerceProfileID], status: "active", issued_at: issued.toISOString(), expires_at: expires.toISOString(),
  }
  const records = [
    publicRecord("issuer", rootIssuer, rootIssuer, rootIssuer),
    publicRecord("issuer", buyerIssuer, buyerIssuer, buyerIssuer, publicJwk, { parent: rootIssuer }),
    publicRecord("key", buyerIssuerKey1, buyerIssuer, buyerIssuer, issuerJwk1, { key_role: "issuer" }),
    publicRecord("key", buyerRuntimeKey, buyerIssuer, buyerAgent, runtimeJwk, { key_role: "agent_runtime" }),
    { type: "passport", id: buyerAgent, display_name: "Integration Buyer Passport", status: "active", issuer: buyerIssuer,
      organisation_id: buyerOrganisation, issued_at: issued.toISOString(), expires_at: expires.toISOString(), proof_status: "verified", public_attributes: { signed_document: JSON.stringify(passport), subject: buyerAgent } },
    publicRecord("issuer", gatewayIssuer, gatewayIssuer, gatewayIssuer, publicJwk, { parent: rootIssuer }),
    publicRecord("key", gatewayKey, gatewayIssuer, gatewayIssuer),
    { type: "profile", id: commerceProfileID, display_name: profileDocument.name, status: "active", issuer: gatewayIssuer,
      organisation_id: sellerOrganisation, issued_at: issued.toISOString(), expires_at: expires.toISOString(), proof_status: "verified",
      public_attributes: { document: JSON.stringify(profileDocument), signed_document: JSON.stringify(profileDocument) } },
    { type: "service", id: commerceServiceID, display_name: serviceDocument.display_name, status: "active", issuer: gatewayIssuer,
      organisation_id: sellerOrganisation, issued_at: issued.toISOString(), expires_at: expires.toISOString(), proof_status: "verified",
      public_attributes: { document: JSON.stringify(serviceDocument), signed_document: JSON.stringify(serviceDocument) } },
  ]
  const put = (record) => { const index = records.findIndex((item) => item.type === record.type && item.id === record.id); if (index < 0) records.push(record); else records[index] = record }
  const authority = async (sequence, requestedVersion = rotated ? 2 : 1, mandateSequence = sequence) => {
    const created = new Date(Date.now() - 2_000), proofExpires = new Date(Date.now() + 5 * 60 * 1000)
    const useSecond = Number(requestedVersion) === 2
    const issuerKeyID = useSecond ? buyerIssuerKey2 : buyerIssuerKey1
    const issuerPrivate = useSecond ? issuerKey2.privateKey : issuerKey1.privateKey
    const mandate = await signDocument({
      oati_version: "1.0", id: `oati:mandate:integration:commerce-${mandateSequence}`, issuer: buyerIssuer, subject: buyerAgent,
      sponsor: buyerOrganisation, purpose: "Purchase protected weather data", actions: ["commerce.purchase"], resources: [commerceServiceID],
      counterparties: [sellerOrganisation], destinations: [`${gatewayOrigin}/protected`], limits: { max_calls: 1, currency: "EUR", max_total: "0.10" },
      not_before: created.toISOString(), expires_at: proofExpires.toISOString(), status: "active", delegation: { allowed: false, max_depth: 0 },
      profile: "https://specs.intelliger.ai/oati/profiles/commerce/v0.1",
      extensions: { commerce: { merchant_organisation_id: sellerOrganisation, service_id: commerceServiceID, offer_id: "weather-v1", currency: "EUR", max_unit_price: "0.05", max_total: "0.10", max_quantity: 1, billing_model: "per_request", terms_digest: "sha256:integration-weather-terms" } },
    }, { algorithm: "EdDSA", verificationMethod: issuerKeyID, privateKey: issuerPrivate, audience: "oati:production:mandate",
      nonce: `integration-mandate-${sequence}-${crypto.randomUUID()}`, created, expires: proofExpires })
    put({ type: "mandate", id: mandate.id, display_name: "Integration Commerce Mandate", status: "active", issuer: buyerIssuer,
      organisation_id: buyerOrganisation, issued_at: created.toISOString(), expires_at: proofExpires.toISOString(), proof_status: "verified",
      public_attributes: { signed_document: JSON.stringify(mandate), subject: buyerAgent } })
    const target = `${gatewayOrigin}/protected?city=Berlin`
    const requestDigest = await httpRequestDigest(new Request(target))
    const envelope = await signDocument({
      oati_version: "1.0", id: `oati:tx:integration:gateway-${sequence}`, agent_id: buyerAgent, organisation_id: buyerOrganisation,
      mandate_id: mandate.id, action: "commerce.purchase", resource: commerceServiceID, purpose: mandate.purpose,
      destination: `${gatewayOrigin}/protected`, counterparty: sellerOrganisation, protocol: "http",
      commercial_profile: "https://specs.intelliger.ai/oati/profiles/commerce/v0.1", request_digest: requestDigest,
      issued_at: new Date().toISOString(), nonce: `integration-envelope-object-${sequence}`,
      extensions: { commerce: { merchant_organisation_id: sellerOrganisation, service_id: commerceServiceID, offer_id: "weather-v1", currency: "EUR", quantity: 1, quoted_unit_price: "0.05", quoted_total: "0.05", idempotency_key: `commerce-${sequence}`, terms_digest: "sha256:integration-weather-terms" } },
    }, { algorithm: "EdDSA", verificationMethod: buyerRuntimeKey, privateKey: runtimeKey.privateKey, audience: gatewayOrigin,
      nonce: `integration-envelope-${sequence}-${crypto.randomUUID()}`, created, expires: proofExpires })
    return { mandate, envelope, headers: { "OATI-Mandate": encodeOatiHeader(mandate), "OATI-Envelope": encodeOatiHeader(envelope) } }
  }
  listen("lookup-fixture", async (request, response, url) => {
    if (request.method === "GET" && url.pathname === "/oati/v1/status") return send(response, unavailable ? 503 : 200, { status: unavailable ? "unavailable" : "ok" })
    if (request.method === "POST" && url.pathname === "/test/unavailable") { unavailable = true; return send(response, 200, { unavailable }) }
    if (request.method === "POST" && url.pathname === "/test/available") { unavailable = false; return send(response, 200, { unavailable }) }
    if (request.method === "POST" && url.pathname === "/test/rotate") {
      const old = records.find((item) => item.type === "key" && item.id === buyerIssuerKey1)
      old.status = "retired"; old.expires_at = new Date(Date.now() - 2 * 60_000).toISOString()
      put(publicRecord("key", buyerIssuerKey2, buyerIssuer, buyerIssuer, issuerJwk2, { key_role: "issuer", predecessor_key_id: buyerIssuerKey1 }))
      rotated = true
      return send(response, 200, { rotated, old_key: buyerIssuerKey1, new_key: buyerIssuerKey2 })
    }
    if (request.method === "POST" && url.pathname === "/test/revoke") {
      const target = url.searchParams.get("target"), record = records.find((item) => item.id === target)
      if (!record) return send(response, 404, { error: { code: "LOOKUP_NOT_FOUND", message: "record not found" } })
      record.status = "revoked"; return send(response, 200, { target, status: record.status })
    }
    if (request.method === "GET" && url.pathname === "/test/authority") return send(response, 200, await authority(
      url.searchParams.get("sequence") ?? "1", url.searchParams.get("issuer_version") ?? undefined,
      url.searchParams.get("mandate_sequence") ?? url.searchParams.get("sequence") ?? "1"))
    if (request.method === "GET" && url.pathname === "/oati/v1/discovery") {
      const organisationID = url.searchParams.get("organisation_id")
      if (organisationID !== sellerOrganisation) return send(response, 404, { error: { code: "LOOKUP_NOT_FOUND", message: "discovery not found" } })
      return send(response, 200, { organisation_id: organisationID, services: records.filter((item) => item.type === "service"), profiles: records.filter((item) => item.type === "profile") })
    }
    if (request.method === "GET" && url.pathname === "/oati/v1/lookup") {
      if (unavailable) return send(response, 503, { error: { code: "LOOKUP_UNAVAILABLE", message: "integration outage" } })
      const type = url.searchParams.get("type"), id = url.searchParams.get("id")
      if (type === "revocation" && url.searchParams.has("target")) return send(response, 404, { error: { code: "LOOKUP_NOT_FOUND", message: "no separate revocation assertion" } })
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

async function evidenceService() {
  const receipts = new Map()
  const gatewayToken = "oati-integration-evidence-gateway-token-0001"
  const readerOrganisations = new Map([
    ["oati-integration-evidence-enterprise-a-token", buyerOrganisation],
    ["oati-integration-evidence-enterprise-b-token", sellerOrganisation],
    ["oati-integration-evidence-outsider-token-0001", "oati:org:integration:outsider"],
  ])
  listen("evidence-fixture", async (request, response, url) => {
    if (request.method === "GET" && url.pathname === "/readyz") return send(response, 200, { status: "ready" })
    const token = String(request.headers.authorization ?? "").replace(/^Bearer /, "")
    if (request.method === "POST" && url.pathname === "/evidence/v1/receipts") {
      if (token !== gatewayToken) return send(response, 403, { error: "insufficient_permission" })
      const receipt = (await jsonBody(request)).receipt
      if (!receipt?.id || !receipt?.transaction_id || !receipt?.extensions?.counterparty_organisation_id) return send(response, 400, { error: "invalid_receipt" })
      const canonical = JSON.stringify(receipt)
      const prior = receipts.get(receipt.id)
      if (prior && prior.canonical !== canonical) return send(response, 409, { error: "evidence_conflict" })
      receipts.set(receipt.id, { canonical, receipt })
      return send(response, 201, { receipt_id: receipt.id, transaction_id: receipt.transaction_id })
    }
    const match = url.pathname.match(/^\/evidence\/v1\/transactions\/(.+)$/)
    if (request.method === "GET" && match) {
      const organisation = readerOrganisations.get(token)
      if (!organisation) return send(response, 403, { error: "insufficient_permission" })
      const transactionID = decodeURIComponent(match[1])
      const visible = [...receipts.values()].map((item) => item.receipt).filter((receipt) => receipt.transaction_id === transactionID
        && [receipt.organisation_id, receipt.extensions.counterparty_organisation_id].includes(organisation))
      if (visible.length === 0) return send(response, 404, { error: "evidence_not_found" })
      return send(response, 200, { transaction_id: transactionID, receipts: visible })
    }
    send(response, 404, { error: "not_found" })
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
  const lookupClient = new OatiLookupClient({ resolverUrls: [lookupUrl], cache: false })
  const discovery = await lookupClient.discoverOrganisation(sellerOrganisation)
  if (discovery.services[0]?.record.id !== commerceServiceID || discovery.profiles[0]?.record.id !== commerceProfileID
    || !discovery.services[0].document.accepted_profiles.includes(commerceProfileID)) throw new Error(`Service/Profile discovery failed: ${JSON.stringify(discovery)}`)
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
    trustAnchors: [rootIssuer], expectedAudience: gatewayOrigin, replayCache: new MemoryReplayCache() })
  if (!receiptVerification.verified || receipt.outcome !== "pending") throw new Error(`Receipt verification failed: ${JSON.stringify(receiptVerification)}`)
  if (receipt.extensions?.counterparty_organisation_id !== sellerOrganisation) throw new Error("Receipt omitted its bilateral evidence participant")
  for (const token of ["oati-integration-evidence-enterprise-a-token", "oati-integration-evidence-enterprise-b-token"]) {
    const evidence = await getJson(`${evidenceUrl}/evidence/v1/transactions/${encodeURIComponent(receipt.transaction_id)}`, { headers: { authorization: `Bearer ${token}` } })
    if (evidence.response.status !== 200 || evidence.value.receipts?.[0]?.id !== receipt.id) throw new Error(`participant evidence retrieval failed: ${evidence.response.status} ${JSON.stringify(evidence.value)}`)
  }
  const outsiderEvidence = await getJson(`${evidenceUrl}/evidence/v1/transactions/${encodeURIComponent(receipt.transaction_id)}`, { headers: { authorization: "Bearer oati-integration-evidence-outsider-token-0001" } })
  if (outsiderEvidence.response.status !== 404) throw new Error(`outsider retrieved bilateral evidence: ${outsiderEvidence.response.status}`)

  const replay = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: firstAuthority.headers })
  if (replay.response.status !== 401 || replay.value.code !== "MIDDLEWARE_REPLAY") throw new Error(`replay was not rejected: ${replay.response.status} ${JSON.stringify(replay.value)}`)

  const secondAuthority = (await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/authority?sequence=2&mandate_sequence=1`)).value
  const overLimit = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: secondAuthority.headers })
  if (overLimit.response.status !== 403 || !overLimit.value.reason_codes?.includes("CALL_LIMIT_EXCEEDED")) {
    throw new Error(`Valkey-backed usage limit was not enforced: ${overLimit.response.status} ${JSON.stringify(overLimit.value)}`)
  }

  const rotated = await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/rotate`, { method: "POST" })
  if (rotated.response.status !== 200) throw new Error(`rotation failed: ${JSON.stringify(rotated.value)}`)
  const newKeyAuthority = (await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/authority?sequence=3&issuer_version=2`)).value
  const newKey = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: newKeyAuthority.headers })
  if (newKey.response.status !== 200) throw new Error(`new issuer key was rejected: ${newKey.response.status} ${JSON.stringify(newKey.value)}`)
  const retiredAuthority = (await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/authority?sequence=4&issuer_version=1`)).value
  const retired = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: retiredAuthority.headers })
  if (retired.response.status !== 401 || !retired.value.reason_codes?.some((code) => code.includes("KEY_INVALID"))) {
    throw new Error(`retired issuer key was accepted: ${retired.response.status} ${JSON.stringify(retired.value)}`)
  }

  const revokedAuthority = (await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/authority?sequence=5&issuer_version=2`)).value
  const revokedState = await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/revoke?target=${encodeURIComponent(revokedAuthority.mandate.id)}`, { method: "POST" })
  if (revokedState.response.status !== 200) throw new Error(`Mandate revocation failed: ${JSON.stringify(revokedState.value)}`)
  const revoked = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: revokedAuthority.headers })
  if (revoked.response.status !== 401 || !revoked.value.reason_codes?.includes("MANDATE_DOCUMENT_REVOKED")) {
    throw new Error(`revoked Mandate was accepted: ${revoked.response.status} ${JSON.stringify(revoked.value)}`)
  }

  const outageAuthority = (await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/authority?sequence=6&issuer_version=2`)).value
  await fetch(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/unavailable`, { method: "POST" })
  const outage = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: outageAuthority.headers })
  if (outage.response.status < 400) throw new Error("lookup outage failed open")
  await fetch(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/available`, { method: "POST" })

  console.log(JSON.stringify({ status: "passed", allow: first.response.status, replay: replay.response.status,
    usage_limit: overLimit.response.status, discovery: true, rotated_key: newKey.response.status,
    retired_key: retired.response.status, revoked_mandate: revoked.response.status, lookup_outage: outage.response.status,
    receipt_verified: true, bilateral_evidence: true, upstream_headers_sanitized: true }, null, 2))
}

async function valkeyOutageRunner() {
  await waitForGateway()
  const authority = (await getJson(`${lookupUrl.replace(/\/oati\/v1$/, "")}/test/authority?sequence=7&issuer_version=2`)).value
  const denied = await getJson(`${gatewayOrigin}/protected?city=Berlin`, { headers: authority.headers })
  if (denied.response.status !== 503) throw new Error(`Valkey outage failed open: ${denied.response.status} ${JSON.stringify(denied.value)}`)
  console.log(JSON.stringify({ status: "passed", valkey_outage: denied.response.status }, null, 2))
}

const modes = { lookup: lookupService, transit: transitService, application: applicationService, evidence: evidenceService, runner, "valkey-outage": valkeyOutageRunner }
if (!modes[mode]) throw new Error(`unknown integration support mode ${mode ?? "(missing)"}`)
await modes[mode]()
