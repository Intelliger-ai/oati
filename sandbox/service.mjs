import { createServer } from "node:http"
import {
  COMMERCE_PROFILE,
  DevelopmentIssuer,
  LookupTrustResolver,
  MemoryReplayCache,
  OatiLookupClient,
  RWA_PROFILE,
  evaluateAuthority,
  projectPublicRecord,
  validateSchema,
  verifyDocument,
} from "../sdk/typescript/dist/index.js"

const mode = process.argv[2]
const port = Number(process.env.PORT ?? 8080)
const transactionAudience = "oati:development:transaction"
const receiptAudience = "oati:sandbox:buyer"
const urls = {
  issuer: process.env.ISSUER_URL ?? "http://issuer:8080",
  control: process.env.CONTROL_URL ?? "http://control-plane:8080",
  lookup: process.env.LOOKUP_URL ?? "http://lookup:8080/oati/v1",
  commerce: process.env.COMMERCE_URL ?? "http://commerce:8080",
  rwa: process.env.RWA_URL ?? "http://rwa:8080",
  buyer: process.env.BUYER_URL ?? "http://buyer:8080",
}

const commerceTerms = {
  merchant_organisation_id: "oati:org:sandbox-seller",
  service_id: "oati:service:sandbox:weather",
  offer_id: "weather-current-v1",
  currency: "EUR",
  max_unit_price: "0.05",
  max_total: "0.25",
  max_quantity: 5,
  billing_model: "per_request",
  terms_digest: "sha256:sandbox-weather-terms-v1",
}
const rwaTerms = {
  asset_id: "oati:asset:sandbox:warehouse-1",
  state_claim_id: "oati:claim:sandbox:reserve-1",
  network: "sandbox-ledger",
  token_contract: "sandbox:RWA-WAREHOUSE-1",
  operation: "mint",
  unit: "token",
  max_quantity: "25",
  one_time: true,
  minimum_approvals: 2,
  required_roles: ["custodian", "auditor"],
}

function send(response, status, value, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers })
  response.end(JSON.stringify(value))
}

async function body(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_000_000) throw Object.assign(new Error("request body is too large"), { status: 413 })
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) }
  catch { throw Object.assign(new Error("request body must be JSON"), { status: 400 }) }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Accept: "application/json", "Content-Type": "application/json", ...options.headers } })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(value.error?.message ?? `${url} returned HTTP ${response.status}`), { status: response.status, details: value })
  return value
}

function server(name, handler) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
      if (url.pathname === "/health") return send(response, 200, { status: "ok", service: name })
      await handler(request, response, url)
    } catch (error) {
      const status = Number(error?.status) || 500
      send(response, status, { error: { code: status < 500 ? "SANDBOX_REQUEST_INVALID" : "SANDBOX_INTERNAL", message: error instanceof Error ? error.message : "sandbox request failed" } })
    }
  }).listen(port, "0.0.0.0", () => console.log(`${name} listening on :${port}`))
}

