# Handle errors, outages, and revocation

OATI integrations distinguish malformed input, untrusted evidence, denied authority, missing public state, and temporary infrastructure failure. Do not collapse them into “unauthorised” or retry everything.

## Lookup outcomes

Use `lookupState()` when all resolver states belong in normal control flow:

```ts
const state = await lookup.lookupState("key", keyId)
switch (state.state) {
  case "found":
    if (state.record.proof_status !== "verified") deny("LOOKUP_INVALID_PROOF")
    break
  case "not_found": deny("KEY_NOT_FOUND"); break
  case "invalid_proof": deny("LOOKUP_INVALID_PROOF"); break
  case "unknown": deny("TRUST_STATE_UNKNOWN"); break
  case "unavailable": failClosedAndRetryLater(); break
}
```

Thrown lookup errors have stable codes: `LOOKUP_BAD_REQUEST`, `LOOKUP_NOT_FOUND`, `LOOKUP_RATE_LIMITED`, `LOOKUP_UNAVAILABLE`, `LOOKUP_INVALID_RESPONSE`, `LOOKUP_TIMEOUT`, and `LOOKUP_CANCELLED`. Honor `retryAfter`; retry only transient states with bounded exponential backoff. Do not retry bad requests or invalid proofs.

The hosted API returns `application/problem+json` with `error.code`, `message`, HTTP `status`, `request_id`, and `retryable`. Preserve the request ID in logs and support reports.

## Verification and revocation

`verifyDocument()` returns stable issue codes such as `KEY_REVOKED`, `ISSUER_REVOKED`, `DOCUMENT_REVOKED`, `REVOCATION_UNAVAILABLE`, `DOCUMENT_EXPIRED`, `AUDIENCE_MISMATCH`, and `REPLAY_DETECTED`. Any issue means the object is not verified.

For issuer, key, and revocation records, respect the short cache lifetime and purge immediately after an administrative lifecycle change. If revocation resolution is unavailable, material actions fail closed. Do not serve stale “good” status beyond the policy window.

Revocation does not undo completed external effects. Stop new execution, preserve evidence, reconcile in-flight idempotency keys, and use the domain’s compensating process for charges, data release, or chain transactions.
