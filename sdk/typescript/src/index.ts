export const COMMERCE_PROFILE =
  "https://specs.intelliger.ai/oati/profiles/commerce/v0.1" as const
export const RWA_PROFILE =
  "https://specs.intelliger.ai/oati/profiles/rwa/v0.1" as const

export type DecimalString = `${number}`

export interface Proof {
  type: "OatiJwsProof2026" | string
  cryptosuite?: "eddsa-jcs-2022" | "ecdsa-jcs-2019" | string
  algorithm?: "EdDSA" | "ES256" | string
  created?: string
  expires?: string
  verification_method?: string
  proof_purpose?: "assertionMethod" | string
  audience?: string | string[]
  nonce?: string
  /** RFC 7797 detached compact JWS: protected-header..signature */
  signature?: string
}

export interface VerificationMethod {
  id: string
  type: string
  controller: string
  public_key_jwk: Record<string, unknown>
}

export interface AgentPassport {
  oati_version: "1.0"
  id: `oati:agent:${string}`
  organisation_id: `oati:org:${string}`
  issuer: string
  status: "active" | "suspended" | "revoked" | "expired"
  display_name?: string
  capabilities?: string[]
  protocols?: Array<"http" | "grpc" | "mcp" | "a2a">
  assurance_level?: string
  verification_methods: VerificationMethod[]
  issued_at: string
  expires_at: string
  status_endpoint?: string
  proof?: Proof
}

export interface AgentMandate {
  oati_version: "1.0"
  id: `oati:mandate:${string}`
  issuer: string
  subject: `oati:agent:${string}`
  sponsor?: string
  parent_mandate?: string
  purpose: string
  actions: string[]
  resources?: string[]
  counterparties?: string[]
  destinations?: string[]
  limits?: Record<string, unknown>
  data_use?: Record<string, unknown>
  delegation?: { allowed: boolean; max_depth: number }
  not_before: string
  expires_at: string
  status: "active" | "suspended" | "revoked" | "expired" | "consumed"
  profile?: string
  extensions?: Record<string, unknown>
  proof?: Proof
}

export interface TransactionEnvelope {
  oati_version: "1.0"
  id: `oati:tx:${string}`
  agent_id: `oati:agent:${string}`
  organisation_id: `oati:org:${string}`
  mandate_id: `oati:mandate:${string}`
  action: string
  resource: string
  purpose?: string
  destination?: string
  counterparty?: string
  protocol?: "http" | "grpc" | "mcp" | "a2a"
  commercial_profile?: string
  request_digest?: string
  issued_at: string
  nonce: string
  profile?: string
  extensions?: Record<string, unknown>
  proof?: Proof
}

export interface AuthorisationDecision {
  oati_version: "1.0"
  id: `oati:decision:${string}`
  transaction_id: `oati:tx:${string}`
  decision: "allow" | "deny" | "transform" | "approval_required"
  policy_digest: string
  reason_codes?: string[]
  obligations?: Array<Record<string, unknown>>
  decided_at: string
  expires_at?: string
  issuer: string
  proof?: Proof
}

export interface ActionReceipt {
  oati_version: "1.0"
  id: `oati:receipt:${string}`
  transaction_id: string
  agent_id: `oati:agent:${string}`
  organisation_id: `oati:org:${string}`
  mandate_id: `oati:mandate:${string}`
  decision: "allow" | "deny" | "transform" | "approval_required"
  outcome: "succeeded" | "failed" | "denied" | "pending" | "unknown"
  occurred_at: string
  issuer: string
  profile?: string
  extensions?: Record<string, unknown>
  proof: Proof
  policy_digest?: string
  request_digest?: string
  response_digest?: string
  commercial_profile?: string
  [key: string]: unknown
}

export interface CommerceTerms {
  merchant_organisation_id: `oati:org:${string}`
  service_id: `oati:service:${string}`
  offer_id: string
  currency: string
  max_unit_price: DecimalString
  max_total: DecimalString
  max_quantity: number
  billing_model?: "per_request" | "per_unit" | "subscription" | "fixed"
  terms_digest?: string
}

export interface PurchaseMandate extends AgentMandate {
  profile: typeof COMMERCE_PROFILE
  extensions: { commerce: CommerceTerms }
}

export interface CommerceReceiptTerms {
  merchant_organisation_id: string
  service_id: string
  offer_id: string
  currency: string
  quantity: number
  unit_price: DecimalString
  total_amount: DecimalString
  fulfilment_status: "fulfilled" | "partial" | "failed" | "refunded"
  terms_digest: string
  billing_reference?: string
}

