# Envoy external-authorisation reference

This bundle shows the fail-closed gateway edge for OATI. Envoy forwards all protected requests to an `envoy.service.auth.v3.Authorization` service at `oati-authz:9001`. That service uses `fromEnvoyCheckRequest()`, the reference middleware/evaluator, and `envoyDecisionHeaders()` from `@intelliger/oati/adapters`.

The configuration deliberately sets `failure_mode_allow: false` and returns HTTP 503 when the authorizer is unavailable. Only the OATI authority headers, method, path, host, and authorization proof are forwarded. Private platform records must never be added to Envoy dynamic metadata.

`opa/oati.rego` is an optional defense-in-depth policy for deployments that route the normalized `toOpaInput()` document to OPA. It never grants access on malformed or absent OATI input and requires the deterministic OATI decision to be `allow`.

Production deployments must use TLS/mTLS between Envoy and the authorizer, a distributed replay cache, durable Receipt emission, bounded request bodies, and atomic Mandate usage storage.
