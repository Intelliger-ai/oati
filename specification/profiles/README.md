# OATI profiles

Profiles add domain semantics without creating incompatible OATI object families.

Every profiled core object:

1. remains valid against its core OATI schema;
2. declares a stable `profile` URI;
3. places domain fields in a namespaced member of `extensions`;
4. preserves core identity, expiry, revocation, non-amplification, and evidence rules;
5. publishes positive and negative conformance vectors.

Initial profiles:

- [`commerce/`](commerce/) — agent purchase of a paid API or digital service;
- [`rwa/`](rwa/) — controlled minting against a current Asset State Claim.
