[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / ActionReceipt

# Interface: ActionReceipt

Defined in: [src/index.ts:104](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L104)

## Extended by

- [`CommerceReceipt`](CommerceReceipt.md)
- [`RwaReceipt`](RwaReceipt.md)

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### agent\_id

> **agent\_id**: `` `oati:agent:${string}` ``

Defined in: [src/index.ts:108](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L108)

***

### commercial\_profile?

> `optional` **commercial\_profile?**: `string`

Defined in: [src/index.ts:121](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L121)

***

### decision

> **decision**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

Defined in: [src/index.ts:111](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L111)

***

### extensions?

> `optional` **extensions?**: `Record`\<`string`, `unknown`\>

Defined in: [src/index.ts:116](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L116)

***

### id

> **id**: `` `oati:receipt:${string}` ``

Defined in: [src/index.ts:106](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L106)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:114](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L114)

***

### mandate\_id

> **mandate\_id**: `` `oati:mandate:${string}` ``

Defined in: [src/index.ts:110](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L110)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:105](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L105)

***

### occurred\_at

> **occurred\_at**: `string`

Defined in: [src/index.ts:113](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L113)

***

### organisation\_id

> **organisation\_id**: `` `oati:org:${string}` ``

Defined in: [src/index.ts:109](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L109)

***

### outcome

> **outcome**: `"unknown"` \| `"failed"` \| `"succeeded"` \| `"denied"` \| `"pending"`

Defined in: [src/index.ts:112](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L112)

***

### policy\_digest?

> `optional` **policy\_digest?**: `string`

Defined in: [src/index.ts:118](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L118)

***

### profile?

> `optional` **profile?**: `string`

Defined in: [src/index.ts:115](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L115)

***

### proof

> **proof**: [`Proof`](Proof.md)

Defined in: [src/index.ts:117](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L117)

***

### request\_digest?

> `optional` **request\_digest?**: `string`

Defined in: [src/index.ts:119](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L119)

***

### response\_digest?

> `optional` **response\_digest?**: `string`

Defined in: [src/index.ts:120](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L120)

***

### transaction\_id

> **transaction\_id**: `string`

Defined in: [src/index.ts:107](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/index.ts#L107)
