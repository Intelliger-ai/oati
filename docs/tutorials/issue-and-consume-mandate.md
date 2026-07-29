# Issue and consume a Mandate

This flow creates a development organisation and agent, issues a signed short-lived Mandate, signs a request, and deterministically consumes one call. It runs entirely in the TypeScript SDK.

```sh
cd sdk/typescript
pnpm install --frozen-lockfile
pnpm build
node --input-type=module <<'JS'
import { DevelopmentIssuer, evaluateAuthority } from "./dist/index.js"

const now = new Date()
const issuer = await DevelopmentIssuer.create({ slug: "buyer", displayName: "Example Buyer" })
const passport = await issuer.registerAgent({
  slug: "purchasing", displayName: "Purchasing Agent", capabilities: ["catalog.read"]
}, now)
const mandate = await issuer.createMandate(passport.id, {
  purpose: "catalog_sync",
  actions: ["catalog.read"],
  resources: ["oati:service:seller:catalog"],
  expiresInSeconds: 300,
}, now)
const envelope = await issuer.signTransaction(passport.id, mandate, {
  action: "catalog.read",
  resource: "oati:service:seller:catalog",
  purpose: "catalog_sync",
  audience: "https://seller.example",
}, new Date(now.getTime() + 1000))

const result = evaluateAuthority({
  oati_version: "1.0",
  evaluation_time: new Date(now.getTime() + 2000).toISOString(),
  mandate,
  envelope,
  usage: { calls: 0 },
  consumption: { calls: 1, idempotency_key: "catalog-sync-1" },
})
if (result.decision !== "allow" || result.next_usage.calls !== 1) throw new Error(JSON.stringify(result))
console.log(result)
JS
```

`evaluateAuthority` does not persist usage. A production service must compare-and-set the prior usage snapshot and commit `next_usage` atomically with execution or Receipt state. Never execute first and update a counter afterward.

The development issuer accepts only an unchanged, active Mandate that it issued for the active agent. Agent identifiers are namespaced by the development organisation, and transaction purpose/profile default to the Mandate. Use `extensions` for signed Commerce or RWA transaction terms; server-derived reserve and approval evidence still needs independent verification.

To test lifecycle denial, call `issuer.setStatus("mandate", mandate.id, "revoked")`; publish the resulting revocation projection and ensure future verification/evaluation fails closed. Development issuers use ephemeral keys and are never production trust anchors.

Next: [generate and verify a Receipt](generate-and-verify-receipt.md).
