import { canonicalJson } from "./canonical.js"
import type { VerificationPolicy, VerificationResult } from "./crypto.js"
import { verifyDocument } from "./crypto.js"
import { OatiError } from "./errors.js"
import type { EvaluationRequest, EvaluationResult, UsageSnapshot } from "./evaluator.js"
import { evaluateAuthority } from "./evaluator.js"
import type { ActionReceipt, AgentMandate, TransactionEnvelope } from "./index.js"
import { assertSchema } from "./validation.js"

export const OATI_HTTP_HEADERS = Object.freeze({
  envelope: "OATI-Envelope",
  mandate: "OATI-Mandate",
  parentMandate: "OATI-Parent-Mandate",
  transactionId: "OATI-Transaction-ID",
  correlationId: "OATI-Correlation-ID",
  receipt: "OATI-Receipt",
  receiptId: "OATI-Receipt-ID",
} as const)

export type OatiDocumentKind = "envelope" | "mandate" | "parent_mandate"
export type ReceiptDraft = Omit<ActionReceipt, "oati_version" | "proof">

export interface ExtractedOatiRequest {
  envelope: TransactionEnvelope
  mandate: AgentMandate
  parentMandate?: AgentMandate
}

export interface OatiUsageStore {
  /** Load the latest usage snapshot. */
  load(mandateId: string): Promise<UsageSnapshot>
  /** Atomically replace `previous` with `next`; false indicates a concurrent update. */
  compareAndSet(mandateId: string, previous: UsageSnapshot, next: UsageSnapshot): Promise<boolean>
}

export interface OatiEvaluationExtensions {
  delegation_depth?: number
  consumption?: EvaluationRequest["consumption"]
  commerce?: EvaluationRequest["commerce"]
  rwa?: EvaluationRequest["rwa"]
}

export interface OatiMiddlewareOptions {
  /** Policy factory. Envelope policies must use a shared replay cache. */
  verificationPolicy(kind: OatiDocumentKind, request: Request): VerificationPolicy | Promise<VerificationPolicy>
  receiptIssuer: string
  /** Sign and return a schema-valid receipt. No unsigned fallback is permitted. */
  signReceipt(draft: ReceiptDraft, context: OatiMiddlewareContext): Promise<ActionReceipt>
  usageStore?: OatiUsageStore
  evaluationExtensions?(request: Request, extracted: ExtractedOatiRequest): OatiEvaluationExtensions | Promise<OatiEvaluationExtensions>
  extract?(request: Request): ExtractedOatiRequest | Promise<ExtractedOatiRequest>
  emitReceipt?(receipt: ActionReceipt, context: OatiMiddlewareContext): void | Promise<void>
  now?: () => Date
  generateCorrelationId?: () => string
  generateReceiptId?: (transactionId: string) => string
  policyDigest?: string
  maxHeaderBytes?: number
  /** Require Envelope.request_digest to bind method, target, and body. Defaults to true. */
  requireRequestDigest?: boolean
  maxBodyBytes?: number
}

export interface OatiMiddlewareContext {
  request: Request
  envelope: TransactionEnvelope
  mandate: AgentMandate
  parentMandate?: AgentMandate
  correlationId: string
  transactionId: string
  envelopeVerification: VerificationResult
  mandateVerification: VerificationResult
  parentMandateVerification?: VerificationResult
  evaluation: EvaluationResult
}

export type OatiRequestHandler = (request: Request, context: OatiMiddlewareContext) => Response | Promise<Response>
export type OatiMiddleware = (request: Request, next: OatiRequestHandler) => Promise<Response>

