import { canonicalJson } from "./canonical.js"
import { OatiError } from "./errors.js"
import type { AgentPassport, Proof } from "./index.js"
import { OatiLookupClient } from "./lookup.js"
import { OatiLookupError } from "./errors.js"

export const OATI_CRYPTO_PROFILE = "https://specs.intelliger.ai/oati/crypto/v1" as const
export const OATI_PROOF_TYPE = "OatiJwsProof2026" as const
export const OATI_SUPPORTED_ALGORITHMS = ["EdDSA", "ES256"] as const
export type OatiAlgorithm = (typeof OATI_SUPPORTED_ALGORITHMS)[number]
export type OatiCryptosuite = "eddsa-jcs-2022" | "ecdsa-jcs-2019"

export interface OatiJwsProof extends Proof {
  type: typeof OATI_PROOF_TYPE
  cryptosuite: OatiCryptosuite
  algorithm: OatiAlgorithm
  created: string
  expires: string
  verification_method: string
  proof_purpose: "assertionMethod"
  audience: string | string[]
  nonce: string
  signature: string
}

export interface SigningOptions {
  algorithm: OatiAlgorithm
  verificationMethod: string
  privateKey: CryptoKey | JsonWebKey
  audience: string | string[]
  nonce: string
  created?: Date | string
  expires: Date | string
}

export interface ExternalSigningOptions extends Omit<SigningOptions, "privateKey"> {
  /** Sign the exact RFC 7797 detached-JWS signing input inside a KMS/HSM boundary. */
  sign(input: Uint8Array, algorithm: OatiAlgorithm, verificationMethod: string): Promise<Uint8Array>
}

export interface VerificationKey {
  id: string
  controller: string
  issuer: string
  algorithm: OatiAlgorithm
  publicKeyJwk: JsonWebKey
  status: "active" | "retired" | "revoked"
  validFrom: string
  validUntil?: string
  revokedAt?: string
  proofStatus?: "verified" | "invalid" | "unavailable" | "unknown"
}

export interface TrustedIssuer {
  id: string
  parent?: string
  status: "active" | "suspended" | "revoked"
  validFrom?: string
  validUntil?: string
  revokedAt?: string
  proofStatus?: "verified" | "invalid" | "unavailable" | "unknown"
}

export interface RevocationStatus {
  target: string
  status: "good" | "suspended" | "revoked"
  effectiveAt?: string
}

export interface TrustResolver {
  resolveKey(id: string): Promise<VerificationKey | null>
  resolveIssuer(id: string): Promise<TrustedIssuer | null>
  resolveRevocation(target: string): Promise<RevocationStatus | null>
}

export interface ReplayCache {
  /** Atomically return false when the key was already present and unexpired. */
  checkAndStore(key: string, expiresAt: Date, now?: Date): boolean | Promise<boolean>
}

export interface VerificationPolicy {
  resolver: TrustResolver
  trustAnchors: readonly string[]
  expectedAudience: string
  replayCache: ReplayCache
  now?: Date
  allowedAlgorithms?: readonly OatiAlgorithm[]
  clockSkewMs?: number
  maxProofAgeMs?: number
  maxTrustDepth?: number
}

export type VerificationCode =
  | "PROOF_MISSING" | "PROOF_MALFORMED" | "ALGORITHM_NOT_ALLOWED" | "SIGNATURE_INVALID"
  | "KEY_NOT_FOUND" | "KEY_INVALID" | "KEY_REVOKED" | "ISSUER_NOT_TRUSTED" | "ISSUER_REVOKED"
  | "DOCUMENT_REVOKED" | "REVOCATION_UNAVAILABLE" | "PROOF_NOT_YET_VALID" | "PROOF_EXPIRED" | "PROOF_TOO_OLD"
  | "DOCUMENT_NOT_YET_VALID" | "DOCUMENT_EXPIRED" | "AUDIENCE_MISMATCH" | "REPLAY_DETECTED"

export interface VerificationIssue {
  code: VerificationCode
  message: string
}

export interface VerificationResult {
  verified: boolean
  algorithm?: OatiAlgorithm
  verificationMethod?: string
  issuer?: string
  issues: VerificationIssue[]
}

