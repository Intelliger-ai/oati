# Protect a paid API with OATI Commerce

This tutorial binds a paid weather request to an advertised offer, buyer budget, accepted terms, idempotency key, and signed Receipt.

## Validate the contract objects

```sh
oati commerce validate-offer examples/commerce/merchant-service-profile.json
oati commerce validate-mandate examples/commerce/purchase-mandate.json
oati validate envelope examples/commerce/transaction-envelope.json
oati commerce validate-receipt \
  --mandate examples/commerce/purchase-mandate.json \
  examples/commerce/commerce-receipt.json
```

The buyer must select the offer and issue a Purchase Mandate that fixes merchant, service, offer, currency, unit-price ceiling, cumulative total, maximum quantity, billing model, and terms digest. The request Envelope repeats the selected offer and binds a unique idempotency key.

## Merchant request sequence

1. Validate the Envelope and Purchase Mandate schemas.
2. Verify both proofs, issuer trust, audience, timestamps, and current revocation state.
3. Bind the Envelope to the HTTP method, target, and body digest.
4. Load the current usage snapshot and call `evaluateAuthority` with the quoted price and idempotency key.
5. Atomically reserve `next_usage`; a concurrent reservation conflict denies the request.
6. Execute or charge once, using the same idempotency key downstream.
7. Emit a signed Commerce Receipt with price, quantity, total, terms digest, billing reference, and fulfilment status.

Example evaluation context:

```ts
const result = evaluateAuthority({
  oati_version: "1.0", evaluation_time: new Date().toISOString(), mandate, envelope, usage,
  commerce: {
    merchant_organisation_id: "oati:org:acme-weather",
    service_id: "oati:service:acme-weather:forecast",
    offer_id: "forecast-eu-per-request-v1",
    currency: "EUR", quantity: 1, unit_price: "0.20", total_amount: "0.20",
    idempotency_key: "weather-purchase-001", terms_digest: "sha256:terms-example-001",
  },
})
```

Never use binary floating point for money. OATI decimal strings are evaluated exactly. A changed price, currency, offer, merchant, terms digest, or exhausted cumulative budget denies before execution.

See the [Commerce profile](../../specification/profiles/commerce/README.md) for normative semantics.
