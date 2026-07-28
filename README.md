# OATI

### Trusted transactions between enterprise agents.

**Open Agent Trust Infrastructure (OATI)** is an open standard by [Intelliger](https://intelliger.ai) for identifying enterprise agents, expressing short-lived delegated authority, enforcing transaction constraints, and producing verifiable action receipts across organisational boundaries.

An API credential can show that an agent may connect. OATI describes **who owns the agent, on whose authority it acts, what it may do now, and what evidence proves the transaction**.

- Website: `https://intelliger.ai/oati`
- Public lookup: `https://intelliger.ai/oati/lookup`
- Machine API: `https://api.intelliger.ai/oati/v1`
- Licence: [Apache 2.0](LICENSE)
- Status: **developer preview**

## Why OATI

Enterprise controls are split across identity providers, gateways, policy engines, data platforms, contracts, payments, and audit systems. A valid token alone does not reveal the responsible organisation, current delegated purpose, downstream data restrictions, commercial authority, or mutually verifiable evidence.

OATI binds those concerns into one portable transaction model:

```text
Verified organisation + Agent Passport + short-lived Mandate
        + Transaction Envelope + deterministic decision
        + signed Action Receipt
```

OATI complements OAuth, OIDC, SPIFFE, AuthZEN, Cedar, OPA, MCP, and A2A. It does not replace them.

## Core objects

| Object | Answers |
|---|---|
| **Agent Passport** | Who is this agent, who operates it, and how is that claim verified now? |
| **Agent Mandate** | What exact authority was delegated, by whom, for what purpose, and until when? |
| **Transaction Envelope** | What action, resource, destination, context, and proof are being evaluated? |
| **Authorisation Decision** | Was the transaction allowed, denied, transformed, or sent for approval—and under which policy? |
| **Action Receipt** | What happened, under which authority and controls, and what signed evidence can be checked later? |

The central invariant is **non-amplification**: a delegated Mandate may preserve or reduce authority, but it must never silently expand it.

## Domain profiles

OATI profiles add strict domain semantics while preserving the same core identity, authority, policy, and evidence model.

### Commerce 0.1 — paid APIs and digital services

The first Commerce workflow lets an enterprise agent purchase one API request under a seller-published offer and a buyer-issued Purchase Mandate. It constrains merchant, service, offer, currency, price, budget, quantity, purpose, destination, and data use.

- [Profile specification](specification/profiles/commerce/)
- [Paid-API quickstart](guides/commerce/quickstart.md)
- [Runnable objects](examples/commerce/)
- [Executable conformance suite](conformance/)

### RWA 0.1 — controlled token minting

The first RWA workflow permits bounded, one-time minting only against a current Asset State Claim, authorised roles, matching asset and token details, and the required approval threshold.

- [Profile specification](specification/profiles/rwa/)
- [Controlled-mint quickstart](guides/rwa/quickstart.md)
- [Runnable objects](examples/rwa/)
- [Conformance vectors](conformance/rwa/)

## Start in five minutes

Requirement: Go 1.24+.

```bash
git clone git@github.com:Intelliger-ai/oati.git
cd oati

# Validate the included Agent Passport
go run ./cli/cmd/oati validate passport ./examples/passport.json
```

## CLI

Install the developer-preview CLI:

```bash
go install github.com/Intelliger-ai/oati/cli/cmd/oati@main
```

Then validate, canonicalize, or resolve an OATI record:

```bash
oati validate passport ./examples/passport.json
oati canonicalize ./examples/passport.json
oati lookup --type agent --id oati:agent:intelliger:commerce-demo

oati sign --algorithm EdDSA --key ./private.jwk \
  --verification-method oati:key:example:2026-07 \
  --audience https://service.example \
  --nonce 01K0EXAMPLE000000000000000 \
  --expires 5m ./examples/commerce/transaction-envelope.json

oati evaluate ./evaluation-request.json

oati commerce validate-offer ./examples/commerce/merchant-service-profile.json
oati commerce validate-receipt \
  --mandate ./examples/commerce/purchase-mandate.json \
  ./examples/commerce/commerce-receipt.json

oati rwa validate-mint-mandate \
  --claim ./examples/rwa/asset-state-claim.json \
  ./examples/rwa/mint-mandate.json
```

The current CLI is ready for object validation, fixtures, deterministic JSON processing, lookup integration, detached-JWS signing, trust verification, delegation subset proofs, non-amplification, and deterministic Commerce/RWA authority evaluation. See [CLI documentation](cli/README.md).

## Repository map

| Path | Purpose |
|---|---|
| [`specification/`](specification/) | normative standard and protocol profiles |
| [`schemas/`](schemas/) | versioned JSON Schemas |
| [`examples/`](examples/) | valid example objects and transactions |
| [`cli/`](cli/) | developer CLI |
| [`sdk/`](sdk/) | TypeScript reference SDK plus Python and Go SDKs sharing one conformance suite |
| [`conformance/`](conformance/) | shared fixtures, test vectors, and compatibility tests |
| [`api/lookup.openapi.yaml`](api/lookup.openapi.yaml) | public lookup API contract for client generation |
| [`integrations/envoy/`](integrations/envoy/) | fail-closed Envoy ext_authz and OPA reference integration |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | system boundaries and deployment model |

## Public lookup and privacy

The lookup service resolves organisations, agents, Passports, Mandates, Receipts, issuers, keys, and revocation status. Public access is rate-limited.

Lookup is a **privacy-reviewed projection**, not an unrestricted view of OATI Platform records. Mandates and Receipts expose only approved metadata, status, digests, issuer information, timestamps, and verification material unless a selective-disclosure grant permits more.

The production lookup UI and service are operated from the private OATI Platform repository. Developers can integrate against the published [`OpenAPI contract`](api/lookup.openapi.yaml), use the CLI lookup client, or implement a compatible resolver.

## Open-source boundary

This repository is intended to contain everything an independent developer needs to implement and use the standard:

- specification, schemas, and examples;
- SDKs, verifier, and CLI;
- conformance tests and test vectors;
- MCP, A2A, OAuth, AuthZEN, and gateway adapters;
- lookup client contracts and test fixtures;
- reference middleware required for interoperability testing.

Intelliger’s production lookup service, commercial control plane, policy studio/compiler, data-release engine, commercial-profile compiler, evidence and dispute operations, enterprise integrations, tenant administration, and network operations remain in the private `Intelliger-ai/oati-platform` repository.

Private code may consume public OATI releases. Public code never depends on private packages.

## Security model

OATI uses deterministic systems for authorisation and enforcement. AI may help draft or explain policy, but it is not the final authority for identity, signatures, revocation, financial limits, policy deployment, or irreversible actions.

Do not report security vulnerabilities in a public issue. Until a dedicated security address is published, contact Intelliger through [intelliger.ai](https://intelliger.ai).

## Project status

The repository is an early developer preview. Core and profile schemas, Commerce and RWA flows, a functional CLI, and a tested TypeScript SDK now cover schema validation, lookup, signing, trust verification, deterministic authority evaluation, reference middleware, and MCP, A2A, OAuth/DPoP, AuthZEN, Cedar/OPA, and Envoy adapters. A versioned executable conformance suite covers core objects, canonicalization, cryptography, authority evaluation, and privacy projection. The cryptographic and protocol profiles require independent review and additional SDK languages remain under active development. Production lookup operations are deliberately outside this repository.

Compatibility claims must reference a published OATI version and conformance-suite version.

## Contributing

Issues and design discussions should identify the affected object, interoperability consequence, and proposed conformance test. Changes to a public object require a schema update and corresponding fixture.

By contributing, you agree that your contribution is licensed under Apache 2.0.

## Licence and stewardship

OATI is created and maintained by Intelliger and licensed under the [Apache License 2.0](LICENSE). The standard is designed to be implementable without buying an Intelliger product.