/** Create fail-closed Web Fetch API middleware for an OATI-protected HTTP endpoint. */
export function createOatiMiddleware(options: OatiMiddlewareOptions): OatiMiddleware {
  if (!options.receiptIssuer.trim()) throw new TypeError("receiptIssuer is required")
  const now = options.now ?? (() => new Date())
  const extract = options.extract ?? ((request: Request) => extractOatiHeaders(request, options.maxHeaderBytes))
  return async (request, next) => {
    let extracted: ExtractedOatiRequest
    let correlationId: string
    try {
      correlationId = correlation(request.headers.get(OATI_HTTP_HEADERS.correlationId), options.generateCorrelationId)
      extracted = await extract(request)
      assertSchema<AgentMandate>("mandate", extracted.mandate)
      assertSchema<TransactionEnvelope>("envelope", extracted.envelope)
      if (extracted.parentMandate) assertSchema<AgentMandate>("mandate", extracted.parentMandate)
      const declaredTransaction = request.headers.get(OATI_HTTP_HEADERS.transactionId)
      if (declaredTransaction && declaredTransaction !== extracted.envelope.id) throw middlewareError("MIDDLEWARE_BAD_REQUEST", "Transaction header does not match the Envelope")
    } catch (error) {
      const safeError = isMiddlewareError(error) ? error : middlewareError("MIDDLEWARE_BAD_REQUEST", "OATI headers or objects are invalid")
      return problem(safeError, 400, "Invalid OATI request")
    }

    const transactionId = extracted.envelope.id
    try {
      const mandatePolicy = reusableDocumentPolicy(await options.verificationPolicy("mandate", request))
      const mandateVerification = await verifyDocument(extracted.mandate as unknown as Record<string, unknown>, mandatePolicy)
      if (!mandateVerification.verified) return await deniedVerification(options, request, extracted, correlationId, mandateVerification, "mandate", now())

      let parentMandateVerification: VerificationResult | undefined
      if (extracted.parentMandate) {
        const parentPolicy = reusableDocumentPolicy(await options.verificationPolicy("parent_mandate", request))
        parentMandateVerification = await verifyDocument(extracted.parentMandate as unknown as Record<string, unknown>, parentPolicy)
        if (!parentMandateVerification.verified) return await deniedVerification(options, request, extracted, correlationId, parentMandateVerification, "parent_mandate", now(), mandateVerification)
      }

      const envelopePolicy = await options.verificationPolicy("envelope", request)
      const envelopeVerification = await verifyDocument(extracted.envelope as unknown as Record<string, unknown>, envelopePolicy)
      if (!envelopeVerification.verified) return await deniedVerification(options, request, extracted, correlationId, envelopeVerification, "envelope", now(), mandateVerification, parentMandateVerification)

      if (options.requireRequestDigest !== false) {
        const expected = extracted.envelope.request_digest
        const actual = await httpRequestDigest(request, options.maxBodyBytes)
        if (!expected || expected !== actual) {
          const bindingEvaluation = deniedEvaluation(extracted, [expected ? "HTTP_REQUEST_DIGEST_MISMATCH" : "HTTP_REQUEST_DIGEST_REQUIRED"])
          const bindingContext = middlewareContext(request, extracted, correlationId, envelopeVerification, mandateVerification, parentMandateVerification, bindingEvaluation)
          return await receiptResponse(options, bindingContext, "denied", 401, now(), "MIDDLEWARE_UNAUTHENTICATED")
        }
      }

      const suppliedExtensions = await options.evaluationExtensions?.(request, extracted) ?? {}
      const extensions = compactExtensions(suppliedExtensions)
      const previousUsage = options.usageStore ? await options.usageStore.load(extracted.mandate.id) : {}
      if (!options.usageStore && requiresPersistentUsage(extracted.mandate)) {
        const unavailable = deniedEvaluation(extracted, ["USAGE_STORE_REQUIRED"])
        const unavailableContext = middlewareContext(request, extracted, correlationId, envelopeVerification, mandateVerification, parentMandateVerification, unavailable)
        return await receiptResponse(options, unavailableContext, "denied", 503, now(), "MIDDLEWARE_UNAVAILABLE")
      }
      const evaluationRequest: EvaluationRequest = {
        oati_version: "1.0", evaluation_time: now().toISOString(), mandate: extracted.mandate,
        ...(extracted.parentMandate ? { parent_mandate: extracted.parentMandate } : {}),
        envelope: extracted.envelope, usage: previousUsage,
        ...(extensions.delegation_depth === undefined ? {} : { delegation_depth: extensions.delegation_depth }),
        ...(extensions.consumption === undefined ? {} : { consumption: extensions.consumption }),
        ...(extensions.commerce === undefined ? {} : { commerce: extensions.commerce }),
        ...(extensions.rwa === undefined ? {} : { rwa: extensions.rwa }),
      }
      const evaluation = evaluateAuthority(evaluationRequest)
      const context = middlewareContext(request, extracted, correlationId, envelopeVerification, mandateVerification, parentMandateVerification, evaluation)
      if (evaluation.decision !== "allow") return await receiptResponse(options, context, "denied", 403, now())
      if (options.usageStore && !await options.usageStore.compareAndSet(extracted.mandate.id, previousUsage, evaluation.next_usage)) {
        const conflict = { ...context, evaluation: deniedEvaluation(extracted, ["USAGE_CONFLICT"]) }
        return await receiptResponse(options, conflict, "denied", 409, now(), "MIDDLEWARE_USAGE_CONFLICT")
      }

      let downstream: Response
      try { downstream = await next(request, context) }
      catch { return await receiptResponse(options, context, "failed", 500, now()) }
      const outcome: ActionReceipt["outcome"] = downstream.status < 400 ? "succeeded" : downstream.status === 403 ? "denied" : "failed"
      return attachReceipt(downstream, await issueReceipt(options, context, outcome, now()), context)
    } catch (error) {
      const code = error instanceof OatiError && error.code === "MIDDLEWARE_REPLAY" ? 401 : 503
      const safeError = isMiddlewareError(error) ? error : middlewareError("MIDDLEWARE_UNAVAILABLE", "A middleware dependency failed")
      return problem(safeError, code, code === 401 ? "Replay rejected" : "OATI middleware unavailable", correlationId, transactionId)
    }
  }
}

