# OATI Deterministic Authority Evaluator 0.1

Status: developer preview.

## Objective

The evaluator determines whether one explicit Transaction Envelope is inside one current Mandate and computes the usage state that would result from allowing it. It is deterministic: identical JSON input produces the same decision, sorted reason codes, and proposed state transition in every conforming implementation.

The evaluator does not verify signatures and does not persist state. Callers verify cryptographic proofs first, then evaluate authority, execute the protected action, and atomically commit the relevant Receipt and `next_usage` under their own concurrency controls.

## Input and output

The language-neutral contracts are:

- [`evaluation-request.schema.json`](../schemas/evaluation-request.schema.json)
- [`evaluation-result.schema.json`](../schemas/evaluation-result.schema.json)

Every request supplies `evaluation_time` and the complete prior `usage` snapshot. Implementations MUST NOT read the wall clock or hidden counters during evaluation.

An `allow` result has no reason codes and carries the proposed next usage. A `deny` result carries unique, lexicographically sorted reason codes and returns normalized usage unchanged.

## Core evaluation

The evaluator denies unless all applicable checks pass:

1. Mandate status is `active`.
2. `not_before <= evaluation_time < expires_at`.
3. Envelope `mandate_id` matches the evaluated Mandate.
4. Envelope action belongs to `actions`.
5. When resources, counterparties, or destinations are constrained, the corresponding Envelope value is present and belongs to the allowed set.
6. Envelope purpose equals the Mandate purpose.
7. Prior usage is not already consumed.
8. Idempotency key has not been consumed.
9. Proposed calls, amount, currency, and quantity remain inside applicable limits.

An omitted optional constraint is unbounded. An empty constraint array allows nothing.

## Delegation and non-amplification

A child evaluation supplies `parent_mandate` and `delegation_depth`. It denies amplification when:

- `parent_mandate` does not reference the supplied parent;
- the parent is inactive or delegation is disallowed;
- depth exceeds `parent.delegation.max_depth`;
- child actions, resources, counterparties, or destinations are not subsets;
- child purpose differs;
- child activation starts earlier or expires later;
- numeric/decimal limits increase;
- data-use constraints are removed or widened;
- the child's remaining delegation depth exceeds the parent's remaining depth;
- Commerce identities change or price, total, or quantity maxima increase;
- RWA target identities change, quantity increases, approval threshold decreases, required roles are removed, or a one-time restriction is relaxed.

Additional child restrictions are permitted. A parent constraint may not disappear in the child.

## Consumption

Core consumption supports calls, decimal amount and currency, decimal quantity, idempotency key, and a consumed flag. Decimal values are non-negative base-10 strings and are evaluated using arbitrary-precision integer arithmetic—never binary floating point.

The evaluator only proposes state. Production services MUST use compare-and-swap, serializable transactions, or an equivalent atomic mechanism so concurrent requests cannot both spend the same remaining authority.

## Commerce

Commerce evaluation binds merchant, service, offer, currency, terms digest, and idempotency key. It requires:

- quoted unit price at or below `max_unit_price`;
- exact `total_amount == unit_price × quantity`;
- cumulative amount at or below `max_total`;
- transaction quantity at or below `max_quantity`;
- matching usage currency;
- a previously unseen idempotency key.

Successful evaluation increments calls, cumulative spend, cumulative quantity, and sorted idempotency keys.

## RWA controlled mint

RWA evaluation binds asset, State Claim, network, token contract, operation, and unit. It requires:

- State Claim validity at evaluation time;
- cumulative quantity at or below the Mandate maximum;
- `current_supply + quantity <= verified reserve`;
- resulting supply at or below `maximum_supply` when present;
- usage supply snapshot equal to the supplied current supply when tracked;
- approval count at or above the threshold;
- every required role present;
- unused state for one-time Mandates.

Successful mint evaluation proposes updated cumulative quantity, resulting minted supply, and consumed state for a one-time Mandate.

## Conformance

[`conformance/evaluator/cases.json`](../conformance/evaluator/cases.json) is normative for evaluator version 0.1. It covers activation/expiry, all core set constraints, child subset proofs, non-amplification, calls and budgets, one-time use, Commerce cumulative price controls, and RWA reserve, approval, role, and supply controls.