export interface CommerceReceipt extends ActionReceipt {
  profile: typeof COMMERCE_PROFILE
  extensions: { commerce: CommerceReceiptTerms }
}

export interface AssetStateClaim {
  oati_version: "1.0"
  profile: typeof RWA_PROFILE
  id: `oati:claim:${string}`
  asset_id: `oati:asset:${string}`
  claim_type:
    | "reserve_balance"
    | "nav"
    | "eligibility"
    | "covenant"
    | "custody"
    | "collateral"
  value: DecimalString
  unit: string
  observed_at: string
  valid_until: string
  issuer: string
  issuer_role: "custodian" | "administrator" | "oracle" | "auditor"
  evidence: { uri?: string; digest: string; media_type: string }
  proof: Proof
}

export interface RwaMandateTerms {
  asset_id: `oati:asset:${string}`
  state_claim_id: `oati:claim:${string}`
  network: string
  token_contract: string
  operation: "mint" | "burn" | "transfer" | "redeem" | "publish_state"
  unit: string
  max_quantity: DecimalString
  one_time: boolean
  minimum_approvals: number
  required_roles?: string[]
}

export interface AssetMandate extends AgentMandate {
  profile: typeof RWA_PROFILE
  extensions: { rwa: RwaMandateTerms }
}

export interface RwaReceiptTerms {
  asset_id: string
  state_claim_id: string
  operation: "mint" | "burn" | "transfer" | "redeem" | "publish_state"
  network: string
  token_contract: string
  quantity: DecimalString
  unit: string
  chain_transaction_hash: string
  approval_count: number
  resulting_supply?: DecimalString
}

export interface RwaReceipt extends ActionReceipt {
  profile: typeof RWA_PROFILE
  extensions: { rwa: RwaReceiptTerms }
}

export interface ValidationResult {
  valid: boolean
  issues: string[]
}

export function createPurchaseMandate(
  core: Omit<AgentMandate, "oati_version" | "profile" | "extensions">,
  commerce: CommerceTerms
): PurchaseMandate {
  return {
    ...core,
    oati_version: "1.0",
    profile: COMMERCE_PROFILE,
    extensions: { commerce },
  }
}

export function validateCommerceReceipt(
  receipt: CommerceReceipt,
  mandate?: PurchaseMandate
): ValidationResult {
  const issues = validateReceiptCore(receipt)
  const commerce = receipt.extensions?.commerce
  if (receipt.profile !== COMMERCE_PROFILE) issues.push("unexpected Commerce profile URI")
  if (!commerce) return result([...issues, "missing extensions.commerce"])
  if (!isCurrency(commerce.currency)) issues.push("currency must be a three-letter uppercase code")
  if (commerce.quantity < 1) issues.push("quantity must be at least 1")
  if (!isDecimal(commerce.unit_price)) issues.push("unit_price must be a non-negative decimal string")
  if (!isDecimal(commerce.total_amount)) issues.push("total_amount must be a non-negative decimal string")
  if (mandate) {
    const limit = mandate.extensions.commerce
    if (receipt.mandate_id !== mandate.id) issues.push("receipt mandate_id does not match Mandate")
    if (commerce.merchant_organisation_id !== limit.merchant_organisation_id) issues.push("merchant is not authorised by Mandate")
    if (commerce.service_id !== limit.service_id) issues.push("service is not authorised by Mandate")
    if (commerce.offer_id !== limit.offer_id) issues.push("offer is not authorised by Mandate")
    if (commerce.currency !== limit.currency) issues.push("receipt currency differs from Mandate")
    if (commerce.quantity > limit.max_quantity) issues.push("quantity exceeds Mandate")
    if (compareDecimal(commerce.unit_price, limit.max_unit_price) > 0) issues.push("unit price exceeds Mandate")
    if (compareDecimal(commerce.total_amount, limit.max_total) > 0) issues.push("total amount exceeds Mandate")
  }
  return result(issues)
}

export function createAssetStateClaim(
  claim: Omit<AssetStateClaim, "oati_version" | "profile">
): AssetStateClaim {
  return { ...claim, oati_version: "1.0", profile: RWA_PROFILE }
}

