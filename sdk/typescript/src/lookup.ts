import { OatiLookupError } from "./errors.js"
import { validateSchema } from "./validation.js"

export const OATI_RECORD_TYPES = [
  "organisation", "agent", "passport", "mandate", "receipt", "issuer", "key", "revocation", "service", "profile",
] as const
export type OatiRecordType = (typeof OATI_RECORD_TYPES)[number]
export type ProofStatus = "verified" | "invalid" | "unavailable" | "unknown"

export interface PublicOatiRecord<T extends OatiRecordType = OatiRecordType, A extends Record<string, string | undefined> = Record<string, string | undefined>> {
  type: T
  id: string
  display_name?: string
  status: string
  issuer: string
  organisation_id?: string
  issued_at?: string
  expires_at?: string
  assurance_level?: string
  proof_status: ProofStatus
  public_attributes: A
}
export interface OrganisationRecord extends PublicOatiRecord<"organisation"> {}
export interface AgentRecord extends PublicOatiRecord<"agent"> {}
export interface PassportRecord extends PublicOatiRecord<"passport"> { status: "active" | "suspended" | "revoked" | "expired" | "unknown" }
export interface MandateRecord extends PublicOatiRecord<"mandate"> { status: "active" | "suspended" | "revoked" | "expired" | "consumed" | "unknown" }
export interface ReceiptRecord extends PublicOatiRecord<"receipt"> {}
export interface IssuerAttributes extends Record<string, string | undefined> { parent?: string; revoked_at?: string }
export interface IssuerRecord extends PublicOatiRecord<"issuer", IssuerAttributes> { status: "active" | "suspended" | "revoked" | "unknown" }
export interface KeyAttributes extends Record<string, string | undefined> {
  controller: string; algorithm: "EdDSA" | "ES256"; public_key_jwk: string; revoked_at?: string
  /** @deprecated Key issuer is canonical at `record.issuer`. */ issuer?: string
  /** @deprecated Key activation is canonical at `record.issued_at`. */ valid_from?: string
  /** @deprecated Key expiry is canonical at `record.expires_at`. */ valid_until?: string
}
export interface KeyRecord extends PublicOatiRecord<"key", KeyAttributes> {
  status: "active" | "retired" | "revoked" | "unknown"; issued_at: string; expires_at: string
}
export interface RevocationAttributes extends Record<string, string | undefined> { target?: string; revocation_status?: "good" | "suspended" | "revoked" | "unknown"; effective_at?: string; reason?: string }
export interface RevocationRecord extends PublicOatiRecord<"revocation", RevocationAttributes> { status: "active" | "suspended" | "revoked" | "unknown" }
export interface ServiceEndpoint {
  id: string; url: string; protocol: "http" | "grpc" | "mcp" | "a2a"; audience: string
  actions?: string[]; accepted_profiles?: string[]; priority?: number; regions?: string[]
}
export interface ServiceDiscoveryDocument {
  oati_version: "1.0"; id: string; organisation_id: string; issuer: string; display_name: string
  description?: string; endpoints: ServiceEndpoint[]; accepted_profiles: string[]
  status: "active" | "suspended" | "revoked"; issued_at: string; expires_at?: string; proof?: unknown
}
export interface ProfileDiscoveryDocument {
  oati_version: "1.0"; id: string; organisation_id: string; issuer: string; name: string; version: string
  schema_uri: string; specification_uri?: string; digest: string; compatible_with?: string[]
  status: "active" | "suspended" | "revoked"; issued_at: string; expires_at?: string; proof?: unknown
}
export interface DiscoveryAttributes extends Record<string, string> { document: string }
export interface ServiceRecord extends PublicOatiRecord<"service", DiscoveryAttributes> {}
export interface ProfileRecord extends PublicOatiRecord<"profile", DiscoveryAttributes> {}
export interface OrganisationDiscovery {
  organisation_id: string; services: Array<{ record: ServiceRecord; document: ServiceDiscoveryDocument }>
  profiles: Array<{ record: ProfileRecord; document: ProfileDiscoveryDocument }>
}
export interface FederationDocument { oati_version: "1.0"; organisations: string[]; resolvers: string[]; expires_at?: string }
export interface OatiRecordByType {
  organisation: OrganisationRecord; agent: AgentRecord; passport: PassportRecord; mandate: MandateRecord
  receipt: ReceiptRecord; issuer: IssuerRecord; key: KeyRecord; revocation: RevocationRecord
  service: ServiceRecord; profile: ProfileRecord
}

