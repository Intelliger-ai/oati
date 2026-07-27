[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AuthorisationDecision

# Interface: AuthorisationDecision

Defined in: [src/index.ts:92](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L92)

## Properties

### decided\_at

> **decided\_at**: `string`

Defined in: [src/index.ts:100](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L100)

***

### decision

> **decision**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

Defined in: [src/index.ts:96](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L96)

***

### expires\_at?

> `optional` **expires\_at?**: `string`

Defined in: [src/index.ts:101](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L101)

***

### id

> **id**: `` `oati:decision:${string}` ``

Defined in: [src/index.ts:94](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L94)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:102](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L102)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:93](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L93)

***

### obligations?

> `optional` **obligations?**: `Record`\<`string`, `unknown`\>[]

Defined in: [src/index.ts:99](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L99)

***

### policy\_digest

> **policy\_digest**: `string`

Defined in: [src/index.ts:97](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L97)

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

Defined in: [src/index.ts:103](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L103)

***

### reason\_codes?

> `optional` **reason\_codes?**: `string`[]

Defined in: [src/index.ts:98](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L98)

***

### transaction\_id

> **transaction\_id**: `` `oati:tx:${string}` ``

Defined in: [src/index.ts:95](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L95)
