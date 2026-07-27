import { OatiLookupError } from "./errors.js"

export const OATI_RECORD_TYPES = [
  "organisation", "agent", "passport", "mandate", "receipt", "issuer", "key", "revocation",
] as const

export type OatiRecordType = (typeof OATI_RECORD_TYPES)[number]

export interface PublicOatiRecord {
  type: OatiRecordType
  id: string
  display_name?: string
  status: string
  issuer: string
  organisation_id?: string
  issued_at?: string
  expires_at?: string
  assurance_level?: string
  proof_status: "verified" | "invalid" | "unavailable" | "unknown"
  public_attributes: Record<string, string>
}

export interface LookupClientOptions {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  headers?: HeadersInit
}

export interface LookupOptions {
  signal?: AbortSignal
}

/** Client for an OATI-compatible public resolver. */
export class OatiLookupClient {
  readonly baseUrl: string
  private readonly fetcher: typeof globalThis.fetch
  private readonly timeoutMs: number
  private readonly headers: HeadersInit

  constructor(options: LookupClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.intelliger.ai/oati/v1").replace(/\/+$/, "")
    this.fetcher = options.fetch ?? globalThis.fetch
    if (typeof this.fetcher !== "function") throw new TypeError("A Fetch API implementation is required")
    this.timeoutMs = options.timeoutMs ?? 10_000
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new RangeError("timeoutMs must be positive")
    this.headers = options.headers ?? {}
  }

  async lookup(type: OatiRecordType, id: string, options: LookupOptions = {}): Promise<PublicOatiRecord> {
    if (!OATI_RECORD_TYPES.includes(type) || id.trim() === "") {
      throw new OatiLookupError("LOOKUP_BAD_REQUEST", "A supported record type and non-empty id are required")
    }
    const url = new URL(`${this.baseUrl}/lookup`)
    url.searchParams.set("type", type)
    url.searchParams.set("id", id)
    const controller = new AbortController()
    const abort = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener("abort", abort, { once: true })
    const timeout = setTimeout(() => controller.abort(new Error("lookup timed out")), this.timeoutMs)
    try {
      const response = await this.fetcher(url, {
        method: "GET",
        headers: { Accept: "application/json", ...this.headers },
        signal: controller.signal,
      })
      const payload = await readPayload(response)
      if (!response.ok) throw responseError(response, payload)
      if (!isPublicRecord(payload)) {
        throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", "Resolver returned an invalid public record", {
          status: response.status,
          details: payload,
        })
      }
      return payload
    } catch (error) {
      if (error instanceof OatiLookupError) throw error
      if (controller.signal.aborted && !options.signal?.aborted) {
        throw new OatiLookupError("LOOKUP_TIMEOUT", `Lookup exceeded ${this.timeoutMs}ms`, { cause: error })
      }
      throw new OatiLookupError("LOOKUP_UNAVAILABLE", "The OATI resolver is unavailable", { cause: error })
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener("abort", abort)
    }
  }
}

export function createLookupClient(options: LookupClientOptions = {}): OatiLookupClient {
  return new OatiLookupClient(options)
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text === "") return undefined
  try { return JSON.parse(text) as unknown } catch {
    throw new OatiLookupError("LOOKUP_INVALID_RESPONSE", "Resolver returned non-JSON content", { status: response.status })
  }
}

function responseError(response: Response, details: unknown): OatiLookupError {
  const delay = retryAfter(response.headers.get("Retry-After"))
  const options = { status: response.status, details, ...(delay === undefined ? {} : { retryAfter: delay }) }
  if (response.status === 400) return new OatiLookupError("LOOKUP_BAD_REQUEST", "Resolver rejected the lookup request", options)
  if (response.status === 404) return new OatiLookupError("LOOKUP_NOT_FOUND", "OATI record was not found", options)
  if (response.status === 429) return new OatiLookupError("LOOKUP_RATE_LIMITED", "OATI lookup rate limit exceeded", options)
  return new OatiLookupError("LOOKUP_UNAVAILABLE", `OATI resolver returned HTTP ${response.status}`, options)
}

function retryAfter(value: string | null): number | undefined {
  if (value === null) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

function isPublicRecord(value: unknown): value is PublicOatiRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return OATI_RECORD_TYPES.includes(item.type as OatiRecordType)
    && typeof item.id === "string"
    && typeof item.status === "string"
    && typeof item.issuer === "string"
    && ["verified", "invalid", "unavailable", "unknown"].includes(String(item.proof_status))
    && typeof item.public_attributes === "object" && item.public_attributes !== null && !Array.isArray(item.public_attributes)
    && Object.values(item.public_attributes as Record<string, unknown>).every((entry) => typeof entry === "string")
}
