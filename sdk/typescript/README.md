# `@intelliger/oati`

The official TypeScript SDK for creating and validating OATI core objects, using the Commerce and RWA profiles, producing deterministic JSON, and resolving public OATI records.

> Status: developer preview. Object validation, lookup, detached-JWS signing, and policy-driven verification are functional. The cryptographic profile still requires independent specialist review before production-security claims.

## Install

```bash
pnpm add @intelliger/oati
```

The package is ESM and targets modern browsers, Node.js 20+, and runtimes with the Fetch API.

## Build and validate core objects

Builders add `oati_version: "1.0"` but deliberately do not invent identifiers, timestamps, authority, or proof material.

```ts
import {
  assertSchema,
  canonicalJson,
  createMandate,
  createTransactionEnvelope,
  validateSchema,
} from "@intelliger/oati"

const mandate = createMandate({
  id: "oati:mandate:buyer:purchase-1",
  issuer: "oati:org:buyer",
  subject: "oati:agent:buyer:purchasing",
  purpose: "Purchase one approved API call",
  actions: ["api.purchase"],
  resources: ["oati:service:seller:pricing"],
  not_before: "2026-07-27T12:00:00Z",
  expires_at: "2026-07-27T12:05:00Z",
  status: "active",
})

const validation = validateSchema("mandate", mandate)
if (!validation.valid) console.error(validation.issues)

// Throws OatiValidationError with structured schema issues when invalid.
assertSchema("mandate", mandate)

const envelope = createTransactionEnvelope({
  id: "oati:tx:buyer:request-1",
  agent_id: mandate.subject,
  organisation_id: "oati:org:buyer",
  mandate_id: mandate.id,
  action: "api.purchase",
  resource: "oati:service:seller:pricing",
  issued_at: "2026-07-27T12:01:00Z",
  nonce: "01J4EXAMPLE0000000000000000",
})

const signingPayload = canonicalJson(envelope)
```

Available core builders are `createPassport`, `createMandate`, `createTransactionEnvelope`, `createDecision`, and `createReceipt`.

## JSON Schema validation

The SDK embeds the published Draft 2020-12 schemas, so validation does not require filesystem or network access. Supported schema names are:

- `passport`, `mandate`, `envelope`, `decision`, and `receipt`;
- `commerceOffer`, `commerceMandate`, and `commerceReceipt`;
- `rwaAsset`, `rwaStateClaim`, `rwaMandate`, and `rwaReceipt`.

Use `getSchema(name)` when an integration needs the underlying schema document. It returns a defensive clone.

## Public lookup

```ts
import { OatiLookupClient, OatiLookupError } from "@intelliger/oati"

const lookup = new OatiLookupClient({
  resolverUrls: [
    "https://api.intelliger.ai/oati/v1",
    "https://backup-resolver.example/oati",
  ],
  timeoutMs: 5_000,
  retry: { maxRetries: 2, baseDelayMs: 200, maxDelayMs: 5_000 },
  cache: { ttlMs: 60_000, negativeTtlMs: 10_000, maxEntries: 500 },
})

try {
  // The type argument selects AgentRecord here. All ten record types are discriminated.
  const agent = await lookup.lookup("agent", "oati:agent:intelliger:commerce-demo", { signal })
  console.log(agent.proof_status, agent.public_attributes)
} catch (error) {
  if (error instanceof OatiLookupError) {
    console.error(error.code, error.status, error.retryAfter)
  }
}
```

`lookupDetailed()` additionally returns the resolver URL, cache disposition, and parsed rate-limit metadata. `lookupState()` provides a non-throwing union for `found`, `not_found`, `unavailable`, `invalid_proof`, and `unknown` states. Use `cache: "reload"` to revalidate with an ETag, `cache: "no-store"` to bypass storage, or `clearCache()` after an administrative state change.

Use `lookupRevocationByTarget(target)` when the caller has the issuer, key, Passport, Mandate, or other governed target ID rather than the revocation record ID. It calls the resolver's explicit `type=revocation&target=...` contract and rejects a response whose public target does not match. `LookupTrustResolver.resolveRevocation()` uses this path automatically.

Successful responses follow `Cache-Control`, `Expires`, and `ETag`; otherwise the configured TTL applies. HTTP 404 responses use the shorter negative TTL. Retries are bounded, use exponential backoff, honor `Retry-After`, and only apply to timeouts, rate limits, transport failures, and unavailable responses. Multiple `resolverUrls` fail over in order. Caller cancellation is distinct from timeout.

Lookup failures use stable codes: `LOOKUP_BAD_REQUEST`, `LOOKUP_NOT_FOUND`, `LOOKUP_RATE_LIMITED`, `LOOKUP_UNAVAILABLE`, `LOOKUP_INVALID_RESPONSE`, `LOOKUP_TIMEOUT`, and `LOOKUP_CANCELLED`.

`LookupTrustResolver` adapts typed `key`, `issuer`, and `revocation` records directly to `verifyDocument()`:

```ts
import { LookupTrustResolver } from "@intelliger/oati/crypto"

const resolver = new LookupTrustResolver(lookup)
```

For key lookup records, `issuer`, `issued_at`, and `expires_at` are canonical top-level fields. `public_attributes` contains key-specific material such as `controller`, `algorithm`, and `public_key_jwk`. The client normalizes the former legacy `issuer`, `valid_from`, and `valid_until` attributes during migration, but new resolvers and integrations should emit the top-level contract.

To test the SDK against the platform service, start `oati-platform/services/lookup-api` and run `pnpm test:lookup-integration`. Override `OATI_LOOKUP_URL`, `OATI_LOOKUP_TYPE`, and `OATI_LOOKUP_ID` for a deployed resolver.

## Reference HTTP middleware

The framework-neutral middleware uses standard Web `Request` and `Response` objects, so it works directly in modern Node.js, Next.js route handlers, Deno, Bun, and edge runtimes.

```ts
import {
  MemoryReplayCache,
  createOatiMiddleware,
  signDocument,
} from "@intelliger/oati"

const replayCache = new MemoryReplayCache() // use a distributed atomic cache in production
const middleware = createOatiMiddleware({
  receiptIssuer: "oati:org:merchant",
  verificationPolicy: (_kind, request) => ({
    resolver: lookupTrustResolver,
    trustAnchors: ["oati:issuer:intelliger"],
    expectedAudience: new URL(request.url).origin,
    replayCache,
  }),
  usageStore: {
    load: (mandateId) => usage.load(mandateId),
    compareAndSet: (mandateId, previous, next) => usage.compareAndSet(mandateId, previous, next),
  },
  signReceipt: (draft) => signDocument(
    { ...draft, oati_version: "1.0" },
    receiptSigningOptions,
  ),
})

export async function POST(request: Request) {
  return middleware(request, async (_request, context) => {
    return Response.json({ authorisedBy: context.mandate.id })
  })
}
```

Clients place base64url-encoded canonical JSON in `OATI-Envelope` and `OATI-Mandate`; delegated calls also send `OATI-Parent-Mandate`. Use `encodeOatiHeader()` to construct them. The middleware checks schemas, signatures, trust and revocation, audience, replay, Mandate authority, agent/subject binding, and the HTTP request digest before invoking the handler.

The HTTP binding digest is generated by `httpRequestDigest(request)` and placed in `Envelope.request_digest`. It binds the uppercase method, path plus query, and SHA-256 of the raw body. It deliberately excludes transport headers and origin so trusted proxies and resolver deployments do not invalidate the proof.

Every authenticated allow or denial produces a signed Receipt. Small receipts are returned in `OATI-Receipt`, while `OATI-Receipt-ID`, `OATI-Transaction-ID`, and `OATI-Correlation-ID` are always returned. Use `emitReceipt` for durable evidence storage. Constrained, profiled, and one-time Mandates require an atomic `usageStore`; absence or compare-and-set conflicts fail closed.

See the normative [HTTP middleware profile](../../specification/HTTP_MIDDLEWARE_PROFILE.md).

## Protocol adapters

`@intelliger/oati/adapters` maps protocol-native requests into the same OATI Envelope/Mandate authority context:

```ts
import {
  mcpProtectedResourceMetadata,
  mcpToolCallEnvelope,
  toAuthZenRequest,
  toCedarRequest,
  toOpaInput,
  verifyDpopProof,
} from "@intelliger/oati/adapters"
```

- MCP: RFC 9728 protected-resource metadata, OAuth carriers, `tools/call` Envelopes, and Receipt result metadata.
- A2A: Agent Card OAuth/OATI declarations, Message Envelopes, task/context bindings, and authority metadata.
- OAuth/DPoP: RFC 9449 ES256/EdDSA proof verification, `ath`, `htm`, `htu`, `iat`, `jti`, JWK thumbprints, replay, and OATI token-claim binding.
- AuthZEN: subject/action/resource/context requests and fail-closed Decision mapping.
- Cedar and OPA: normalized principal/action/resource/context mappings; OPA accepts only an exact boolean `true` result.
- Envoy: v3 `ext_authz` CheckRequest extraction and reviewed decision/Receipt response headers.

Protocol adapters translate data; they do not replace signature verification or deterministic authority evaluation. OAuth issuer/audience/scope validation remains the OAuth resource server’s responsibility. DPoP requires an atomic replay store, and external policy engines may narrow an OATI allow decision but must never override an OATI denial.

See the [Protocol Adapter Profile](../../specification/PROTOCOL_ADAPTERS.md) and [Envoy reference bundle](../../integrations/envoy/).

## Signing and verification

OATI uses an RFC 7797 detached JWS over canonical JSON. Both Ed25519 (`EdDSA`) and P-256 (`ES256`) are supported.