export function validateMintMandate(
  mandate: AssetMandate,
  claim?: AssetStateClaim,
  now = new Date()
): ValidationResult {
  const issues = validateMandateCore(mandate, now)
  const rwa = mandate.extensions?.rwa
  if (mandate.profile !== RWA_PROFILE) issues.push("unexpected RWA profile URI")
  if (!rwa) return result([...issues, "missing extensions.rwa"])
  if (rwa.operation !== "mint") issues.push("controlled-mint Mandate operation must be mint")
  if (!rwa.one_time) issues.push("controlled-mint Mandate must be one-time")
  if (!isDecimal(rwa.max_quantity) || compareDecimal(rwa.max_quantity, "0") <= 0) issues.push("max_quantity must be greater than zero")
  if (rwa.minimum_approvals < 1) issues.push("minimum_approvals must be at least 1")
  if (claim) {
    if (rwa.asset_id !== claim.asset_id) issues.push("State Claim asset differs from Mandate")
    if (rwa.state_claim_id !== claim.id) issues.push("State Claim id differs from Mandate")
    if (rwa.unit !== claim.unit) issues.push("State Claim unit differs from Mandate")
    if (new Date(claim.valid_until) <= now) issues.push("State Claim is expired")
    if (compareDecimal(rwa.max_quantity, claim.value) > 0) issues.push("mint authority exceeds claimed reserve")
  }
  return result(issues)
}

export function validateRwaReceipt(
  receipt: RwaReceipt,
  mandate?: AssetMandate
): ValidationResult {
  const issues = validateReceiptCore(receipt)
  const rwa = receipt.extensions?.rwa
  if (receipt.profile !== RWA_PROFILE) issues.push("unexpected RWA profile URI")
  if (!rwa) return result([...issues, "missing extensions.rwa"])
  if (!rwa.chain_transaction_hash) issues.push("missing chain transaction hash")
  if (rwa.approval_count < 0) issues.push("approval_count cannot be negative")
  if (mandate) {
    const limit = mandate.extensions.rwa
    if (receipt.mandate_id !== mandate.id) issues.push("receipt mandate_id does not match Mandate")
    if (rwa.asset_id !== limit.asset_id) issues.push("receipt asset differs from Mandate")
    if (rwa.state_claim_id !== limit.state_claim_id) issues.push("receipt State Claim differs from Mandate")
    if (rwa.network !== limit.network || rwa.token_contract !== limit.token_contract) issues.push("receipt token target differs from Mandate")
    if (compareDecimal(rwa.quantity, limit.max_quantity) > 0) issues.push("receipt quantity exceeds Mandate")
    if (rwa.approval_count < limit.minimum_approvals) issues.push("receipt has insufficient approvals")
  }
  return result(issues)
}

function validateMandateCore(mandate: AgentMandate, now: Date): string[] {
  const issues: string[] = []
  if (!mandate.id.startsWith("oati:mandate:")) issues.push("invalid Mandate id")
  if (!mandate.subject.startsWith("oati:agent:")) issues.push("invalid Mandate subject")
  if (mandate.actions.length === 0) issues.push("Mandate needs at least one action")
  if (new Date(mandate.not_before) > now) issues.push("Mandate is not active yet")
  if (new Date(mandate.expires_at) <= now) issues.push("Mandate is expired")
  if (mandate.status !== "active") issues.push(`Mandate status is ${mandate.status}`)
  return issues
}

function validateReceiptCore(receipt: ActionReceipt): string[] {
  const issues: string[] = []
  if (!receipt.id.startsWith("oati:receipt:")) issues.push("invalid Receipt id")
  if (!receipt.transaction_id.startsWith("oati:tx:")) issues.push("invalid transaction id")
  if (!receipt.mandate_id.startsWith("oati:mandate:")) issues.push("invalid Mandate reference")
  if (!receipt.proof) issues.push("missing Receipt proof")
  return issues
}

function result(issues: string[]): ValidationResult {
  return { valid: issues.length === 0, issues }
}

function isCurrency(value: string): boolean {
  return /^[A-Z]{3}$/.test(value)
}

function isDecimal(value: string): boolean {
  return /^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)
}

function compareDecimal(left: string, right: string): number {
  if (!isDecimal(left) || !isDecimal(right)) return Number.NaN
  const [leftWhole = "0", leftFraction = ""] = left.split(".")
  const [rightWhole = "0", rightFraction = ""] = right.split(".")
  if (leftWhole.length !== rightWhole.length) {
    return leftWhole.length > rightWhole.length ? 1 : -1
  }
  if (leftWhole !== rightWhole) return leftWhole > rightWhole ? 1 : -1
  const width = Math.max(leftFraction.length, rightFraction.length)
  const a = leftFraction.padEnd(width, "0")
  const b = rightFraction.padEnd(width, "0")
  return a === b ? 0 : a > b ? 1 : -1
}

export * from "./builders.js"
export * from "./canonical.js"
export * from "./crypto.js"
export * from "./errors.js"
export * from "./evaluator.js"
export * from "./lookup.js"
export * from "./validation.js"