export interface RateLimitInfo { limit?: number; remaining?: number; resetAt?: string; retryAfter?: number }
export interface LookupResponse<T extends OatiRecordType> {
  record: OatiRecordByType[T]
  resolverUrl: string
  cache: "hit" | "miss" | "revalidated"
  rateLimit: RateLimitInfo
}
export type LookupState<T extends OatiRecordType> =
  | { state: "found"; response: LookupResponse<T> }
  | { state: "not_found"; error: OatiLookupError }
  | { state: "unavailable"; error: OatiLookupError }
  | { state: "unavailable"; record: OatiRecordByType[T]; response: LookupResponse<T> }
  | { state: "invalid_proof"; record: OatiRecordByType[T]; response: LookupResponse<T> }
  | { state: "unknown"; record: OatiRecordByType[T]; response: LookupResponse<T> }

export interface LookupCacheOptions { ttlMs?: number; negativeTtlMs?: number; maxEntries?: number }
export interface LookupRetryOptions { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number }
export interface LookupClientOptions {
  /** Resolver base URLs. Calls fail over in order; each URL must expose `/lookup`. */
  resolverUrls?: readonly string[]
  /** @deprecated Use resolverUrls. */
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  /** Maximum resolver response body accepted before failing closed. Defaults to 2 MiB. */
  maxResponseBytes?: number
  headers?: HeadersInit
  retry?: LookupRetryOptions
  cache?: LookupCacheOptions | false
}
export interface LookupOptions {
  signal?: AbortSignal
  cache?: "default" | "reload" | "no-store"
  timeoutMs?: number
}

interface CacheEntry { record?: PublicOatiRecord; notFound?: true; expiresAt: number; etag?: string; resolverUrl: string; rateLimit: RateLimitInfo }
type LookupSelector = "id" | "target"

/** Production client for OATI-compatible public resolvers. */
export class OatiLookupClient {
  readonly resolverUrls: readonly string[]
  /** First configured resolver, retained for source compatibility. */
  readonly baseUrl: string
  private readonly fetcher: typeof globalThis.fetch
  private readonly timeoutMs: number
  private readonly maxResponseBytes: number
  private readonly headers: HeadersInit
  private readonly retries: Required<LookupRetryOptions>
  private readonly cacheOptions: Required<LookupCacheOptions> | false
  private readonly cacheEntries = new Map<string, CacheEntry>()

  constructor(options: LookupClientOptions = {}) {
    const urls = options.resolverUrls ?? (options.baseUrl ? [options.baseUrl] : ["https://api.intelliger.ai/oati/v1"])
    if (urls.length === 0) throw new RangeError("At least one resolver URL is required")
    this.resolverUrls = Object.freeze(urls.map(normalizeResolverUrl))
    this.baseUrl = this.resolverUrls[0]!
    this.fetcher = options.fetch ?? globalThis.fetch
    if (typeof this.fetcher !== "function") throw new TypeError("A Fetch API implementation is required")
    this.timeoutMs = positive(options.timeoutMs ?? 10_000, "timeoutMs")
    this.maxResponseBytes = positiveInteger(options.maxResponseBytes ?? 2_097_152, "maxResponseBytes")
    this.headers = options.headers ?? {}
    this.retries = {
      maxRetries: nonNegativeInteger(options.retry?.maxRetries ?? 2, "maxRetries"),
      baseDelayMs: positive(options.retry?.baseDelayMs ?? 200, "baseDelayMs"),
      maxDelayMs: positive(options.retry?.maxDelayMs ?? 5_000, "maxDelayMs"),
    }
    this.cacheOptions = options.cache === false ? false : {
      ttlMs: nonNegative(options.cache?.ttlMs ?? 60_000, "ttlMs"),
      negativeTtlMs: nonNegative(options.cache?.negativeTtlMs ?? 10_000, "negativeTtlMs"),
      maxEntries: positiveInteger(options.cache?.maxEntries ?? 500, "maxEntries"),
    }
  }

  async lookup<T extends OatiRecordType>(type: T, id: string, options: LookupOptions = {}): Promise<OatiRecordByType[T]> {
    return (await this.lookupDetailed(type, id, options)).record
  }

