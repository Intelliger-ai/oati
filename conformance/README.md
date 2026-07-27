# Conformance

The conformance suite will contain language-neutral fixtures for:

- valid and invalid Passport, Mandate, Envelope, Decision, and Receipt objects;
- canonical serialisation and signature verification;
- expiry, suspension, and revocation;
- delegation subset and non-amplification checks;
- replay and audience binding;
- selective-disclosure public projections;
- MCP, A2A, OAuth, DPoP, and AuthZEN profiles.

An implementation may claim OATI compatibility only against a published conformance-suite version.

Initial profile suites:

- [`commerce/`](commerce/) — paid-API price, currency, quantity, merchant, service, and offer constraints;
- [`rwa/`](rwa/) — controlled-mint reserve, State Claim, token target, quantity, and approval constraints.