/** Sign an OATI object using an RFC 7797 detached JWS over its canonical JSON form. */
export async function signDocument<T extends Record<string, unknown>>(document: T, options: SigningOptions): Promise<T & { proof: OatiJwsProof }> {
  return signPreparedDocument(document, options, async (input) => {
    const key = await importSigningKey(options.privateKey, options.algorithm)
    return new Uint8Array(await cryptoProvider().subtle.sign(webCryptoAlgorithm(options.algorithm), key, toArrayBuffer(input)))
  })
}

/** Sign through a caller-supplied KMS/HSM operation without importing private key material. */
export async function signDocumentWithSigner<T extends Record<string, unknown>>(document: T, options: ExternalSigningOptions): Promise<T & { proof: OatiJwsProof }> {
  return signPreparedDocument(document, options, (input) => options.sign(input, options.algorithm, options.verificationMethod))
}

async function signPreparedDocument<T extends Record<string, unknown>>(
  document: T,
  options: Omit<SigningOptions, "privateKey">,
  signer: (input: Uint8Array) => Promise<Uint8Array>,
): Promise<T & { proof: OatiJwsProof }> {
  if (!OATI_SUPPORTED_ALGORITHMS.includes(options.algorithm)) throw new RangeError(`Unsupported algorithm ${options.algorithm}`)
  if (options.verificationMethod.trim() === "") throw new TypeError("verificationMethod is required")
  if (options.nonce.length < 16) throw new TypeError("nonce must contain at least 16 characters")
  const audiences = normalizeAudience(options.audience)
  if (audiences.length === 0) throw new TypeError("audience is required")
  const created = instant(options.created ?? new Date(), "created")
  const expires = instant(options.expires, "expires")
  if (expires <= created) throw new RangeError("expires must be after created")
  const proofWithoutSignature = {
    type: OATI_PROOF_TYPE,
    cryptosuite: suite(options.algorithm),
    algorithm: options.algorithm,
    created: created.toISOString(),
    expires: expires.toISOString(),
    verification_method: options.verificationMethod,
    proof_purpose: "assertionMethod" as const,
    audience: options.audience,
    nonce: options.nonce,
  }
  const unsigned = { ...document, proof: proofWithoutSignature }
  const protectedHeader = base64url(encoder.encode(canonicalJson({ alg: options.algorithm, b64: false, crit: ["b64"], kid: options.verificationMethod, typ: "oati+jws" })))
  const signingInput = joinSigningInput(protectedHeader, encoder.encode(canonicalJson(unsigned)))
  const signature = await signer(signingInput)
  if (!(signature instanceof Uint8Array) || signature.byteLength !== 64) throw new TypeError(`${options.algorithm} signer must return a 64-byte JWS signature`)
  return { ...unsigned, proof: { ...proofWithoutSignature, signature: `${protectedHeader}..${base64url(signature)}` } }
}

