import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  DevelopmentIssuer,
  MemoryReplayCache,
  StaticTrustResolver,
  evaluateAuthority,
  verifyDocument,
} from "../dist/index.js"

const fixedNow = new Date("2026-07-29T10:00:00Z")

function resolverFor(issuer) {
  const records = issuer.registryRecords()
  return new StaticTrustResolver(
    records.filter((record) => record.type === "key").map((record) => ({
      id: record.id,
      controller: record.public_attributes.controller,
      issuer: record.issuer,
      algorithm: record.public_attributes.algorithm,
      publicKeyJwk: JSON.parse(record.public_attributes.public_key_jwk),
      status: record.status,
      validFrom: record.issued_at,
      validUntil: record.expires_at,
      proofStatus: record.proof_status,
    })),
    records.filter((record) => record.type === "issuer").map((record) => ({
      id: record.id, status: record.status, proofStatus: record.proof_status,
    })),
  )
}

test("development issuance is reproducible, tenant-namespaced, and audience configurable", async () => {
  const issuer = await DevelopmentIssuer.create({ slug: "acme", displayName: "Acme" }, fixedNow)
  const other = await DevelopmentIssuer.create({ slug: "globex", displayName: "Globex" }, fixedNow)
  const passport = await issuer.registerAgent({ slug: "buyer", displayName: "Buyer" }, fixedNow)
  const otherPassport = await other.registerAgent({ slug: "buyer", displayName: "Buyer" }, fixedNow)
  assert.equal(passport.id, "oati:agent:acme:buyer")
  assert.equal(otherPassport.id, "oati:agent:globex:buyer")
  assert.equal(passport.proof.created, fixedNow.toISOString())
  await assert.rejects(() => issuer.registerAgent({ slug: "buyer", displayName: "Duplicate" }, fixedNow), /already registered/)

  const mandate = await issuer.createMandate(passport.id, {
    purpose: "Buy data", actions: ["commerce.purchase"], resources: ["oati:service:seller:data"],
    profile: "https://specs.intelliger.ai/oati/profiles/commerce/v0.1",
  }, fixedNow)
  assert.equal(mandate.proof.created, fixedNow.toISOString())
  const commerce = {
    offer_id: "data-1", currency: "EUR", quantity: 1, quoted_unit_price: "1.00", quoted_total: "1.00",
    idempotency_key: "purchase-1", terms_digest: "sha256:terms-1",
  }
  const transactionTime = new Date(fixedNow.getTime() + 1_000)
  const transaction = await issuer.signTransaction(passport.id, mandate, {
    action: "commerce.purchase", resource: "oati:service:seller:data", extensions: { commerce },
    audience: "https://seller.example", requestDigest: "sha256:request-1", commercialProfile: "data-1",
  }, transactionTime)
  assert.equal(transaction.purpose, mandate.purpose)
  assert.equal(transaction.profile, mandate.profile)
  assert.deepEqual(transaction.extensions.commerce, commerce)
  assert.equal(transaction.proof.created, transactionTime.toISOString())

  const verified = await verifyDocument(transaction, {
    resolver: resolverFor(issuer), trustAnchors: [issuer.issuerId], expectedAudience: "https://seller.example",
    replayCache: new MemoryReplayCache(), now: new Date(transactionTime.getTime() + 1_000),
  })
  assert.equal(verified.verified, true, JSON.stringify(verified.issues))
  const amplified = structuredClone(mandate)
  amplified.actions.push("admin.everything")
  await assert.rejects(() => issuer.signTransaction(passport.id, amplified, {
    action: "admin.everything", resource: "oati:service:seller:data",
  }, transactionTime), /does not match the credential/)
  await assert.rejects(() => other.signTransaction(otherPassport.id, mandate, {
    action: "commerce.purchase", resource: "oati:service:seller:data",
  }, transactionTime), /issued by this development issuer/)
})

