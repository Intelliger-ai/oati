# RWA controlled-mint example

This fixture set models minting 250 units of a EUR-denominated reserve-backed token against a current reserve claim of 1,000 units.

1. `asset-profile.json` identifies the instrument, token contract, roles, and state policy.
2. `asset-state-claim.json` records the current custodian-observed reserve.
3. `mint-mandate.json` grants one-time authority to mint at most 250 units against that claim.
4. `rwa-receipt.json` binds the successful mint to its claim, Mandate, approvals, and chain transaction.

Identifiers, addresses, evidence, and proofs are illustrative.
