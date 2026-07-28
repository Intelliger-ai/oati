# Cryptographic threat model

## Security objectives

- A verifier accepts an OATI object only when its bytes, proof metadata, signer key, issuer chain, intended audience, validity window, and nonce are valid under local policy.
- A signed Passport or Mandate cannot be altered, replayed, re-addressed, re-keyed, or amplified without detection.
- Trust discovery cannot create a trust anchor, cross a tenant boundary, or conceal revocation/unavailability.
- Cryptographic success cannot bypass Mandate, Commerce, RWA, data-use, or non-amplification evaluation.
- Issuance and approval identities remain attributable and separated; public projections never expose private signing material.

## Trust boundaries

| Boundary | Trusted for | Not trusted for |
|---|---|---|
| Local verifier policy | anchors, expected audience, time/replay policy | remote identity assertions not yet verified |
| KMS/HSM/Transit | custody and use of private issuer keys | business authorization or publication approval |
| Public lookup | delivery of public projections | creating local trust anchors or overriding fail-closed policy |
| Issuer/child issuer | signed identity assertions within certification | expanding a Mandate or self-approving governance actions |
| Gateway/middleware | request transport and correlation | altering signed Envelope fields or skipping evaluation |
| Replay store | atomic uniqueness until proof expiry | signature or policy validity |

## Adversaries

- An unauthenticated network attacker able to create arbitrary JSON, headers, proofs, requests, and lookup identifiers.
- A malicious or compromised agent holding its own valid key and narrowly scoped Mandate.
- A compromised tenant administrator, issuer, publisher, approver, or integration credential, but not every separated role simultaneously.
- A malicious lookup response, stale/intercepted cache, unavailable resolver, or tenant attempting to publish another tenant’s identifier.
- A supply-chain attacker modifying an SDK, CLI, dependency, generated schema, conformance report, or container between review and release.
- A concurrency attacker racing replay, budget, publication, approval, rotation, or revocation operations.

## High-value assets

Issuer and agent private keys; trust-anchor configuration; Mandate authority; replay and usage state; production fingerprints and approvals; tenant registry data; public issuer/key/revocation integrity; Commerce budgets; RWA reserve and mint constraints; audit evidence.

## Explicit assumptions

- Production private keys are generated and retained in an appropriately administered signing boundary.
- Local trust anchors are provisioned out of band and are not learned from public lookup.
- Production replay and usage stores provide atomic operations across all verifier instances.
- Host, identity-provider, database, KMS/HSM, CI, DNS/TLS, and operator compromise require separate infrastructure controls; the review should still identify where one such compromise defeats OATI guarantees.
- Legal validity, organizational due diligence, oracle truth, asset ownership, reserve existence, and payment finality are outside cryptographic proof and require separate controls.

## Known pre-review risks

- The profile and every implementation remain developer preview until the independent gate closes.
- Language implementations do not necessarily have identical feature completeness; the reviewer must treat divergence as a finding or explicit limitation, not infer equivalence from a shared package name.
- In-memory replay storage and local trust bundles are development mechanisms, not horizontally scaled production controls.
- Public lookup availability and cache invalidation directly affect revocation freshness and must fail closed for material actions.
