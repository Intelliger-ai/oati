# Contributing to OATI

Thank you for helping build an interoperable trust standard for autonomous transactions. Contributions are accepted under the Apache License 2.0. By submitting a contribution, you agree that it may be distributed under that licence.

## Development environment

The repository's CI baseline is Node.js 24, pnpm 10.14, Python 3.13, Go 1.24, and Ruby 3.3. Install the TypeScript dependencies before running the complete gate set:

```sh
cd sdk/typescript
pnpm install --frozen-lockfile
cd ../..
```

## Required checks

Run the checks affected by your change before opening a pull request:

```sh
# TypeScript SDK, schema validation, and examples
(cd sdk/typescript && pnpm test)

# Python and Go SDKs
(cd sdk/python && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v test_sdk.py)
(cd sdk/go && go test ./...)

# CLI
(cd cli && go test ./...)

# Language-neutral conformance vectors and reports
./conformance/run-all.sh

# Public OpenAPI validity and platform compatibility
ruby scripts/validate-openapi.rb

# Generated schema bindings, API docs, and conformance reports
./scripts/check-generated.sh

# Project and dependency licence policy
node scripts/check-licenses.mjs
```

CI also runs Redocly OpenAPI linting, `pnpm audit`, `govulncheck`, Trivy filesystem scanning, GitHub dependency review, and CodeQL. High or critical dependency findings and incompatible dependency licences block a pull request.

## Generated files

Generated artifacts are committed so downstream users can inspect and consume a release without installing generator tooling. If `check-generated.sh` reports a difference, regenerate the relevant artifact and include it in the same commit:

```sh
(cd sdk/typescript && pnpm run docs)
./conformance/run-all.sh
```

Do not edit generated API documentation, schema bindings, or conformance reports by hand.

## Platform API compatibility

[`api/lookup.openapi.yaml`](api/lookup.openapi.yaml) is the public contract. [`compatibility/platform-lookup.openapi.yaml`](compatibility/platform-lookup.openapi.yaml) is the reviewed snapshot of the lookup contract currently implemented by `oati-platform`.

When the private platform contract changes:

1. Update the platform implementation and its OpenAPI document.
2. Copy the reviewed contract into the compatibility snapshot.
3. Run `ruby scripts/validate-openapi.rb` and Redocly against both files.
4. Commit the public contract and compatibility snapshot together when the public API changes.

The compatibility gate prevents the public SDK contract from silently diverging from the deployed platform surface. It does not publish private platform implementation details.

## Pull requests

Keep changes focused, add or update tests and conformance vectors, and explain any compatibility or security impact. A maintainer should configure branch protection for `main` to require every job in **Quality gates** and **CodeQL** before merge.
