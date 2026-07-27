# Schemas

Versioned JSON Schemas for OATI Passport, Mandate, Transaction Envelope, Authorisation Decision, and Action Receipt objects. Draft 2020-12 is the initial schema dialect. Schemas describe structure; signature suites, canonicalisation, delegation subset evaluation, issuer trust, and selective disclosure are normative protocol concerns implemented by the SDKs and conformance suite.

Domain schemas live under `commerce/` and `rwa/`. Profiled core objects remain valid core objects and place domain fields under namespaced `extensions.commerce` or `extensions.rwa` members.

Cryptographic interoperability uses the proof, verification-key, issuer, and revocation schemas together with the [OATI Cryptographic Profile](../specification/CRYPTOGRAPHIC_PROFILE.md).

Portable authorization uses the evaluation-request and evaluation-result schemas with the [Deterministic Authority Evaluator](../specification/AUTHORITY_EVALUATOR.md).
