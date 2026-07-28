[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / VerificationPolicy

# Interface: VerificationPolicy

## Properties

### allowedAlgorithms?

> `optional` **allowedAlgorithms?**: readonly (`"EdDSA"` \| `"ES256"`)[]

***

### clockSkewMs?

> `optional` **clockSkewMs?**: `number`

***

### expectedAudience

> **expectedAudience**: `string`

***

### maxProofAgeMs?

> `optional` **maxProofAgeMs?**: `number`

***

### maxTrustDepth?

> `optional` **maxTrustDepth?**: `number`

***

### now?

> `optional` **now?**: `Date`

***

### replayCache

> **replayCache**: [`ReplayCache`](ReplayCache.md)

***

### resolver

> **resolver**: [`TrustResolver`](TrustResolver.md)

***

### trustAnchors

> **trustAnchors**: readonly `string`[]
