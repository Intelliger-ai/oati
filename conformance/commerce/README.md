# Commerce Profile conformance 0.1

The golden-path objects in `examples/commerce/` are the initial positive vectors.

Negative vectors in `invalid/` must be rejected for the stated semantic reason even when the document is otherwise valid JSON.

| Vector | Expected result |
|---|---|
| `over-budget-receipt.json` against the example Purchase Mandate | reject: unit price and total exceed Mandate |
| `currency-mismatch-receipt.json` against the example Purchase Mandate | reject: currency differs from Mandate |

Run with the developer CLI:

```bash
oati commerce validate-receipt \
  --mandate examples/commerce/purchase-mandate.json \
  conformance/commerce/invalid/over-budget-receipt.json
```
