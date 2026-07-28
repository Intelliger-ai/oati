# Cryptographic conformance

These vectors exercise the OATI Cryptographic Profile across implementations. The Ed25519 key is the public RFC 8032 test key and is not a production secret.

- `ed25519-private.jwk` — deterministic signing key for test generation only;
- `trust-bundle.json` — public key and root trust configuration;
- `unsigned-envelope.json` — canonical signing input object;
- `signed-envelope.json` — expected detached-JWS result produced at the fixed test time;
- `tampered-envelope.json` — signature-negative vector.
- `es256-signed-envelope.json` and `es256-trust-bundle.json` — fixed P-256 detached-JWS vector; no private key is published;
- `issuer-chain-*.json` — valid multi-level, missing-parent, cyclic, and suspended issuer paths;
- `rotation-*.json` — retired-key overlap, missing retirement expiry, and proof-after-key-expiry behavior;
- `revocation-*.json` — key, issuer, and document targets, suspension, future-effective status, ambiguous records, and resolver unavailability.

Conforming implementations must verify the Ed25519 and ES256 vectors for audience `https://merchant.example`, reject tampering and replay, traverse issuer chains to a configured root, enforce key validity during rotation, and fail closed for effective, ambiguous, or unavailable revocation information. Suite `0.3` defines the exact expected code for every vector.
