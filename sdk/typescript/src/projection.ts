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

/** Create the strict allow-listed record exposed by public lookup. */
export function projectPublicRecord(source: RegistryProjectionSource): PublicOatiRecord {
  const projected: Record<string, unknown> = {}
  for (const field of publicFields) if (source[field] !== undefined) projected[field] = structuredClone(source[field])
  if (typeof projected.type !== "string" || typeof projected.id !== "string" || typeof projected.display_name !== "string"
    || typeof projected.status !== "string" || typeof projected.issuer !== "string" || typeof projected.proof_status !== "string"
    || typeof projected.public_attributes !== "object" || projected.public_attributes === null || Array.isArray(projected.public_attributes)) {
    throw new OatiValidationError("Registry source cannot produce a valid public record", { required: publicFields })
  }
  return projected as unknown as PublicOatiRecord
}
