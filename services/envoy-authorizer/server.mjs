import crypto from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import net from "node:net"
import tls from "node:tls"
import { pathToFileURL } from "node:url"
import {
  LookupTrustResolver,
  MemoryReplayCache,
  OatiLookupClient,
  canonicalJson,
  createOatiMiddleware,
  extractOatiHeaders,
  signDocumentWithSigner,
  verifyDocument,
} from "../../sdk/typescript/dist/index.js"

const ALLOWED_RESPONSE_HEADERS = new Set([
  "content-type", "x-oati-decision", "x-oati-transaction-id", "x-oati-correlation-id",
  "x-oati-receipt-id", "x-oati-receipt", "x-oati-reason-codes",
])

export function createApplication(config = configuration()) {
  config = { ...config, invalidationToken: configuredInvalidationToken(config), evidenceToken: configuredEvidenceToken(config) }
  const valkey = config.valkey ?? new ValkeyClient(config.valkeyUrl, config.valkeyPasswordFile, config.valkeyTlsCAFile, config.valkeyTlsServerName)
  const replayCache = config.replayCache ?? new ValkeyReplayCache(valkey, config.replayPrefix)
  const usageStore = config.usageStore ?? new ValkeyUsageStore(valkey, config.usagePrefix)
  const lookup = config.lookup ?? new OatiLookupClient({
    resolverUrls: config.resolverUrls, timeoutMs: config.lookupTimeoutMs, retry: { maxRetries: 1, baseDelayMs: 50, maxDelayMs: 200 },
    cache: { ttlMs: config.lookupCacheMs, negativeTtlMs: Math.min(config.lookupCacheMs, 5_000), maxEntries: 5_000 },
  })
  const resolver = config.resolver ?? new LookupTrustResolver(lookup)
  const signer = config.signer ?? new TransitSigner(config)
  const middleware = createOatiMiddleware({
    receiptIssuer: config.receiptIssuer,
    verificationPolicy: (kind, request) => gatewayVerificationPolicy(kind, request, { config, lookup, resolver, replayCache }),
    usageStore,
    evaluationExtensions: (_request, extracted) => ({
      ...(extracted.envelope.extensions?.commerce ? { commerce: commerceEvaluationContext(extracted.envelope.extensions.commerce) } : {}),
      ...(extracted.envelope.extensions?.rwa ? { rwa: extracted.envelope.extensions.rwa } : {}),
    }),
    maxHeaderBytes: config.maxHeaderBytes,
    maxBodyBytes: config.maxBodyBytes,
    requireRequestDigest: true,
    allowedReceiptOutcome: "pending",
    signReceipt: async (draft) => signDocumentWithSigner({ oati_version: "1.0", ...draft }, {
      algorithm: "EdDSA", verificationMethod: config.receiptVerificationMethod, audience: config.expectedAudience,
      nonce: crypto.randomBytes(18).toString("base64url"), created: new Date(), expires: new Date(Date.now() + config.receiptProofLifetimeMs),
      sign: (input) => signer.signAndVerify(input),
    }),
    emitReceipt: async (receipt) => {
      await valkey.command("XADD", config.receiptStream, "*", "receipt", canonicalJson(receipt))
      if (config.evidenceUrl) await persistEvidence(config, receipt)
    },
  })

  return async function application(request, response) {
    if (request.url === "/healthz") return json(response, 200, { status: "ok" })
    if (request.url === "/readyz") {
      try {
        await valkey.command("PING")
        await signer.ready()
        await lookupReady(config)
        if (config.evidenceUrl) await evidenceReady(config)
        return json(response, 200, { status: "ready" })
      } catch {
        return json(response, 503, { status: "not_ready" })
      }
    }
    if (request.url === "/invalidate-cache") {
      if (request.method !== "POST") return json(response, 405, { error: "method_not_allowed" })
      if (!cacheInvalidationAuthorized(request, config)) return json(response, 401, { error: "unauthorized" })
      try {
        const payload = JSON.parse((await boundedBody(request, 65_536)).toString("utf8"))
        if (!Array.isArray(payload.records) || payload.records.length < 1 || payload.records.length > 100) throw new Error("invalid records")
        for (const record of payload.records) {
          if (!record || !["organisation", "issuer", "key", "agent", "passport", "mandate", "receipt", "revocation", "service", "profile"].includes(record.type) || typeof record.id !== "string" || record.id.length < 1 || record.id.length > 512) throw new Error("invalid record")
          lookup.clearCache(record.type, record.id)
          if (record.type === "revocation") lookup.clearRevocationTargetCache()
        }
        return json(response, 200, { cache_invalidated: true, records: payload.records.length })
      } catch {
        return json(response, 400, { error: "invalid_invalidation_request" })
      }
    }
    if (!request.url?.startsWith("/authorize/")) return json(response, 404, { error: "not_found" })
    try {
      const body = await boundedBody(request, config.maxBodyBytes)
      const target = request.url.slice("/authorize".length) || "/"
      const headers = new Headers()
      for (const [name, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) for (const item of value) headers.append(name, item)
        else if (value !== undefined) headers.set(name, value)
      }
      const verificationRequest = new Request(new URL(target, config.externalOrigin), {
        method: request.method, headers, ...(body.byteLength === 0 || request.method === "GET" || request.method === "HEAD" ? {} : { body }),
      })
      const decision = await middleware(verificationRequest, (_verifiedRequest, context) => new Response(null, { status: 200, headers: {
        "x-oati-decision": "allow", "x-oati-transaction-id": context.transactionId, "x-oati-correlation-id": context.correlationId,
        "x-oati-reason-codes": context.evaluation.reason_codes.join(","),
      } }))
      await writeDecision(response, decision)
    } catch (error) {
      json(response, error?.code === "BODY_TOO_LARGE" ? 413 : 503, { error: error?.code === "BODY_TOO_LARGE" ? "request_too_large" : "authorization_unavailable" })
    }
  }
}