```ts
import {
  MemoryReplayCache,
  StaticTrustResolver,
  signDocument,
  verifyDocument,
} from "@intelliger/oati/crypto"

const signed = await signDocument(envelope, {
  algorithm: "EdDSA",
  verificationMethod: "oati:key:buyer:2026-07",
  privateKey, // CryptoKey or private JWK
  audience: "https://merchant.example",
  nonce: "01K0EXAMPLE000000000000000",
  expires: new Date(Date.now() + 5 * 60_000),
})

const result = await verifyDocument(signed, {
  resolver: new StaticTrustResolver(keys, issuers, revocations),
  trustAnchors: ["oati:issuer:intelliger-root"],
  expectedAudience: "https://merchant.example",
  replayCache: new MemoryReplayCache(),
})

if (!result.verified) console.error(result.issues)
```

`verifyDocument` evaluates the algorithm allow-list, detached JWS, key validity and rotation window, issuer chain, current revocation, document/proof timestamps, exact audience, signer binding, and atomic replay-cache result. `LookupTrustResolver` resolves trust material through an `OatiLookupClient`; `passportTrustResolver` resolves verification methods embedded in an Agent Passport.

`MemoryReplayCache` is only appropriate for development and a single process. Production deployments must provide a shared atomic `ReplayCache` implementation and protected KMS/HSM signing keys.

## Commerce and RWA

The existing profile APIs remain available:

```ts
import {
  createAssetStateClaim,
  createPurchaseMandate,
  validateCommerceReceipt,
  validateMintMandate,
  validateRwaReceipt,
} from "@intelliger/oati"
```

Profile semantic validators check cross-object constraints in addition to JSON Schema structure—for example Commerce price/currency limits and RWA reserve/approval constraints.

## Deterministic authority evaluation

```ts
import { evaluateAuthority } from "@intelliger/oati/evaluator"

const result = evaluateAuthority({
  oati_version: "1.0",
  evaluation_time: "2026-07-27T09:03:00Z",
  mandate,
  envelope,
  usage: {
    calls: 3,
    amount: "0.60",
    currency: "EUR",
    quantity: "3",
    consumed: false,
    idempotency_keys: ["request-1", "request-2", "request-3"],
  },
  commerce: quotedPurchase,
})

if (result.decision === "allow") {
  // Commit result.next_usage atomically with execution/receipt state.
}
```

The evaluator uses only the supplied time and usage snapshot. It checks activation and expiry, core action/resource/counterparty/destination/purpose constraints, parent-child subset and non-amplification, calls and budget consumption, one-time use, Commerce cumulative pricing, and RWA reserve/approval/supply controls. Decimal arithmetic is exact and does not use floating point.

Evaluation does not mutate or persist state. Production callers must atomically guard the prior snapshot and commit `next_usage` so concurrent requests cannot double-spend authority.

## Package entry points

- `@intelliger/oati` — complete public API;
- `@intelliger/oati/validation` — schema validation only;
- `@intelliger/oati/lookup` — public resolver client only.
- `@intelliger/oati/crypto` — signing, trust resolution, replay, and verification.
- `@intelliger/oati/evaluator` — deterministic authority decisions and proposed usage transitions.

Generated API documentation is available in [`docs/api/`](docs/api/README.md).

## Development

### Test identity issuance

`DevelopmentIssuer` runs the complete credential lifecycle locally with ephemeral Ed25519 keys. It creates a development organisation, registers an agent with an agent-bound transaction key, issues signed Passport and Mandate objects, signs example transactions and Receipts, produces strict public projections, and emits suspension or revocation records.

```ts
import { DevelopmentIssuer } from "@intelliger/oati/development"

const issuer = await DevelopmentIssuer.create({ slug: "acme-labs", displayName: "Acme Labs" })
const passport = await issuer.registerAgent({ slug: "buyer", displayName: "Buyer", protocols: ["mcp"] })
const mandate = await issuer.createMandate(passport.id, {
  purpose: "Exercise the sandbox API",
  actions: ["api.call"],
  resources: ["https://sandbox.example/api"],
})
const envelope = await issuer.signTransaction(passport.id, mandate, {
  action: "api.call",
  resource: "https://sandbox.example/api",
  protocol: "mcp",
})
const publicPassport = issuer.publish("passport", passport.id)
const registryRecords = issuer.registryRecords() // POST each to the private control plane
const revocation = issuer.setStatus("mandate", mandate.id, "revoked")
```

Development issuers and their keys are memory-only, deliberately marked with `assurance_level: development`, and must never be promoted into production trust stores.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm run docs
pnpm pack --dry-run
pnpm test:package-install -- npm
pnpm test:package-install -- pnpm
```

`pnpm test` rebuilds the embedded schema bundle, compiles the package, runs the SDK tests, and verifies every published schema and example. The package-install checks pack the SDK and install it into an empty consumer project before compiling its declarations and exercising every documented export path.

## Security boundary

Schema validation establishes document structure, not authenticity or authority. Applications must use `verifyDocument` and an explicit local trust-anchor policy before treating a proof as verified. A valid proof establishes integrity and a trusted signer; it does not prove that a Mandate grants the requested business authority. Delegation subset and policy evaluation remain separate required controls.