  /** Lookup with resolver, cache, and rate-limit metadata. */
  async lookupDetailed<T extends OatiRecordType>(type: T, id: string, options: LookupOptions = {}): Promise<LookupResponse<T>> {
    return this.lookupSelectedDetailed(type, "id", id, options)
  }

  /** Resolve the authoritative published revocation record for a target identifier. */
  async lookupRevocationByTarget(target: string, options: LookupOptions = {}): Promise<RevocationRecord> {
    return (await this.lookupRevocationByTargetDetailed(target, options)).record
  }

  /** Target-based revocation lookup with resolver, cache, and rate-limit metadata. */
  async lookupRevocationByTargetDetailed(target: string, options: LookupOptions = {}): Promise<LookupResponse<"revocation">> {
    return this.lookupSelectedDetailed("revocation", "target", target, options)
  }

  /** Discover all active, verified services and profiles published by an organisation. */
  async discoverOrganisation(organisationId: string, options: LookupOptions = {}): Promise<OrganisationDiscovery> {
    if (!organisationId.startsWith("oati:org:")) throw new OatiLookupError("LOOKUP_BAD_REQUEST", "A valid OATI organisation id is required")
    let payload: unknown
    let lastError: OatiLookupError | undefined
    for (const resolverUrl of this.resolverUrls) {
      try {
        payload = await this.fetchDiscovery(`${resolverUrl}/discovery?organisation_id=${encodeURIComponent(organisationId)}`, options)
        lastError = undefined
        break
      } catch (error) {
        if (!(error instanceof OatiLookupError) || !retryable(error)) throw error
        lastError = error
      }
    }
    if (lastError || payload === undefined) throw lastError ?? new OatiLookupError("LOOKUP_UNAVAILABLE", "No OATI discovery resolver was available")
    if (!isObject(payload) || payload.organisation_id !== organisationId || !Array.isArray(payload.services) || !Array.isArray(payload.profiles)) {
      throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", "Resolver returned an invalid discovery response", { details: payload })
    }
    const discovery = {
      organisation_id: organisationId,
      services: payload.services.map((value) => decodeDiscoveryRecord(value, "service") as unknown as { record: ServiceRecord; document: ServiceDiscoveryDocument }),
      profiles: payload.profiles.map((value) => decodeDiscoveryRecord(value, "profile") as unknown as { record: ProfileRecord; document: ProfileDiscoveryDocument }),
    }
    const profiles = new Set(discovery.profiles.map(({ record }) => record.id))
    for (const { document } of discovery.services) for (const profile of document.accepted_profiles) {
      if (!profiles.has(profile)) throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", `Discovery service references unpublished profile ${profile}`, { details: payload })
    }
    return discovery
  }

  /** Resolve a domain's `/.well-known/oati`, then use its advertised resolver. */
  async discoverFederated(domain: string, organisationId: string, options: LookupOptions = {}): Promise<OrganisationDiscovery> {
    const origin = federationOrigin(domain)
    const document = await this.fetchDiscovery(`${origin}/.well-known/oati`, options)
    if (!isFederationDocument(document) || !document.organisations.includes(organisationId)) {
      throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", "Domain returned an invalid or unrelated OATI federation document", { details: document })
    }
    if (document.expires_at && Date.parse(document.expires_at) <= Date.now()) {
      throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", "OATI federation document is expired", { details: document })
    }
    return new OatiLookupClient({ resolverUrls: document.resolvers, fetch: this.fetcher, timeoutMs: options.timeoutMs ?? this.timeoutMs, headers: this.headers, retry: this.retries, cache: this.cacheOptions }).discoverOrganisation(organisationId, options)
  }

