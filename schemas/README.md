# Schemas

Versioned JSON Schemas for OATI Passport, Mandate, Transaction Envelope, Authorisation Decision, and Action Receipt objects. Draft 2020-12 is the initial schema dialect. Schemas describe structure; signature suites, canonicalisation, delegation subset evaluation, issuer trust, and selective disclosure are normative protocol concerns implemented by the SDKs and conformance suite.

Domain schemas live under `commerce/` and `rwa/`. Profiled core objects remain valid core objects and place domain fields under namespaced `extensions.commerce` or `extensions.rwa` members.