function commerceEvaluationContext(value) {
  return {
    merchant_organisation_id: value.merchant_organisation_id, service_id: value.service_id, offer_id: value.offer_id,
    currency: value.currency, quantity: value.quantity, unit_price: value.quoted_unit_price,
    total_amount: value.quoted_total, idempotency_key: value.idempotency_key, terms_digest: value.terms_digest,
  }
}

async function gatewayVerificationPolicy(kind, request, dependencies) {
  const { config, lookup, resolver, replayCache } = dependencies
  const extracted = extractOatiHeaders(request, config.maxHeaderBytes)
  const base = {
    resolver, trustAnchors: config.trustAnchors, replayCache,
    clockSkewMs: config.clockSkewMs, maxProofAgeMs: config.maxProofAgeMs, maxTrustDepth: config.maxTrustDepth,
  }
  if (kind === "mandate" || kind === "parent_mandate") {
    const document = kind === "mandate" ? extracted.mandate : extracted.parentMandate
    if (!document) return { ...base, expectedAudience: config.mandateAudience }
    const record = await boundPublicDocument(lookup, "mandate", document.id, document)
    return { ...base, expectedAudience: config.mandateAudience, resolver: lifecycleResolver(resolver, document.id, record) }
  }

  const passportRecord = await boundPublicDocument(lookup, "passport", extracted.envelope.agent_id)
  const passport = JSON.parse(passportRecord.public_attributes.signed_document)
  const passportPolicy = {
    ...base, expectedAudience: config.passportAudience, replayCache: new MemoryReplayCache(),
    maxProofAgeMs: Number.MAX_SAFE_INTEGER, resolver: lifecycleResolver(resolver, passport.id, passportRecord),
  }
  const verifiedPassport = await verifyDocument(passport, passportPolicy)
  const method = passport.verification_methods?.find((candidate) => candidate.id === extracted.envelope.proof?.verification_method)
  const runtimeRecord = method ? await lookup.lookup("key", method.id) : undefined
  const runtimeMatches = runtimeRecord?.status === "active" && runtimeRecord.proof_status === "verified"
    && runtimeRecord.issuer === passport.issuer && runtimeRecord.public_attributes.controller === passport.id
    && canonicalJson(JSON.parse(runtimeRecord.public_attributes.public_key_jwk)) === canonicalJson(method.public_key_jwk)
  return {
    ...base, expectedAudience: config.expectedAudience,
    resolver: verifiedPassport.verified && method?.controller === passport.id && runtimeMatches
      ? resolver
      : unavailableRuntimeResolver(resolver, extracted.envelope.proof?.verification_method),
  }
}

async function boundPublicDocument(lookup, kind, id, presented) {
  const record = await lookup.lookup(kind, id)
  if (record.proof_status !== "verified" || typeof record.public_attributes.signed_document !== "string") throw new Error(`${kind} public projection is not verified`)
  const signed = JSON.parse(record.public_attributes.signed_document)
  if (presented && canonicalJson(signed) !== canonicalJson(presented)) throw new Error(`${kind} does not match its public projection`)
  return record
}

