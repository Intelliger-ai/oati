import { OatiLookupClient } from "../dist/index.js"

const resolverUrl = process.env.OATI_LOOKUP_URL ?? "http://127.0.0.1:18080/oati/v1"
const type = process.env.OATI_LOOKUP_TYPE ?? "agent"
const id = process.env.OATI_LOOKUP_ID ?? "oati:agent:intelliger:commerce-demo"
const client = new OatiLookupClient({ resolverUrls: [resolverUrl], retry: { maxRetries: 0 } })
const result = await client.lookupDetailed(type, id, { cache: "reload" })

if (result.record.type !== type || result.record.id !== id) throw new Error("lookup service returned a mismatched record")
if (result.record.proof_status !== "verified") throw new Error(`lookup proof state is ${result.record.proof_status}`)
process.stdout.write(`${JSON.stringify({ resolverUrl: result.resolverUrl, type, id, proofStatus: result.record.proof_status, rateLimit: result.rateLimit })}\n`)
