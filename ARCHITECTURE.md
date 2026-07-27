# OATI public architecture

## Context

OATI is an Intelliger standard with an Apache-2.0 developer implementation and a separately deployed commercial platform. The public repository owns portable contracts; the private platform consumes them without redefining them.

```text
intelliger.ai/oati/lookup                 api.intelliger.ai/oati/v1
        lookup-web  --------------------------> lookup-api
                                                       |
                    +----------------------------------+------------------+
                    |              |                   |                  |
                PostgreSQL       Redis          Object storage       KMS/HSM
                public index   rate limits     evidence documents   signing keys

oati-platform (private) -- publishes approved public projections --> public index
```

## Trust boundary

The lookup service is a public projection, not the system of record for private transaction data. The private platform publishes only approved fields. Mandates and Receipts default to metadata, status, digest, issuer, timestamps, and verification material; payloads and private claims require explicit selective-disclosure grants.

## Public components

1. Normative specification and profiles.
2. Versioned JSON Schemas and canonicalisation/signing rules.
3. SDKs, verifier, CLI, adapters, examples, and conformance suite.
4. Public lookup UI.
5. Rate-limited lookup/resolver API.
6. Reference gateway/middleware sufficient for interoperability testing.

## Private components

The commercial control plane, policy compiler and studio, data-release engine, commercial-profile compiler, evidence and dispute operations, tenant administration, enterprise integrations, and network operations remain in `oati-platform`.

## Deployment

Services target Hetzner-hosted Kubernetes. Envoy terminates public traffic and delegates rate limiting and authorisation. Go services use PostgreSQL, Redis/Valkey, S3-compatible object storage, KMS/HSM-backed signing, and OpenTelemetry. CI/CD is intentionally unspecified and supplied by Intelliger.

## Versioning

- Schemas use stable `$id` URLs under `https://schemas.intelliger.ai/oati/`.
- APIs are path-versioned (`/oati/v1`).
- Standard releases use semantic versioning until a formal standards maturity process is adopted.
- Breaking schema changes require a new major schema identifier and conformance fixtures.
