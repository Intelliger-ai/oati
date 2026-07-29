import { createMandate, createPassport, createReceipt as buildReceipt, createTransactionEnvelope } from "./builders.js"
import { canonicalJson } from "./canonical.js"
import { signDocument } from "./crypto.js"
import { projectPublicRecord, type RegistryProjectionSource } from "./projection.js"
import { assertSchema } from "./validation.js"
import type { ActionReceipt, AgentMandate, AgentPassport, TransactionEnvelope } from "./index.js"
import type { PublicOatiRecord } from "./lookup.js"

export interface DevelopmentOrganisationInput { slug: string; displayName: string }
export interface DevelopmentAgentInput { slug: string; displayName: string; capabilities?: string[]; protocols?: AgentPassport["protocols"] }
export interface DevelopmentMandateInput {
  purpose: string
  actions: string[]
  resources?: string[]
  counterparties?: string[]
  destinations?: string[]
  limits?: Record<string, unknown>
  dataUse?: Record<string, unknown>
  profile?: string
  extensions?: Record<string, unknown>
  expiresInSeconds?: number
}
export interface DevelopmentTransactionInput {
  action: string
  resource: string
  purpose?: string
  destination?: string
  counterparty?: string
  protocol?: TransactionEnvelope["protocol"]
  commercialProfile?: string
  requestDigest?: string
  profile?: string
  extensions?: Record<string, unknown>
  audience?: string
  expiresInSeconds?: number
}
export interface DevelopmentReceiptInput {
  transaction: TransactionEnvelope
  decision: ActionReceipt["decision"]
  outcome: ActionReceipt["outcome"]
  audience: string
  profile?: string
  extensions?: Record<string, unknown>
  policyDigest?: string
}
export type DevelopmentRecordStatus = "suspended" | "revoked"

/** In-memory, development-only issuer. Never use its ephemeral keys for production identities. */
export class DevelopmentIssuer {
  readonly organisationId: `oati:org:${string}`
  readonly issuerId: string
  readonly verificationMethod: string
  private readonly privateKey: CryptoKey
  private readonly publicKey: JsonWebKey
  private readonly records = new Map<string, RegistryProjectionSource>()
  private readonly agentKeys = new Map<string, { privateKey: CryptoKey; verificationMethod: string }>()
  private sequence = 0

  private constructor(input: DevelopmentOrganisationInput, privateKey: CryptoKey, publicKey: JsonWebKey, now: Date) {
    const slug = identifier(input.slug)
    this.organisationId = `oati:org:${slug}`
    this.issuerId = `oati:issuer:${slug}:development`
    this.verificationMethod = `oati:key:${slug}:development-1`
    this.privateKey = privateKey
    this.publicKey = publicKey
    const issuedAt = now.toISOString()
    const keyExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    this.put({ type: "organisation", id: this.organisationId, display_name: input.displayName, status: "active", issuer: this.issuerId,
      issued_at: issuedAt, assurance_level: "development", proof_status: "verified", public_attributes: { environment: "development" } })
    this.put({ type: "issuer", id: this.issuerId, display_name: `${input.displayName} development issuer`, status: "active", issuer: this.issuerId,
      organisation_id: this.organisationId, issued_at: issuedAt, proof_status: "verified", public_attributes: { environment: "development" } })
    this.put({ type: "key", id: this.verificationMethod, display_name: "Development signing key", status: "active", issuer: this.issuerId,
      organisation_id: this.organisationId, issued_at: issuedAt, expires_at: keyExpiry, proof_status: "verified", public_attributes: { controller: this.issuerId,
        algorithm: "EdDSA", public_key_jwk: JSON.stringify(this.publicKey) } })
  }

