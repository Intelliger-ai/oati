# SDKs

SDKs provide the portable developer surface of OATI. The planned release order follows the product blueprint:

1. TypeScript
2. Python
3. Go
4. Java
5. .NET

Every SDK must create and validate public OATI objects, request and present Mandates, sign and verify Receipts, enrich MCP and A2A messages, resolve status and issuer trust, and run the shared conformance vectors. SDKs must not depend on `oati-platform`.

The [`typescript/`](typescript/) package implements core and profile object builders, offline validation against the published schemas, Commerce and RWA cross-object validation, canonical JSON, a typed public lookup client, Ed25519/P-256 detached-JWS signing, issuer/key/revocation resolution, trust-chain and replay verification, structured errors, generated API documentation, and automated cross-language tests.
