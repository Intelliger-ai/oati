# OATI CLI

The OATI CLI is the quickest way to inspect and validate OATI objects while building an integration.

## Install

```bash
go install github.com/Intelliger-ai/oati/cli/cmd/oati@main
```

Or build from a clone:

```bash
go build -o ./bin/oati ./cli/cmd/oati
```

## Commands

```bash
# Validate a Passport, Mandate, Envelope, or Receipt
oati validate passport ./examples/passport.json

# Emit compact deterministic JSON with recursively sorted object keys
oati canonicalize ./examples/passport.json > passport.canonical.json

# Resolve a public OATI record
oati lookup \
  --type agent \
  --id oati:agent:intelliger:commerce-demo

# Use another compatible resolver
oati lookup --api http://localhost:8080/oati/v1 --type agent --id oati:agent:intelliger:commerce-demo

# Add an audience-bound, expiring detached JWS proof
oati sign \
  --algorithm EdDSA \
  --key ./private-signing-key.jwk \
  --verification-method oati:key:buyer:2026-07 \
  --audience https://merchant.example \
  --nonce 01K0EXAMPLE000000000000000 \
  --expires 5m \
  ./envelope.json > ./signed-envelope.json

# Verify signature, trust chain, revocation, time, audience, and replay
oati verify \
  --trust-bundle ./trust-bundle.json \
  --audience https://merchant.example \
  --replay-cache ./.oati-replay.json \
  ./signed-envelope.json

# Evaluate scope, delegation, budgets, Commerce/RWA constraints, and consumption
oati evaluate ./evaluation-request.json

# Validate the Commerce paid-API flow
oati commerce validate-offer ./examples/commerce/merchant-service-profile.json
oati commerce validate-mandate ./examples/commerce/purchase-mandate.json
oati commerce validate-receipt \
  --mandate ./examples/commerce/purchase-mandate.json \
  ./examples/commerce/commerce-receipt.json

# Validate the RWA controlled-mint flow
oati rwa validate-asset ./examples/rwa/asset-profile.json
oati rwa validate-state-claim ./examples/rwa/asset-state-claim.json
oati rwa validate-mint-mandate \
  --claim ./examples/rwa/asset-state-claim.json \
  ./examples/rwa/mint-mandate.json
oati rwa validate-receipt \
  --mandate ./examples/rwa/mint-mandate.json \
  ./examples/rwa/rwa-receipt.json
```

`validate` performs the structural and semantic checks implemented by this developer preview, including required fields, identifier prefixes, timestamps, status values, and object-specific invariants. Published JSON Schema and conformance vectors remain the interoperable source of truth.

## Cryptographic trust bundle

`verify` accepts a JSON bundle containing `trust_anchors`, `keys`, `issuers`, and `revocations`. See [`conformance/crypto/trust-bundle.json`](../conformance/crypto/trust-bundle.json). Private JWK files are accepted only by `sign`; never put production private keys or production replay state in this repository.

The CLI implements the developer-preview [OATI Cryptographic Profile](../specification/CRYPTOGRAPHIC_PROFILE.md), including Ed25519 and P-256. Its file replay cache is intended for local and single-process workflows. Production gateways require shared atomic replay storage and KMS/HSM-backed signing.

`evaluate` implements the [Deterministic Authority Evaluator](../specification/AUTHORITY_EVALUATOR.md). Evaluation requests include their own time and prior usage state. An allow result proposes `next_usage`; the CLI never persists it.

## Current boundary

The CLI is ready for schema-oriented development, fixtures, local testing, canonical JSON, public lookup, signing, proof verification, child-Mandate non-amplification, and deterministic authority evaluation.
