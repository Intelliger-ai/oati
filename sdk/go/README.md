# OATI Go SDK

Standard-library Go implementation of OATI canonical JSON, core builders, published-schema validation, typed public lookup, Ed25519/ES256 signing and verification, issuer-chain and key-lifecycle validation, fail-closed revocation, replay protection, public projection, and deterministic core, Commerce, and RWA authority evaluation. Use `SignDocument` for Ed25519 and `SignDocumentES256` for P-256; both emit RFC 7797 detached JWS proofs.

```bash
cd sdk/go
go test ./...
go run ./cmd/conformance --suite ../../conformance/suite-v0.4.json --implementation-version 0.2.0-dev.0 --output ../../conformance/reports/go-sdk-0.2.0-dev.0-suite-0.4.0.json
go run ./scripts/test-package-install.go
```

The conformance command reads the language-neutral suite directly; it does not maintain Go-specific vectors.
The SDK test suite also exercises these capabilities directly, including resolver failover, typed lookup states, rate-limit metadata, discovery trust checks, every shared evaluator case, and the complete shared crypto lifecycle matrix.

Use `ResolverClient.LookupRevocationByTarget` when resolving current revocation state from a governed target ID rather than a revocation-record ID.

`ResolverClient.DiscoverOrganisation` and `DiscoverFederated` return validated `DiscoveredRecord` pairs and fail closed on expired, mismatched, unverified, or unpublished Profile references. `LookupState.State` uses the portable names `found`, `not_found`, `invalid_proof`, `unknown`, and `unavailable`.
The package-install command creates an empty Go module, consumes the SDK through its public module path, installs the CLI into an isolated `GOBIN`, and executes the installed binary.