function lifecycleResolver(upstream, documentID, record) {
  return {
    resolveKey: (id) => upstream.resolveKey(id),
    resolveIssuer: (id) => upstream.resolveIssuer(id),
    resolveRevocation: async (target) => target === documentID && record.status !== "active"
      ? { target, status: record.status === "suspended" ? "suspended" : "revoked", effectiveAt: record.issued_at }
      : upstream.resolveRevocation(target),
  }
}

function unavailableRuntimeResolver(upstream, runtimeKeyID) {
  return {
    resolveKey: (id) => id === runtimeKeyID ? null : upstream.resolveKey(id),
    resolveIssuer: (id) => upstream.resolveIssuer(id),
    resolveRevocation: (target) => upstream.resolveRevocation(target),
  }
}

export function configuration(environment = process.env) {
  const required = (name) => { const value = environment[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value }
  const integer = (name, fallback, minimum, maximum) => {
    const value = Number(environment[name] ?? fallback)
    if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`)
    return value
  }
  const production = environment.OATI_ENVIRONMENT === "production"
  const config = {
    port: integer("PORT", 9001, 1, 65535), externalOrigin: normalizedOrigin(required("OATI_GATEWAY_EXTERNAL_ORIGIN"), production),
    expectedAudience: required("OATI_GATEWAY_EXPECTED_AUDIENCE"), receiptIssuer: required("OATI_GATEWAY_RECEIPT_ISSUER"),
    mandateAudience: environment.OATI_GATEWAY_MANDATE_AUDIENCE ?? "oati:production:mandate",
    passportAudience: environment.OATI_GATEWAY_PASSPORT_AUDIENCE ?? "oati:production:passport",
    receiptVerificationMethod: required("OATI_GATEWAY_RECEIPT_VERIFICATION_METHOD"),
    trustAnchors: required("OATI_GATEWAY_TRUST_ANCHORS").split(",").map((value) => value.trim()).filter(Boolean),
    resolverUrls: required("OATI_LOOKUP_RESOLVER_URLS").split(",").map((value) => value.trim()).filter(Boolean),
    valkeyUrl: required("VALKEY_URL"), valkeyPasswordFile: environment.VALKEY_PASSWORD_FILE,
    valkeyTlsCAFile: environment.VALKEY_TLS_CA_FILE, valkeyTlsServerName: environment.VALKEY_TLS_SERVER_NAME,
    replayPrefix: environment.OATI_GATEWAY_REPLAY_PREFIX ?? "oati:gateway:replay:",
    usagePrefix: environment.OATI_GATEWAY_USAGE_PREFIX ?? "oati:gateway:usage:", receiptStream: environment.OATI_GATEWAY_RECEIPT_STREAM ?? "oati:gateway:receipts",
    lookupTimeoutMs: integer("OATI_GATEWAY_LOOKUP_TIMEOUT_MS", 1500, 100, 10_000), lookupCacheMs: integer("OATI_GATEWAY_LOOKUP_CACHE_MS", 15_000, 0, 60_000),
    clockSkewMs: integer("OATI_GATEWAY_CLOCK_SKEW_MS", 30_000, 0, 300_000), maxProofAgeMs: integer("OATI_GATEWAY_MAX_PROOF_AGE_MS", 300_000, 1_000, 900_000),
    maxTrustDepth: integer("OATI_GATEWAY_MAX_TRUST_DEPTH", 8, 1, 32), maxHeaderBytes: integer("OATI_GATEWAY_MAX_HEADER_BYTES", 65_536, 1024, 262_144),
    maxBodyBytes: integer("OATI_GATEWAY_MAX_BODY_BYTES", 1_048_576, 0, 10_485_760), receiptProofLifetimeMs: integer("OATI_GATEWAY_RECEIPT_PROOF_LIFETIME_MS", 300_000, 10_000, 900_000),
    transitAddr: required("OATI_TRANSIT_ADDR").replace(/\/$/, ""), transitMount: environment.OATI_TRANSIT_MOUNT ?? "transit",
    transitKeyName: required("OATI_GATEWAY_TRANSIT_KEY_NAME"), transitKeyVersion: integer("OATI_GATEWAY_TRANSIT_KEY_VERSION", undefined, 1, 2_147_483_647),
    transitTokenFile: required("OATI_TRANSIT_TOKEN_FILE"),
    invalidationTokenFile: environment.OATI_GATEWAY_INVALIDATION_TOKEN_FILE,
    evidenceUrl: optionalServiceUrl(environment.OATI_GATEWAY_EVIDENCE_URL, production, "OATI_GATEWAY_EVIDENCE_URL"),
    evidenceTokenFile: environment.OATI_GATEWAY_EVIDENCE_TOKEN_FILE,
    evidenceTimeoutMs: integer("OATI_GATEWAY_EVIDENCE_TIMEOUT_MS", 1500, 100, 10_000),
    transitTimeoutMs: integer("OATI_GATEWAY_TRANSIT_TIMEOUT_MS", 1500, 100, 10_000),
    tlsCertFile: environment.OATI_GATEWAY_TLS_CERT_FILE, tlsKeyFile: environment.OATI_GATEWAY_TLS_KEY_FILE, tlsClientCAFile: environment.OATI_GATEWAY_TLS_CLIENT_CA_FILE,
    production,
  }
  if (config.trustAnchors.length === 0 || config.resolverUrls.length === 0) throw new Error("at least one trust anchor and resolver URL are required")
  if (production && (!config.tlsCertFile || !config.tlsKeyFile || !config.tlsClientCAFile)) throw new Error("production authorizer requires mTLS certificate, key, and client CA")
  if (production && !config.invalidationTokenFile) throw new Error("production authorizer requires an invalidation bearer token file")
  if (production && (!config.evidenceUrl || !config.evidenceTokenFile)) throw new Error("production authorizer requires the evidence service URL and bearer token file")
  if (production && config.resolverUrls.some((value) => new URL(value).protocol !== "https:")) throw new Error("production lookup resolvers must use HTTPS")
  if (production && new URL(config.transitAddr).protocol !== "https:") throw new Error("production Transit endpoint must use HTTPS")
  const valkey = new URL(config.valkeyUrl)
  if (production && valkey.protocol !== "rediss:") throw new Error("production authorizer requires TLS-protected Valkey (rediss)")
  if (production && (!valkey.username || (!valkey.password && !config.valkeyPasswordFile))) throw new Error("production authorizer requires a Valkey ACL username and password file")
  return config
}

function optionalServiceUrl(value, production, name) {
  if (!value?.trim()) return undefined
  const url = new URL(value.trim())
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error(`${name} must be an origin without path, credentials, query, or fragment`)
  if (production && !["https:", "http:"].includes(url.protocol)) throw new Error(`${name} must use HTTP or HTTPS`)
  return url.toString().replace(/\/$/, "")
}

async function persistEvidence(config, receipt) {
  const response = await fetch(`${config.evidenceUrl}/evidence/v1/receipts`, {
    method: "POST", signal: AbortSignal.timeout(config.evidenceTimeoutMs),
    headers: { "Authorization": `Bearer ${config.evidenceToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ receipt }),
  })
  if (response.status !== 201) throw new Error(`evidence service returned ${response.status}`)
}