  private async fetchDiscovery(url: string, options: LookupOptions): Promise<unknown> {
    const controller = new AbortController(); const abort = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener("abort", abort, { once: true })
    const timeoutMs = options.timeoutMs ?? this.timeoutMs; const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await this.fetcher(url, { headers: { Accept: "application/json", ...this.headers }, signal: controller.signal })
      const payload = await readPayload(response, this.maxResponseBytes)
      if (!response.ok) throw responseError(response, payload, rateLimitInfo(response))
      return payload
    } catch (error) {
      if (error instanceof OatiLookupError) throw error
      if (options.signal?.aborted) throw cancelled(options.signal.reason)
      if (controller.signal.aborted) throw new OatiLookupError("LOOKUP_TIMEOUT", `Discovery exceeded ${timeoutMs}ms`, { cause: error })
      throw new OatiLookupError("LOOKUP_UNAVAILABLE", "The OATI discovery resolver is unavailable", { cause: error })
    } finally { clearTimeout(timeout); options.signal?.removeEventListener("abort", abort) }
  }

  private async lookupSelectedDetailed<T extends OatiRecordType>(type: T, selector: LookupSelector, value: string, options: LookupOptions): Promise<LookupResponse<T>> {
    validateInput(type, value)
    if (options.signal?.aborted) throw cancelled(options.signal.reason)
    const cacheKey = `${type}\u0000${selector}\u0000${value}`
    const cached = this.cacheEntries.get(cacheKey)
    if (options.cache !== "reload" && options.cache !== "no-store" && cached && cached.expiresAt > Date.now()) {
      touch(this.cacheEntries, cacheKey, cached)
      if (cached.notFound) throw new OatiLookupError("LOOKUP_NOT_FOUND", "OATI record was not found", { status: 404, cache: "hit" })
      return { record: cached.record as OatiRecordByType[T], resolverUrl: cached.resolverUrl, cache: "hit", rateLimit: cached.rateLimit }
    }

    let lastError: OatiLookupError | undefined
    for (const resolverUrl of this.resolverUrls) {
      try {
        const reusable = options.cache !== "no-store" && cached?.resolverUrl === resolverUrl ? cached : undefined
        const response = await this.requestWithRetry<T>(resolverUrl, type, selector, value, options, reusable)
        if (options.cache !== "no-store" && response.cacheable) this.store(cacheKey, {
          record: response.record, expiresAt: response.expiresAt, ...(response.etag ? { etag: response.etag } : {}),
          resolverUrl, rateLimit: response.rateLimit,
        })
        return { record: response.record, resolverUrl, cache: response.revalidated ? "revalidated" : "miss", rateLimit: response.rateLimit }
      } catch (error) {
        if (!(error instanceof OatiLookupError)) throw error
        if (error.code === "LOOKUP_CANCELLED" || error.code === "LOOKUP_BAD_REQUEST" || error.code === "LOOKUP_INVALID_RESPONSE") throw error
        if (error.code === "LOOKUP_NOT_FOUND") {
          if (options.cache !== "no-store" && this.cacheOptions !== false) this.store(cacheKey, {
            notFound: true, expiresAt: Date.now() + this.cacheOptions.negativeTtlMs, resolverUrl, rateLimit: error.rateLimit ?? {},
          })
          throw error
        }
        lastError = error
      }
    }
    throw lastError ?? new OatiLookupError("LOOKUP_UNAVAILABLE", "No OATI resolver was available")
  }

  /** Resolve expected absence and proof-state failures without exception-based control flow. */
  async lookupState<T extends OatiRecordType>(type: T, id: string, options: LookupOptions = {}): Promise<LookupState<T>> {
    try {
      const response = await this.lookupDetailed(type, id, options)
      if (response.record.proof_status === "invalid") return { state: "invalid_proof", record: response.record, response }
      if (response.record.proof_status === "unavailable") return { state: "unavailable", record: response.record, response }
      if (response.record.proof_status === "unknown") return { state: "unknown", record: response.record, response }
      return { state: "found", response }
    } catch (error) {
      if (!(error instanceof OatiLookupError)) throw error
      if (error.code === "LOOKUP_NOT_FOUND") return { state: "not_found", error }
      if (["LOOKUP_UNAVAILABLE", "LOOKUP_TIMEOUT", "LOOKUP_RATE_LIMITED"].includes(error.code)) return { state: "unavailable", error }
      throw error
    }
  }

  clearCache(type?: OatiRecordType, id?: string): void {
    if (type === undefined) this.cacheEntries.clear()
    else if (id !== undefined) this.cacheEntries.delete(`${type}\u0000id\u0000${id}`)
    else for (const key of this.cacheEntries.keys()) if (key.startsWith(`${type}\u0000`)) this.cacheEntries.delete(key)
  }

  clearRevocationTargetCache(target?: string): void {
    if (target !== undefined) this.cacheEntries.delete(`revocation\u0000target\u0000${target}`)
    else for (const key of this.cacheEntries.keys()) if (key.startsWith("revocation\u0000target\u0000")) this.cacheEntries.delete(key)
  }

  private async requestWithRetry<T extends OatiRecordType>(resolverUrl: string, type: T, selector: LookupSelector, value: string, options: LookupOptions, cached?: CacheEntry) {
    let lastError: OatiLookupError | undefined
    for (let attempt = 0; attempt <= this.retries.maxRetries; attempt++) {
      if (attempt > 0) await delay(retryDelay(lastError, attempt, this.retries), options.signal)
      try { return await this.requestOnce(resolverUrl, type, selector, value, options, cached) }
      catch (error) {
        if (!(error instanceof OatiLookupError) || !retryable(error) || attempt === this.retries.maxRetries) throw error
        lastError = error
      }
    }
    throw lastError
  }

  private async requestOnce<T extends OatiRecordType>(resolverUrl: string, type: T, selector: LookupSelector, value: string, options: LookupOptions, cached?: CacheEntry) {
    const url = new URL(`${resolverUrl}/lookup`)
    url.searchParams.set("type", type); url.searchParams.set(selector, value)
    const controller = new AbortController()
    const abort = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener("abort", abort, { once: true })
    const timeoutMs = options.timeoutMs === undefined ? this.timeoutMs : positive(options.timeoutMs, "timeoutMs")
    const timeout = setTimeout(() => controller.abort(new Error("lookup timed out")), timeoutMs)
    try {
      const response = await this.fetcher(url, { method: "GET", headers: {
        Accept: "application/json", ...this.headers, ...(cached?.etag ? { "If-None-Match": cached.etag } : {}),
      }, signal: controller.signal })
      const rateLimit = rateLimitInfo(response)
      if (response.status === 304 && cached?.record) return {
        record: cached.record as OatiRecordByType[T], expiresAt: expiry(response, this.cacheOptions, false),
        etag: cached.etag, rateLimit: { ...cached.rateLimit, ...rateLimit }, revalidated: true, cacheable: isCacheable(response),
      }
      const payload = await readPayload(response, this.maxResponseBytes)
      if (!response.ok) throw responseError(response, payload, rateLimit)
      if (!isPublicRecord(payload)) throw new OatiLookupError(
        "LOOKUP_INVALID_RESPONSE", "Resolver returned an invalid or mismatched public record", { status: response.status, details: payload, rateLimit },
      )
      const selectorMatches = selector === "id" ? payload.id === value : payload.type === "revocation"
        && payload.public_attributes.target === value && validRevocationStatus(payload.public_attributes.revocation_status)
      if (!selectorMatches || payload.type !== type) throw new OatiLookupError(
        "LOOKUP_INVALID_RESPONSE", "Resolver returned an invalid or mismatched public record", { status: response.status, details: payload, rateLimit },
      )
      const record = normalizePublicRecord(payload as PublicOatiRecord) as OatiRecordByType[T]
      return { record, expiresAt: expiry(response, this.cacheOptions, false), etag: response.headers.get("ETag") ?? undefined, rateLimit, revalidated: false, cacheable: isCacheable(response) }
    } catch (error) {
      if (error instanceof OatiLookupError) throw error
      if (options.signal?.aborted) throw cancelled(options.signal.reason)
      if (controller.signal.aborted) throw new OatiLookupError("LOOKUP_TIMEOUT", `Lookup exceeded ${timeoutMs}ms`, { cause: error })
      throw new OatiLookupError("LOOKUP_UNAVAILABLE", "The OATI resolver is unavailable", { cause: error })
    } finally { clearTimeout(timeout); options.signal?.removeEventListener("abort", abort) }
  }

  private store(key: string, entry: CacheEntry): void {
    if (this.cacheOptions === false) return
    this.cacheEntries.delete(key); this.cacheEntries.set(key, entry)
    while (this.cacheEntries.size > this.cacheOptions.maxEntries) this.cacheEntries.delete(this.cacheEntries.keys().next().value!)
  }
}

