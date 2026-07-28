# Envoy external-authorisation reference

This bundle is the operational fail-closed gateway edge for OATI. Envoy sends every protected request to the HTTPS authorizer at `oati-authz:9001`; `/authorize` is prefixed to the original path so the authorizer can bind the untouched method, target, and complete bounded body. The service in [`../../services/envoy-authorizer/`](../../services/envoy-authorizer/) runs the reference middleware/evaluator with public lookup trust resolution.

The configuration sets `failure_mode_allow: false`, buffers at most 1 MiB with partial messages forbidden, and returns HTTP 503 when the authorizer is unavailable. Envoy and the authorizer mutually authenticate with TLS. Untrusted downstream `x-oati-*` decision headers are removed before authorization; signed OATI/DPoP carrier headers are removed after verification so only authorizer-produced `x-oati-*` results reach the application. Private platform records are never added to Envoy metadata.

`opa/oati.rego` is an optional defense-in-depth policy for deployments that route the normalized `toOpaInput()` document to OPA. It never grants access on malformed or absent OATI input and requires the deterministic OATI decision to be `allow`.

The authorizer uses Valkey `SET NX PX` for replay and a Lua compare-and-set for Mandate usage, resolves issuer/key/revocation state through configured public resolver URLs, signs Receipts through Transit, verifies Transit’s response, and appends every generated Receipt to an AOF-backed Valkey handoff stream. Dependency errors deny or return 503; trust cache freshness is explicitly bounded by deployment configuration. Only an evidence consumer may trim the stream after a durable commit.

Validate customer configuration with the exact Envoy image before rollout:

```sh
envoy --mode validate -c /etc/envoy/envoy.yaml
```

The bundled upstream cluster is a placeholder named `application`. Customer deployments must replace only its address/TLS policy and the fixed gateway audience; they must preserve the authorization filter order and fail-closed settings.