/** Wrap a Web Fetch API handler with OATI middleware. */
export function withOati(handler: OatiRequestHandler, options: OatiMiddlewareOptions): (request: Request) => Promise<Response> {
  const middleware = createOatiMiddleware(options)
  return (request) => middleware(request, handler)
}

/** Encode a document for an OATI HTTP header. */
export function encodeOatiHeader(value: unknown): string {
  return base64url(new TextEncoder().encode(canonicalJson(value)))
}

/** Compute the OATI HTTP binding digest over method, path/query target, and raw body bytes. */
export async function httpRequestDigest(request: Request, maxBodyBytes = 1_048_576): Promise<string> {
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 0) throw new RangeError("maxBodyBytes must be a non-negative integer")
  const body = new Uint8Array(await request.clone().arrayBuffer())
  if (body.byteLength > maxBodyBytes) throw middlewareError("MIDDLEWARE_BAD_REQUEST", "HTTP request body exceeds the verification limit")
  const bodyHash = await sha256(body)
  const url = new URL(request.url)
  const binding = canonicalJson({ method: request.method.toUpperCase(), target: `${url.pathname}${url.search}`, body_sha256: `sha256:${hex(bodyHash)}` })
  return `sha256:${hex(await sha256(new TextEncoder().encode(binding)))}`
}

/** Default strict extraction contract for OATI-Envelope and OATI-Mandate headers. */
export function extractOatiHeaders(request: Request, maxHeaderBytes = 65_536): ExtractedOatiRequest {
  const envelope = decodeHeader(request.headers.get(OATI_HTTP_HEADERS.envelope), OATI_HTTP_HEADERS.envelope, maxHeaderBytes) as TransactionEnvelope
  const mandate = decodeHeader(request.headers.get(OATI_HTTP_HEADERS.mandate), OATI_HTTP_HEADERS.mandate, maxHeaderBytes) as AgentMandate
  const parent = request.headers.get(OATI_HTTP_HEADERS.parentMandate)
  return { envelope, mandate, ...(parent ? { parentMandate: decodeHeader(parent, OATI_HTTP_HEADERS.parentMandate, maxHeaderBytes) as AgentMandate } : {}) }
}

