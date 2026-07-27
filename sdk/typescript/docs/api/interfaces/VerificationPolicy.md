[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / VerificationPolicy

# Interface: VerificationPolicy

Defined in: [src/crypto.ts:76](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L76)

## Properties

### allowedAlgorithms?

> `optional` **allowedAlgorithms?**: readonly (`"EdDSA"` \| `"ES256"`)[]

Defined in: [src/crypto.ts:82](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L82)

***

### clockSkewMs?

> `optional` **clockSkewMs?**: `number`

Defined in: [src/crypto.ts:83](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L83)

***

### expectedAudience

> **expectedAudience**: `string`

Defined in: [src/crypto.ts:79](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L79)

***

### maxProofAgeMs?

> `optional` **maxProofAgeMs?**: `number`

Defined in: [src/crypto.ts:84](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L84)

***

### maxTrustDepth?

> `optional` **maxTrustDepth?**: `number`

Defined in: [src/crypto.ts:85](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L85)

***

### now?

> `optional` **now?**: `Date`

Defined in: [src/crypto.ts:81](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L81)

***

### replayCache

> **replayCache**: [`ReplayCache`](ReplayCache.md)

Defined in: [src/crypto.ts:80](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L80)

***

### resolver

> **resolver**: [`TrustResolver`](TrustResolver.md)

Defined in: [src/crypto.ts:77](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L77)

***

### trustAnchors

> **trustAnchors**: readonly `string`[]

Defined in: [src/crypto.ts:78](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L78)