/** Verify signature, trust chain, key lifecycle, revocation, time, audience, and replay in one operation. */
export async function verifyDocument(document: Record<string, unknown>, policy: VerificationPolicy): Promise<VerificationResult> {
  const issues: VerificationIssue[] = []
  const proof = parseProof(document.proof, issues)
  if (!proof) return { verified: false, issues }
  const now = policy.now ?? new Date()
  const skew = policy.clockSkewMs ?? 30_000
  const allowed = policy.allowedAlgorithms ?? OATI_SUPPORTED_ALGORITHMS
  if (!allowed.includes(proof.algorithm)) issue(issues, "ALGORITHM_NOT_ALLOWED", `${proof.algorithm} is not allowed`)
  checkProofTime(proof, now, skew, policy.maxProofAgeMs ?? 300_000, issues)
  checkDocumentTime(document, now, skew, issues)
  if (!normalizeAudience(proof.audience).includes(policy.expectedAudience)) issue(issues, "AUDIENCE_MISMATCH", `proof is not addressed to ${policy.expectedAudience}`)

  let key: VerificationKey | null
  try { key = await policy.resolver.resolveKey(proof.verification_method) } catch {
    issue(issues, "KEY_NOT_FOUND", `verification key ${proof.verification_method} could not be resolved`)
    return result(proof, undefined, issues)
  }
  if (!key) {
    issue(issues, "KEY_NOT_FOUND", `verification key ${proof.verification_method} was not found`)
    return result(proof, undefined, issues)
  }
  checkKey(key, proof, now, skew, issues)
  const issuer = await validateTrustChain(key.issuer, policy, now, skew, issues)
  await checkRevocation(policy.resolver, [key.id, key.issuer, documentId(document)], now, issues)
  checkSignerBinding(document, key, issues)

  if (!issues.some((entry) => entry.code === "PROOF_MALFORMED" || entry.code === "ALGORITHM_NOT_ALLOWED")) {
    try {
      const [protectedHeader, empty, encodedSignature] = proof.signature.split(".")
      if (!protectedHeader || empty !== "" || !encodedSignature) throw new Error("invalid detached JWS")
      const header = JSON.parse(decoder.decode(fromBase64url(protectedHeader))) as Record<string, unknown>
      if (header.alg !== proof.algorithm || header.kid !== proof.verification_method || header.b64 !== false || header.typ !== "oati+jws"
        || !Array.isArray(header.crit) || !header.crit.includes("b64")) throw new Error("protected header does not match proof")
      const unsigned = { ...document, proof: withoutSignature(proof) }
      const input = joinSigningInput(protectedHeader, encoder.encode(canonicalJson(unsigned)))
      const publicKey = await cryptoProvider().subtle.importKey("jwk", key.publicKeyJwk, webCryptoImportAlgorithm(proof.algorithm), false, ["verify"])
      const valid = await cryptoProvider().subtle.verify(webCryptoAlgorithm(proof.algorithm), publicKey, toArrayBuffer(fromBase64url(encodedSignature)), toArrayBuffer(input))
      if (!valid) issue(issues, "SIGNATURE_INVALID", "detached JWS signature is invalid")
    } catch (error) {
      issue(issues, "SIGNATURE_INVALID", error instanceof Error ? error.message : "signature verification failed")
    }
  }

  if (issues.length === 0) {
    const replayKey = `${proof.verification_method}\u0000${policy.expectedAudience}\u0000${proof.nonce}`
    if (!await policy.replayCache.checkAndStore(replayKey, new Date(proof.expires), now)) issue(issues, "REPLAY_DETECTED", "proof nonce has already been accepted")
  }
  return result(proof, issuer, issues)
}

export class MemoryReplayCache implements ReplayCache {
  private readonly entries = new Map<string, number>()
  checkAndStore(key: string, expiresAt: Date, verificationTime = new Date()): boolean {
    const now = verificationTime.getTime()
    const existing = this.entries.get(key)
    if (existing !== undefined && existing > now) return false
    this.entries.set(key, expiresAt.getTime())
    if (this.entries.size > 10_000) for (const [candidate, expiry] of this.entries) if (expiry <= now) this.entries.delete(candidate)
    return true
  }
}

export class StaticTrustResolver implements TrustResolver {
  constructor(
    private readonly keys: readonly VerificationKey[],
    private readonly issuers: readonly TrustedIssuer[],
    private readonly revocations: readonly RevocationStatus[] = [],
  ) {}
  async resolveKey(id: string): Promise<VerificationKey | null> { return this.keys.find((item) => item.id === id) ?? null }
  async resolveIssuer(id: string): Promise<TrustedIssuer | null> { return this.issuers.find((item) => item.id === id) ?? null }
  async resolveRevocation(target: string): Promise<RevocationStatus | null> {
    const matches = this.revocations.filter((item) => item.target === target)
    if (matches.length > 1) throw new Error(`ambiguous revocation status for ${target}`)
    return matches[0] ?? null
  }
}

