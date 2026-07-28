# OATI migration and compatibility policy

OATI versions four independently deployable surfaces: object/schema versions, profile versions, SDK/CLI packages, and HTTP APIs. An implementation must record all versions used in a compatibility claim.

## Stability rules

- `oati_version` identifies core object semantics. A major change uses a new value; verifiers must never silently reinterpret it.
- Profile URIs are immutable semantic identifiers. A breaking profile change receives a new URI.
- Published JSON Schemas and conformance suites are immutable after release. Corrections are new patch releases with release notes.
- SDKs and the CLI use semantic versioning. Before 1.0, minor releases may contain breaking API changes, which must be documented.
- HTTP clients select the major API in the URL and may send `OATI-Version: 1.0`. An unsupported requested version returns `406 unsupported_api_version`.
- Unknown extension fields may be preserved but never treated as authority. Unknown required core fields, algorithms, profiles, or critical proof parameters fail closed.

## Compatibility promise

Within one stable major object/API version, additions are backward compatible when they are optional, use new enum values only where consumers already handle unknown values, and do not weaken validation or authority. Removing or renaming fields, changing canonicalization, broadening authority implicitly, or changing the meaning of an existing value is breaking.

Servers support the current stable major and at least one documented migration window for its predecessor. The default retirement window is 180 days after a successor becomes stable; security-critical algorithms or compromised trust material may be retired faster with an advisory.

## Upgrade procedure

1. Pin the target SDK, schema, profile URI, and conformance-suite versions.
2. Read release notes and regenerate bindings/documentation.
3. Run the new conformance suite against production-equivalent trust, replay, evaluator, Commerce, and RWA paths.
4. Send the target `OATI-Version` explicitly in staging and test structured error handling.
5. Dual-read old/new optional fields where needed; never dual-authorise conflicting decisions. A denial from either security policy wins during migration.
6. Roll out verifiers before issuers so every emitted object is already understood.
7. Monitor error codes, version distribution, signature algorithms, and revocation freshness.
8. Remove predecessor support only after the published window and zero supported-client usage.

## Schema and API evolution checklist

A public change is releasable only when schemas, examples, SDK types/builders, generated API docs, OpenAPI, valid and invalid conformance vectors, expected error codes, compatibility snapshot, and migration notes agree. CI must demonstrate that generated artifacts are current and the platform implements the public contract.

Compatibility claims use this form:

```text
OATI core 1.0; Commerce profile 0.1 (if used); RWA profile 0.1 (if used);
conformance suite 0.1; implementation name and version; report digest.
```

“Compatible with OATI” without a core version and conformance report is not a valid compatibility claim.

## Deprecation notice

Deprecations are announced in release notes and documentation with the replacement, first deprecated release, earliest removal date, and security impact. Hosted APIs also emit standards-based `Deprecation` and `Sunset` headers when a deployed version enters its retirement window.
