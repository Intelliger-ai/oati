# Commerce quickstart: protect a paid API

## Goal

Accept one paid API request from an external enterprise agent while enforcing merchant, service, offer, currency, price, quantity, purpose, destination, and data-use limits.

## 1. Publish a service and offer

Start from [`merchant-service-profile.json`](../../examples/commerce/merchant-service-profile.json). Replace the example organisation, endpoint, action, price, terms, status, timestamps, and proof.

```bash
oati commerce validate-offer merchant-service-profile.json
```

## 2. Receive a Purchase Mandate

The buyer issues a short-lived Mandate naming your organisation, service, offer, currency, maximum price, total budget, quantity, and accepted terms digest.

```bash
oati commerce validate-mandate purchase-mandate.json
```

Do not treat a valid Mandate as sufficient by itself. Verify issuer trust, current status, proof-key binding, revocation, replay state, and local merchant policy.

## 3. Evaluate the request

Normalize the request into an OATI Transaction Envelope. Enforce:

- agent and organisation identity;
- Mandate status, time window, audience, purpose, and action;
- selected offer and current terms digest;
- currency, unit price, quantity, and accumulated total;
- destination, retention, and redistribution restrictions;
- an idempotency key before charging or executing.

## 4. Return a Receipt

Bind the response to its transaction, Mandate, policy digest, terms digest, charge/usage reference, and fulfilment status.

```bash
oati commerce validate-receipt \
  --mandate purchase-mandate.json \
  commerce-receipt.json
```

Production verification requires a supported signature suite and issuer trust policy. The developer CLI currently validates structure and objective profile constraints.