/** Resolve key, issuer, and revocation records through the public OATI lookup API. */
export class LookupTrustResolver implements TrustResolver {
  constructor(private readonly lookup: OatiLookupClient) {}
  async resolveKey(id: string): Promise<VerificationKey | null> {
    try {
      const record = await this.lookup.lookup("key", id)
      const attributes = record.public_attributes
      return {
        id: record.id, controller: required(attributes, "controller"), issuer: record.issuer,
        algorithm: required(attributes, "algorithm") as OatiAlgorithm,
        publicKeyJwk: JSON.parse(required(attributes, "public_key_jwk")) as JsonWebKey,
        status: record.status as VerificationKey["status"], validFrom: record.issued_at, validUntil: record.expires_at,
        ...(attributes.revoked_at ? { revokedAt: attributes.revoked_at } : {}), proofStatus: record.proof_status,
      }
    } catch (error) { if (error instanceof OatiLookupError && error.code === "LOOKUP_NOT_FOUND") return null; throw error }
  }
  async resolveIssuer(id: string): Promise<TrustedIssuer | null> {
    try {
      const record = await this.lookup.lookup("issuer", id)
      return {
        id: record.id, status: record.status as TrustedIssuer["status"],
        ...(record.public_attributes.parent ? { parent: record.public_attributes.parent } : {}),
        ...(record.issued_at ? { validFrom: record.issued_at } : {}), ...(record.expires_at ? { validUntil: record.expires_at } : {}),
        ...(record.public_attributes.revoked_at ? { revokedAt: record.public_attributes.revoked_at } : {}), proofStatus: record.proof_status,
      }
    } catch (error) { if (error instanceof OatiLookupError && error.code === "LOOKUP_NOT_FOUND") return null; throw error }
  }
  async resolveRevocation(target: string): Promise<RevocationStatus | null> {
    try {
      const record = await this.lookup.lookupRevocationByTarget(target)
      return { target, status: required(record.public_attributes, "revocation_status") as RevocationStatus["status"], ...(record.public_attributes.effective_at ? { effectiveAt: record.public_attributes.effective_at } : {}) }
    } catch (error) { if (error instanceof OatiLookupError && error.code === "LOOKUP_NOT_FOUND") return null; throw error }
  }
}

/** Build a resolver for keys embedded in a Passport, optionally chained to issuer metadata. */
export function passportTrustResolver(passport: AgentPassport, upstream?: TrustResolver): TrustResolver {
  const keys: VerificationKey[] = passport.verification_methods.map((method) => ({
    id: method.id, controller: method.controller, issuer: passport.issuer, algorithm: algorithmFromJwk(method.public_key_jwk),
    publicKeyJwk: method.public_key_jwk, status: passport.status === "active" ? "active" : "revoked",
    validFrom: passport.issued_at, validUntil: passport.expires_at, proofStatus: "verified",
  }))
  return {
    resolveKey: async (id) => keys.find((item) => item.id === id) ?? upstream?.resolveKey(id) ?? null,
    resolveIssuer: async (id) => upstream?.resolveIssuer(id) ?? null,
    resolveRevocation: async (target) => upstream?.resolveRevocation(target) ?? null,
  }
}

function parseProof(value: unknown, issues: VerificationIssue[]): OatiJwsProof | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) { issue(issues, "PROOF_MISSING", "OATI proof is required"); return null }
  const proof = value as Partial<OatiJwsProof>
  if (proof.type !== OATI_PROOF_TYPE || !OATI_SUPPORTED_ALGORITHMS.includes(proof.algorithm as OatiAlgorithm)
    || proof.cryptosuite !== suite(proof.algorithm as OatiAlgorithm) || typeof proof.created !== "string" || typeof proof.expires !== "string"
    || typeof proof.verification_method !== "string" || proof.proof_purpose !== "assertionMethod"
    || (typeof proof.audience !== "string" && !Array.isArray(proof.audience)) || typeof proof.nonce !== "string" || proof.nonce.length < 16
    || typeof proof.signature !== "string") {
    issue(issues, "PROOF_MALFORMED", "proof does not conform to the OATI JWS profile"); return null
  }
  return proof as OatiJwsProof
}

function checkProofTime(proof: OatiJwsProof, now: Date, skew: number, maxAge: number, issues: VerificationIssue[]): void {
  const created = Date.parse(proof.created), expires = Date.parse(proof.expires)
  if (Number.isNaN(created) || Number.isNaN(expires) || expires <= created) { issue(issues, "PROOF_MALFORMED", "proof timestamps are invalid"); return }
  if (created > now.getTime() + skew) issue(issues, "PROOF_NOT_YET_VALID", "proof creation time is in the future")
  if (expires <= now.getTime() - skew) issue(issues, "PROOF_EXPIRED", "proof has expired")
  if (now.getTime() - created > maxAge + skew) issue(issues, "PROOF_TOO_OLD", "proof exceeds the maximum accepted age")
}

