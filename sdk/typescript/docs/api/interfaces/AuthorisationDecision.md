[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AuthorisationDecision

# Interface: AuthorisationDecision

Defined in: [src/index.ts:90](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L90)

## Properties

### decided\_at

> **decided\_at**: `string`

Defined in: [src/index.ts:98](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L98)

***

### decision

> **decision**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

Defined in: [src/index.ts:94](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L94)

***

### expires\_at?

> `optional` **expires\_at?**: `string`

Defined in: [src/index.ts:99](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L99)

***

### id

> **id**: `` `oati:decision:${string}` ``

Defined in: [src/index.ts:92](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L92)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:100](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L100)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:91](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L91)

***

### obligations?

> `optional` **obligations?**: `Record`\<`string`, `unknown`\>[]

Defined in: [src/index.ts:97](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L97)

***

### policy\_digest

> **policy\_digest**: `string`

Defined in: [src/index.ts:95](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L95)

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

Defined in: [src/index.ts:101](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L101)

***

### reason\_codes?

> `optional` **reason\_codes?**: `string`[]

Defined in: [src/index.ts:96](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L96)

***

### transaction\_id

> **transaction\_id**: `` `oati:tx:${string}` ``

Defined in: [src/index.ts:93](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L93)
