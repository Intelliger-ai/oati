import type { AgentMandate, TransactionEnvelope } from "./index.js"

export interface UsageSnapshot {
  calls?: number
  amount?: string
  currency?: string
  quantity?: string
  consumed?: boolean
  idempotency_keys?: string[]
  minted_supply?: string
}

export interface Consumption {
  calls?: number
  amount?: string
  currency?: string
  quantity?: string
  idempotency_key?: string
  consume?: boolean
}

export interface CommerceEvaluationContext {
  merchant_organisation_id: string
  service_id: string
  offer_id: string
  currency: string
  quantity: number
  unit_price: string
  total_amount: string
  idempotency_key: string
  terms_digest?: string
}

export interface RwaEvaluationContext {
  asset_id: string
  state_claim_id: string
  network: string
  token_contract: string
  operation: "mint" | "burn" | "transfer" | "redeem" | "publish_state"
  unit: string
  quantity: string
  reserve: string
  approval_count: number
  approval_roles: string[]
  current_supply: string
  maximum_supply?: string
  claim_valid_until: string
}

export interface EvaluationRequest {
  oati_version: "1.0"
  evaluation_time: string
  mandate: AgentMandate
  parent_mandate?: AgentMandate
  delegation_depth?: number
  envelope: TransactionEnvelope
  usage: UsageSnapshot
  consumption?: Consumption
  commerce?: CommerceEvaluationContext
  rwa?: RwaEvaluationContext
}

export interface EvaluationResult {
  oati_version: "1.0"
  decision: "allow" | "deny"
  mandate_id: string
  transaction_id: string
  reason_codes: string[]
  next_usage: UsageSnapshot
}

/** Deterministically evaluate authority from explicit objects, time, and prior usage. */
export function evaluateAuthority(request: EvaluationRequest): EvaluationResult {
  const reasons = new Set<string>()
  const now = timestamp(request.evaluation_time)
  const mandate = request.mandate
  const envelope = request.envelope
  if (mandate.status !== "active") reasons.add("MANDATE_NOT_ACTIVE")
  if (timestamp(mandate.not_before) > now) reasons.add("MANDATE_NOT_YET_ACTIVE")
  if (timestamp(mandate.expires_at) <= now) reasons.add("MANDATE_EXPIRED")
  if (envelope.mandate_id !== mandate.id) reasons.add("MANDATE_REFERENCE_MISMATCH")
  if (envelope.agent_id !== mandate.subject) reasons.add("SUBJECT_MISMATCH")
  if (!mandate.actions.includes(envelope.action)) reasons.add("ACTION_NOT_ALLOWED")
  checkSetConstraint(mandate.resources, envelope.resource, "RESOURCE_NOT_ALLOWED", reasons)
  if (envelope.purpose !== mandate.purpose) reasons.add("PURPOSE_MISMATCH")
  checkSetConstraint(mandate.counterparties, envelope.counterparty, "COUNTERPARTY_NOT_ALLOWED", reasons)
  checkSetConstraint(mandate.destinations, envelope.destination, "DESTINATION_NOT_ALLOWED", reasons)
  if (envelope.profile !== undefined && envelope.profile !== mandate.profile) reasons.add("PROFILE_MISMATCH")
  if (request.parent_mandate) checkChildMandate(mandate, request.parent_mandate, request.delegation_depth ?? 1, now, reasons)
  else if (mandate.parent_mandate) reasons.add("PARENT_MANDATE_REQUIRED")

  const usage = normalizedUsage(request.usage)
  const delta = effectiveConsumption(request)
  checkConsumptionContext(request, delta, reasons)
  checkConsumption(mandate, usage, delta, reasons)
  if (request.commerce || mandate.profile === "https://specs.intelliger.ai/oati/profiles/commerce/v0.1") checkCommerce(mandate, envelope, request.commerce, usage, reasons)
  if (request.rwa || mandate.profile === "https://specs.intelliger.ai/oati/profiles/rwa/v0.1") checkRwa(mandate, envelope, request.rwa, usage, request.usage.minted_supply !== undefined, now, reasons)

  const reasonCodes = [...reasons].sort()
  return {
    oati_version: "1.0",
    decision: reasonCodes.length === 0 ? "allow" : "deny",
    mandate_id: mandate.id,
    transaction_id: envelope.id,
    reason_codes: reasonCodes,
    next_usage: reasonCodes.length === 0 ? applyConsumption(usage, delta, request) : usage,
  }
}

