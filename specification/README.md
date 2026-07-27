# OATI specification

This directory will contain the normative, versioned specification. Normative extraction from Intelliger's private product sources must preserve the following invariants:

- identity is verifiable, current, and revocable;
- every consequential action traces to an accountable organisation and current Mandate;
- delegated authority never amplifies;
- deterministic systems authorise and enforce;
- sensitive data stays in the customer environment wherever practical;
- the standard is implementable without the commercial Intelliger platform.

The first normative object set is Agent Passport, Agent Mandate, Agent Transaction Envelope, Authorisation Decision, and Action Receipt.

The developer-preview [`Cryptographic Profile 1.0`](CRYPTOGRAPHIC_PROFILE.md) defines canonical detached JWS proofs, Ed25519 and P-256, key rotation, issuer trust, revocation, time, audience, and replay verification.

Domain behaviour is defined through [`profiles/`](profiles/). The first developer-preview profiles cover Commerce paid-API transactions and RWA controlled minting.