test("development lifecycle refuses invalid lifetimes and inactive records", async () => {
  const issuer = await DevelopmentIssuer.create({ slug: "lifecycle", displayName: "Lifecycle" }, fixedNow)
  const passport = await issuer.registerAgent({ slug: "agent", displayName: "Agent" }, fixedNow)
  await assert.rejects(() => issuer.createMandate(passport.id, { purpose: "Test", actions: [], expiresInSeconds: 60 }, fixedNow), /at least one action/)
  await assert.rejects(() => issuer.createMandate(passport.id, { purpose: "Test", actions: ["test"], expiresInSeconds: 0 }, fixedNow), /positive integer/)
  const mandate = await issuer.createMandate(passport.id, { purpose: "Test", actions: ["test"], expiresInSeconds: 60 }, fixedNow)
  await assert.rejects(() => issuer.signTransaction(passport.id, mandate, { action: "test", resource: "test" }, new Date(fixedNow.getTime() + 60_000)), /not active at the transaction time/)
  issuer.setStatus("agent", passport.id, "suspended", new Date(fixedNow.getTime() + 1_000))
  await assert.rejects(() => issuer.createMandate(passport.id, { purpose: "Test", actions: ["test"] }, new Date(fixedNow.getTime() + 2_000)), /not active/)
  await assert.rejects(() => issuer.signTransaction(passport.id, mandate, { action: "test", resource: "test" }, new Date(fixedNow.getTime() + 2_000)), /not active/)
})

test("deterministic evaluator cannot under-report profiled consumption", async () => {
  const suite = JSON.parse(await readFile(new URL("../../../conformance/evaluator/cases.json", import.meta.url), "utf8"))
  const base = structuredClone(suite.cases.find((item) => item.name === "commerce-allow-and-consume").request)
  base.consumption = { amount: "0.00", currency: "EUR", quantity: "0", idempotency_key: "different" }
  const result = evaluateAuthority(base)
  assert.equal(result.decision, "deny")
  assert.ok(result.reason_codes.includes("CONSUMPTION_CONTEXT_MISMATCH"))
  assert.deepEqual(result.next_usage, base.usage)

  const oneTime = structuredClone(base)
  delete oneTime.commerce
  oneTime.mandate.profile = undefined
  oneTime.mandate.extensions = undefined
  oneTime.mandate.limits = { one_time: true }
  oneTime.consumption = { consume: false }
  const oneTimeResult = evaluateAuthority(oneTime)
  assert.ok(oneTimeResult.reason_codes.includes("CONSUMPTION_CONTEXT_MISMATCH"))
})

test("deterministic evaluator enforces generic quantity and signed profile bindings", async () => {
  const suite = JSON.parse(await readFile(new URL("../../../conformance/evaluator/cases.json", import.meta.url), "utf8"))
  const request = structuredClone(suite.cases.find((item) => item.name === "commerce-allow-and-consume").request)
  delete request.commerce
  delete request.mandate.profile
  delete request.mandate.extensions
  delete request.envelope.profile
  delete request.envelope.extensions
  request.mandate.limits.max_quantity = "1"
  request.usage.quantity = "0.75"
  request.consumption = { quantity: "1" }
  let result = evaluateAuthority(request)
  assert.ok(result.reason_codes.includes("QUANTITY_LIMIT_EXCEEDED"))

  const commerceRequest = structuredClone(suite.cases.find((item) => item.name === "commerce-allow-and-consume").request)
  delete commerceRequest.consumption
  commerceRequest.envelope.profile = "https://specs.intelliger.ai/oati/profiles/rwa/v0.1"
  commerceRequest.envelope.extensions.commerce.quoted_total = "0.01"
  result = evaluateAuthority(commerceRequest)
  assert.ok(result.reason_codes.includes("PROFILE_MISMATCH"))
  assert.ok(result.reason_codes.includes("COMMERCE_ENVELOPE_CONTEXT_MISMATCH"))
})
