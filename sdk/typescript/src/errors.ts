export type OatiErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_CANONICAL_VALUE"
  | "LOOKUP_BAD_REQUEST"
  | "LOOKUP_NOT_FOUND"
  | "LOOKUP_RATE_LIMITED"
  | "LOOKUP_UNAVAILABLE"
  | "LOOKUP_INVALID_RESPONSE"
  | "LOOKUP_TIMEOUT"

export interface OatiErrorOptions {
  cause?: unknown
  details?: unknown
  status?: number
  retryAfter?: number
}

/** Base error for failures produced by the OATI SDK. */
export class OatiError extends Error {
  readonly code: OatiErrorCode
  readonly details?: unknown
  readonly status?: number
  readonly retryAfter?: number

  constructor(code: OatiErrorCode, message: string, options: OatiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = "OatiError"
    this.code = code
    if (options.details !== undefined) this.details = options.details
    if (options.status !== undefined) this.status = options.status
    if (options.retryAfter !== undefined) this.retryAfter = options.retryAfter
  }
}

export class OatiValidationError extends OatiError {
  constructor(message: string, details: unknown) {
    super("VALIDATION_FAILED", message, { details })
    this.name = "OatiValidationError"
  }
}

export class OatiLookupError extends OatiError {
  constructor(code: Exclude<OatiErrorCode, "VALIDATION_FAILED" | "INVALID_CANONICAL_VALUE">, message: string, options: OatiErrorOptions = {}) {
    super(code, message, options)
    this.name = "OatiLookupError"
  }
}
