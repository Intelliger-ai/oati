import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  LookupTrustResolver,
  MemoryReplayCache,
  OATI_RECORD_TYPES,
  OatiLookupClient,
  validateSchema,
  verifyDocument,
} from "../dist/index.js"

const defaultManifest = fileURLToPath(new URL("../../../smoke/production-lookup.inventory.json", import.meta.url))
const forbiddenProjectionKeys = new Set(["private_attributes", "credential", "tenant_id", "internal_id", "private_key", "kms_key"])

export async function runProductionLookupSmoke({ manifest, fetcher = globalThis.fetch, now = new Date(), verifySignedDocument }) {
  validateManifest(manifest)
  const resolverUrl = (process.env.OATI_LOOKUP_URL ?? manifest.resolver_url).replace(/\/$/, "")
  if (new URL(resolverUrl).protocol !== "https:" && process.env.OATI_ALLOW_HTTP_SMOKE !== "1") throw new Error("hosted smoke requires HTTPS")
  const checks = []
  const records = new Map()
  const request = (path, options = {}) => requestWithRetry(fetcher, `${resolverUrl}${path}`, {
    ...options,
    headers: { Accept: "application/json", "OATI-Version": "1.0", Origin: manifest.cors_origin, ...options.headers },
  })
  const check = async (name, operation) => {
    const started = performance.now()
    try {
      const details = await operation()
      checks.push({ name, status: "pass", duration_ms: Math.round(performance.now() - started), ...(details ? { details } : {}) })
    } catch (error) {
      checks.push({ name, status: "fail", duration_ms: Math.round(performance.now() - started), error: error instanceof Error ? error.message : String(error) })
    }
  }

  await check("status.operational", async () => {
    const response = await request("/status")
    const value = await responseJson(response)
    require(response.status === 200, `status returned HTTP ${response.status}`)
    require(value.status === "operational" && value.service === "oati-public-lookup", "status contract is not operational")
    require(!Number.isNaN(Date.parse(value.checked_at)), "status checked_at is invalid")
    responseContract(response, manifest)
    return { version: value.version }
  })

  for (const expected of manifest.records) {
    await check(`lookup.${expected.type}`, async () => {
      const response = await request(`/lookup?type=${encodeURIComponent(expected.type)}&id=${encodeURIComponent(expected.id)}`)
      const value = await responseJson(response)
      require(response.status === 200, `${expected.type} ${expected.id} returned HTTP ${response.status}: ${problemCode(value)}`)
      responseContract(response, manifest, { cache: true })
      require(value.type === expected.type && value.id === expected.id, "resolver returned a mismatched record")
      require(value.proof_status === "verified", `proof_status is ${value.proof_status}`)
      require(validateSchema("publicRecord", value).valid, `public record schema failed: ${validateSchema("publicRecord", value).issues.map((item) => item.code).join(",")}`)
      privacyProjection(value)
      require(typeof value.public_attributes.signed_document === "string", "signed_document is missing")
      records.set(expected.type, { expected, value, etag: response.headers.get("etag") })
      require(expected.statuses.includes(value.status), `status ${value.status} is outside ${expected.statuses.join(",")}`)
      if (expected.require_future_expiry) require(typeof value.expires_at === "string" && Date.parse(value.expires_at) > now.getTime(), `record expired at ${value.expires_at ?? "(missing)"}`)
      if (expected.target) require(value.public_attributes.target === expected.target, `revocation target is ${value.public_attributes.target}`)
      if (expected.revocation_status) require(value.public_attributes.revocation_status === expected.revocation_status, `revocation status is ${value.public_attributes.revocation_status}`)
      return { id: value.id, proof_status: value.proof_status, etag: response.headers.get("etag"), rate_remaining: response.headers.get("x-ratelimit-remaining") }
    })
  }

  await check("lookup.etag-revalidation", async () => {
    const organisation = records.get("organisation")
    require(organisation?.etag, "organisation ETag is unavailable")
    const response = await request(`/lookup?type=organisation&id=${encodeURIComponent(organisation.expected.id)}`, { headers: { "If-None-Match": organisation.etag } })
    require(response.status === 304, `If-None-Match returned HTTP ${response.status}`)
    require(response.headers.get("etag") === organisation.etag, "304 response changed the ETag")
    return { etag: organisation.etag }
  })

  await check("lookup.revocation-by-target", async () => {
    const expected = manifest.records.find((item) => item.type === "revocation")
    const response = await request(`/lookup?type=revocation&target=${encodeURIComponent(expected.target)}`)
    const value = await responseJson(response)
    require(response.status === 200, `target revocation returned HTTP ${response.status}: ${problemCode(value)}`)
    require(value.id === expected.id && value.public_attributes.target === expected.target, "target revocation mapping is inconsistent")
    return { id: value.id, status: value.public_attributes.revocation_status }
  })

  await check("api.version-negotiation", async () => {
    const response = await request("/status", { headers: { "OATI-Version": "999" } })
    const value = await responseJson(response)
    require(response.status === 406, `unsupported version returned HTTP ${response.status}`)
    structuredProblem(value, 406)
    return { code: value.error.code }
  })

  await check("api.structured-errors", async () => {
    const invalid = await request("/lookup?type=agent")
    const invalidValue = await responseJson(invalid)
    require(invalid.status === 400, `invalid request returned HTTP ${invalid.status}`)
    structuredProblem(invalidValue, 400)
    const missing = await request(`/lookup?type=agent&id=${encodeURIComponent("oati:agent:smoke:known-missing")}`)
    const missingValue = await responseJson(missing)
    require(missing.status === 404, `missing record returned HTTP ${missing.status}`)
    structuredProblem(missingValue, 404)
    return { invalid_code: invalidValue.error.code, missing_code: missingValue.error.code }
  })

  await check("lookup.signed-documents", async () => {
    const failures = []
    const client = verifySignedDocument ? undefined : new OatiLookupClient({ resolverUrls: [resolverUrl], fetch: fetcher, timeoutMs: 5_000, retry: { maxRetries: 1, baseDelayMs: 50, maxDelayMs: 200 } })
    const resolver = client ? new LookupTrustResolver(client) : undefined
    for (const { expected, value } of records.values()) {
      try {
        const document = JSON.parse(value.public_attributes.signed_document)
        const result = verifySignedDocument
          ? await verifySignedDocument({ document, expected, value })
          : await verifyDocument(document, { resolver, trustAnchors: manifest.trust_anchors, expectedAudience: expected.audience,
            replayCache: new MemoryReplayCache(), now, maxProofAgeMs: 400 * 24 * 60 * 60 * 1000 })
        if (!result.verified) failures.push(`${expected.type}: ${result.issues.map((item) => item.code).join(",")}`)
      } catch (error) { failures.push(`${expected.type}: ${error instanceof Error ? error.message : String(error)}`) }
    }
    if (records.size !== OATI_RECORD_TYPES.length) failures.push(`only ${records.size}/${OATI_RECORD_TYPES.length} records are available`)
    require(failures.length === 0, failures.join("; "))
    return { verified: records.size }
  })

  await check("discovery.organisation", async () => {
    const response = await request(`/discovery?organisation_id=${encodeURIComponent(manifest.organisation_id)}`)
    const value = await responseJson(response)
    require(response.status === 200, `discovery returned HTTP ${response.status}: ${problemCode(value)}`)
    responseContract(response, manifest)
    require(value.organisation_id === manifest.organisation_id && Array.isArray(value.services) && Array.isArray(value.profiles), "discovery response is malformed")
    const serviceIds = validateDiscoveryRecords(value.services, "service", manifest.organisation_id)
    const profileIds = validateDiscoveryRecords(value.profiles, "profile", manifest.organisation_id)
    for (const id of manifest.discovery.service_ids) require(serviceIds.includes(id), `discovery omitted Service ${id}`)
    for (const id of manifest.discovery.profile_ids) require(profileIds.includes(id), `discovery omitted Profile ${id}`)
    const sdkDiscovery = await new OatiLookupClient({ resolverUrls: [resolverUrl], fetch: fetcher, retry: { maxRetries: 0 } }).discoverOrganisation(manifest.organisation_id, { cache: "reload" })
    require(sdkDiscovery.services.length === value.services.length && sdkDiscovery.profiles.length === value.profiles.length, "SDK discovery disagrees with the raw response")
    return { services: serviceIds, profiles: profileIds }
  })

  const failed = checks.filter((item) => item.status === "fail").length
  return { schema_version: "1.0", checked_at: now.toISOString(), resolver_url: resolverUrl,
    inventory: { expected: OATI_RECORD_TYPES.length, resolved: records.size }, summary: { total: checks.length, passed: checks.length - failed, failed }, checks }
}

