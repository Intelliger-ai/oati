import assert from "node:assert/strict"
import {
  COMMERCE_PROFILE,
  RWA_PROFILE,
  createPurchaseMandate,
  createAssetStateClaim,
  validateCommerceReceipt,
  validateMintMandate,
} from "../dist/index.js"

const mandate = createPurchaseMandate(
  {
    id: "oati:mandate:test:purchase",
    issuer: "oati:org:buyer",
    subject: "oati:agent:buyer:agent",
    purpose: "testing",
    actions: ["service.purchase"],
    not_before: "2026-01-01T00:00:00Z",
    expires_at: "2028-01-01T00:00:00Z",
    status: "active",
  },
  {
    merchant_organisation_id: "oati:org:seller",
    service_id: "oati:service:seller:api",
    offer_id: "offer-1",
    currency: "EUR",
    max_unit_price: "1.00",
    max_total: "2.00",
    max_quantity: 2,
  }
)

assert.equal(mandate.profile, COMMERCE_PROFILE)
const commerceResult = validateCommerceReceipt({
  oati_version: "1.0",
  id: "oati:receipt:seller:1",
  transaction_id: "oati:tx:buyer:1",
  agent_id: "oati:agent:buyer:agent",
  organisation_id: "oati:org:buyer",
  mandate_id: mandate.id,
  decision: "allow",
  outcome: "succeeded",
  occurred_at: "2026-01-01T00:00:01Z",
  issuer: "oati:org:seller",
  proof: { type: "example" },
  profile: COMMERCE_PROFILE,
  extensions: {
    commerce: {
      merchant_organisation_id: "oati:org:seller",
      service_id: "oati:service:seller:api",
      offer_id: "offer-1",
      currency: "EUR",
      quantity: 1,
      unit_price: "1.00",
      total_amount: "1.00",
      fulfilment_status: "fulfilled",
      terms_digest: "sha256:example",
    },
  },
}, mandate)
assert.equal(commerceResult.valid, true, commerceResult.issues.join(", "))

const claim = createAssetStateClaim({
  id: "oati:claim:test:reserve",
  asset_id: "oati:asset:test:eur",
  claim_type: "reserve_balance",
  value: "1000.00",
  unit: "EUR",
  observed_at: "2026-01-01T00:00:00Z",
  valid_until: "2028-01-01T00:00:00Z",
  issuer: "oati:org:custodian",
  issuer_role: "custodian",
  evidence: { digest: "sha256:example", media_type: "application/json" },
  proof: { type: "example" },
})
assert.equal(claim.profile, RWA_PROFILE)
const mintResult = validateMintMandate({
  oati_version: "1.0",
  id: "oati:mandate:test:mint",
  issuer: "oati:org:issuer",
  subject: "oati:agent:issuer:minter",
  purpose: "issuance",
  actions: ["token.mint"],
  not_before: "2026-01-01T00:00:00Z",
  expires_at: "2028-01-01T00:00:00Z",
  status: "active",
  profile: RWA_PROFILE,
  extensions: {
    rwa: {
      asset_id: claim.asset_id,
      state_claim_id: claim.id,
      network: "eip155:1",
      token_contract: "0x1",
      operation: "mint",
      unit: "EUR",
      max_quantity: "250.00",
      one_time: true,
      minimum_approvals: 2,
    },
  },
}, claim, new Date("2027-01-01T00:00:00Z"))
assert.equal(mintResult.valid, true, mintResult.issues.join(", "))

console.log("OATI TypeScript SDK smoke tests passed")
