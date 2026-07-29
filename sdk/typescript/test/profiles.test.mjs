import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { validateCommerceReceipt, validateMintMandate, validateRwaReceipt, validateSchema } from "../dist/index.js"

const fixture = async (path) => JSON.parse(await readFile(new URL(`../../../${path}`, import.meta.url), "utf8"))

test("Commerce receipts bind exact arithmetic and Mandate terms", async () => {
  const mandate = await fixture("examples/commerce/purchase-mandate.json")
  const receipt = await fixture("examples/commerce/commerce-receipt.json")
  assert.equal(validateCommerceReceipt(receipt, mandate).valid, true)

  const inconsistent = structuredClone(receipt)
  inconsistent.extensions.commerce.total_amount = "0.19"
  let checked = validateCommerceReceipt(inconsistent, mandate)
  assert.ok(checked.issues.includes("total amount must equal unit price multiplied by quantity"))

  const switchedTerms = structuredClone(receipt)
  switchedTerms.extensions.commerce.terms_digest = "sha256:different-terms"
  checked = validateCommerceReceipt(switchedTerms, mandate)
  assert.ok(checked.issues.includes("receipt terms digest differs from Mandate"))

  const malformed = structuredClone(receipt)
  malformed.extensions.commerce.unit_price = "1e2"
  assert.equal(validateSchema("commerceReceipt", malformed).valid, false)
})

test("controlled mint requires reserve evidence and exact Receipt bindings", async () => {
  const mandate = await fixture("examples/rwa/mint-mandate.json")
  const claim = await fixture("examples/rwa/asset-state-claim.json")
  const receipt = await fixture("examples/rwa/rwa-receipt.json")
  const evaluationTime = new Date("2026-07-27T09:06:00Z")
  assert.equal(validateMintMandate(mandate, claim, evaluationTime).valid, true)
  assert.equal(validateRwaReceipt(receipt, mandate).valid, true)

  const nonReserve = structuredClone(claim)
  nonReserve.claim_type = "nav"
  assert.ok(validateMintMandate(mandate, nonReserve, evaluationTime).issues.includes("controlled mint requires a reserve_balance State Claim"))

  const future = structuredClone(claim)
  future.observed_at = "2026-07-27T09:07:00Z"
  assert.ok(validateMintMandate(mandate, future, evaluationTime).issues.includes("State Claim observation is in the future"))

  const wrongOperation = structuredClone(receipt)
  wrongOperation.extensions.rwa.operation = "burn"
  wrongOperation.extensions.rwa.unit = "USD"
  const checked = validateRwaReceipt(wrongOperation, mandate)
  assert.ok(checked.issues.includes("receipt operation differs from Mandate"))
  assert.ok(checked.issues.includes("receipt unit differs from Mandate"))

  const incomplete = structuredClone(receipt)
  delete incomplete.extensions.rwa.resulting_supply
  assert.equal(validateSchema("rwaReceipt", incomplete).valid, false)
  assert.ok(validateRwaReceipt(incomplete, mandate).issues.includes("receipt resulting_supply must be a non-negative decimal string"))
})
