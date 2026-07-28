# OATI Go SDK

Standard-library Go implementation of OATI canonical JSON, core builders, published-schema validation, typed public lookup, Ed25519 signing, Ed25519/ES256 verification, issuer-chain and key-lifecycle validation, fail-closed revocation, replay protection, public projection, and deterministic core, Commerce, and RWA authority evaluation.

```bash
cd sdk/go
go test ./...
go run ./cmd/conformance --suite ../../conformance/suite-v0.3.json --implementation-version 0.2.0-dev.0 --output ../../conformance/reports/go-sdk-0.2.0-dev.0-suite-0.3.0.json
go run ./scripts/test-package-install.go
```

The conformance command reads the language-neutral suite directly; it does not maintain Go-specific vectors.
The SDK test suite also exercises these capabilities directly, including resolver failover, typed lookup states, rate-limit metadata, discovery trust checks, every shared evaluator case, and the complete shared crypto lifecycle matrix.

Use `ResolverClient.LookupRevocationByTarget` when resolving current revocation state from a governed target ID rather than a revocation-record ID.
The package-install command creates an empty Go module, consumes the SDK through its public module path, installs the CLI into an isolated `GOBIN`, and executes the installed binary.
