# Envoy external-authorisation reference

This bundle is the operational fail-closed gateway edge for OATI. Envoy sends every protected request to the HTTPS authorizer at `oati-authz:9001`; `/authorize` is prefixed to the original path so the authorizer can bind the untouched method, target, and complete bounded body. The service in [`../../services/envoy-authorizer/`](../../services/envoy-authorizer/) runs the reference middleware/evaluator with public lookup trust resolution.

The configuration sets `failure_mode_allow: false`, buffers at most 1 MiB with partial messages forbidden, limits each instance to a 200-request burst replenished at 200 requests/second before authorization, and returns HTTP 503 when the authorizer is unavailable. Tune the local token bucket to the protected service and add a distributed edge limit for multi-instance deployments. Envoy and the authorizer mutually authenticate with TLS. Untrusted downstream `x-oati-*` decision headers are removed before authorization; signed OATI/DPoP carrier headers are removed after verification and only the six explicitly allow-listed authorizer result headers can reach the application or client. Private platform records are never added to Envoy metadata. The Envoy admin listener is loopback-only.

`opa/oati.rego` is an optional defense-in-depth policy for deployments that route the normalized `toOpaInput()` document to OPA. It never grants access on malformed or absent OATI input and requires the deterministic OATI decision to be `allow`.

The authorizer uses Valkey `SET NX PX` for replay and a Lua compare-and-set for Mandate usage, resolves issuer/key/revocation state through configured public resolver URLs, signs Receipts through Transit, verifies Transit’s response, appends every generated Receipt to an AOF-backed Valkey recovery stream, and commits it to the private evidence API before allowing the request. Dependency errors deny or return 503; trust cache freshness is explicitly bounded by deployment configuration. Only an evidence consumer may trim the stream after a durable commit.

Validate customer configuration with the exact Envoy image before rollout:

```sh
envoy --mode validate -c /etc/envoy/envoy.yaml
```

## Container integration test

Run the public end-to-end integration from the repository root:

```sh
./integrations/envoy/test/integration.sh
```

The test builds the real authorizer image and starts Envoy 1.33, Valkey, a contract-compatible lookup resolver, an mTLS certificate generator, a protected upstream, a bilateral evidence fixture, and a test-only Transit protocol signer. It proves that:

- Envoy and the authorizer mutually authenticate and the published YAML is accepted by the pinned Envoy image;
- lookup-resolved issuer/key trust permits a valid request;
- untrusted decision headers and raw OATI credentials do not reach the upstream;
- the authorizer emits a Transit-signed Receipt that verifies through lookup;
- Valkey rejects an exact replay and persists the Mandate usage transition;
- a fresh request exceeding `max_calls` is denied; and
- a new issuer key succeeds while a retired issuer key fails;
- a revoked Mandate fails;
- lookup and Valkey outages fail closed; and
- both named organisations retrieve the immutable Receipt while an outsider cannot.

The script removes all containers, networks, and generated TLS material on exit. The lookup, key, and Transit fixtures contain only the repository's public conformance test key and are never suitable for deployment.

The bundled upstream cluster is a placeholder named `application`. Customer deployments must replace only its address/TLS policy and the fixed gateway audience; they must preserve the authorization filter order and fail-closed settings. Port 8080 is deliberately a reference cleartext listener: production deployments must terminate authenticated HTTPS at this Envoy listener or at a trusted load balancer that cannot be bypassed.