async function evidenceReady(config) {
  const response = await fetch(`${config.evidenceUrl}/readyz`, { signal: AbortSignal.timeout(config.evidenceTimeoutMs) })
  if (!response.ok) throw new Error("evidence service unavailable")
}

function cacheInvalidationAuthorized(request, config) {
  const expected = config.invalidationToken
  if (typeof expected !== "string" || expected.length < 32) return false
  const supplied = request.headers.authorization?.replace(/^Bearer /, "") ?? ""
  const left = Buffer.from(expected), right = Buffer.from(supplied)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function configuredInvalidationToken(config) {
  const token = config.invalidationToken ?? (config.invalidationTokenFile ? fs.readFileSync(config.invalidationTokenFile, "utf8").trim() : undefined)
  if (token !== undefined && token.length < 32) throw new Error("gateway invalidation bearer token must contain at least 32 characters")
  if (config.production && token === undefined) throw new Error("production authorizer requires an invalidation bearer token")
  return token
}

function configuredEvidenceToken(config) {
  if (!config.evidenceUrl) return undefined
  const token = config.evidenceToken ?? (config.evidenceTokenFile ? fs.readFileSync(config.evidenceTokenFile, "utf8").trim() : undefined)
  if (typeof token !== "string" || token.length < 32) throw new Error("evidence bearer token must contain at least 32 characters")
  return token
}

class TransitSigner {
  constructor(config) { this.config = config }
  async signAndVerify(input) {
    const token = fs.readFileSync(this.config.transitTokenFile, "utf8").trim()
    if (!token) throw new Error("Transit token is empty")
    const base = `${this.config.transitAddr}/v1/${encodeURIComponent(this.config.transitMount)}`
    const common = { method: "POST", headers: { "Content-Type": "application/json", "X-Vault-Token": token } }
    const encoded = Buffer.from(input).toString("base64")
    const signed = await fetch(`${base}/sign/${encodeURIComponent(this.config.transitKeyName)}`, { ...common, signal: AbortSignal.timeout(this.config.transitTimeoutMs), body: JSON.stringify({ input: encoded, signature_algorithm: "ed25519", prehashed: false, key_version: this.config.transitKeyVersion }) })
    if (!signed.ok) throw new Error(`Transit sign returned ${signed.status}`)
    const signatureValue = (await signed.json())?.data?.signature
    if (typeof signatureValue !== "string") throw new Error("Transit sign response omitted signature")
    if (signatureValue.split(":")[1] !== `v${this.config.transitKeyVersion}`) throw new Error("Transit used a key version other than the pinned Receipt version")
    const verified = await fetch(`${base}/verify/${encodeURIComponent(this.config.transitKeyName)}`, { ...common, signal: AbortSignal.timeout(this.config.transitTimeoutMs), body: JSON.stringify({ input: encoded, signature: signatureValue, signature_algorithm: "ed25519", prehashed: false }) })
    if (!verified.ok || (await verified.json())?.data?.valid !== true) throw new Error("Transit did not verify its receipt signature")
    const encodedSignature = signatureValue.split(":").at(-1)
    const raw = Buffer.from(encodedSignature, "base64")
    if (raw.byteLength !== 64) throw new Error("Transit returned a non-Ed25519 signature")
    return new Uint8Array(raw)
  }
  async ready() {
    const token = fs.readFileSync(this.config.transitTokenFile, "utf8").trim()
    const response = await fetch(`${this.config.transitAddr}/v1/${encodeURIComponent(this.config.transitMount)}/keys/${encodeURIComponent(this.config.transitKeyName)}`, { signal: AbortSignal.timeout(this.config.transitTimeoutMs), headers: { "X-Vault-Token": token } })
    if (!response.ok) throw new Error("Transit key unavailable")
    const payload = await response.json()
    if (!payload?.data?.keys?.[String(this.config.transitKeyVersion)]?.public_key) throw new Error("pinned Transit key version unavailable")
  }
}

class ValkeyReplayCache {
  constructor(client, prefix) { this.client = client; this.prefix = prefix }
  async checkAndStore(key, expiresAt, now = new Date()) {
    const ttl = Math.max(1, expiresAt.getTime() - now.getTime())
    return await this.client.command("SET", this.prefix + digestKey(key), "1", "PX", String(ttl), "NX") === "OK"
  }
}

class ValkeyUsageStore {
  constructor(client, prefix) { this.client = client; this.prefix = prefix; this.raw = new WeakMap() }
  async load(mandateId) {
    const stored = await this.client.command("GET", this.prefix + digestKey(mandateId))
    const value = stored === null ? {} : JSON.parse(stored)
    this.raw.set(value, stored ?? "")
    return value
  }
  async compareAndSet(mandateId, previous, next) {
    const script = "local c=redis.call('GET',KEYS[1]); if (c or '') ~= ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1"
    return await this.client.command("EVAL", script, "1", this.prefix + digestKey(mandateId), this.raw.get(previous) ?? "", JSON.stringify(next)) === 1
  }
}

class ValkeyClient {
  constructor(value, passwordFile, tlsCAFile, tlsServerName) {
    this.url = new URL(value); this.passwordFile = passwordFile; this.tlsCAFile = tlsCAFile; this.tlsServerName = tlsServerName
    if (!["redis:", "rediss:"].includes(this.url.protocol)) throw new Error("VALKEY_URL must use redis or rediss")
  }
  command(...parts) {
    return new Promise((resolve, reject) => {
      const options = { host: this.url.hostname, port: Number(this.url.port || 6379),
        ...(this.url.protocol === "rediss:" ? { servername: this.tlsServerName ?? this.url.hostname, rejectUnauthorized: true,
          ...(this.tlsCAFile ? { ca: fs.readFileSync(this.tlsCAFile) } : {}) } : {}) }
      const socket = this.url.protocol === "rediss:" ? tls.connect(options) : net.createConnection(options)
      const commands = []
      const password = this.passwordFile ? fs.readFileSync(this.passwordFile, "utf8").trim() : decodeURIComponent(this.url.password)
      if (password) commands.push(this.url.username ? ["AUTH", decodeURIComponent(this.url.username), password] : ["AUTH", password])
      const database = this.url.pathname.replace(/^\//, "")
      if (database && database !== "0") commands.push(["SELECT", database])
      commands.push(parts)
      let buffer = Buffer.alloc(0), completed = 0, settled = false
      socket.setTimeout(2000)
      socket.on(this.url.protocol === "rediss:" ? "secureConnect" : "connect", () => socket.write(commands.map(resp).join("")))
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk])
        try {
          while (completed < commands.length) {
            const parsed = parseResp(buffer)
            if (!parsed) return
            buffer = buffer.subarray(parsed.bytes); completed += 1
            if (parsed.error) { settled = true; socket.destroy(); reject(parsed.error); return }
            if (completed === commands.length) { settled = true; socket.end(); resolve(parsed.value); return }
          }
        } catch (error) { settled = true; socket.destroy(); reject(error) }
      })
      socket.on("timeout", () => socket.destroy(new Error("Valkey timeout")))
      socket.on("error", (error) => { if (!settled) reject(error) })
    })
  }
}