function checkChildMandate(child: AgentMandate, parent: AgentMandate, depth: number, now: number, reasons: Set<string>): void {
  if (child.parent_mandate !== parent.id) reasons.add("PARENT_MANDATE_MISMATCH")
  if (parent.status !== "active" || timestamp(parent.not_before) > now || timestamp(parent.expires_at) <= now) reasons.add("PARENT_MANDATE_NOT_ACTIVE")
  if (!parent.delegation?.allowed || depth > parent.delegation.max_depth) reasons.add("DELEGATION_NOT_ALLOWED")
  if (!subset(child.actions, parent.actions)) reasons.add("CHILD_ACTION_AMPLIFICATION")
  if (!constrainedSubset(child.resources, parent.resources)) reasons.add("CHILD_RESOURCE_AMPLIFICATION")
  if (!constrainedSubset(child.counterparties, parent.counterparties)) reasons.add("CHILD_COUNTERPARTY_AMPLIFICATION")
  if (!constrainedSubset(child.destinations, parent.destinations)) reasons.add("CHILD_DESTINATION_AMPLIFICATION")
  if (child.purpose !== parent.purpose) reasons.add("CHILD_PURPOSE_AMPLIFICATION")
  if (timestamp(child.not_before) < timestamp(parent.not_before) || timestamp(child.expires_at) > timestamp(parent.expires_at)) reasons.add("CHILD_TIME_AMPLIFICATION")
  if (!narrowerObject(child.limits, parent.limits)) reasons.add("CHILD_LIMIT_AMPLIFICATION")
  if (!narrowerObject(child.data_use, parent.data_use)) reasons.add("CHILD_DATA_USE_AMPLIFICATION")
  if (child.delegation?.allowed) {
    const remaining = Math.max(0, parent.delegation!.max_depth - depth)
    if (child.delegation.max_depth > remaining) reasons.add("CHILD_DELEGATION_AMPLIFICATION")
  }
  checkProfileSubset(child, parent, reasons)
}

function checkProfileSubset(child: AgentMandate, parent: AgentMandate, reasons: Set<string>): void {
  if (child.profile !== parent.profile) { if (child.profile || parent.profile) reasons.add("CHILD_PROFILE_AMPLIFICATION"); return }
  const childCommerce = objectAt(child.extensions, "commerce"), parentCommerce = objectAt(parent.extensions, "commerce")
  if (parentCommerce && (!childCommerce || !sameFields(childCommerce, parentCommerce, ["merchant_organisation_id", "service_id", "offer_id", "currency", "billing_model", "terms_digest"])
    || !decimalAtMost(childCommerce.max_unit_price, parentCommerce.max_unit_price) || !decimalAtMost(childCommerce.max_total, parentCommerce.max_total)
    || !numberAtMost(childCommerce.max_quantity, parentCommerce.max_quantity))) reasons.add("CHILD_COMMERCE_AMPLIFICATION")
  const childRwa = objectAt(child.extensions, "rwa"), parentRwa = objectAt(parent.extensions, "rwa")
  if (parentRwa) {
    const requiredParent = stringArray(parentRwa.required_roles), requiredChild = stringArray(childRwa?.required_roles)
    if (!childRwa || !sameFields(childRwa, parentRwa, ["asset_id", "state_claim_id", "network", "token_contract", "operation", "unit"])
      || !decimalAtMost(childRwa.max_quantity, parentRwa.max_quantity) || !numberAtLeast(childRwa.minimum_approvals, parentRwa.minimum_approvals)
      || !subset(requiredParent, requiredChild) || parentRwa.one_time === true && childRwa.one_time !== true) reasons.add("CHILD_RWA_AMPLIFICATION")
  }
}

