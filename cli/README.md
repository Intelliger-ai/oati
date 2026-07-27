# OATI CLI

The OATI CLI is the quickest way to inspect and validate OATI objects while building an integration.

## Install

```bash
go install github.com/Intelliger-ai/oati/cli/cmd/oati@main
```

Or build from a clone:

```bash
go build -o ./bin/oati ./cli/cmd/oati
```

## Commands

```bash
# Validate a Passport, Mandate, Envelope, or Receipt
oati validate passport ./examples/passport.json

# Emit compact deterministic JSON with recursively sorted object keys
oati canonicalize ./examples/passport.json > passport.canonical.json

# Resolve a public OATI record
oati lookup \
  --type agent \
  --id oati:agent:intelliger:commerce-demo

# Use another compatible resolver
oati lookup --api http://localhost:8080/oati/v1 --type agent --id oati:agent:intelliger:commerce-demo
```

`validate` performs the structural and semantic checks implemented by this developer preview, including required fields, identifier prefixes, timestamps, status values, and object-specific invariants. Published JSON Schema and conformance vectors remain the interoperable source of truth.

## Current boundary

The CLI is ready for schema-oriented development, fixtures, local testing, canonical JSON, and public lookup. Signature-suite verification, trust-chain evaluation, and child-Mandate non-amplification proofs are planned for the conformance milestone and are not claimed by this version.