function checkDocumentTime(document: Record<string, unknown>, now: Date, skew: number, issues: VerificationIssue[]): void {
  const start = typeof document.not_before === "string" ? Date.parse(document.not_before) : typeof document.issued_at === "string" ? Date.parse(document.issued_at) : undefined
  const end = typeof document.expires_at === "string" ? Date.parse(document.expires_at) : undefined
  if (start !== undefined && (Number.isNaN(start) || start > now.getTime() + skew)) issue(issues, "DOCUMENT_NOT_YET_VALID", "document is not active yet")
  if (end !== undefined && (Number.isNaN(end) || end <= now.getTime() - skew)) issue(issues, "DOCUMENT_EXPIRED", "document has expired")
}

function checkKey(key: VerificationKey, proof: OatiJwsProof, now: Date, skew: number, issues: VerificationIssue[]): void {
  if (key.algorithm !== proof.algorithm || key.id !== proof.verification_method || key.proofStatus && key.proofStatus !== "verified" || !jwkMatches(key.publicKeyJwk, proof.algorithm)) issue(issues, "KEY_INVALID", "resolved key metadata does not match the proof")
  if (key.status !== "active" && key.status !== "retired" && key.status !== "revoked") issue(issues, "KEY_INVALID", "verification key has an unsupported status")
  if (key.status === "retired" && !key.validUntil) issue(issues, "KEY_INVALID", "retired verification keys require validUntil")
  const created = Date.parse(proof.created), from = Date.parse(key.validFrom), until = key.validUntil ? Date.parse(key.validUntil) : undefined
  if (Number.isNaN(from) || created < from - skew || until !== undefined && (Number.isNaN(until) || created >= until + skew)) issue(issues, "KEY_INVALID", "key was not valid when the proof was created")
  if (key.status === "revoked" || key.revokedAt && Date.parse(key.revokedAt) <= now.getTime()) issue(issues, "KEY_REVOKED", "verification key is revoked")
}

async function validateTrustChain(start: string, policy: VerificationPolicy, now: Date, skew: number, issues: VerificationIssue[]): Promise<string | undefined> {
  const anchors = new Set(policy.trustAnchors), visited = new Set<string>()
  let current = start
  for (let depth = 0; depth <= (policy.maxTrustDepth ?? 8); depth++) {
    if (anchors.has(current)) return current
    if (visited.has(current)) break
    visited.add(current)
    let issuer: TrustedIssuer | null
    try { issuer = await policy.resolver.resolveIssuer(current) } catch { issue(issues, "ISSUER_NOT_TRUSTED", `issuer ${current} could not be resolved`); return undefined }
    if (!issuer || issuer.proofStatus && issuer.proofStatus !== "verified") break
    if (issuer.status !== "active" || issuer.revokedAt && Date.parse(issuer.revokedAt) <= now.getTime()) { issue(issues, "ISSUER_REVOKED", `issuer ${current} is not active`); return undefined }
    if (issuer.validFrom && Date.parse(issuer.validFrom) > now.getTime() + skew || issuer.validUntil && Date.parse(issuer.validUntil) <= now.getTime() - skew) { issue(issues, "ISSUER_REVOKED", `issuer ${current} is outside its validity period`); return undefined }
    if (!issuer.parent) break
    current = issuer.parent
  }
  issue(issues, "ISSUER_NOT_TRUSTED", `issuer chain from ${start} does not reach a configured trust anchor`)
  return undefined
}

async function checkRevocation(resolver: TrustResolver, targets: string[], now: Date, issues: VerificationIssue[]): Promise<void> {
  for (const [index, target] of targets.entries()) {
    if (!target) continue
    let status: RevocationStatus | null
    try { status = await resolver.resolveRevocation(target) } catch { issue(issues, "REVOCATION_UNAVAILABLE", `revocation status for ${target} is unavailable`); continue }
    if (status && status.status !== "good" && (!status.effectiveAt || Date.parse(status.effectiveAt) <= now.getTime())) {
      issue(issues, index === 0 ? "KEY_REVOKED" : index === 1 ? "ISSUER_REVOKED" : "DOCUMENT_REVOKED", `${target} is ${status.status}`)
    }
  }
}

