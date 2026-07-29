# OATI executable conformance suite

Run TypeScript, Python, and Go against the exact same manifest with `./conformance/run-all.sh`. The harness schema-validates every suite and report, requires exactly 73 passing cases, and rejects different suite versions, omitted/added/reordered cases, or any difference in outcome and error codes.

This directory is the portable compatibility contract for OATI 1.0. The suite manifest, fixtures, expected codes, and report format are JSON so any language can implement an adapter without depending on TypeScript. The included reference runner executes the published TypeScript SDK.

## Run it

From `sdk/typescript`:

```sh
pnpm install
pnpm conformance
```

To write a machine-readable report:

```sh
pnpm build
node ../../conformance/run.mjs \
  --suite ../../conformance/suite-v0.4.json \
  --output ../../conformance/reports/typescript-sdk-0.8.0-dev.0-suite-0.4.0.json
```

The process exits non-zero if a case does not match both its expected outcome and exact error-code set. Output is deterministic: reports omit timestamps, machine paths, and durations so two identical runs have byte-identical results.

## Portable adapter contract

An implementation reads the current [`suite-v0.4.json`](suite-v0.4.json), resolves fixture paths relative to that file, recursively prepends cases from its optional `extends` suite, implements each named `operation`, and validates its output against [`conformance-report.schema.json`](../schemas/conformance-report.schema.json). Suites `0.1` through `0.3` remain immutable compatibility baselines. Cyclic inheritance, duplicate inherited case IDs, and standard-version mismatches are runner errors. The suite itself is governed by [`conformance-suite.schema.json`](../schemas/conformance-suite.schema.json).

Operations are deliberately small:

| Operation | Required observation |
| --- | --- |
| `schema` | Validate against the named published schema and return `SCHEMA_<KEYWORD>` codes. |
| `canonicalize` | Serialize input and compare exact UTF-8 text with `auxiliary`. |
| `verify` | Verify proof, trust, lifecycle, time, and audience using the supplied bundle. |
| `verify-replay` | Verify twice with one replay cache; report the second result. |
| `evaluate-suite` | Run every request in the evaluator vector file and compare decision, reason codes, and next usage. |
| `public-project` | Apply the public allowlist, validate it, and compare it with the expected projection. |
| `discover` | Validate federation ownership/expiry and require active proof-verified Service/Profile records whose embedded documents match their public records and accepted Profile references. |

Schema failures use stable `SCHEMA_<UPPERCASE_JSON_SCHEMA_KEYWORD>` codes, such as `SCHEMA_REQUIRED`. Cryptographic and evaluator codes are defined by their public SDK types and specifications. Adapters compare unique, sorted code sets so validator traversal order is irrelevant.

## Coverage

- `core/`: valid examples and invalid Passport, Mandate, Envelope, Decision, and Receipt vectors;
- `canonical/`: exact nested, Unicode, numeric, and numeric-string serialization vectors;
- `crypto/`: signed, tampered, revoked, expired, audience, and replay vectors;
- suite 0.3 extends cryptographic coverage with ES256, multi-level/broken/cyclic issuer chains, rotation overlap, retired-key validity, target-specific suspension/revocation, future-effective status, ambiguity, and resolver unavailability;
- `evaluator/`: activation/expiry, constraints, delegation subset proofs, non-amplification, budgets, one-time use, profile/consumption substitution resistance, signed Commerce/RWA context binding, and profile controls;
- `privacy/`: a private registry record and its strict public projection;
- `commerce/` and `rwa/`: profile-specific invalid artifacts;
- `discovery/`: valid and invalid Service/Profile/well-known schemas plus federation, trust-state, expiry, document-binding, and accepted-profile resolution vectors;
- `reports/`: immutable reports named for implementation and implementation version.

An implementation may claim compatibility only by naming the OATI version, suite version, implementation name/version, and publishing a passing report. A fixture change requires a new suite version; published manifests and reports are immutable.

Discovery error precedence and offline runner semantics are specified in [`discovery/README.md`](discovery/README.md).
