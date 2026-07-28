# OATI Go SDK

Standard-library Go implementation of OATI canonical JSON, core builders, published-schema validation, typed public lookup, Ed25519 signing and verification, replay protection, public projection, and deterministic core, Commerce, and RWA authority evaluation.

```bash
cd sdk/go
go test ./...
go run ./cmd/conformance --suite ../../conformance/suite-v0.1.json --implementation-version 0.2.0-dev.0 --output ../../conformance/reports/go-sdk-0.2.0-dev.0.json
```

The conformance command reads the language-neutral suite directly; it does not maintain Go-specific vectors.

Use `ResolverClient.LookupRevocationByTarget` when resolving current revocation state from a governed target ID rather than a revocation-record ID.
