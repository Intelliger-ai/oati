# RWA Profile conformance 0.1

The golden-path objects in `examples/rwa/` are the initial positive vectors.

| Vector | Expected result |
|---|---|
| `reserve-amplification-mandate.json` against the example State Claim | reject: mint authority exceeds claimed reserve |
| `insufficient-approvals-receipt.json` against the example mint Mandate | reject: fewer approvals than required |

Run with the developer CLI:

```bash
oati rwa validate-mint-mandate \
  --claim examples/rwa/asset-state-claim.json \
  conformance/rwa/invalid/reserve-amplification-mandate.json
```