async function deniedVerification(options: OatiMiddlewareOptions, request: Request, extracted: ExtractedOatiRequest, correlationId: string, verification: VerificationResult, kind: OatiDocumentKind, at: Date, knownMandate?: VerificationResult, knownParent?: VerificationResult): Promise<Response> {
  const replay = verification.issues.some((issue) => issue.code === "REPLAY_DETECTED")
  const evaluation = deniedEvaluation(extracted, verification.issues.map((issue) => `${kind.toUpperCase()}_${issue.code}`))
  const context = middlewareContext(request, extracted, correlationId,
    kind === "envelope" ? verification : failedVerification("ENVELOPE_NOT_VERIFIED"),
    kind === "mandate" ? verification : knownMandate ?? failedVerification("MANDATE_NOT_VERIFIED"),
    kind === "parent_mandate" ? verification : knownParent, evaluation)
  try { return await receiptResponse(options, context, "denied", 401, at, replay ? "MIDDLEWARE_REPLAY" : "MIDDLEWARE_UNAUTHENTICATED") }
  catch { return problem(middlewareError("MIDDLEWARE_UNAVAILABLE", "Receipt generation failed"), 503, "Receipt generation unavailable", correlationId, extracted.envelope.id) }
}

async function receiptResponse(options: OatiMiddlewareOptions, context: OatiMiddlewareContext, outcome: ActionReceipt["outcome"], status: number, at: Date, code: "MIDDLEWARE_REPLAY" | "MIDDLEWARE_UNAUTHENTICATED" | "MIDDLEWARE_FORBIDDEN" | "MIDDLEWARE_USAGE_CONFLICT" | "MIDDLEWARE_UNAVAILABLE" = "MIDDLEWARE_FORBIDDEN"): Promise<Response> {
  const receipt = await issueReceipt(options, context, outcome, at)
  const title = status === 401 ? "OATI authentication failed" : status === 409 ? "OATI usage conflict" : status === 503 ? "OATI authority unavailable" : "OATI authority denied"
  const response = Response.json({ type: "https://specs.intelliger.ai/oati/problems/authorization", title, status, code, reason_codes: context.evaluation.reason_codes, receipt }, { status, headers: { "Content-Type": "application/problem+json" } })
  return attachReceipt(response, receipt, context)
}

async function issueReceipt(options: OatiMiddlewareOptions, context: OatiMiddlewareContext, outcome: ActionReceipt["outcome"], at: Date): Promise<ActionReceipt> {
  const draft: ReceiptDraft = {
    id: (options.generateReceiptId?.(context.transactionId) ?? `oati:receipt:${safeUuid()}`) as `oati:receipt:${string}`,
    transaction_id: context.transactionId, agent_id: context.envelope.agent_id, organisation_id: context.envelope.organisation_id,
    mandate_id: context.mandate.id, decision: context.evaluation.decision, outcome, occurred_at: at.toISOString(),
    issuer: options.receiptIssuer, policy_digest: options.policyDigest ?? "sha256:oati-reference-evaluator-v1",
    ...(context.envelope.request_digest ? { request_digest: context.envelope.request_digest } : {}),
    ...(context.envelope.commercial_profile ? { commercial_profile: context.envelope.commercial_profile } : {}),
    extensions: { correlation_id: context.correlationId, reason_codes: context.evaluation.reason_codes },
  }
  const receipt = await options.signReceipt(draft, context)
  assertSchema<ActionReceipt>("receipt", receipt)
  await options.emitReceipt?.(receipt, context)
  return receipt
}

