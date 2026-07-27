import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const schemaDirectory = path.resolve(scriptDirectory, "../../../schemas")
const schemaFiles = walk(schemaDirectory).filter((file) => file.endsWith(".schema.json"))
const schemas = schemaFiles.map((file) => JSON.parse(fs.readFileSync(file, "utf8")))

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)

for (const schema of schemas) ajv.addSchema(schema)
for (const schema of schemas) ajv.getSchema(schema.$id)

const repositoryRoot = path.resolve(scriptDirectory, "../../..")
const examples = [
  ["examples/passport.json", "https://schemas.intelliger.ai/oati/v1/passport.schema.json"],
  ["examples/commerce/merchant-service-profile.json", "https://schemas.intelliger.ai/oati/profiles/commerce/v0.1/merchant-service-profile.schema.json"],
  ["examples/commerce/purchase-mandate.json", "https://schemas.intelliger.ai/oati/profiles/commerce/v0.1/purchase-mandate.schema.json"],
  ["examples/commerce/transaction-envelope.json", "https://schemas.intelliger.ai/oati/v1/transaction-envelope.schema.json"],
  ["examples/commerce/commerce-receipt.json", "https://schemas.intelliger.ai/oati/profiles/commerce/v0.1/commerce-receipt.schema.json"],
  ["examples/rwa/asset-profile.json", "https://schemas.intelliger.ai/oati/profiles/rwa/v0.1/asset-profile.schema.json"],
  ["examples/rwa/asset-state-claim.json", "https://schemas.intelliger.ai/oati/profiles/rwa/v0.1/asset-state-claim.schema.json"],
  ["examples/rwa/mint-mandate.json", "https://schemas.intelliger.ai/oati/profiles/rwa/v0.1/asset-mandate.schema.json"],
  ["examples/rwa/rwa-receipt.json", "https://schemas.intelliger.ai/oati/profiles/rwa/v0.1/rwa-receipt.schema.json"],
]

for (const [relativeFile, schemaId] of examples) {
  const validate = ajv.getSchema(schemaId)
  const value = JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativeFile), "utf8"))
  if (!validate?.(value)) {
    throw new Error(`${relativeFile} failed ${schemaId}: ${ajv.errorsText(validate?.errors)}`)
  }
}

console.log(`Validated ${schemas.length} OATI JSON Schemas and ${examples.length} examples`)

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : target
  })
}
