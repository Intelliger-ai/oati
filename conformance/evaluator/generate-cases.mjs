import { readFile, writeFile } from "node:fs/promises"

const read = async (path) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), "utf8"))
const commerceMandate = await read("examples/commerce/purchase-mandate.json")
const commerceEnvelope = await read("examples/commerce/transaction-envelope.json")
const rwaMandate = await read("examples/rwa/mint-mandate.json")

const usage = { calls: 0, amount: "0.00", currency: "EUR", quantity: "0.00", consumed: false, idempotency_keys: [], minted_supply: "0.00" }
const commerce = {
  merchant_organisation_id: "oati:org:acme-weather", service_id: "oati:service:acme-weather:forecast",
  offer_id: "forecast-eu-per-request-v1", currency: "EUR", quantity: 1, unit_price: "0.20",
  total_amount: "0.20", idempotency_key: "weather-purchase-001", terms_digest: "sha256:terms-example-001",
}
const rwaEnvelope = {
  oati_version: "1.0", id: "oati:tx:example:mint-250-001", agent_id: rwaMandate.subject,
  organisation_id: "oati:org:example-issuer", mandate_id: rwaMandate.id, action: "token.mint",
  resource: "oati:asset:example:eur-reserve-token", purpose: "reserve_backed_issuance",
  counterparty: "oati:org:example-custodian", issued_at: "2026-07-27T09:06:00Z", nonce: "rwa-evaluation-nonce-001",
}
const rwa = {
  asset_id: "oati:asset:example:eur-reserve-token", state_claim_id: "oati:claim:example:reserve-20260727-0900",
  network: "eip155:1", token_contract: "0x1111111111111111111111111111111111111111", operation: "mint",
  unit: "EUR", quantity: "250.00", reserve: "1000.00", approval_count: 2,
  approval_roles: ["custodian", "approver"], current_supply: "500.00", maximum_supply: "1000.00",
  claim_valid_until: "2026-07-27T09:30:00Z",
}
const commerceRequest = { oati_version: "1.0", evaluation_time: "2026-07-27T09:03:00Z", mandate: commerceMandate, envelope: commerceEnvelope, usage, commerce }
const rwaRequest = { oati_version: "1.0", evaluation_time: "2026-07-27T09:07:00Z", mandate: rwaMandate, envelope: rwaEnvelope, usage: { ...usage, minted_supply: "500.00" }, rwa }

const parent = {
  oati_version: "1.0", id: "oati:mandate:parent:one", issuer: "oati:org:buyer", subject: "oati:agent:buyer:parent",
  purpose: "procurement", actions: ["quote.read", "order.create"], resources: ["catalogue:a", "catalogue:b"],
  counterparties: ["oati:org:seller-a", "oati:org:seller-b"], destinations: ["system:buyer"], limits: { max_calls: 10, max_total: "100.00", currency: "EUR" },
  data_use: { retention_seconds: 3600, purposes: ["procurement", "audit"] }, delegation: { allowed: true, max_depth: 1 },
  not_before: "2026-07-27T08:00:00Z", expires_at: "2026-07-27T18:00:00Z", status: "active",
}
const child = {
  ...structuredClone(parent), id: "oati:mandate:child:one", issuer: "oati:agent:buyer:parent", subject: "oati:agent:buyer:child",
  parent_mandate: parent.id, actions: ["quote.read"], resources: ["catalogue:a"], counterparties: ["oati:org:seller-a"],
  limits: { max_calls: 5, max_total: "25.00", currency: "EUR" }, data_use: { retention_seconds: 1800, purposes: ["procurement"] },
  delegation: { allowed: false, max_depth: 0 }, not_before: "2026-07-27T09:00:00Z", expires_at: "2026-07-27T12:00:00Z",
}
const childEnvelope = { oati_version: "1.0", id: "oati:tx:child:one", agent_id: child.subject, organisation_id: "oati:org:buyer", mandate_id: child.id, action: "quote.read", resource: "catalogue:a", purpose: "procurement", counterparty: "oati:org:seller-a", destination: "system:buyer", issued_at: "2026-07-27T10:00:00Z", nonce: "child-evaluation-nonce-1" }
const childRequest = { oati_version: "1.0", evaluation_time: "2026-07-27T10:00:00Z", mandate: child, parent_mandate: parent, delegation_depth: 1, envelope: childEnvelope, usage: { calls: 1, amount: "5.00", currency: "EUR", quantity: "0", consumed: false, idempotency_keys: [] }, consumption: { calls: 1, amount: "2.00", currency: "EUR", idempotency_key: "child-call-2" } }

