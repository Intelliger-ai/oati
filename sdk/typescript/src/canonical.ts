import { OatiError } from "./errors.js"

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

/** Return a recursively key-sorted, JSON-compatible clone. */
export function canonicalize<T>(value: T): T {
  return canonicalValue(value, new Set(), 0) as T
}

/** Serialize JSON deterministically with recursively sorted object keys. */
export function canonicalJson(value: unknown): string {
  return serializeCanonical(canonicalValue(value, new Set(), 0))
}

function serializeCanonical(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => serializeCanonical(item)).join(",")}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${serializeCanonical(value[key]!)}`).join(",")}}`
}

function canonicalValue(value: unknown, ancestors: Set<object>, depth: number): JsonValue {
  if (depth > 256) throw invalid("JSON nesting exceeds the canonicalization limit")
  if (value === null || typeof value === "boolean") return value
  if (typeof value === "string") {
    assertUnicodeScalarString(value)
    return value
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalid("non-finite numbers are not valid JSON")
    return value
  }
  if (typeof value !== "object") throw invalid(`${typeof value} values are not valid JSON`)
  if (ancestors.has(value)) throw invalid("cyclic values cannot be canonicalized")
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => canonicalValue(item, ancestors, depth + 1))
    const prototype = Object.getPrototypeOf(value) as object | null
    if (prototype !== Object.prototype && prototype !== null) throw invalid("only plain objects and arrays can be canonicalized")
    const source = value as Record<string, unknown>
    const target: Record<string, JsonValue> = {}
    for (const key of Object.keys(source).sort()) {
      assertUnicodeScalarString(key)
      const item = source[key]
      if (item === undefined) throw invalid(`undefined at property ${key}`)
      target[key] = canonicalValue(item, ancestors, depth + 1)
    }
    return target
  } finally {
    ancestors.delete(value)
  }
}

function assertUnicodeScalarString(value: string): void {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 0xd800 || code > 0xdfff) continue
    if (code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        index++
        continue
      }
    }
    throw invalid("lone UTF-16 surrogates are not valid I-JSON strings")
  }
}

function invalid(message: string): OatiError {
  return new OatiError("INVALID_CANONICAL_VALUE", message)
}
