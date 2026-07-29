import { OatiValidationError } from "./errors.js"
import type { PublicOatiRecord } from "./lookup.js"

export interface RegistryProjectionSource extends PublicOatiRecord {
  private_attributes?: Record<string, unknown>
  [key: string]: unknown
}

const publicFields = [
  "type", "id", "display_name", "status", "issuer", "organisation_id", "issued_at",
  "expires_at", "assurance_level", "proof_status", "public_attributes",
] as const

const publicAttributesByType: Readonly<Record<string, readonly string[]>> = {
  organisation: ["environment", "website", "jurisdiction", "signed_document"],
  issuer: ["environment", "parent", "revoked_at", "signed_document"],
  key: ["controller", "algorithm", "public_key_jwk", "revoked_at", "signed_document"],
  agent: ["protocol", "protocols", "signed_document"],
  passport: ["subject", "signed_document"],
  mandate: ["subject", "signed_document"],
  receipt: ["transaction_id", "mandate_id", "outcome", "signed_document"],
  revocation: ["target", "revocation_status", "effective_at", "signed_document"],
  service: ["document", "signed_document"],
  profile: ["document", "signed_document"],
}

const sensitiveNestedFields = new Set([
  "access_token", "api_key", "credential", "internal_id", "kms_key", "operator_notes",
  "password", "private_attributes", "private_key", "refresh_token", "secret", "tenant_id",
])

function assertPublicJson(value: string, attribute: string): void {
  let document: unknown
  try { document = JSON.parse(value) } catch {
    throw new OatiValidationError(`Public attribute ${attribute} must contain valid JSON`, { attribute })
  }
  const visit = (current: unknown, depth: number): void => {
    if (depth > 32) throw new OatiValidationError(`Public attribute ${attribute} exceeds the nesting limit`, { attribute })
    if (Array.isArray(current)) { for (const item of current) visit(item, depth + 1); return }
    if (typeof current !== "object" || current === null) return
    const record = current as Record<string, unknown>
    for (const [key, nested] of Object.entries(record)) {
      if (sensitiveNestedFields.has(key.toLowerCase())) throw new OatiValidationError(`Public attribute ${attribute} contains forbidden field ${key}`, { attribute, field: key })
      visit(nested, depth + 1)
    }
    if (typeof record.kty === "string" && "d" in record) throw new OatiValidationError(`Public attribute ${attribute} contains private JWK material`, { attribute })
  }
  visit(document, 0)
}

/** Create the strict allow-listed record exposed by public lookup. */
export function projectPublicRecord(source: RegistryProjectionSource): PublicOatiRecord {
  const projected: Record<string, unknown> = {}
  for (const field of publicFields) if (source[field] !== undefined) projected[field] = structuredClone(source[field])
  const allowedAttributes = typeof projected.type === "string" ? publicAttributesByType[projected.type] : undefined
  if (!allowedAttributes) throw new OatiValidationError("Registry source has an unsupported public record type", { type: projected.type })
  const attributes = projected.public_attributes
  if (typeof attributes !== "object" || attributes === null || Array.isArray(attributes)) {
    throw new OatiValidationError("Registry source public_attributes must be an object", { type: projected.type })
  }
  const filteredAttributes: Record<string, string> = {}
  for (const name of allowedAttributes) {
    const value = (attributes as Record<string, unknown>)[name]
    if (value === undefined) continue
    if (typeof value !== "string") throw new OatiValidationError(`Public attribute ${name} must be a string`, { attribute: name })
    if (["document", "public_key_jwk", "signed_document"].includes(name)) assertPublicJson(value, name)
    filteredAttributes[name] = value
  }
  projected.public_attributes = filteredAttributes
  if (typeof projected.type !== "string" || typeof projected.id !== "string" || typeof projected.display_name !== "string"
    || typeof projected.status !== "string" || typeof projected.issuer !== "string" || typeof projected.proof_status !== "string"
    || typeof projected.public_attributes !== "object" || projected.public_attributes === null || Array.isArray(projected.public_attributes)) {
    throw new OatiValidationError("Registry source cannot produce a valid public record", { required: publicFields })
  }
  return projected as unknown as PublicOatiRecord
}
