# OATI RWA Profile 0.1

## Purpose

The RWA Profile controls agentic actions connecting tokenised instruments to off-chain assets, organisations, evidence, approvals, and current asset state.

Profile URI: `https://specs.intelliger.ai/oati/profiles/rwa/v0.1`

The first conformance workflow is controlled minting against a current Asset State Claim.

## Objects

### Asset Profile

Issuer-signed metadata identifying the asset, instrument, jurisdiction, token contract, units, authoritative roles, eligibility policy, and evidence policy.

### Asset State Claim

A signed assertion by an authorised custodian, administrator, auditor, or oracle describing a measured state such as reserve balance or NAV, its observation time, evidence digest, validity window, and subject asset.

### Asset Mandate

A core Agent Mandate whose RWA extension constrains asset, chain, token contract, action, maximum quantity, state-claim reference, required roles, approval threshold, and one-time use.

### RWA Action Receipt

A core Action Receipt whose RWA extension binds the asset, state claim, chain transaction, token contract, quantity, approvals, and resulting supply or position.

## Controlled-mint invariants

- Asset Profile, State Claim, Mandate, and operator Passport must be current;
- State Claim issuer must hold an allowed role for the asset;
- claim observation age must be within the asset policy;
- asset, chain, token contract, unit, and state-claim references must match;
- mint quantity must not exceed both Mandate maximum and verified available reserve;
- required segregation-of-duties roles and approval threshold must be satisfied;
- a one-time Mandate cannot be replayed;
- the Receipt binds the on-chain transaction hash and resulting supply.

OATI verifies authority, evidence provenance, and enforced constraints. It does not assert that an off-chain asset exists, a valuation is correct, or a legal right is enforceable in every jurisdiction.
