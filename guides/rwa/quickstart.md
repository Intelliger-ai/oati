# RWA quickstart: controlled minting

## Goal

Mint a bounded quantity of a tokenised asset only when a current, authorised Asset State Claim and the required approvals support the action.

## 1. Publish the Asset Profile

Describe the asset, issuer, jurisdiction, unit, network, token contract, standard, authorised roles, claim freshness, and approval policy.

```bash
oati rwa validate-asset asset-profile.json
```

## 2. Produce an Asset State Claim

An authorised custodian, administrator, oracle, or auditor signs a current claim with its evidence digest and validity window.

```bash
oati rwa validate-state-claim asset-state-claim.json
```

## 3. Issue one-time mint authority

The Asset Mandate binds the exact asset, claim, network, contract, unit, maximum quantity, approvals, expiry, and one-time-use requirement.

```bash
oati rwa validate-mint-mandate \
  --claim asset-state-claim.json \
  mint-mandate.json
```

Before execution, independently verify proof chains, role authority, claim freshness, available reserve, approval segregation, current supply, replay state, and local legal/compliance policy.

## 4. Record the on-chain result

The RWA Receipt binds the mint to its Mandate, State Claim, approvals, chain transaction hash, quantity, and resulting supply.

```bash
oati rwa validate-receipt \
  --mandate mint-mandate.json \
  rwa-receipt.json
```

OATI establishes attributable authority and evidence. It does not guarantee asset existence, valuation correctness, or legal enforceability.
