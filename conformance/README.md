# OATI executable conformance suite

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
  --suite ../../conformance/suite-v0.1.json \
  --output ../../conformance/reports/typescript-sdk-0.4.0-dev.0.json
```

The process exits non-zero if a case does not match both its expected outcome and exact error-code set. Output is deterministic: reports omit timestamps, machine paths, and durations so two identical runs have byte-identical results.

## Portable adapter contract

An implementation reads [`suite-v0.1.json`](suite-v0.1.json), resolves fixture paths relative to that file, implements each named `operation`, and validates its output against [`conformance-report.schema.json`](../schemas/conformance-report.schema.json). The suite itself is governed by [`conformance-suite.schema.json`](../schemas/conformance-suite.schema.json).

Operations are deliberately small:

| Operation | Required observation |
| --- | --- |
| `schema` | Validate against the named published schema and return `SCHEMA_<KEYWORD>` codes. |
| `canonicalize` | Serialize input and compare exact UTF-8 text with `auxiliary`. |
| `verify` | Verify proof, trust, lifecycle, time, and audience using the supplied bundle. |
| `verify-replay` | Verify twice with one replay cache; report the second result. |
| `evaluate-suite` | Run every request in the evaluator vector file and compare decision, reason codes, and next usage. |
| `public-project` | Apply the public allowlist, validate it, and compare it with the expected projection. |

Schema failures use stable `SCHEMA_<UPPERCASE_JSON_SCHEMA_KEYWORD>` codes, such as `SCHEMA_REQUIRED`. Cryptographic and evaluator codes are defined by their public SDK types and specifications. Adapters compare unique, sorted code sets so validator traversal order is irrelevant.

## Coverage

- `core/`: valid examples and invalid Passport, Mandate, Envelope, Decision, and Receipt vectors;
- `canonical/`: exact nested, Unicode, numeric, and numeric-string serialization vectors;
- `crypto/`: signed, tampered, revoked, expired, audience, and replay vectors;
- `evaluator/`: activation/expiry, constraints, delegation subset proofs, non-amplification, budgets, one-time use, Commerce, and RWA vectors;
- `privacy/`: a private registry record and its strict public projection;
- `commerce/` and `rwa/`: profile-specific invalid artifacts;
- `reports/`: immutable reports named for implementation and implementation version.

An implementation may claim compatibility only by naming the OATI version, suite version, implementation name/version, and publishing a passing report. A fixture change requires a new suite version; published manifests and reports are immutable.
