import { OatiError } from "./errors.js"

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

/** Return a recursively key-sorted, JSON-compatible clone. */
export function canonicalize<T>(value: T): T {
  return canonicalValue(value, new Set()) as T
}

/** Serialize JSON deterministically with recursively sorted object keys. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function canonicalValue(value: unknown, ancestors: Set<object>): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalid("non-finite numbers are not valid JSON")
    return value
  }
  if (typeof value !== "object") throw invalid(`${typeof value} values are not valid JSON`)
  if (ancestors.has(value)) throw invalid("cyclic values cannot be canonicalized")
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => canonicalValue(item, ancestors))
    const prototype = Object.getPrototypeOf(value) as object | null
    if (prototype !== Object.prototype && prototype !== null) throw invalid("only plain objects and arrays can be canonicalized")
    const source = value as Record<string, unknown>
    const target: Record<string, JsonValue> = {}
    for (const key of Object.keys(source).sort()) {
      const item = source[key]
      if (item === undefined) throw invalid(`undefined at property ${key}`)
      target[key] = canonicalValue(item, ancestors)
    }
    return target
  } finally {
    ancestors.delete(value)
  }
}

function invalid(message: string): OatiError {
  return new OatiError("INVALID_CANONICAL_VALUE", message)
}
