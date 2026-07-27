# OATI Commerce Profile 0.1

## Purpose

The Commerce Profile lets an agent discover and purchase a paid API or digital service under verifiable identity, bounded authority, objective commercial terms, data-use restrictions, and receipt-backed evidence.

Profile URI: `https://specs.intelliger.ai/oati/profiles/commerce/v0.1`

## Objects

### Merchant Service Profile

A seller-signed description of a service, supported protocol, allowed actions, endpoint, offer, billing model, and data-use terms. It is discovery metadata, not an irrevocable promise of availability.

### Purchase Mandate

A core Agent Mandate whose Commerce extension constrains merchant, service, offer, currency, unit price, total budget, quantity, billing model, and permitted data use.

### Commerce Transaction Envelope

A core Transaction Envelope whose Commerce extension identifies the selected offer, quantity, quoted price, idempotency key, billing account reference, and acceptance of terms.

### Commerce Action Receipt

A core Action Receipt whose Commerce extension records the merchant, service, offer, quantity, unit and total amount, currency, usage/billing reference, fulfilment status, and terms digest.

## Required invariants

- merchant and service must be allowed by the Purchase Mandate;
- offer currency must equal the Mandate currency;
- unit price and total amount must not exceed Mandate limits;
- quantity and accumulated usage must stay within limits;
- the offer and Mandate must both be current;
- transaction idempotency prevents duplicate charging;
- data-use and destination restrictions must be equal to or narrower than the Mandate;
- the Receipt binds the offer, Mandate, transaction, policy, and outcome digests.

## Golden path

```text
discover Merchant Service Profile
→ select a current offer
→ receive a short-lived Purchase Mandate
→ submit a profiled Transaction Envelope
→ enforce price, quantity, destination, and data-use policy
→ execute the paid API request
→ return a Commerce Action Receipt
```

Payment execution remains outside OATI. The profile carries provider-neutral billing and payment references rather than defining a payment rail.
