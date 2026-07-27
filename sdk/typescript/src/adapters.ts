import { canonicalJson } from "./canonical.js"
import { OatiError } from "./errors.js"
import type { ActionReceipt, AgentMandate, AuthorisationDecision, TransactionEnvelope } from "./index.js"
import { encodeOatiHeader, OATI_HTTP_HEADERS } from "./middleware.js"

export const OATI_MCP_EXTENSION_URI = "https://specs.intelliger.ai/oati/extensions/mcp/v0.1" as const
export const OATI_A2A_EXTENSION_URI = "https://specs.intelliger.ai/oati/extensions/a2a/v0.1" as const

export interface AdapterEnvelopeInput {
  id: `oati:tx:${string}`; agentId: `oati:agent:${string}`; organisationId: `oati:org:${string}`
  mandateId: `oati:mandate:${string}`; purpose: string; issuedAt: string; nonce: string
}

export interface McpProtectedResourceMetadata {
  resource: string; authorization_servers: string[]; scopes_supported?: string[]
  oati: { extension: typeof OATI_MCP_EXTENSION_URI; lookup_url: string; mandate_header: string; envelope_header: string }
}

/** Add OATI discovery to RFC 9728 metadata used by an HTTP MCP server. */
export function mcpProtectedResourceMetadata(resource: string, authorizationServers: string[], lookupUrl: string, scopes?: string[]): McpProtectedResourceMetadata {
  if (!isHttps(resource) || !isHttps(lookupUrl) || authorizationServers.length === 0 || !authorizationServers.every(isHttps)) throw adapterError("MCP metadata requires HTTPS resource, lookup, and authorization server URLs")
  return { resource, authorization_servers: [...authorizationServers], ...(scopes ? { scopes_supported: [...scopes] } : {}),
    oati: { extension: OATI_MCP_EXTENSION_URI, lookup_url: lookupUrl, mandate_header: OATI_HTTP_HEADERS.mandate, envelope_header: OATI_HTTP_HEADERS.envelope } }
}

export async function mcpToolCallEnvelope(input: AdapterEnvelopeInput & { serverId: string; toolName: string; arguments: Record<string, unknown> }): Promise<TransactionEnvelope> {
  required(input.serverId, "serverId"); required(input.toolName, "toolName")
  return envelope(input, "mcp.tools.call", `mcp:server:${input.serverId}:tool:${input.toolName}`, "mcp", {
    mcp: { server_id: input.serverId, tool_name: input.toolName, arguments_digest: await digestJson(input.arguments) },
  })
}

export function mcpAuthorizationHeaders(envelope: TransactionEnvelope, mandate: AgentMandate, accessToken?: string): Headers {
  const headers = adapterHeaders(envelope, mandate)
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)
  return headers
}

export function mcpResultWithReceipt<T extends Record<string, unknown>>(result: T, receipt: ActionReceipt): T & { _meta: Record<string, unknown> } {
  const existing = isObject(result._meta) ? result._meta : {}
  return { ...result, _meta: { ...existing, [OATI_MCP_EXTENSION_URI]: { receipt } } }
}

export interface A2aAgentCard { securitySchemes?: Record<string, unknown>; security?: Array<Record<string, string[]>>; capabilities?: Record<string, unknown>; [key: string]: unknown }

/** Advertise OAuth and OATI extension support in an A2A Agent Card. */
export function a2aAgentCard(card: A2aAgentCard, authorizationUrl: string, tokenUrl: string, scopes: Record<string, string>): A2aAgentCard {
  if (!isHttps(authorizationUrl) || !isHttps(tokenUrl)) throw adapterError("A2A OAuth endpoints must use HTTPS")
  const capabilities = { ...(card.capabilities ?? {}) }
  const extensions = Array.isArray(capabilities.extensions) ? [...capabilities.extensions] : []
  if (!extensions.some((item) => isObject(item) && item.uri === OATI_A2A_EXTENSION_URI)) extensions.push({ uri: OATI_A2A_EXTENSION_URI, required: true })
  return { ...card, capabilities: { ...capabilities, extensions }, securitySchemes: { ...(card.securitySchemes ?? {}), oati_oauth: {
    oauth2SecurityScheme: { flows: { authorizationCode: { authorizationUrl, tokenUrl, scopes } } },
  } }, security: [...(card.security ?? []), { oati_oauth: Object.keys(scopes) }] }
}