function checkConsumption(mandate: AgentMandate, usage: Required<UsageSnapshot>, delta: Required<Consumption>, reasons: Set<string>): void {
  if (usage.consumed) reasons.add("MANDATE_ALREADY_CONSUMED")
  if (delta.idempotency_key && usage.idempotency_keys.includes(delta.idempotency_key)) reasons.add("IDEMPOTENCY_REPLAY")
  const limits = mandate.limits ?? {}
  if (typeof limits.max_calls === "number" && usage.calls + delta.calls > limits.max_calls) reasons.add("CALL_LIMIT_EXCEEDED")
  if (mandate.profile === undefined && (typeof limits.max_quantity === "string" || typeof limits.max_quantity === "number")
    && compareDecimal(addDecimal(usage.quantity, delta.quantity), String(limits.max_quantity)) > 0) reasons.add("QUANTITY_LIMIT_EXCEEDED")
  if (typeof limits.max_total === "string" && delta.amount !== "0") {
    const currency = typeof limits.currency === "string" ? limits.currency : undefined
    if (currency && (delta.currency !== currency || usage.amount !== "0" && usage.currency !== currency)) reasons.add("BUDGET_CURRENCY_MISMATCH")
    if (compareDecimal(addDecimal(usage.amount, delta.amount), limits.max_total) > 0) reasons.add("BUDGET_EXCEEDED")
  }
}

function checkCommerce(mandate: AgentMandate, envelope: TransactionEnvelope, context: CommerceEvaluationContext | undefined, usage: Required<UsageSnapshot>, reasons: Set<string>): void {
  const limits = objectAt(mandate.extensions, "commerce")
  if (!context || !limits) { reasons.add("COMMERCE_CONTEXT_REQUIRED"); return }
  const signed = objectAt(envelope.extensions, "commerce")
  const envelopeMismatch = signed && (envelope.resource !== context.service_id || envelope.counterparty !== context.merchant_organisation_id
    || !sameMappedFields(signed, context as unknown as Record<string, unknown>, [
      ["offer_id", "offer_id"], ["currency", "currency"], ["quantity", "quantity"], ["quoted_unit_price", "unit_price"],
      ["quoted_total", "total_amount"], ["idempotency_key", "idempotency_key"], ["terms_digest", "terms_digest"],
    ]))
  if (context.merchant_organisation_id !== limits.merchant_organisation_id) reasons.add("COMMERCE_MERCHANT_NOT_ALLOWED")
  if (context.service_id !== limits.service_id) reasons.add("COMMERCE_SERVICE_NOT_ALLOWED")
  if (context.offer_id !== limits.offer_id) reasons.add("COMMERCE_OFFER_NOT_ALLOWED")
  if (context.currency !== limits.currency || usage.amount !== "0" && usage.currency !== context.currency) reasons.add("COMMERCE_CURRENCY_MISMATCH")
  if (compareDecimal(context.unit_price, String(limits.max_unit_price)) > 0) reasons.add("COMMERCE_UNIT_PRICE_EXCEEDED")
  if (compareDecimal(context.total_amount, multiplyDecimal(context.unit_price, context.quantity)) !== 0) reasons.add("COMMERCE_TOTAL_INVALID")
  if (compareDecimal(addDecimal(usage.amount, context.total_amount), String(limits.max_total)) > 0) reasons.add("COMMERCE_BUDGET_EXCEEDED")
  if (compareDecimal(String(context.quantity), String(limits.max_quantity)) > 0) reasons.add("COMMERCE_QUANTITY_EXCEEDED")
  if (limits.terms_digest && context.terms_digest !== limits.terms_digest) reasons.add("COMMERCE_TERMS_MISMATCH")
  if (usage.idempotency_keys.includes(context.idempotency_key)) reasons.add("IDEMPOTENCY_REPLAY")
  // Preserve the established primary domain failure when an already-invalid
  // context also differs from the Envelope; otherwise report substitution.
  if (envelopeMismatch && ![...reasons].some((code) => code.startsWith("COMMERCE_"))) reasons.add("COMMERCE_ENVELOPE_CONTEXT_MISMATCH")
}

