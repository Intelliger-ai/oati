# Request for independent protocol and implementation security review

## Objective

Assess whether the OATI 1.0 cryptographic profile and its reference implementations securely authenticate OATI objects under their stated threat model, fail closed under malformed or unavailable trust data, interoperate deterministically, and avoid creating authority beyond a verified Mandate. This is a pre-production review, not a compliance certification.

## Workstreams

### 1. Protocol design

- RFC 7797 detached JWS with `b64=false`, protected-header requirements, proof-field binding, and domain separation.
- Choice and use of Ed25519/EdDSA and P-256/ES256; algorithm and key-confusion resistance.
- OATI canonical JSON profile, Unicode/property ordering, number serialization, duplicate-key handling, and cross-runtime equivalence.
- Signer/controller/issuer binding, key lifecycle and rotation, trust anchors and child-issuer chains.
- Revocation semantics at signing time versus verification time, suspension, lookup ambiguity/unavailability, and cache effects.
- Proof/document time, exact audience matching, nonce construction, replay-key scope, atomic consumption, and distributed replay storage.
- Interaction between cryptographic validity, deterministic Mandate evaluation, Commerce/RWA constraints, HTTP message binding, OAuth/DPoP, MCP, and A2A adapters.

### 2. Public implementations

- TypeScript SDK signing, verification, canonicalization, lookup resolver, middleware, and protocol adapters.
- Go CLI signing/verification and persistent replay handling.
- Go and Python SDK cryptographic implementations, including explicit analysis of any behavior that does not yet implement the complete profile.
- Schema and conformance vectors, cross-language differential behavior, error handling, resource exhaustion, and unsafe defaults.
- Key import/parsing, curve and point validation, ES256 raw `R || S` handling, signature malleability, Ed25519 subgroup/canonical encoding behavior, base64url strictness, and exception paths.

### 3. Private platform implementation

- OpenBao/Vault Transit signing boundary, key creation policy, key-version pinning, response verification, TLS/token handling, and child-issuer separation.
- Production issuance, two-person fingerprint approval, tenant isolation/RLS, public projection, key/revocation publication, key rotation, and emergency revocation.
- OIDC and service-principal authorization for issuance, publication, approval, and security operations.
- End-to-end attack paths spanning the private issuer and public resolver/SDK verifier.

## Required adversarial tests

- Header/proof algorithm disagreement; `alg=none`; unknown/missing/duplicated `crit`; encoded rather than detached payload.
- JWK type/curve/algorithm mismatch; invalid, low-order, off-curve, non-canonical, oversized, and private-key-containing public inputs.
- DER/raw ES256 confusion, high-S handling, truncated/extended signatures, non-canonical base64url, and malformed UTF-8/JSON.
- Canonicalization collisions and differences across JavaScript, Go, and Python, including Unicode keys and numeric boundaries.
- Trust-chain cycles, excessive depth, parent substitution, untrusted anchors, issuer/key/object revocation, and ambiguous revocation target records.
- Boundary timestamps, skew abuse, excessive lifetime, audience type confusion, nonce collisions, replay races, cache failure, and resolver failover.
- Cross-tenant issuance/publication attempts, self-approval, role escalation, signer substitution, and stale CDN/public lookup data.

## Deliverables and severity

Use a recognized severity model such as CVSS 4.0 with an accompanying protocol-impact rationale. Each finding must include evidence, affected targets, exploit prerequisites, impact, and a concrete remediation. Separately list specification ambiguity, implementation defects, hardening opportunities, and test gaps. The final retest must identify the exact remediation commit and disposition of every finding.

Independence conflicts, subcontractors, use of automated or AI-assisted analysis, data handling, report publication, embargo, and intellectual-property terms must be declared before kickoff.
