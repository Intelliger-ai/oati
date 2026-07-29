# OATI Envoy authorizer

Operational HTTP `ext_authz` service for Envoy. It runs the public reference middleware with public lookup trust resolution, bounded proof/request parsing, distributed Valkey replay prevention and Mandate usage CAS, Transit-backed signed Receipts, and durable Receipt stream emission.

Production startup fails unless lookup resolvers, local trust anchors, expected audience, receipt issuer/key, Valkey, Transit, and authorizer mTLS files are configured. Trust lookup, Valkey, Transit signing/verification, Receipt persistence, malformed authority, replay, and usage conflicts all fail closed.

Required production settings are:

- `OATI_GATEWAY_EXTERNAL_ORIGIN` and `OATI_GATEWAY_EXPECTED_AUDIENCE`;
- `OATI_GATEWAY_TRUST_ANCHORS` and comma-separated `OATI_LOOKUP_RESOLVER_URLS`;
- a `rediss://` `VALKEY_URL` with a dedicated ACL username and `VALKEY_PASSWORD_FILE` in production; use `VALKEY_TLS_CA_FILE` for a private CA and `VALKEY_TLS_SERVER_NAME` only when the certificate identity differs from the connection hostname;
- `OATI_GATEWAY_RECEIPT_ISSUER`, `OATI_GATEWAY_RECEIPT_VERIFICATION_METHOD`, `OATI_GATEWAY_TRANSIT_KEY_NAME`, explicit `OATI_GATEWAY_TRANSIT_KEY_VERSION`, `OATI_TRANSIT_ADDR`, and `OATI_TRANSIT_TOKEN_FILE`;
- `OATI_GATEWAY_INVALIDATION_TOKEN_FILE`, containing a distinct bearer secret of at least 32 characters for authenticated trust-cache purges;
- `OATI_GATEWAY_TLS_CERT_FILE`, `OATI_GATEWAY_TLS_KEY_FILE`, and `OATI_GATEWAY_TLS_CLIENT_CA_FILE`.

`/readyz` requires Valkey, Transit, and at least one lookup resolver. The external origin is deployment-owned and is used only to reconstruct the original path/query binding; the caller's Host header cannot select a trust domain.

`POST /invalidate-cache` accepts the authenticated `{reason,records:[{type,id}]}` fan-out contract used by the platform control plane and synchronously clears exact SDK lookup entries. Revocation changes also clear target-indexed revocation entries. Keep this route internal and mTLS-protected; the bearer token is an additional boundary. Publish and purge a new public key before changing `OATI_GATEWAY_TRANSIT_KEY_VERSION` or the Receipt verification-method ID.

Envoy must prefix authorization requests with `/authorize`, buffer complete bodies with `allow_partial_message: false`, set `failure_mode_allow: false`, and accept only reviewed `x-oati-*` response headers. See [`../../integrations/envoy/envoy.yaml`](../../integrations/envoy/envoy.yaml).

The authorizer does not accept a caller-supplied trust anchor or audience. Each deployment protects one configured audience; deploy separate instances for materially different trust domains.

On allow, constrained authority is atomically consumed and the authorizer emits a signed `pending` Receipt. The protected application remains responsible for a terminal execution Receipt. No gateway Receipt claims that the upstream succeeded before it ran.

Replay and usage keys are security state, not a disposable cache. Run them in an ACL-isolated Valkey database with persistence and `noeviction`; an out-of-memory write must fail authorization rather than evicting a nonce or usage counter.

The Receipt stream is an append-only handoff, not the evidence system of record. A consumer may acknowledge and trim entries only after committing each signed Receipt to durable evidence storage. Until then, capacity pressure intentionally fails authorization closed.

The manual/tagged `Publish gateway authorizer image` workflow publishes multi-architecture GHCR images with an SBOM, provenance, and an immutable digest. Deploy that digest, never a mutable tag.

The real container integration is executable with `./integrations/envoy/test/integration.sh` from the repository root. It covers Envoy-to-authorizer mTLS, lookup trust resolution, Valkey replay and usage state, Transit-compatible Receipt signing, upstream header sanitization, and dependency fail-closed behavior.