function validateManifest(manifest) {
  require(manifest?.schema_version === "1.0" && typeof manifest.resolver_url === "string" && typeof manifest.organisation_id === "string", "production smoke manifest is malformed")
  require(new URL(manifest.resolver_url).protocol === "https:", "manifest resolver_url must use HTTPS")
  require(new URL(manifest.cors_origin).origin === manifest.cors_origin, "manifest cors_origin must be an origin")
  require(Array.isArray(manifest.trust_anchors) && manifest.trust_anchors.length > 0, "manifest must declare at least one trust anchor")
  require(Array.isArray(manifest.records) && manifest.records.length === OATI_RECORD_TYPES.length, `manifest must contain exactly ${OATI_RECORD_TYPES.length} records`)
  const types = manifest.records.map((item) => item.type).sort()
  require(JSON.stringify(types) === JSON.stringify([...OATI_RECORD_TYPES].sort()), "manifest must cover every public record type exactly once")
  for (const item of manifest.records) require(typeof item.id === "string" && Array.isArray(item.statuses) && item.statuses.length && typeof item.audience === "string", `manifest entry ${item.type} is incomplete`)
  require(Array.isArray(manifest.discovery?.service_ids) && Array.isArray(manifest.discovery?.profile_ids), "manifest discovery expectations are incomplete")
}

