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
  baseUrl: "https://api.intelliger.ai/oati/v1",
  timeoutMs: 5_000,
})

try {
  const agent = await lookup.lookup("agent", "oati:agent:intelliger:commerce-demo")
  console.log(agent.proof_status, agent.public_attributes)
} catch (error) {
  if (error instanceof OatiLookupError) {
    console.error(error.code, error.status, error.retryAfter)
  }
}
```

Lookup failures use stable codes: `LOOKUP_BAD_REQUEST`, `LOOKUP_NOT_FOUND`, `LOOKUP_RATE_LIMITED`, `LOOKUP_UNAVAILABLE`, `LOOKUP_INVALID_RESPONSE`, and `LOOKUP_TIMEOUT`.

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

## Package entry points

- `@intelliger/oati` — complete public API;
- `@intelliger/oati/validation` — schema validation only;
- `@intelliger/oati/lookup` — public resolver client only.
- `@intelliger/oati/crypto` — signing, trust resolution, replay, and verification.

Generated API documentation is available in [`docs/api/`](docs/api/README.md).

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm run docs
pnpm pack --dry-run
```

`pnpm test` rebuilds the embedded schema bundle, compiles the package, runs the SDK tests, and verifies every published schema and example.

## Security boundary

Schema validation establishes document structure, not authenticity or authority. Applications must use `verifyDocument` and an explicit local trust-anchor policy before treating a proof as verified. A valid proof establishes integrity and a trusted signer; it does not prove that a Mandate grants the requested business authority. Delegation subset and policy evaluation remain separate required controls.
