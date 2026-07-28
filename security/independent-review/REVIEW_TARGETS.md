# Review targets

The manifest generator hashes these public paths at the pinned review commit:

- `specification/CRYPTOGRAPHIC_PROFILE.md`
- `specification/AUTHORITY_EVALUATOR.md`
- `specification/HTTP_MIDDLEWARE_PROFILE.md`
- `specification/PROTOCOL_ADAPTERS.md`
- `schemas/proof.schema.json`, `schemas/verification-key.schema.json`, `schemas/issuer.schema.json`, and `schemas/revocation.schema.json`
- `sdk/typescript/src/canonical.ts`, `crypto.ts`, `evaluator.ts`, `lookup.ts`, `middleware.ts`, and `adapters.ts`
- `sdk/typescript/test/`
- `cli/cmd/oati/crypto.go` and relevant CLI tests
- `sdk/go/crypto.go`, canonicalization, evaluator, lookup, conformance runner, and tests
- `sdk/python/src/oati/crypto.py`, canonicalization, evaluator, lookup, conformance runner, and tests
- `conformance/`, including cryptographic, canonicalization, evaluator, delegation, replay, audience, expiry, revocation, and privacy vectors
- `integrations/` and cryptographic request-binding examples

The private platform scope must pin and review:

- control-plane Transit signer and production issuance;
- root and child-issuer certification, approval, publication, rotation, and revocation;
- lookup key/revocation projection and resolution contracts;
- OIDC/service authentication and role enforcement;
- database tenant isolation, audit records, and migrations;
- production Compose/OpenBao configuration and ceremony scripts.

Generated documentation, vendored dependencies, build outputs, and third-party cryptographic primitive internals are out of direct source-review scope unless the reviewer identifies a reason to include them. Their selection, configuration, version, known vulnerabilities, and API use remain in scope.

Any source affecting the claim that is discovered outside this list must be added before kickoff. Scope reductions require written risk acceptance and must be visible in the final report.