const cases = [
  { name: "commerce-allow-and-consume", request: commerceRequest, expected: { decision: "allow", reason_codes: [], next_usage: { calls: 1, amount: "0.20", currency: "EUR", quantity: "1.00", consumed: false, idempotency_keys: ["weather-purchase-001"], minted_supply: "0.00" } } },
  { name: "commerce-cumulative-budget", request: { ...structuredClone(commerceRequest), usage: { ...usage, amount: "0.90" } }, expected: { decision: "deny", reason_codes: ["BUDGET_EXCEEDED", "COMMERCE_BUDGET_EXCEEDED"] } },
  { name: "commerce-price-and-replay", request: { ...structuredClone(commerceRequest), commerce: { ...commerce, unit_price: "0.30", total_amount: "0.30" }, usage: { ...usage, idempotency_keys: [commerce.idempotency_key] } }, expected: { decision: "deny", reason_codes: ["COMMERCE_UNIT_PRICE_EXCEEDED", "IDEMPOTENCY_REPLAY"] } },
  { name: "rwa-allow-one-time-mint", request: rwaRequest, expected: { decision: "allow", reason_codes: [], next_usage: { calls: 1, amount: "0.00", currency: "EUR", quantity: "250.00", consumed: true, idempotency_keys: [], minted_supply: "750.00" } } },
  { name: "rwa-reserve-and-supply", request: { ...structuredClone(rwaRequest), rwa: { ...rwa, quantity: "600.00", maximum_supply: "900.00" } }, expected: { decision: "deny", reason_codes: ["RWA_MAXIMUM_SUPPLY_EXCEEDED", "RWA_QUANTITY_EXCEEDED", "RWA_RESERVE_EXCEEDED"] } },
  { name: "rwa-approval-and-role", request: { ...structuredClone(rwaRequest), rwa: { ...rwa, approval_count: 1, approval_roles: ["custodian"] } }, expected: { decision: "deny", reason_codes: ["RWA_APPROVAL_THRESHOLD_NOT_MET", "RWA_REQUIRED_ROLE_MISSING"] } },
  { name: "rwa-one-time-consumed", request: { ...structuredClone(rwaRequest), usage: { ...usage, minted_supply: "500.00", consumed: true } }, expected: { decision: "deny", reason_codes: ["MANDATE_ALREADY_CONSUMED"] } },
  { name: "child-subset-allow", request: childRequest, expected: { decision: "allow", reason_codes: [], next_usage: { calls: 2, amount: "7.00", currency: "EUR", quantity: "0", consumed: false, idempotency_keys: ["child-call-2"], minted_supply: "0" } } },
  { name: "activation-not-before", request: { ...structuredClone(childRequest), evaluation_time: "2026-07-27T08:30:00Z" }, expected: { decision: "deny", reason_codes: ["MANDATE_NOT_YET_ACTIVE"] } },
  { name: "cumulative-call-limit", request: { ...structuredClone(childRequest), usage: { ...childRequest.usage, calls: 5 } }, expected: { decision: "deny", reason_codes: ["CALL_LIMIT_EXCEEDED"] } },
  { name: "child-non-amplification", request: { ...structuredClone(childRequest), mandate: { ...structuredClone(child), actions: ["quote.read", "payment.send"], resources: ["catalogue:a", "catalogue:c"], expires_at: "2026-07-28T12:00:00Z", limits: { max_calls: 20, max_total: "200.00", currency: "EUR" } } }, expected: { decision: "deny", reason_codes: ["CHILD_ACTION_AMPLIFICATION", "CHILD_LIMIT_AMPLIFICATION", "CHILD_RESOURCE_AMPLIFICATION", "CHILD_TIME_AMPLIFICATION"] } },
  { name: "core-expiry-and-constraints", request: { ...structuredClone(childRequest), evaluation_time: "2026-07-27T13:00:00Z", envelope: { ...childEnvelope, action: "order.create", resource: "catalogue:b", purpose: "marketing", counterparty: "oati:org:seller-b", destination: "system:external" } }, expected: { decision: "deny", reason_codes: ["ACTION_NOT_ALLOWED", "COUNTERPARTY_NOT_ALLOWED", "DESTINATION_NOT_ALLOWED", "MANDATE_EXPIRED", "PURPOSE_MISMATCH", "RESOURCE_NOT_ALLOWED"] } },
]

await writeFile(new URL("cases.json", import.meta.url), JSON.stringify({ suite: "oati-evaluator-0.1", cases }, null, 2) + "\n")
