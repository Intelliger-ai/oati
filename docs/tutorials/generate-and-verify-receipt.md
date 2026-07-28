# Generate and verify a Receipt

A Receipt records the decision and observed outcome of one transaction. It is evidence of what the issuer recorded—not proof that every external business claim is true.

The reference HTTP middleware generates and signs Receipts for both allow and deny outcomes. Configure it with a trust policy, atomic usage store, signing callback, and durable evidence callback:

```ts
import { createOatiMiddleware, signDocument } from "@intelliger/oati"

const middleware = createOatiMiddleware({
  receiptIssuer: "oati:org:merchant",
  verificationPolicy: (_kind, request) => ({
    resolver,
    trustAnchors: ["oati:issuer:intelliger:production"],
    expectedAudience: new URL(request.url).origin,
    replayCache,
  }),
  usageStore,
  signReceipt: (draft) => signDocument(
    { ...draft, oati_version: "1.0" },
    { algorithm: "EdDSA", verificationMethod: keyId, privateKey, audience: clientAudience,
      nonce: crypto.randomUUID(), expires: new Date(Date.now() + 300_000) },
  ),
  emitReceipt: (receipt) => evidenceStore.put(receipt.id, receipt),
})
```

On success, read `OATI-Receipt-ID`, `OATI-Transaction-ID`, and `OATI-Correlation-ID`. A small Receipt may also be returned in `OATI-Receipt`. Resolve the Receipt by ID when the header is absent or too large.

Verify a received Receipt exactly like another signed OATI object:

```ts
import { assertSchema, verifyDocument } from "@intelliger/oati"

assertSchema("receipt", receipt)
const verification = await verifyDocument(receipt, {
  resolver, trustAnchors: ["oati:issuer:intelliger:production"],
  expectedAudience: myOrganisationId, replayCache,
})
if (!verification.verified) throw new Error(JSON.stringify(verification.issues))
if (receipt.transaction_id !== expectedTransactionId || receipt.mandate_id !== expectedMandateId) {
  throw new Error("Receipt is not bound to the expected transaction")
}
```

Persist the canonical Receipt, signature, policy digest, request/response digests, and correlation ID. Treat `outcome: unknown` or a missing durable Receipt as an operational exception—not as success.