export async function a2aMessageEnvelope(input: AdapterEnvelopeInput & { targetAgentId: string; messageId: string; contextId?: string; taskId?: string; parts: unknown[] }): Promise<TransactionEnvelope> {
  required(input.targetAgentId, "targetAgentId"); required(input.messageId, "messageId")
  return envelope(input, "a2a.message.send", input.targetAgentId, "a2a", { a2a: {
    message_id: input.messageId, ...(input.contextId ? { context_id: input.contextId } : {}), ...(input.taskId ? { task_id: input.taskId } : {}),
    parts_digest: await digestJson(input.parts), extension: OATI_A2A_EXTENSION_URI,
  } })
}

export function a2aMessageWithAuthority<T extends Record<string, unknown>>(message: T, envelope: TransactionEnvelope, mandate: AgentMandate): T {
  const metadata = isObject(message.metadata) ? message.metadata : {}
  return { ...message, metadata: { ...metadata, [OATI_A2A_EXTENSION_URI]: { envelope, mandate } } }
}

export interface DpopReplayStore { checkAndStore(jti: string, expiresAt: Date): boolean | Promise<boolean> }
export interface DpopVerificationOptions { accessToken: string; expectedJkt?: string; now?: Date; clockSkewSeconds?: number; maxAgeSeconds?: number; replayStore: DpopReplayStore }
export interface DpopVerificationResult { valid: boolean; jkt?: string; claims?: Record<string, unknown>; issues: string[] }

/** Verify an RFC 9449 ES256 or EdDSA DPoP proof and its access-token/request binding. */
export async function verifyDpopProof(proof: string, request: Request, options: DpopVerificationOptions): Promise<DpopVerificationResult> {
  const issues: string[] = []
  try {
    const [encodedHeader, encodedPayload, encodedSignature, extra] = proof.split(".")
    if (!encodedHeader || !encodedPayload || !encodedSignature || extra !== undefined) throw new Error("malformed JWT")
    const header = decodeObject(encodedHeader), claims = decodeObject(encodedPayload)
    if (header.typ !== "dpop+jwt") issues.push("DPOP_TYP_INVALID")
    if (header.alg !== "ES256" && header.alg !== "EdDSA") issues.push("DPOP_ALGORITHM_UNSUPPORTED")
    if (!isObject(header.jwk) || "d" in header.jwk) issues.push("DPOP_JWK_INVALID")
    const jkt = isObject(header.jwk) ? await jwkThumbprint(header.jwk) : undefined
    if (options.expectedJkt && jkt !== options.expectedJkt) issues.push("DPOP_KEY_BINDING_MISMATCH")
    if (claims.htm !== request.method.toUpperCase()) issues.push("DPOP_METHOD_MISMATCH")
    const url = new URL(request.url), htu = `${url.origin}${url.pathname}`
    if (claims.htu !== htu) issues.push("DPOP_URI_MISMATCH")
    if (claims.ath !== await accessTokenHash(options.accessToken)) issues.push("DPOP_TOKEN_HASH_MISMATCH")
    const now = Math.floor((options.now ?? new Date()).getTime() / 1000), skew = options.clockSkewSeconds ?? 30, maxAge = options.maxAgeSeconds ?? 300
    if (typeof claims.iat !== "number" || claims.iat > now + skew || claims.iat < now - maxAge - skew) issues.push("DPOP_TIME_INVALID")
    if (typeof claims.jti !== "string" || claims.jti === "") issues.push("DPOP_JTI_INVALID")
    if (issues.length === 0 && isObject(header.jwk)) {
      const algorithm = header.alg === "EdDSA" ? { name: "Ed25519" } : { name: "ECDSA", namedCurve: "P-256" }
      const verificationAlgorithm = header.alg === "EdDSA" ? { name: "Ed25519" } : { name: "ECDSA", hash: "SHA-256" }
      const key = await crypto.subtle.importKey("jwk", header.jwk, algorithm, false, ["verify"])
      const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
      if (!await crypto.subtle.verify(verificationAlgorithm, key, fromBase64url(encodedSignature).slice().buffer, signingInput)) issues.push("DPOP_SIGNATURE_INVALID")
    }
    if (issues.length === 0 && !await options.replayStore.checkAndStore(claims.jti as string, new Date((now + maxAge) * 1000))) issues.push("DPOP_REPLAY")
    return { valid: issues.length === 0, ...(jkt ? { jkt } : {}), claims, issues }
  } catch { return { valid: false, issues: ["DPOP_MALFORMED"] } }
}

