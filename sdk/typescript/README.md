# `@intelliger/oati`

Developer-preview TypeScript types, builders, and semantic validation for OATI core objects and the Commerce and RWA profiles.

```ts
import {
  createPurchaseMandate,
  validateCommerceReceipt,
  createAssetStateClaim,
  validateMintMandate,
} from "@intelliger/oati"
```

Builders require caller-supplied identifiers, issuers, timestamps, and domain inputs. They do not invent trust material. Validation returns a list of actionable issues and does not throw for invalid documents.

Cryptographic signing, proof verification, resolver trust policy, and persistence are not implemented in this developer-preview package.