export function createLookupClient(options: LookupClientOptions = {}): OatiLookupClient { return new OatiLookupClient(options) }

async function readPayload(response: Response, maximum: number): Promise<unknown> {
  const declared = Number(response.headers.get("Content-Length"))
  if (Number.isFinite(declared) && declared > maximum) throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", `Resolver response exceeds ${maximum} bytes`, { status: response.status })
  const reader = response.body?.getReader()
  if (!reader) return undefined
  const chunks: Uint8Array[] = []; let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maximum) {
      await reader.cancel().catch(() => undefined)
      throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", `Resolver response exceeds ${maximum} bytes`, { status: response.status })
    }
    chunks.push(value)
  }
  const encoded = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { encoded.set(chunk, offset); offset += chunk.byteLength }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(encoded); if (text === "") return undefined
    return JSON.parse(text) as unknown
  } catch { throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", "Resolver returned non-JSON content", { status: response.status }) }
}
function responseError(response: Response, details: unknown, rateLimit: RateLimitInfo): OatiLookupError {
  const options = { status: response.status, details, rateLimit, ...(rateLimit.retryAfter === undefined ? {} : { retryAfter: rateLimit.retryAfter }) }
  if (response.status === 400) return new OatiLookupError("LOOKUP_BAD_REQUEST", "Resolver rejected the lookup request", options)
  if (response.status === 404) return new OatiLookupError("LOOKUP_NOT_FOUND", "OATI record was not found", options)
  if (response.status === 429) return new OatiLookupError("LOOKUP_RATE_LIMITED", "OATI lookup rate limit exceeded", options)
  return new OatiLookupError("LOOKUP_UNAVAILABLE", `OATI resolver returned HTTP ${response.status}`, options)
}
function rateLimitInfo(response: Response): RateLimitInfo {
  const retry = retryAfter(response.headers.get("Retry-After")); const limit = integerHeader(response, "X-RateLimit-Limit")
  const remaining = integerHeader(response, "X-RateLimit-Remaining"); const reset = response.headers.get("X-RateLimit-Reset")
  return { ...(limit === undefined ? {} : { limit }), ...(remaining === undefined ? {} : { remaining }),
    ...(reset ? { resetAt: /^\d+$/.test(reset) ? new Date(Number(reset) * 1000).toISOString() : reset } : {}), ...(retry === undefined ? {} : { retryAfter: retry }) }
}
function retryAfter(value: string | null): number | undefined {
  if (value === null) return undefined; const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const date = Date.parse(value); return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}
