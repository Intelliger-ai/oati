import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, "..")
const repositorySchemas = resolve(packageRoot, "..", "..", "schemas")
const entries = {
  proof: "proof.schema.json",
  verificationKey: "verification-key.schema.json",
  issuer: "issuer.schema.json",
  revocation: "revocation.schema.json",
  evaluationRequest: "evaluation-request.schema.json",
  evaluationResult: "evaluation-result.schema.json",
  publicRecord: "public-record.schema.json",
  conformanceSuite: "conformance-suite.schema.json",
  conformanceReport: "conformance-report.schema.json",
  passport: "passport.schema.json",
  mandate: "mandate.schema.json",
  envelope: "transaction-envelope.schema.json",
  decision: "decision.schema.json",
  receipt: "receipt.schema.json",
  commerceOffer: "commerce/merchant-service-profile.schema.json",
  commerceMandate: "commerce/purchase-mandate.schema.json",
  commerceReceipt: "commerce/commerce-receipt.schema.json",
  rwaAsset: "rwa/asset-profile.schema.json",
  rwaStateClaim: "rwa/asset-state-claim.schema.json",
  rwaMandate: "rwa/asset-mandate.schema.json",
  rwaReceipt: "rwa/rwa-receipt.schema.json",
}

const schemas = {}
for (const [name, relativePath] of Object.entries(entries)) {
  schemas[name] = JSON.parse(await readFile(resolve(repositorySchemas, relativePath), "utf8"))
}

const source = `// Generated from ../../schemas by scripts/generate-schema-bundle.mjs. Do not edit.\n`+
  `export const schemas = ${JSON.stringify(schemas, null, 2)} as const\n`
await writeFile(resolve(packageRoot, "src", "generated-schemas.ts"), source)