function checkRwa(mandate: AgentMandate, envelope: TransactionEnvelope, context: RwaEvaluationContext | undefined, usage: Required<UsageSnapshot>, hasMintedSupply: boolean, now: number, reasons: Set<string>): void {
  const limits = objectAt(mandate.extensions, "rwa")
  if (!context || !limits) { reasons.add("RWA_CONTEXT_REQUIRED"); return }
  const signed = objectAt(envelope.extensions, "rwa")
  if (signed && (envelope.resource !== context.asset_id || !sameFields(signed, context as unknown as Record<string, unknown>,
    ["asset_id", "state_claim_id", "network", "token_contract", "operation", "unit", "quantity"]))) reasons.add("RWA_ENVELOPE_CONTEXT_MISMATCH")
  if (!sameFields(context as unknown as Record<string, unknown>, limits, ["asset_id", "state_claim_id", "network", "token_contract", "operation", "unit"])) reasons.add("RWA_TARGET_MISMATCH")
  if (timestamp(context.claim_valid_until) <= now) reasons.add("RWA_STATE_CLAIM_EXPIRED")
  if (compareDecimal(addDecimal(usage.quantity, context.quantity), String(limits.max_quantity)) > 0) reasons.add("RWA_QUANTITY_EXCEEDED")
  const resultingSupply = addDecimal(context.current_supply, context.quantity)
  if (compareDecimal(resultingSupply, context.reserve) > 0) reasons.add("RWA_RESERVE_EXCEEDED")
  if (context.maximum_supply && compareDecimal(resultingSupply, context.maximum_supply) > 0) reasons.add("RWA_MAXIMUM_SUPPLY_EXCEEDED")
  if (hasMintedSupply && compareDecimal(usage.minted_supply, context.current_supply) !== 0) reasons.add("RWA_SUPPLY_STATE_MISMATCH")
  if (context.approval_count < Number(limits.minimum_approvals)) reasons.add("RWA_APPROVAL_THRESHOLD_NOT_MET")
  for (const role of stringArray(limits.required_roles)) if (!context.approval_roles.includes(role)) reasons.add("RWA_REQUIRED_ROLE_MISSING")
  if (limits.one_time === true && usage.consumed) reasons.add("MANDATE_ALREADY_CONSUMED")
}

function effectiveConsumption(request: EvaluationRequest): Required<Consumption> {
  const commerce = request.commerce, rwa = request.rwa, supplied = request.consumption ?? {}
  return {
    calls: supplied.calls ?? 1,
    amount: commerce?.total_amount ?? supplied.amount ?? "0",
    currency: commerce?.currency ?? supplied.currency ?? "",
    quantity: commerce ? String(commerce.quantity) : rwa?.quantity ?? supplied.quantity ?? "0",
    idempotency_key: commerce?.idempotency_key ?? supplied.idempotency_key ?? "",
    consume: Boolean(objectAt(request.mandate.extensions, "rwa")?.one_time || request.mandate.limits?.one_time) || supplied.consume === true,
  }
}

function checkConsumptionContext(request: EvaluationRequest, effective: Required<Consumption>, reasons: Set<string>): void {
  const supplied = request.consumption
  if (!supplied) return
  const constrained: Array<keyof Consumption> = request.commerce
    ? ["amount", "currency", "quantity", "idempotency_key"]
    : request.rwa ? ["quantity"] : []
  if (effective.consume && supplied.consume === false) constrained.push("consume")
  if (constrained.some((field) => supplied[field] !== undefined && supplied[field] !== effective[field])) reasons.add("CONSUMPTION_CONTEXT_MISMATCH")
}

function applyConsumption(usage: Required<UsageSnapshot>, delta: Required<Consumption>, request: EvaluationRequest): UsageSnapshot {
  const next: UsageSnapshot = {
    calls: usage.calls + delta.calls,
    amount: addDecimal(usage.amount, delta.amount),
    currency: delta.currency || usage.currency,
    quantity: addDecimal(usage.quantity, delta.quantity),
    consumed: usage.consumed || delta.consume,
    idempotency_keys: delta.idempotency_key ? [...usage.idempotency_keys, delta.idempotency_key].sort() : [...usage.idempotency_keys],
    minted_supply: request.rwa ? addDecimal(request.rwa.current_supply, request.rwa.quantity) : usage.minted_supply,
  }
  return next
}