function integerHeader(response: Response, name: string): number | undefined { const raw = response.headers.get(name); if (raw === null || raw.trim() === "") return undefined; const value = Number(raw); return Number.isInteger(value) && value >= 0 ? value : undefined }
function expiry(response: Response, cache: Required<LookupCacheOptions> | false, negative: boolean): number {
  const fallback = cache === false ? 0 : negative ? cache.negativeTtlMs : cache.ttlMs
  const control = response.headers.get("Cache-Control") ?? ""
  if (/\bno-store\b/i.test(control)) return 0
  const maxAge = /(?:^|,)\s*(?:s-maxage|max-age)=(\d+)/i.exec(control)?.[1]
  if (maxAge) return Date.now() + Number(maxAge) * 1000
  const expires = Date.parse(response.headers.get("Expires") ?? ""); return Number.isNaN(expires) ? Date.now() + fallback : expires
}
function isCacheable(response: Response): boolean { return !/\bno-store\b/i.test(response.headers.get("Cache-Control") ?? "") }
function retryable(error: OatiLookupError): boolean { return ["LOOKUP_RATE_LIMITED", "LOOKUP_UNAVAILABLE", "LOOKUP_TIMEOUT"].includes(error.code) }
function retryDelay(error: OatiLookupError | undefined, attempt: number, retry: Required<LookupRetryOptions>): number {
  if (error?.retryAfter !== undefined) return Math.min(error.retryAfter * 1000, retry.maxDelayMs)
  return Math.min(retry.baseDelayMs * 2 ** (attempt - 1), retry.maxDelayMs)
}
function delay(ms: number, signal?: AbortSignal): Promise<void> { return new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(cancelled(signal.reason)); const timer = setTimeout(done, ms)
  const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(cancelled(signal?.reason)) }
  function done() { signal?.removeEventListener("abort", abort); resolve() }
  signal?.addEventListener("abort", abort, { once: true })
}) }
function cancelled(cause: unknown): OatiLookupError { return new OatiLookupError("LOOKUP_CANCELLED", "Lookup was cancelled", { cause }) }
function validateInput(type: OatiRecordType, id: string): void { if (!OATI_RECORD_TYPES.includes(type) || id.trim() === "") throw new OatiLookupError("LOOKUP_BAD_REQUEST", "A supported record type and non-empty id are required") }
function normalizeResolverUrl(value: string): string { const url = new URL(value); if (!/^https?:$/.test(url.protocol)) throw new TypeError("Resolver URLs must use HTTP or HTTPS"); return value.replace(/\/+$/, "") }
function positive(value: number, name: string): number { if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive`); return value }
function nonNegative(value: number, name: string): number { if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be non-negative`); return value }
function positiveInteger(value: number, name: string): number { if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer`); return value }
function nonNegativeInteger(value: number, name: string): number { if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer`); return value }
function touch(map: Map<string, CacheEntry>, key: string, value: CacheEntry): void { map.delete(key); map.set(key, value) }
function isPublicRecord(value: unknown): value is PublicOatiRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return OATI_RECORD_TYPES.includes(item.type as OatiRecordType) && typeof item.id === "string" && typeof item.status === "string"
    && typeof item.issuer === "string" && ["verified", "invalid", "unavailable", "unknown"].includes(String(item.proof_status))
    && typeof item.public_attributes === "object" && item.public_attributes !== null && !Array.isArray(item.public_attributes)
    && Object.values(item.public_attributes as Record<string, unknown>).every((entry) => typeof entry === "string")
    && validTypedRecord(item)
}
function validTypedRecord(item: Record<string, unknown>): boolean {
  if (item.type === "service" || item.type === "profile") {
    const attributes = item.public_attributes as Record<string, string>
    if (!nonEmpty(attributes.document)) return false
    try { const document = JSON.parse(attributes.document) as Record<string, unknown>; return document.id === item.id && document.organisation_id === item.organisation_id }
    catch { return false }
  }
  if (item.type !== "key") return true
  const attributes = item.public_attributes as Record<string, string>
  return ["controller", "algorithm", "public_key_jwk"].every((field) => typeof attributes[field] === "string" && attributes[field] !== "")
    && ["EdDSA", "ES256"].includes(attributes.algorithm!)
    && nonEmpty(item.issued_at ?? attributes.valid_from) && nonEmpty(item.expires_at ?? attributes.valid_until)
}
function normalizePublicRecord(record: PublicOatiRecord): PublicOatiRecord {
  if (record.type !== "key") return record
  const attributes = record.public_attributes
  return {
    ...record,
    issued_at: record.issued_at ?? attributes.valid_from!,
    expires_at: record.expires_at ?? attributes.valid_until!,
  }
}
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value !== "" }
function validRevocationStatus(value: unknown): boolean { return typeof value === "string" && ["good", "suspended", "revoked", "unknown"].includes(value) }
function isObject(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value) }
function decodeDiscoveryRecord(value: unknown, type: "service" | "profile") {
  if (!isPublicRecord(value) || value.type !== type || value.status !== "active" || value.proof_status !== "verified") throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", "Discovery contains an untrusted record", { details: value })
  const document = JSON.parse(value.public_attributes.document!) as Record<string, unknown>
  if (!isObject(document) || document.id !== value.id || document.organisation_id !== value.organisation_id || document.issuer !== value.issuer || document.status !== "active") throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", "Discovery document does not match its public record", { details: value })
  const checked = validateSchema(type === "service" ? "serviceDiscovery" : "profileDiscovery", document)
  if (!checked.valid) throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", "Discovery document does not satisfy its published schema", { details: checked.issues })
  if ((value.expires_at && Date.parse(value.expires_at) <= Date.now()) || (typeof document.expires_at === "string" && Date.parse(document.expires_at) <= Date.now())) {
    throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", "Discovery contains an expired record", { details: value })
  }
  return { record: value, document }
}
function federationOrigin(domain: string): string {
  const candidate = domain.includes("://") ? domain : `https://${domain}`; const url = new URL(candidate)
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new OatiLookupError("LOOKUP_BAD_REQUEST", "Federation requires a bare HTTPS domain")
  return url.origin
}
function isFederationDocument(value: unknown): value is FederationDocument {
  return isObject(value) && value.oati_version === "1.0" && Array.isArray(value.organisations) && value.organisations.every((item) => typeof item === "string" && item.startsWith("oati:org:"))
    && Array.isArray(value.resolvers) && value.resolvers.length > 0 && value.resolvers.every((item) => { try { return new URL(item).protocol === "https:" } catch { return false } })
}