function attachReceipt(response: Response, receipt: ActionReceipt, context: OatiMiddlewareContext): Response {
  const headers = new Headers(response.headers)
  headers.set(OATI_HTTP_HEADERS.transactionId, context.transactionId)
  headers.set(OATI_HTTP_HEADERS.correlationId, context.correlationId)
  const encoded = encodeOatiHeader(receipt)
  if (encoded.length <= 8_192) headers.set(OATI_HTTP_HEADERS.receipt, encoded)
  headers.set(OATI_HTTP_HEADERS.receiptId, receipt.id)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function problem(error: unknown, status: number, title: string, correlationId?: string, transactionId?: string): Response {
  const code = error instanceof OatiError ? error.code : "MIDDLEWARE_BAD_REQUEST"
  const headers = new Headers({ "Content-Type": "application/problem+json" })
  if (correlationId) headers.set(OATI_HTTP_HEADERS.correlationId, correlationId)
  if (transactionId) headers.set(OATI_HTTP_HEADERS.transactionId, transactionId)
  return new Response(JSON.stringify({ type: "https://specs.intelliger.ai/oati/problems/middleware", title, status, code }), { status, headers })
}

function deniedEvaluation(extracted: ExtractedOatiRequest, reasonCodes: string[]): EvaluationResult {
  return { oati_version: "1.0", decision: "deny", mandate_id: extracted.mandate.id, transaction_id: extracted.envelope.id, reason_codes: [...new Set(reasonCodes)].sort(), next_usage: {} }
}
function middlewareContext(request: Request, extracted: ExtractedOatiRequest, correlationId: string, envelopeVerification: VerificationResult, mandateVerification: VerificationResult, parentMandateVerification: VerificationResult | undefined, evaluation: EvaluationResult): OatiMiddlewareContext {
  return {
    request, envelope: extracted.envelope, mandate: extracted.mandate,
    ...(extracted.parentMandate ? { parentMandate: extracted.parentMandate } : {}),
    correlationId, transactionId: extracted.envelope.id, envelopeVerification, mandateVerification,
    ...(parentMandateVerification ? { parentMandateVerification } : {}), evaluation,
  }
}
function failedVerification(code: string): VerificationResult { return { verified: false, issues: [{ code: "PROOF_MISSING", message: code }] } }
function compactExtensions(value: OatiEvaluationExtensions): OatiEvaluationExtensions {
  return {
    ...(value.delegation_depth === undefined ? {} : { delegation_depth: value.delegation_depth }),
    ...(value.consumption === undefined ? {} : { consumption: value.consumption }),
    ...(value.commerce === undefined ? {} : { commerce: value.commerce }),
    ...(value.rwa === undefined ? {} : { rwa: value.rwa }),
  }
}
function reusableDocumentPolicy(policy: VerificationPolicy): VerificationPolicy {
  return { ...policy, maxProofAgeMs: policy.maxProofAgeMs ?? Number.MAX_SAFE_INTEGER, replayCache: { checkAndStore: () => true } }
}
function requiresPersistentUsage(mandate: AgentMandate): boolean { return mandate.status === "consumed" || mandate.limits !== undefined || mandate.profile !== undefined }
function middlewareError(code: "MIDDLEWARE_BAD_REQUEST" | "MIDDLEWARE_UNAUTHENTICATED" | "MIDDLEWARE_FORBIDDEN" | "MIDDLEWARE_REPLAY" | "MIDDLEWARE_USAGE_CONFLICT" | "MIDDLEWARE_UNAVAILABLE", message: string): OatiError { return new OatiError(code, message) }
function isMiddlewareError(error: unknown): error is OatiError { return error instanceof OatiError && error.code.startsWith("MIDDLEWARE_") }
function correlation(value: string | null, generator?: () => string): string {
  if (value !== null) { if (!/^[A-Za-z0-9._:-]{1,128}$/.test(value)) throw middlewareError("MIDDLEWARE_BAD_REQUEST", "Invalid correlation ID"); return value }
  return generator?.() ?? safeUuid()
}
function decodeHeader(value: string | null, name: string, maxBytes: number): unknown {
  if (!value) throw middlewareError("MIDDLEWARE_BAD_REQUEST", `${name} is required`)
  if (value.length > maxBytes) throw middlewareError("MIDDLEWARE_BAD_REQUEST", `${name} exceeds the size limit`)
  try { return JSON.parse(new TextDecoder().decode(fromBase64url(value))) as unknown }
  catch { throw middlewareError("MIDDLEWARE_BAD_REQUEST", `${name} is not valid base64url JSON`) }
}
function safeUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) throw middlewareError("MIDDLEWARE_UNAVAILABLE", "Web Crypto random generation is required")
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6]! & 0x0f) | 0x40; bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const value = hex(bytes); return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}
async function sha256(value: Uint8Array): Promise<Uint8Array> { return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", value.slice().buffer)) }
function hex(value: Uint8Array): string { return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("") }
function base64url(value: Uint8Array): string { let binary = ""; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") }
function fromBase64url(value: string): Uint8Array { if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url"); const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)); return Uint8Array.from(binary, (character) => character.charCodeAt(0)) }
