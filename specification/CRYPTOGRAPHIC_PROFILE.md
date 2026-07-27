# OATI Cryptographic Profile 1.0

Status: developer preview. This profile requires independent specialist review before a production-security claim.

## Purpose

This profile defines one interoperable signing and verification procedure for OATI JSON objects. Structural validation alone does not establish authenticity or authority. A conforming verifier evaluates the signature together with key lifecycle, issuer trust, revocation, time, audience, and replay state.

## Algorithms

Implementations MUST use an explicit allow-list. Version 1 supports:

| JWS `alg` | Key | Cryptosuite |
|---|---|---|
| `EdDSA` | Ed25519 JWK (`OKP`, `Ed25519`) | `eddsa-jcs-2022` |
| `ES256` | P-256 JWK (`EC`, `P-256`) | `ecdsa-jcs-2019` |

Verifiers MUST reject algorithm/key mismatches, unknown algorithms, unsigned critical objects, and algorithm selection derived only from untrusted key material. Private keys belong in KMS, HSM, MPC, or an equivalently controlled signing boundary in production.

## Proof

The signed object carries a `proof` conforming to [`proof.schema.json`](../schemas/proof.schema.json):

```json
{
  "type": "OatiJwsProof2026",
  "cryptosuite": "eddsa-jcs-2022",
  "algorithm": "EdDSA",
  "created": "2026-07-27T12:00:00Z",
  "expires": "2026-07-27T12:05:00Z",
  "verification_method": "oati:key:example:signing-2026-07",
  "proof_purpose": "assertionMethod",
  "audience": "https://merchant.example",
  "nonce": "01K0EXAMPLE000000000000000",
  "signature": "<protected>..<signature>"
}
```

`created`, `expires`, `audience`, and a nonce of at least 16 characters are mandatory. Transaction verifiers SHOULD default to a maximum proof age of five minutes and clock tolerance of 30 seconds. A deployment may use stricter values.

## Canonical signing payload

OATI uses an RFC 7797 detached compact JWS with an unencoded payload:

1. Construct the proof without `signature` and place it in the document, replacing any previous proof.
2. Canonicalize the complete document using the OATI deterministic JSON profile: UTF-8 JSON, recursively lexicographically sorted object keys, no insignificant whitespace, finite JSON numbers only, and unchanged array order.
3. Canonicalize this protected header and encode it using unpadded base64url:

   ```json
   {"alg":"EdDSA","b64":false,"crit":["b64"],"kid":"oati:key:example:signing-2026-07","typ":"oati+jws"}
   ```

4. Sign the bytes `BASE64URL(protected) || "." || UTF8(canonical-document)`.
5. Store `BASE64URL(protected) + ".." + BASE64URL(signature)` in `proof.signature`.

Because the proof-without-signature is part of the canonical document, algorithm, key ID, timestamps, audience, nonce, and purpose are cryptographically bound.

For ES256, the JWS signature is the fixed-width 64-byte `R || S` form, not ASN.1 DER. EdDSA uses the 64-byte Ed25519 signature.

## Key resolution and rotation

`verification_method` resolves to a [`Verification Key`](../schemas/verification-key.schema.json), either from an Agent Passport or public lookup. A verifier MUST check:

- resolved ID and algorithm equal the protected proof values;
- JWK type and curve match the algorithm;
- key controller or issuer is bound to the document signer;
- proof creation falls within `valid_from` and `valid_until`;
- lookup metadata itself has verified status;
- the key is not revoked.

Rotation publishes the new key before use. An old key becomes `retired`, retaining its historical validity window so already-issued evidence remains verifiable. `retired` is not equivalent to compromised. A `revoked` key fails verification according to the verifier's revocation policy even when an older signature is mathematically correct.

## Issuer trust chain

The key's `issuer` starts a chain of [`Trusted Issuer`](../schemas/issuer.schema.json) records. Each non-root record names `parent`. Verification succeeds only when the finite, cycle-free, active chain reaches a locally configured trust anchor. Network discovery MUST NOT silently create a trust anchor. Suspended, revoked, expired, unverified, cyclic, or over-depth chains fail closed.

## Revocation

Verifiers evaluate current [`Revocation Status`](../schemas/revocation.schema.json) for the verification key, issuer, and signed object. `suspended` and `revoked` statuses effective at verification time fail closed. Lookup unavailability is a policy decision for low-risk reads, but financial, tokenisation, publication, and other material actions MUST fail closed.

## Time, audience, and replay

A verifier MUST:

- validate proof creation and expiry with bounded clock skew;
- reject proofs older than local maximum age;
- validate document `not_before` or `issued_at` and `expires_at` when present;
- require the expected local audience to appear exactly in `proof.audience`;
- atomically consume `(verification_method, audience, nonce)` until proof expiry;
- reject a previously consumed tuple as replay.

Replay state must be shared across horizontally scaled verifier instances for production transactions. In-memory storage is suitable only for local development and single-process tests.

## Verification order

Implementations SHOULD gather useful independent failures but MUST reach an allow result only when all checks pass:

1. parse proof and enforce algorithm allow-list;
2. validate proof and document time;
3. validate audience;
4. resolve and validate key lifecycle;
5. validate issuer chain to a configured anchor;
6. evaluate key, issuer, and object revocation;
7. validate signer/controller binding;
8. verify the detached JWS;
9. atomically consume replay state.

Successful signature verification does not itself establish that a Mandate grants the requested business authority. Mandate, policy, Commerce, and RWA constraints remain mandatory deterministic checks.
