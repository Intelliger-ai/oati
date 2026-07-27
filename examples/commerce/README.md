# Commerce paid-API example

This fixture set models an enterprise purchasing one weather-data API request for EUR 0.20.

1. `merchant-service-profile.json` publishes the seller, endpoint, offer, and data-use rules.
2. `purchase-mandate.json` allows one agent to spend at most EUR 1.00 on the selected offer.
3. `transaction-envelope.json` requests one unit and binds an idempotency key.
4. `commerce-receipt.json` records successful fulfilment for EUR 0.20.

Identifiers and proofs are illustrative. Do not reuse example keys or signatures.
