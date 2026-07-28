# Execute an RWA controlled mint

This flow permits a one-time mint only when a current reserve claim, approval threshold, required roles, supply state, and Mandate all agree.

Validate the checked-in objects:

```sh
oati rwa validate-asset examples/rwa/asset-profile.json
oati rwa validate-state-claim examples/rwa/asset-state-claim.json
oati rwa validate-mint-mandate \
  --claim examples/rwa/asset-state-claim.json \
  examples/rwa/mint-mandate.json
oati rwa validate-receipt \
  --mandate examples/rwa/mint-mandate.json \
  examples/rwa/rwa-receipt.json
```

Before submitting a transaction, verify the Asset Profile, State Claim, Asset Mandate, issuer roles, proof chains, expiry, and revocation. Read supply from the authoritative chain at a defined block/finality point, not from an untrusted request.

```ts
const result = evaluateAuthority({
  oati_version: "1.0", evaluation_time: "2026-07-27T09:07:00Z",
  mandate, envelope,
  usage: { consumed: false, quantity: "0", minted_supply: "0" },
  rwa: {
    asset_id: "oati:asset:example:eur-reserve-token",
    state_claim_id: "oati:claim:example:reserve-20260727-0900",
    network: "eip155:1", token_contract: "0x1111111111111111111111111111111111111111",
    operation: "mint", unit: "EUR", quantity: "250.00", reserve: "1000.00",
    approval_count: 2, approval_roles: ["custodian", "approver"], current_supply: "0",
    maximum_supply: "1000.00", claim_valid_until: "2026-07-27T10:00:00Z",
  },
})
```

Atomically mark the one-time Mandate consumed before broadcasting, with a recovery record linking the reservation to the chain transaction. After finality, issue an RWA Receipt containing the transaction hash, approval count, quantity, and resulting supply. A retry must reconcile the prior transaction; it must not mint again.

OATI proves attributable authority and recorded controls. It does not prove reserve existence, valuation accuracy, token legality, or jurisdictional compliance. See the [RWA profile](../../specification/profiles/rwa/README.md).
