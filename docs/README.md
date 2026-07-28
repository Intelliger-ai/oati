# OATI developer documentation

These guides take a developer from a signed request to domain-specific integrations. Commands assume the repository root and a built CLI named `oati`; use `go run ./cli/cmd/oati` in place of `oati` when working directly from this checkout.

## Start here

1. [Run the one-command local sandbox](../sandbox/README.md)
2. [Verify your first OATI request](tutorials/verify-first-request.md)
3. [Issue and consume a Mandate](tutorials/issue-and-consume-mandate.md)
4. [Generate and verify a Receipt](tutorials/generate-and-verify-receipt.md)

## Integrate a workload

- [Protect a paid API with the Commerce profile](tutorials/paid-api-commerce.md)
- [Execute an RWA controlled mint](tutorials/rwa-controlled-mint.md)
- [Integrate MCP and A2A](tutorials/mcp-and-a2a.md)
- [Handle errors, outages, and revocation](tutorials/errors-and-revocation.md)

## Operate compatibility

- [Versioning, migration, and compatibility policy](MIGRATION_AND_COMPATIBILITY.md)
- [Fresh-project package installation compatibility](PACKAGE_INSTALLATION_COMPATIBILITY.md)
- [TypeScript SDK](../sdk/typescript/README.md)
- [CLI](../cli/README.md)
- [Executable conformance suite](../conformance/README.md)
- [Hosted ten-record lookup and discovery smoke](../smoke/README.md)
- [Normative specification](../specification/README.md)

Tutorial fixtures are educational and use development trust material. Never promote example keys, proofs, identifiers, or assurance claims into production.