export async function accessTokenHash(token: string): Promise<string> { return base64url(await sha256(new TextEncoder().encode(token))) }
export function dpopAuthorizationHeaders(accessToken: string, proof: string): Headers {
  required(accessToken, "accessToken"); required(proof, "proof")
  return new Headers({ Authorization: `DPoP ${accessToken}`, DPoP: proof })
}
export async function jwkThumbprint(jwk: Record<string, unknown>): Promise<string> {
  let members: Record<string, unknown>
  if (jwk.kty === "EC") members = { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }
  else if (jwk.kty === "OKP") members = { crv: jwk.crv, kty: jwk.kty, x: jwk.x }
  else if (jwk.kty === "RSA") members = { e: jwk.e, kty: jwk.kty, n: jwk.n }
  else throw adapterError("Unsupported JWK type for thumbprint")
  if (Object.values(members).some((value) => typeof value !== "string" || value === "")) throw adapterError("JWK thumbprint members are incomplete")
  return base64url(await sha256(new TextEncoder().encode(canonicalJson(members))))
}

export interface OatiOAuthClaims {
  cnf: { jkt: string }
  oati: { agent_id: string; organisation_id: string; mandate_id: string; transaction_id: string }
}
export function oatiOAuthClaims(envelope: TransactionEnvelope, mandate: AgentMandate, dpopJkt: string): OatiOAuthClaims {
  required(dpopJkt, "dpopJkt")
  return { cnf: { jkt: dpopJkt }, oati: { agent_id: envelope.agent_id, organisation_id: envelope.organisation_id, mandate_id: mandate.id, transaction_id: envelope.id } }
}
export function validateOAuthBinding(claims: Record<string, unknown>, envelope: TransactionEnvelope, dpopJkt: string): string[] {
  const issues: string[] = [], cnf = isObject(claims.cnf) ? claims.cnf : {}, oati = isObject(claims.oati) ? claims.oati : {}
  if (cnf.jkt !== dpopJkt) issues.push("OAUTH_DPOP_KEY_MISMATCH")
  if (oati.agent_id !== envelope.agent_id) issues.push("OAUTH_AGENT_MISMATCH")
  if (oati.organisation_id !== envelope.organisation_id) issues.push("OAUTH_ORGANISATION_MISMATCH")
  if (oati.mandate_id !== envelope.mandate_id) issues.push("OAUTH_MANDATE_MISMATCH")
  if (oati.transaction_id !== envelope.id) issues.push("OAUTH_TRANSACTION_MISMATCH")
  return issues.sort()
}

export interface AuthZenEvaluationRequest { subject: AuthZenEntity; action: AuthZenEntity; resource: AuthZenEntity; context: Record<string, unknown> }
export interface AuthZenEntity { type: string; id: string; properties?: Record<string, unknown> }
export interface AuthZenEvaluationResponse { decision: boolean; context?: Record<string, unknown> }

