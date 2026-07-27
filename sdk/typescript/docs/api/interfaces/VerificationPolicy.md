[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / VerificationPolicy

# Interface: VerificationPolicy

Defined in: src/crypto.ts:76

## Properties

### allowedAlgorithms?

> `optional` **allowedAlgorithms?**: readonly (`"EdDSA"` \| `"ES256"`)[]

Defined in: src/crypto.ts:82

***

### clockSkewMs?

> `optional` **clockSkewMs?**: `number`

Defined in: src/crypto.ts:83

***

### expectedAudience

> **expectedAudience**: `string`

Defined in: src/crypto.ts:79

***

### maxProofAgeMs?

> `optional` **maxProofAgeMs?**: `number`

Defined in: src/crypto.ts:84

***

### maxTrustDepth?

> `optional` **maxTrustDepth?**: `number`

Defined in: src/crypto.ts:85

***

### now?

> `optional` **now?**: `Date`

Defined in: src/crypto.ts:81

***

### replayCache

> **replayCache**: [`ReplayCache`](ReplayCache.md)

Defined in: src/crypto.ts:80

***

### resolver

> **resolver**: [`TrustResolver`](TrustResolver.md)

Defined in: src/crypto.ts:77

***

### trustAnchors

> **trustAnchors**: readonly `string`[]

Defined in: src/crypto.ts:78
