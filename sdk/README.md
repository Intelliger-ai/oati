# SDKs

SDKs provide the portable developer surface of OATI. The planned release order follows the product blueprint:

1. TypeScript
2. Python
3. Go
4. Java
5. .NET

Every SDK must create and validate public OATI objects, request and present Mandates, sign and verify Receipts, enrich MCP and A2A messages, resolve status and issuer trust, and run the shared conformance vectors. SDKs must not depend on `oati-platform`.

The [`typescript/`](typescript/) package is the complete reference implementation. The [`python/`](python/) and [`go/`](go/) SDKs implement the shared portable core: builders, published-schema validation, canonical JSON, public projection, Ed25519 verification, replay protection, and deterministic core, Commerce, and RWA evaluation.

All three execute the exact language-neutral case set through `./conformance/run-all.sh`. Java and .NET remain later milestones.