function resp(parts) { return `*${parts.length}\r\n${parts.map((part) => { const value = String(part); return `$${Buffer.byteLength(value)}\r\n${value}\r\n` }).join("")}` }
function parseResp(buffer) {
  const end = buffer.indexOf("\r\n"); if (end < 0) return null
  const type = String.fromCharCode(buffer[0]), head = buffer.subarray(1, end).toString(), offset = end + 2
  if (type === "+") return { value: head, bytes: offset }
  if (type === "-") return { error: new Error(head), bytes: offset }
  if (type === ":") return { value: Number(head), bytes: offset }
  if (type === "$" && Number(head) === -1) return { value: null, bytes: offset }
  if (type === "$") { const size = Number(head); if (buffer.length < offset + size + 2) return null; return { value: buffer.subarray(offset, offset + size).toString(), bytes: offset + size + 2 } }
  throw new Error("unsupported Valkey response")
}
function digestKey(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function normalizedOrigin(value, production) {
  const url = new URL(value)
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error("OATI_GATEWAY_EXTERNAL_ORIGIN must be an origin without path, credentials, query, or fragment")
  if (production && url.protocol !== "https:") throw new Error("production gateway external origin must use HTTPS")
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("gateway external origin must use HTTP or HTTPS")
  return url.origin
}
async function lookupReady(config) {
  const checks = config.resolverUrls.map(async (base) => {
    const response = await fetch(`${base.replace(/\/$/, "")}/status`, { signal: AbortSignal.timeout(config.lookupTimeoutMs) })
    if (!response.ok) throw new Error(`lookup readiness returned ${response.status}`)
  })
  await Promise.any(checks)
}
async function boundedBody(request, maximum) {
  const chunks = []; let size = 0
  for await (const chunk of request) { size += chunk.length; if (size > maximum) { const error = new Error("body too large"); error.code = "BODY_TOO_LARGE"; throw error } chunks.push(chunk) }
  return Buffer.concat(chunks)
}
async function writeDecision(response, decision) {
  response.statusCode = decision.status
  for (const [rawName, value] of decision.headers) {
    const name = rawName.toLowerCase().replace(/^oati-/, "x-oati-")
    if (ALLOWED_RESPONSE_HEADERS.has(name)) response.setHeader(name, value)
  }
  if (decision.status === 200) return response.end()
  const body = Buffer.from(await decision.arrayBuffer()); response.setHeader("content-length", body.length); response.end(body)
}
function json(response, status, value) { const body = JSON.stringify(value); response.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) }); response.end(body) }

export function start(config = configuration()) {
  const application = createApplication(config)
  const server = config.tlsCertFile ? https.createServer({
    cert: fs.readFileSync(config.tlsCertFile), key: fs.readFileSync(config.tlsKeyFile), ca: fs.readFileSync(config.tlsClientCAFile), requestCert: true, rejectUnauthorized: true,
  }, application) : http.createServer(application)
  return server.listen(config.port, "0.0.0.0")
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start()