async function requestWithRetry(fetcher, url, options) {
  let last
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(5_000) })
      if (![429, 502, 503, 504].includes(response.status) || attempt === 2) return response
      last = new Error(`${url} returned HTTP ${response.status}`)
    } catch (error) { last = error; if (attempt === 2) throw error }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100 * 2 ** attempt))
  }
  throw last
}

function responseContract(response, manifest, options = {}) {
  require(response.headers.get("content-type")?.startsWith("application/json"), "content-type is not application/json")
  require(response.headers.get("oati-version") === "1.0", "OATI-Version response header is missing")
  require(response.headers.get("x-request-id"), "X-Request-ID is missing")
  require(response.headers.get("access-control-allow-origin") === manifest.cors_origin, "public CORS origin is incorrect")
  if (options.cache) {
    require(response.headers.get("cache-control")?.includes("public"), "public Cache-Control is missing")
    require(response.headers.get("etag"), "ETag is missing")
    for (const header of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]) require(response.headers.get(header), `${header} is missing`)
  }
}

function privacyProjection(record) {
  for (const key of Object.keys(record)) require(!forbiddenProjectionKeys.has(key), `forbidden projection field ${key} leaked`)
  for (const key of Object.keys(record.public_attributes ?? {})) require(!forbiddenProjectionKeys.has(key), `forbidden public attribute ${key} leaked`)
}

function validateDiscoveryRecords(records, type, organisationId) {
  return records.map((record) => {
    require(record.type === type && record.organisation_id === organisationId && record.status === "active" && record.proof_status === "verified", `untrusted ${type} discovery record ${record.id}`)
    const document = JSON.parse(record.public_attributes.document)
    const schema = type === "service" ? "serviceDiscovery" : "profileDiscovery"
    const result = validateSchema(schema, document)
    require(result.valid, `${record.id} discovery document is schema-invalid`)
    require(document.id === record.id && document.organisation_id === organisationId, `${record.id} discovery document is mismatched`)
    return record.id
  })
}

async function responseJson(response) { try { return await response.json() } catch { throw new Error(`HTTP ${response.status} did not return JSON`) } }
function problemCode(value) { return value?.error?.code ?? "unknown_error" }
function structuredProblem(value, status) { require(value?.error?.status === status && typeof value.error.code === "string" && typeof value.error.request_id === "string" && typeof value.error.retryable === "boolean", `HTTP ${status} error contract is malformed`) }
function require(condition, message) { if (!condition) throw new Error(message) }

async function main() {
  const args = process.argv.slice(2)
  const option = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1] }
  const manifestPath = resolve(option("--manifest") ?? defaultManifest)
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  const report = await runProductionLookupSmoke({ manifest })
  const output = option("--output")
  if (output) await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (report.summary.failed) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