export function toAuthZenRequest(envelope: TransactionEnvelope, mandate: AgentMandate): AuthZenEvaluationRequest {
  return { subject: { type: "oati_agent", id: envelope.agent_id, properties: { organisation_id: envelope.organisation_id } },
    action: { type: "oati_action", id: envelope.action }, resource: { type: "oati_resource", id: envelope.resource },
    context: { transaction_id: envelope.id, mandate_id: mandate.id, purpose: envelope.purpose ?? mandate.purpose,
      counterparty: envelope.counterparty, destination: envelope.destination, mandate, envelope } }
}

export function fromAuthZenResponse(response: AuthZenEvaluationResponse, envelope: TransactionEnvelope, issuer: string, at = new Date()): AuthorisationDecision {
  if (typeof response.decision !== "boolean") throw adapterError("AuthZEN response decision must be boolean")
  const obligations = Array.isArray(response.context?.obligations) ? response.context.obligations.filter(isObject) : undefined
  return { oati_version: "1.0", id: `oati:decision:authzen:${safeId(envelope.id)}`, transaction_id: envelope.id,
    decision: response.decision ? "allow" : "deny", policy_digest: stringOr(response.context?.policy_digest, "authzen:unspecified"),
    reason_codes: stringArray(response.context?.reason_codes), ...(obligations?.length ? { obligations } : {}), decided_at: at.toISOString(), issuer }
}

export interface CedarEntityUid { type: string; id: string }
export interface CedarRequest { principal: CedarEntityUid; action: CedarEntityUid; resource: CedarEntityUid; context: Record<string, unknown> }
export function toCedarRequest(envelope: TransactionEnvelope, mandate: AgentMandate): CedarRequest {
  return { principal: { type: "OatiAgent", id: envelope.agent_id }, action: { type: "OatiAction", id: envelope.action },
    resource: { type: "OatiResource", id: envelope.resource }, context: normalizedPolicyContext(envelope, mandate) }
}

export interface OpaInput { input: { principal: string; action: string; resource: string; context: Record<string, unknown>; oati: { envelope: TransactionEnvelope; mandate: AgentMandate; decision?: AuthorisationDecision["decision"] } } }
export function toOpaInput(envelope: TransactionEnvelope, mandate: AgentMandate, decision?: AuthorisationDecision): OpaInput {
  return { input: { principal: envelope.agent_id, action: envelope.action, resource: envelope.resource,
    context: normalizedPolicyContext(envelope, mandate), oati: { envelope, mandate, ...(decision ? { decision: decision.decision } : {}) } } }
}
export function opaAllowed(response: unknown): boolean { return isObject(response) && response.result === true }

export interface EnvoyCheckRequest { attributes?: { request?: { http?: { method?: string; path?: string; host?: string; headers?: Record<string, string>; body?: string } }; source?: unknown; destination?: unknown; metadataContext?: unknown } }
export interface EnvoyOatiInput { method: string; path: string; host: string; headers: Record<string, string>; source?: unknown; destination?: unknown; metadata?: unknown; envelope: TransactionEnvelope; mandate: AgentMandate; parentMandate?: AgentMandate }

/** Extract OATI authority from an Envoy v3 ext_authz CheckRequest. */
export function fromEnvoyCheckRequest(check: EnvoyCheckRequest): EnvoyOatiInput {
  const http = check.attributes?.request?.http
  if (!http || !http.method || !http.path) throw adapterError("Envoy CheckRequest is missing HTTP attributes")
  const headers = lowerHeaders(http.headers ?? {})
  const envelope = decodeAuthorityHeader(headers[OATI_HTTP_HEADERS.envelope.toLowerCase()], "Envelope") as TransactionEnvelope
  const mandate = decodeAuthorityHeader(headers[OATI_HTTP_HEADERS.mandate.toLowerCase()], "Mandate") as AgentMandate
  const parentValue = headers[OATI_HTTP_HEADERS.parentMandate.toLowerCase()]
  return { method: http.method, path: http.path, host: http.host ?? headers[":authority"] ?? "", headers,
    ...(check.attributes?.source === undefined ? {} : { source: check.attributes.source }),
    ...(check.attributes?.destination === undefined ? {} : { destination: check.attributes.destination }),
    ...(check.attributes?.metadataContext === undefined ? {} : { metadata: check.attributes.metadataContext }), envelope, mandate,
    ...(parentValue ? { parentMandate: decodeAuthorityHeader(parentValue, "Parent Mandate") as AgentMandate } : {}) }
}