function checkSignerBinding(document: Record<string, unknown>, key: VerificationKey, issues: VerificationIssue[]): void {
  const claimed = typeof document.issuer === "string" ? document.issuer : typeof document.agent_id === "string" ? document.agent_id : undefined
  if (claimed && claimed !== key.controller && claimed !== key.issuer) issue(issues, "KEY_INVALID", `key controller ${key.controller} is not bound to document signer ${claimed}`)
}

function withoutSignature(proof: OatiJwsProof): Omit<OatiJwsProof, "signature"> {
  const { signature: _signature, ...unsigned } = proof
  return unsigned
}

function result(proof: OatiJwsProof, issuer: string | undefined, issues: VerificationIssue[]): VerificationResult {
  return { verified: issues.length === 0, algorithm: proof.algorithm, verificationMethod: proof.verification_method, ...(issuer ? { issuer } : {}), issues }
}

function suite(algorithm: OatiAlgorithm): OatiCryptosuite { return algorithm === "EdDSA" ? "eddsa-jcs-2022" : "ecdsa-jcs-2019" }
function instant(value: Date | string, name: string): Date { const date = value instanceof Date ? value : new Date(value); if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid date`); return date }
function normalizeAudience(value: string | string[]): string[] { return (Array.isArray(value) ? value : [value]).filter((item) => typeof item === "string" && item !== "") }
function issue(issues: VerificationIssue[], code: VerificationCode, message: string): void { if (!issues.some((item) => item.code === code && item.message === message)) issues.push({ code, message }) }
function documentId(document: Record<string, unknown>): string { return typeof document.id === "string" ? document.id : "" }
function required(record: Record<string, string | undefined>, key: string): string { const value = record[key]; if (!value) throw new Error(`missing ${key}`); return value }
function algorithmFromJwk(jwk: Record<string, unknown>): OatiAlgorithm { if (jwk.kty === "OKP" && jwk.crv === "Ed25519") return "EdDSA"; if (jwk.kty === "EC" && jwk.crv === "P-256") return "ES256"; throw new Error("unsupported Passport JWK") }
function jwkMatches(jwk: JsonWebKey, algorithm: OatiAlgorithm): boolean { return algorithm === "EdDSA" ? jwk.kty === "OKP" && jwk.crv === "Ed25519" : jwk.kty === "EC" && jwk.crv === "P-256" }
function webCryptoImportAlgorithm(algorithm: OatiAlgorithm): EcKeyImportParams | AlgorithmIdentifier { return algorithm === "EdDSA" ? { name: "Ed25519" } : { name: "ECDSA", namedCurve: "P-256" } }
function webCryptoAlgorithm(algorithm: OatiAlgorithm): AlgorithmIdentifier | EcdsaParams { return algorithm === "EdDSA" ? { name: "Ed25519" } : { name: "ECDSA", hash: "SHA-256" } }
async function importSigningKey(key: CryptoKey | JsonWebKey, algorithm: OatiAlgorithm): Promise<CryptoKey> { return isCryptoKey(key) ? key : cryptoProvider().subtle.importKey("jwk", key, webCryptoImportAlgorithm(algorithm), false, ["sign"]) }
function isCryptoKey(value: CryptoKey | JsonWebKey): value is CryptoKey { return typeof value === "object" && value !== null && "type" in value && "algorithm" in value && "usages" in value }
function cryptoProvider(): Crypto { if (!globalThis.crypto?.subtle) throw new OatiError("CRYPTO_UNAVAILABLE", "Web Crypto API is required"); return globalThis.crypto }
const encoder = new TextEncoder(), decoder = new TextDecoder()
function joinSigningInput(protectedHeader: string, payload: Uint8Array): Uint8Array { const prefix = encoder.encode(`${protectedHeader}.`); const joined = new Uint8Array(prefix.length + payload.length); joined.set(prefix); joined.set(payload, prefix.length); return joined }
function base64url(value: Uint8Array): string { let binary = ""; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") }
function fromBase64url(value: string): Uint8Array { if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url"); const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4); const binary = atob(padded); return Uint8Array.from(binary, (character) => character.charCodeAt(0)) }
function toArrayBuffer(value: Uint8Array): ArrayBuffer { return value.slice().buffer as ArrayBuffer }
