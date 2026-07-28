# Schemas

Versioned JSON Schemas for OATI Passport, Mandate, Transaction Envelope, Authorisation Decision, and Action Receipt objects. Draft 2020-12 is the initial schema dialect. Schemas describe structure; signature suites, canonicalisation, delegation subset evaluation, issuer trust, and selective disclosure are normative protocol concerns implemented by the SDKs and conformance suite.

Domain schemas live under `commerce/` and `rwa/`. Profiled core objects remain valid core objects and place domain fields under namespaced `extensions.commerce` or `extensions.rwa` members.

Cryptographic interoperability uses the proof, verification-key, issuer, and revocation schemas together with the [OATI Cryptographic Profile](../specification/CRYPTOGRAPHIC_PROFILE.md).

Portable authorization uses the evaluation-request and evaluation-result schemas with the [Deterministic Authority Evaluator](../specification/AUTHORITY_EVALUATOR.md).

Service discovery uses `service-discovery.schema.json` for endpoint, audience, protocol, action, and accepted-profile advertisements; `profile-discovery.schema.json` pins each profile to a canonical HTTPS schema and SHA-256 digest. `well-known.schema.json` defines the domain-to-resolver federation handoff. Discovery metadata is signed by an approved organisation issuer and never contains credentials, secrets, private network addresses, or commercial policy.

For `key` public lookup records, `issuer`, `issued_at`, and `expires_at` are top-level trust metadata. `public_attributes` contains key-specific fields: `controller`, `algorithm`, and the string-encoded `public_key_jwk`. The former duplicated `issuer`, `valid_from`, and `valid_until` attributes are legacy input only and must not be emitted by new projections.

## Canonical HTTPS publication

The schema files in this directory are the only source of truth for `https://schemas.intelliger.ai`. The private platform deployment consumes a reviewed public release; it must not copy, edit, or privately redefine these schemas.

Build a static publication tree directly from every canonical `$id`:

```sh
node scripts/build-schema-site.mjs /tmp/oati-schema-site
```

The builder rejects invalid or duplicate canonical identifiers, unresolved internal schema references, non-empty output directories, and routes outside the `https://schemas.intelliger.ai/oati/` namespace. Running it without an output argument performs the same checks using a temporary directory, which is also enforced in CI.