async function issuerService() {
  const buyerIssuer = await DevelopmentIssuer.create({ slug: "sandbox-buyer", displayName: "OATI Sandbox Buyer Ltd" })
  const sellerIssuer = await DevelopmentIssuer.create({ slug: "sandbox-seller", displayName: "OATI Sandbox Seller Ltd" })
  const buyerPassport = await buyerIssuer.registerAgent({ slug: "sandbox-buyer", displayName: "Sandbox Buyer Agent", capabilities: ["commerce.purchase", "rwa.mint"], protocols: ["http"] })
  await sellerIssuer.registerAgent({ slug: "sandbox-seller", displayName: "Sandbox Seller Agent", capabilities: ["commerce.fulfil", "rwa.execute"], protocols: ["http"] })
  const commerceMandate = await buyerIssuer.createMandate(buyerPassport.id, {
    purpose: "Purchase sandbox weather data", actions: ["commerce.purchase"], resources: [commerceTerms.service_id],
    counterparties: [commerceTerms.merchant_organisation_id], destinations: [urls.commerce], profile: COMMERCE_PROFILE,
    extensions: { commerce: commerceTerms }, limits: { max_calls: 5, max_total: commerceTerms.max_total, currency: commerceTerms.currency },
  })
  const rwaMandate = await buyerIssuer.createMandate(buyerPassport.id, {
    purpose: "Mint sandbox warehouse tokens", actions: ["rwa.mint"], resources: [rwaTerms.asset_id],
    counterparties: [sellerIssuer.organisationId], destinations: [urls.rwa], profile: RWA_PROFILE,
    extensions: { rwa: rwaTerms }, limits: { one_time: true },
  })
  const bootstrap = {
    buyer: { organisation_id: buyerIssuer.organisationId, agent_id: buyerPassport.id, issuer_id: buyerIssuer.issuerId, passport: buyerPassport },
    seller: { organisation_id: sellerIssuer.organisationId, issuer_id: sellerIssuer.issuerId },
    commerce_mandate: commerceMandate,
    rwa_mandate: rwaMandate,
  }

  server("issuer", async (request, response, url) => {
    if (request.method === "GET" && url.pathname === "/bootstrap") return send(response, 200, bootstrap)
    if (request.method === "GET" && url.pathname === "/records") return send(response, 200, { items: [...buyerIssuer.registryRecords(), ...sellerIssuer.registryRecords()] })
    if (request.method === "POST" && url.pathname === "/transactions/commerce") {
      const idempotencyKey = `sandbox:${crypto.randomUUID()}`
      const envelope = await buyerIssuer.signTransaction(buyerPassport.id, commerceMandate, {
        action: "commerce.purchase", resource: commerceTerms.service_id, purpose: commerceMandate.purpose,
        destination: urls.commerce, counterparty: sellerIssuer.organisationId, protocol: "http",
        extensions: { commerce: {
          offer_id: commerceTerms.offer_id, currency: commerceTerms.currency, quantity: 1,
          quoted_unit_price: "0.05", quoted_total: "0.05", idempotency_key: idempotencyKey,
          terms_digest: commerceTerms.terms_digest,
        } },
      })
      return send(response, 201, { envelope, mandate: commerceMandate })
    }
    if (request.method === "POST" && url.pathname === "/transactions/rwa") {
      const envelope = await buyerIssuer.signTransaction(buyerPassport.id, rwaMandate, {
        action: "rwa.mint", resource: rwaTerms.asset_id, purpose: rwaMandate.purpose,
        destination: urls.rwa, counterparty: sellerIssuer.organisationId, protocol: "http",
        extensions: { rwa: { asset_id: rwaTerms.asset_id, state_claim_id: rwaTerms.state_claim_id, network: rwaTerms.network,
          token_contract: rwaTerms.token_contract, operation: rwaTerms.operation, unit: rwaTerms.unit, quantity: "25" } },
      })
      return send(response, 201, { envelope, mandate: rwaMandate })
    }
    if (request.method === "POST" && url.pathname === "/receipts") {
      const input = await body(request)
      const receipt = await sellerIssuer.issueReceipt({
        transaction: input.transaction, decision: input.decision, outcome: input.outcome, audience: receiptAudience,
        profile: input.profile, extensions: input.extensions, policyDigest: "sha256:oati-sandbox-policy-v1",
      })
      return send(response, 201, { receipt })
    }
    send(response, 404, { error: { code: "SANDBOX_NOT_FOUND", message: "issuer route not found" } })
  })
}

async function controlPlaneService() {
  server("development-control-plane", async (request, response, url) => {
    if (request.method === "GET" && url.pathname === "/inventory") {
      const records = await fetchJson(`${urls.issuer}/records`)
      return send(response, 200, { items: records.items.map(projectPublicRecord) })
    }
    if (request.method === "GET" && url.pathname === "/internal/lookup") {
      const type = url.searchParams.get("type")
      const id = url.searchParams.get("id")
      const target = url.searchParams.get("target")
      const records = await fetchJson(`${urls.issuer}/records`)
      const publicRecords = records.items.map(projectPublicRecord)
      const record = target
        ? publicRecords.find((item) => item.type === "revocation" && item.public_attributes.target === target)
        : publicRecords.find((item) => item.type === type && item.id === id)
      if (!record) return send(response, 404, { error: { code: "LOOKUP_NOT_FOUND", message: "OATI record was not found" } })
      return send(response, 200, record)
    }
    send(response, 404, { error: { code: "SANDBOX_NOT_FOUND", message: "control-plane route not found" } })
  })
}