function normalizedUsage(value: UsageSnapshot): Required<UsageSnapshot> { return { calls: value.calls ?? 0, amount: value.amount ?? "0", currency: value.currency ?? "", quantity: value.quantity ?? "0", consumed: value.consumed ?? false, idempotency_keys: [...(value.idempotency_keys ?? [])].sort(), minted_supply: value.minted_supply ?? "0" } }
function checkSetConstraint(allowed: string[] | undefined, actual: string | undefined, code: string, reasons: Set<string>): void { if (allowed && (!actual || !allowed.includes(actual))) reasons.add(code) }
function constrainedSubset(child: string[] | undefined, parent: string[] | undefined): boolean { if (!parent) return true; return child !== undefined && subset(child, parent) }
function subset(child: string[], parent: string[]): boolean { return child.every((item) => parent.includes(item)) }
function timestamp(value: string): number { const parsed = Date.parse(value); if (Number.isNaN(parsed)) throw new TypeError(`Invalid RFC 3339 timestamp: ${value}`); return parsed }
function objectAt(value: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined { const item = value?.[key]; return typeof item === "object" && item !== null && !Array.isArray(item) ? item as Record<string, unknown> : undefined }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [] }
function sameFields(child: Record<string, unknown>, parent: Record<string, unknown>, fields: string[]): boolean { return fields.every((field) => child[field] === parent[field]) }
function sameMappedFields(left: Record<string, unknown>, right: Record<string, unknown>, fields: Array<readonly [string, string]>): boolean { return fields.every(([leftField, rightField]) => left[leftField] === right[rightField]) }
function numberAtMost(child: unknown, parent: unknown): boolean { return typeof child === "number" && typeof parent === "number" && child <= parent }
function numberAtLeast(child: unknown, parent: unknown): boolean { return typeof child === "number" && typeof parent === "number" && child >= parent }
function decimalAtMost(child: unknown, parent: unknown): boolean { return typeof child === "string" && typeof parent === "string" && compareDecimal(child, parent) <= 0 }

function narrowerObject(child: Record<string, unknown> | undefined, parent: Record<string, unknown> | undefined): boolean {
  if (!parent) return true
  if (!child) return false
  return Object.entries(parent).every(([key, parentValue]) => {
    const childValue = child[key]
    if (typeof parentValue === "number") return typeof childValue === "number" && childValue <= parentValue
    if (typeof parentValue === "string" && isDecimal(parentValue)) return typeof childValue === "string" && isDecimal(childValue) && compareDecimal(childValue, parentValue) <= 0
    if (Array.isArray(parentValue)) return Array.isArray(childValue) && childValue.every((item) => parentValue.includes(item))
    if (typeof parentValue === "object" && parentValue !== null) return typeof childValue === "object" && childValue !== null && !Array.isArray(childValue) && narrowerObject(childValue as Record<string, unknown>, parentValue as Record<string, unknown>)
    return childValue === parentValue
  })
}

interface Decimal { coefficient: bigint; scale: number }
function parseDecimal(value: string): Decimal { if (!isDecimal(value)) throw new TypeError(`Invalid decimal: ${value}`); const [whole, fraction = ""] = value.split("."); return { coefficient: BigInt(whole + fraction), scale: fraction.length } }
function align(left: Decimal, right: Decimal): [bigint, bigint, number] { const scale = Math.max(left.scale, right.scale); return [left.coefficient * 10n ** BigInt(scale - left.scale), right.coefficient * 10n ** BigInt(scale - right.scale), scale] }
function compareDecimal(left: string, right: string): number { const [a, b] = align(parseDecimal(left), parseDecimal(right)); return a === b ? 0 : a > b ? 1 : -1 }
function addDecimal(left: string, right: string): string { const [a, b, scale] = align(parseDecimal(left), parseDecimal(right)); return formatDecimal(a + b, scale) }
function multiplyDecimal(value: string, multiplier: number): string { const parsed = parseDecimal(value); return formatDecimal(parsed.coefficient * BigInt(multiplier), parsed.scale) }
function formatDecimal(coefficient: bigint, scale: number): string { if (scale === 0) return coefficient.toString(); const digits = coefficient.toString().padStart(scale + 1, "0"); return `${digits.slice(0, -scale)}.${digits.slice(-scale)}` }
function isDecimal(value: string): boolean { return /^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value) }