export function envoyDecisionHeaders(decision: AuthorisationDecision, receipt?: ActionReceipt): Record<string, string> {
  return { "x-oati-decision": decision.decision, "x-oati-transaction-id": decision.transaction_id,
    "x-oati-reason-codes": (decision.reason_codes ?? []).join(","), ...(receipt ? { "x-oati-receipt-id": receipt.id, "x-oati-receipt": encodeOatiHeader(receipt) } : {}) }
}

function envelope(input: AdapterEnvelopeInput, action: string, resource: string, protocol: "mcp" | "a2a", extensions: Record<string, unknown>): TransactionEnvelope {
  return { oati_version: "1.0", id: input.id, agent_id: input.agentId, organisation_id: input.organisationId,
    mandate_id: input.mandateId, action, resource, purpose: input.purpose, protocol, issued_at: input.issuedAt, nonce: input.nonce, extensions }
}
function adapterHeaders(envelopeValue: TransactionEnvelope, mandate: AgentMandate): Headers { return new Headers({ [OATI_HTTP_HEADERS.envelope]: encodeOatiHeader(envelopeValue), [OATI_HTTP_HEADERS.mandate]: encodeOatiHeader(mandate), [OATI_HTTP_HEADERS.transactionId]: envelopeValue.id }) }
function normalizedPolicyContext(envelopeValue: TransactionEnvelope, mandate: AgentMandate): Record<string, unknown> { return { transaction_id: envelopeValue.id, mandate_id: mandate.id, purpose: envelopeValue.purpose ?? mandate.purpose, counterparty: envelopeValue.counterparty ?? "", destination: envelopeValue.destination ?? "", organisation_id: envelopeValue.organisation_id, mandate_status: mandate.status, mandate_expires_at: mandate.expires_at } }
function decodeAuthorityHeader(value: string | undefined, name: string): unknown { if (!value) throw adapterError(`OATI ${name} header is missing`); try { return JSON.parse(new TextDecoder().decode(fromBase64url(value))) } catch { throw adapterError(`OATI ${name} header is malformed`) } }
function decodeObject(value: string): Record<string, unknown> { const parsed = JSON.parse(new TextDecoder().decode(fromBase64url(value))); if (!isObject(parsed)) throw new Error("not object"); return parsed }
async function digestJson(value: unknown): Promise<string> { return `sha256:${hex(await sha256(new TextEncoder().encode(canonicalJson(value))))}` }
function lowerHeaders(headers: Record<string, string>): Record<string, string> { return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])) }
function adapterError(message: string): OatiError { return new OatiError("ADAPTER_INVALID_INPUT", message) }
function required(value: string, name: string): void { if (!value.trim()) throw adapterError(`${name} is required`) }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
function isHttps(value: string): boolean { try { return new URL(value).protocol === "https:" } catch { return false } }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [] }
function stringOr(value: unknown, fallback: string): string { return typeof value === "string" && value ? value : fallback }
function safeId(value: string): string { return value.replace(/[^A-Za-z0-9._:-]/g, "-") }
async function sha256(value: Uint8Array): Promise<Uint8Array> { return new Uint8Array(await crypto.subtle.digest("SHA-256", value.slice().buffer)) }
function hex(value: Uint8Array): string { return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("") }
function base64url(value: Uint8Array): string { let binary = ""; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") }
function fromBase64url(value: string): Uint8Array { if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url"); const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)); return Uint8Array.from(binary, (character) => character.charCodeAt(0)) }