async function lookupService() {
  server("public-lookup", async (request, response, url) => {
    if (request.method === "GET" && ["/status", "/oati/v1/status"].includes(url.pathname)) {
      return send(response, 200, { status: "ok", version: "v1", environment: "sandbox" })
    }
    if (request.method === "GET" && ["/lookup", "/oati/v1/lookup"].includes(url.pathname)) {
      const query = new URLSearchParams()
      for (const key of ["type", "id", "target"]) if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key))
      try {
        const record = await fetchJson(`${urls.control}/internal/lookup?${query}`)
        return send(response, 200, record, { "Cache-Control": "public, max-age=5", "X-RateLimit-Limit": "1000", "X-RateLimit-Remaining": "999" })
      } catch (error) {
        if (error?.status === 404) return send(response, 404, { error: { code: "LOOKUP_NOT_FOUND", message: "OATI record was not found" } })
        throw error
      }
    }
    send(response, 404, { error: { code: "LOOKUP_NOT_FOUND", message: "lookup route not found" } })
  })
}

function trust(lookupUrl) {
  return new LookupTrustResolver(new OatiLookupClient({ resolverUrls: [lookupUrl], retry: { maxRetries: 2, baseDelayMs: 20, maxDelayMs: 100 } }))
}

async function verifySigned(document, issuerId, expectedAudience, replayCache) {
  const result = await verifyDocument(document, {
    resolver: trust(urls.lookup), trustAnchors: [issuerId], expectedAudience, replayCache, maxProofAgeMs: 10 * 60 * 1000,
  })
  if (!result.verified) throw Object.assign(new Error(`OATI verification failed: ${result.issues.map((item) => item.code).join(", ")}`), { status: 401, details: result })
  return result
}

async function commerceService() {
  const replay = new MemoryReplayCache()
  let usage = {}
  server("commerce-seller", async (request, response, url) => {
    if (request.method !== "POST" || url.pathname !== "/purchase") return send(response, 404, { error: { code: "SANDBOX_NOT_FOUND", message: "Commerce route not found" } })
    const { envelope, mandate } = await body(request)
    const bootstrap = await fetchJson(`${urls.issuer}/bootstrap`)
    if (mandate?.id !== bootstrap.commerce_mandate.id) throw Object.assign(new Error("unknown Commerce Mandate"), { status: 403 })
    await verifySigned(mandate, bootstrap.buyer.issuer_id, "oati:development:mandate", replay)
    await verifySigned(envelope, bootstrap.buyer.issuer_id, transactionAudience, replay)
    const signedCommerce = envelope.extensions?.commerce ?? {}
    const commerce = {
      merchant_organisation_id: envelope.counterparty, service_id: envelope.resource, offer_id: signedCommerce.offer_id,
      currency: signedCommerce.currency, quantity: signedCommerce.quantity, unit_price: signedCommerce.quoted_unit_price,
      total_amount: signedCommerce.quoted_total, idempotency_key: signedCommerce.idempotency_key, terms_digest: signedCommerce.terms_digest,
    }
    const evaluation = evaluateAuthority({ oati_version: "1.0", evaluation_time: new Date().toISOString(), mandate, envelope, usage, commerce })
    if (evaluation.decision === "allow") usage = evaluation.next_usage
    const receipt = (await fetchJson(`${urls.issuer}/receipts`, { method: "POST", body: JSON.stringify({
      transaction: envelope, decision: evaluation.decision, outcome: evaluation.decision === "allow" ? "succeeded" : "denied",
      profile: COMMERCE_PROFILE, extensions: { commerce: { ...commerce, fulfilment_status: evaluation.decision === "allow" ? "fulfilled" : "failed" } },
    }) })).receipt
    return send(response, evaluation.decision === "allow" ? 200 : 403, { evaluation, receipt, data: evaluation.decision === "allow" ? { city: "Berlin", temperature_c: 22 } : undefined })
  })
}

