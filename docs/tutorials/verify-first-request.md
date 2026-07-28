# Verify your first OATI request

This tutorial verifies a deterministic, signed Transaction Envelope and then demonstrates replay and tamper rejection. It uses the checked-in conformance key and trust chain, so no network access is needed.

## Prerequisites

- Go 1.24 or a built `oati` CLI
- a writable temporary directory

Build the CLI:

```sh
go build -o /tmp/oati ./cli/cmd/oati
```

Inspect and structurally validate the unsigned object:

```sh
/tmp/oati validate envelope conformance/crypto/unsigned-envelope.json
```

Verify the signed request at the vector's fixed verification time:

```sh
OATI_REPLAY_DIR=$(mktemp -d)
/tmp/oati verify \
  --trust-bundle conformance/crypto/trust-bundle.json \
  --audience https://merchant.example \
  --replay-cache "$OATI_REPLAY_DIR/replay.json" \
  --now 2026-07-27T12:01:00Z \
  conformance/crypto/signed-envelope.json
```

The result contains `"verified": true`, the `EdDSA` algorithm, verification-method identifier, and trusted issuer. Verification covers canonical detached-JWS integrity, key lifecycle, issuer chain, revocation, timestamps, audience, and nonce replay.

Run the same command again with the same replay-cache file. It must fail with `REPLAY_DETECTED`. Then verify `conformance/crypto/tampered-envelope.json` with a fresh cache; it must fail with `SIGNATURE_INVALID`.

## Production replacement

Replace the static bundle with `LookupTrustResolver` so key, issuer, and revocation state comes from a configured resolver. Keep an explicit trust-anchor allowlist and use an atomic distributed replay cache. Schema validity alone never establishes authenticity or authority.

Next: [issue and consume a Mandate](issue-and-consume-mandate.md).
