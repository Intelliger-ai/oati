# SDKs

SDKs provide the portable developer surface of OATI. The planned release order follows the product blueprint:

1. TypeScript
2. Python
3. Go
4. Java
5. .NET

Every SDK must create and validate public OATI objects, request and present Mandates, sign and verify Receipts, enrich MCP and A2A messages, resolve status and issuer trust, and run the shared conformance vectors. SDKs must not depend on `oati-platform`.
