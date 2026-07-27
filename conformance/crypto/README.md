# Cryptographic conformance

These vectors exercise the OATI Cryptographic Profile across implementations. The Ed25519 key is the public RFC 8032 test key and is not a production secret.

- `ed25519-private.jwk` — deterministic signing key for test generation only;
- `trust-bundle.json` — public key and root trust configuration;
- `unsigned-envelope.json` — canonical signing input object;
- `signed-envelope.json` — expected detached-JWS result produced at the fixed test time;
- `tampered-envelope.json` — signature-negative vector.

Conforming implementations must verify the signed vector for audience `https://merchant.example`, reject the tampered vector, reject a second use of the same nonce, and reject revoked or untrusted bundle variants.
