import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js"
import addFormats from "ajv-formats"
import { OatiValidationError } from "./errors.js"
import { schemas } from "./generated-schemas.js"

export type OatiSchemaName =
  | "proof" | "verificationKey" | "issuer" | "revocation"
  | "passport" | "mandate" | "envelope" | "decision" | "receipt"
  | "commerceOffer" | "commerceMandate" | "commerceReceipt"
  | "rwaAsset" | "rwaStateClaim" | "rwaMandate" | "rwaReceipt"

export interface SchemaIssue {
  path: string
  keyword: string
  message: string
  params: Record<string, unknown>
  schemaPath: string
}

export interface SchemaValidationResult {
  valid: boolean
  issues: SchemaIssue[]
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)

for (const schema of Object.values(schemas)) ajv.addSchema(schema)

const validators = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [name, ajv.getSchema(schema.$id) ?? ajv.compile(schema)]),
) as Record<OatiSchemaName, ValidateFunction>

/** Validate an unknown value against a published OATI JSON Schema. */
export function validateSchema(name: OatiSchemaName, value: unknown): SchemaValidationResult {
  const validator = validators[name]
  const valid = validator(value)
  return { valid: valid === true, issues: valid ? [] : schemaIssues(validator.errors) }
}

/** Validate and narrow a value, throwing an OatiValidationError on failure. */
export function assertSchema<T>(name: OatiSchemaName, value: unknown): asserts value is T {
  const validation = validateSchema(name, value)
  if (!validation.valid) throw new OatiValidationError(`Value does not satisfy the ${name} schema`, validation.issues)
}

/** Return a defensive clone of a bundled published schema. */
export function getSchema(name: OatiSchemaName): Record<string, unknown> {
  return structuredClone(schemas[name]) as unknown as Record<string, unknown>
}

export const schemaNames = Object.freeze(Object.keys(schemas) as OatiSchemaName[])

function schemaIssues(errors: ErrorObject[] | null | undefined): SchemaIssue[] {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || "/",
    keyword: error.keyword,
    message: error.message ?? "schema validation failed",
    params: error.params,
    schemaPath: error.schemaPath,
  }))
}