async function rwaService() {
  const replay = new MemoryReplayCache()
  let usage = { minted_supply: "100" }
  server("rwa-mint-simulator", async (request, response, url) => {
    if (request.method !== "POST" || url.pathname !== "/mint") return send(response, 404, { error: { code: "SANDBOX_NOT_FOUND", message: "RWA route not found" } })
    const { envelope, mandate } = await body(request)
    const bootstrap = await fetchJson(`${urls.issuer}/bootstrap`)
    if (mandate?.id !== bootstrap.rwa_mandate.id) throw Object.assign(new Error("unknown RWA Mandate"), { status: 403 })
    await verifySigned(mandate, bootstrap.buyer.issuer_id, "oati:development:mandate", replay)
    await verifySigned(envelope, bootstrap.buyer.issuer_id, transactionAudience, replay)
    const rwa = { ...rwaTerms, ...(envelope.extensions?.rwa ?? {}), reserve: "1000", approval_count: 2, approval_roles: ["custodian", "auditor"],
      current_supply: "100", maximum_supply: "1000", claim_valid_until: new Date(Date.now() + 60 * 60 * 1000).toISOString() }
    const evaluation = evaluateAuthority({ oati_version: "1.0", evaluation_time: new Date().toISOString(), mandate, envelope, usage, rwa })
    if (evaluation.decision === "allow") usage = evaluation.next_usage
    const receipt = (await fetchJson(`${urls.issuer}/receipts`, { method: "POST", body: JSON.stringify({
      transaction: envelope, decision: evaluation.decision, outcome: evaluation.decision === "allow" ? "succeeded" : "denied",
      profile: RWA_PROFILE, extensions: { rwa: { asset_id: rwa.asset_id, state_claim_id: rwa.state_claim_id, operation: rwa.operation,
        network: rwa.network, token_contract: rwa.token_contract, quantity: rwa.quantity, unit: rwa.unit, approval_count: rwa.approval_count,
        resulting_supply: evaluation.next_usage.minted_supply, chain_transaction_hash: `sandbox:${envelope.id}` } },
    }) })).receipt
    return send(response, evaluation.decision === "allow" ? 200 : 403, { evaluation, receipt, mint: evaluation.decision === "allow" ? { resulting_supply: evaluation.next_usage.minted_supply } : undefined })
  })
}

async function buyerService() {
  const replay = new MemoryReplayCache()
  server("buyer-agent", async (request, response, url) => {
    if (request.method !== "POST" || url.pathname !== "/run") return send(response, 404, { error: { code: "SANDBOX_NOT_FOUND", message: "buyer route not found" } })
    const bootstrap = await fetchJson(`${urls.issuer}/bootstrap`)
    const commerceTransaction = await fetchJson(`${urls.issuer}/transactions/commerce`, { method: "POST", body: "{}" })
    const commerce = await fetchJson(`${urls.commerce}/purchase`, { method: "POST", body: JSON.stringify(commerceTransaction) })
    const rwaTransaction = await fetchJson(`${urls.issuer}/transactions/rwa`, { method: "POST", body: "{}" })
    const rwa = await fetchJson(`${urls.rwa}/mint`, { method: "POST", body: JSON.stringify(rwaTransaction) })
    const commerceReceiptVerification = await verifySigned(commerce.receipt, bootstrap.seller.issuer_id, receiptAudience, replay)
    const rwaReceiptVerification = await verifySigned(rwa.receipt, bootstrap.seller.issuer_id, receiptAudience, replay)
    const schemaChecks = {
      commerce_receipt: validateSchema("receipt", commerce.receipt).valid,
      rwa_receipt: validateSchema("receipt", rwa.receipt).valid,
    }
    if (!Object.values(schemaChecks).every(Boolean)) throw new Error("sandbox produced a schema-invalid Receipt")
    return send(response, 200, {
      status: "passed", buyer: bootstrap.buyer.agent_id,
      commerce: { decision: commerce.evaluation.decision, receipt_id: commerce.receipt.id, signature_verified: commerceReceiptVerification.verified, data: commerce.data },
      rwa: { decision: rwa.evaluation.decision, receipt_id: rwa.receipt.id, signature_verified: rwaReceiptVerification.verified, mint: rwa.mint },
      schema_checks: schemaChecks,
    })
  })
}

async function demo() {
  const result = await fetchJson(`${urls.buyer}/run`, { method: "POST", body: "{}" })
  if (result.status !== "passed") throw new Error("sandbox demo did not pass")
  console.log(JSON.stringify(result, null, 2))
}

const services = { issuer: issuerService, "control-plane": controlPlaneService, lookup: lookupService, commerce: commerceService, rwa: rwaService, buyer: buyerService, demo }
if (!services[mode]) throw new Error(`Unknown sandbox service ${mode ?? "(missing)"}`)
await services[mode]()