  static async create(input: DevelopmentOrganisationInput, now = new Date()): Promise<DevelopmentIssuer> {
    if (!input.displayName.trim()) throw new TypeError("displayName is required")
    validDate(now, "now")
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])
    return new DevelopmentIssuer(input, pair.privateKey, await crypto.subtle.exportKey("jwk", pair.publicKey), now)
  }

  async registerAgent(input: DevelopmentAgentInput, now = new Date()): Promise<AgentPassport & Record<string, unknown>> {
    validDate(now, "now")
    if (!input.displayName.trim()) throw new TypeError("displayName is required")
    const organisationSlug = this.organisationId.slice("oati:org:".length)
    const agentId = `oati:agent:${organisationSlug}:${identifier(input.slug)}` as const
    if (this.records.has(`agent:${agentId}`)) throw new RangeError(`Agent ${agentId} is already registered`)
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])
    const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey)
    const agentVerificationMethod = `oati:key:${organisationSlug}:${identifier(input.slug)}:development-1`
    this.agentKeys.set(agentId, { privateKey: pair.privateKey, verificationMethod: agentVerificationMethod })
    const passport = createPassport({ id: agentId, organisation_id: this.organisationId, issuer: this.issuerId, status: "active",
      display_name: input.displayName, capabilities: input.capabilities ?? [], protocols: input.protocols ?? ["http"], assurance_level: "development",
      verification_methods: [{ id: agentVerificationMethod, type: "JsonWebKey2020", controller: agentId, public_key_jwk: publicKey as Record<string, unknown> }],
      issued_at: now.toISOString(), expires_at: expires.toISOString() })
    const signed = await this.sign(passport, "oati:development:passport", now, expires)
    assertSchema<AgentPassport>("passport", signed)
    this.put({ type: "agent", id: agentId, display_name: input.displayName, status: "active", issuer: this.issuerId, organisation_id: this.organisationId,
      issued_at: now.toISOString(), expires_at: expires.toISOString(), assurance_level: "development", proof_status: "verified",
      public_attributes: { protocols: (input.protocols ?? ["http"]).join(",") }, private_attributes: { passport: structuredClone(signed) } })
    this.put(credentialRecord("passport", signed, input.displayName, this.organisationId))
    this.put({ type: "key", id: agentVerificationMethod, display_name: `${input.displayName} transaction key`, status: "active", issuer: this.issuerId,
      organisation_id: this.organisationId, issued_at: now.toISOString(), expires_at: expires.toISOString(), proof_status: "verified",
      public_attributes: { controller: agentId, algorithm: "EdDSA", public_key_jwk: JSON.stringify(publicKey) } })
    return signed
  }

  async createMandate(agentId: `oati:agent:${string}`, input: DevelopmentMandateInput, now = new Date()): Promise<AgentMandate & Record<string, unknown>> {
    validDate(now, "now")
    const agent = this.records.get(`agent:${agentId}`)
    if (!agent) throw new RangeError(`Agent ${agentId} is not registered`)
    if (agent.status !== "active") throw new RangeError(`Agent ${agentId} is not active`)
    if (!input.purpose.trim()) throw new TypeError("purpose is required")
    if (input.actions.length === 0) throw new TypeError("at least one action is required")
    const lifetime = input.expiresInSeconds ?? 3600
    if (!Number.isInteger(lifetime) || lifetime <= 0) throw new RangeError("expiresInSeconds must be a positive integer")
    const expires = new Date(now.getTime() + lifetime * 1000)
    const mandate = createMandate({ id: `oati:mandate:${identifier(agentId.slice(11))}:${this.nextId(now)}`, issuer: this.issuerId, subject: agentId,
      purpose: input.purpose, actions: input.actions, ...(input.resources ? { resources: input.resources } : {}),
      ...(input.counterparties ? { counterparties: input.counterparties } : {}), ...(input.destinations ? { destinations: input.destinations } : {}),
      ...(input.limits ? { limits: input.limits } : {}), ...(input.dataUse ? { data_use: input.dataUse } : {}),
      ...(input.profile ? { profile: input.profile } : {}), ...(input.extensions ? { extensions: input.extensions } : {}), not_before: now.toISOString(),
      expires_at: expires.toISOString(), status: "active", delegation: { allowed: false, max_depth: 0 } })
    const signed = await this.sign(mandate, "oati:development:mandate", now, expires)
    assertSchema<AgentMandate>("mandate", signed)
    this.put(credentialRecord("mandate", signed, `${input.purpose} mandate`, this.organisationId))
    return signed
  }

  async signTransaction(agentId: `oati:agent:${string}`, mandate: AgentMandate, input: DevelopmentTransactionInput, now = new Date()): Promise<TransactionEnvelope & Record<string, unknown>> {
    validDate(now, "now")
    const agent = this.records.get(`agent:${agentId}`)
    const issuedMandate = this.records.get(`mandate:${mandate.id}`)
    if (!agent || agent.status !== "active") throw new RangeError(`Agent ${agentId} is not active`)
    if (!issuedMandate || issuedMandate.status !== "active" || mandate.issuer !== this.issuerId || mandate.subject !== agentId || mandate.status !== "active") throw new RangeError("An active Mandate issued by this development issuer is required")
    const storedMandate = issuedMandate.private_attributes?.credential
    if (typeof storedMandate !== "object" || storedMandate === null || canonicalJson(storedMandate) !== canonicalJson(mandate)) throw new RangeError("The Mandate does not match the credential issued by this development issuer")
    if (Date.parse(mandate.not_before) > now.getTime() || Date.parse(mandate.expires_at) <= now.getTime()) throw new RangeError("The Mandate is not active at the transaction time")
    const agentKey = this.agentKeys.get(agentId)
    if (!agentKey) throw new RangeError(`Agent ${agentId} has no signing key`)
    const lifetime = input.expiresInSeconds ?? 300
    if (!Number.isInteger(lifetime) || lifetime <= 0) throw new RangeError("expiresInSeconds must be a positive integer")
    const audience = input.audience ?? "oati:development:transaction"
    if (!audience.trim()) throw new TypeError("audience is required")
    const envelope = createTransactionEnvelope({ id: `oati:tx:${identifier(agentId.slice(11))}:${this.nextId(now)}`, agent_id: agentId,
      organisation_id: this.organisationId, mandate_id: mandate.id, action: input.action, resource: input.resource,
      purpose: input.purpose ?? mandate.purpose, ...(input.destination ? { destination: input.destination } : {}),
      ...(input.counterparty ? { counterparty: input.counterparty } : {}), ...(input.protocol ? { protocol: input.protocol } : {}),
      ...(input.commercialProfile ? { commercial_profile: input.commercialProfile } : {}), ...(input.requestDigest ? { request_digest: input.requestDigest } : {}),
      ...(input.profile ?? mandate.profile ? { profile: input.profile ?? mandate.profile } : {}), ...(input.extensions ? { extensions: input.extensions } : {}),
      issued_at: now.toISOString(), nonce: crypto.randomUUID() })
    const signed = await signDocument(envelope as unknown as Record<string, unknown>, { algorithm: "EdDSA", verificationMethod: agentKey.verificationMethod, privateKey: agentKey.privateKey,
      audience, nonce: `${crypto.randomUUID()}:${this.nextId(now)}`, created: now,
      expires: new Date(now.getTime() + lifetime * 1000) }) as TransactionEnvelope & Record<string, unknown>
    assertSchema<TransactionEnvelope>("envelope", signed)
    return signed
  }

  async issueReceipt(input: DevelopmentReceiptInput, now = new Date()): Promise<ActionReceipt & Record<string, unknown>> {
    validDate(now, "now")
    if (!input.audience.trim()) throw new TypeError("audience is required")
    const receipt = buildReceipt({ id: `oati:receipt:${identifier(input.transaction.id)}:${this.nextId(now)}`, transaction_id: input.transaction.id,
      agent_id: input.transaction.agent_id, organisation_id: input.transaction.organisation_id, mandate_id: input.transaction.mandate_id,
      decision: input.decision, outcome: input.outcome, occurred_at: now.toISOString(), issuer: this.issuerId,
      ...(input.profile ? { profile: input.profile } : {}), ...(input.extensions ? { extensions: input.extensions } : {}),
      ...(input.policyDigest ? { policy_digest: input.policyDigest } : {}), proof: { type: "OatiJwsProof2026" } })
    const signed = await this.sign(receipt, input.audience, now, new Date(now.getTime() + 24 * 60 * 60 * 1000))
    assertSchema<ActionReceipt>("receipt", signed)
    this.put(credentialRecord("receipt", signed, `Receipt for ${input.transaction.id}`, this.organisationId))
    return signed
  }

  publish(type: string, id: string): PublicOatiRecord {
    const record = this.records.get(`${type}:${id}`)
    if (!record) throw new RangeError(`${type} ${id} is not registered`)
    return projectPublicRecord(record)
  }

  /** Export tenant-private registry records for the development control-plane API. */
  registryRecords(): RegistryProjectionSource[] { return [...this.records.values()].map((record) => structuredClone(record)) }

  setStatus(type: "agent" | "passport" | "mandate", id: string, status: DevelopmentRecordStatus, now = new Date()): PublicOatiRecord {
    validDate(now, "now")
    const record = this.records.get(`${type}:${id}`)
    if (!record) throw new RangeError(`${type} ${id} is not registered`)
    record.status = status
    const revocationId = `oati:revocation:${identifier(id)}:${this.nextId(now)}`
    this.put({ type: "revocation", id: revocationId, display_name: `${status} ${id}`, status, issuer: this.issuerId,
      organisation_id: this.organisationId, issued_at: now.toISOString(), proof_status: "verified",
      public_attributes: { target: id, revocation_status: status, effective_at: now.toISOString() } })
    return this.publish("revocation", revocationId)
  }

  private async sign<T extends object>(value: T, audience: string, created: Date, expires: Date): Promise<T & Record<string, unknown>> {
    return await signDocument(value as Record<string, unknown>, { algorithm: "EdDSA", verificationMethod: this.verificationMethod, privateKey: this.privateKey,
      audience, nonce: `${crypto.randomUUID()}:${this.nextId(created)}`, created, expires }) as T & Record<string, unknown>
  }
  private put(record: RegistryProjectionSource): void { this.records.set(`${record.type}:${record.id}`, record) }
  private nextId(now: Date): string { this.sequence += 1; return `${now.getTime().toString(36)}-${this.sequence.toString(36)}` }
}

function credentialRecord(type: "passport" | "mandate" | "receipt", value: Record<string, unknown>, displayName: string, organisationId: string): RegistryProjectionSource {
  const proof = typeof value.proof === "object" && value.proof !== null ? value.proof as Record<string, unknown> : {}
  const issuedAt = value.issued_at ?? value.not_before ?? value.occurred_at
  const expiresAt = value.expires_at ?? proof.expires
  return { type, id: String(value.id), display_name: displayName, status: type === "receipt" ? "active" : String(value.status), issuer: String(value.issuer), organisation_id: organisationId,
    ...(issuedAt ? { issued_at: String(issuedAt) } : {}), ...(expiresAt ? { expires_at: String(expiresAt) } : {}), proof_status: "verified",
    public_attributes: { subject: String(value.subject ?? value.id) }, private_attributes: { credential: structuredClone(value) } }
}
function identifier(value: string): string { const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, ""); if (!normalized) throw new TypeError("A valid slug is required"); return normalized }
function validDate(value: Date, name: string): void { if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError(`${name} must be a valid Date`) }
