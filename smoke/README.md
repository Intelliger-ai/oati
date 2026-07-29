# Hosted production smoke tests

The hosted lookup smoke is a read-only deployment gate for `https://api.intelliger.ai/oati/v1`. It checks the TLS chain/protocol/expiry, service status, the reviewed inventory for all ten public record types, response headers and CORS preflight, safe public cache and numeric rate-limit metadata, ETag revalidation, API version negotiation, structured 400/404 errors, target-based revocation, recursive public-projection privacy, cryptographic verification of signed public documents, and linked organisation Service/Profile discovery.

Run it after building the TypeScript SDK:

```sh
cd sdk/typescript
pnpm smoke:production
```

Write a machine-readable report with:

```sh
pnpm smoke:production -- --output ../../production-lookup-smoke.json
```

The reviewed identifiers live in [`production-lookup.inventory.json`](production-lookup.inventory.json). An inventory change is an operational contract change: publish the replacement record first, verify it independently, then update the manifest in review. Override the endpoint only for staging verification:

```sh
OATI_LOOKUP_URL=https://staging.example/oati/v1 pnpm smoke:production
```

The smoke test never sends credentials and never mutates lookup data. Scheduled GitHub Actions publish the JSON report as an artifact even when the gate fails. Missing correlation IDs, inventory records, discovery links, or fail-closed trust evidence remain release-blocking failures; the gate does not weaken its contract to accommodate a partial deployment.
