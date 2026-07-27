[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / ActionReceipt

# Interface: ActionReceipt

Defined in: [src/index.ts:97](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L97)

## Extended by

- [`CommerceReceipt`](CommerceReceipt.md)
- [`RwaReceipt`](RwaReceipt.md)

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### agent\_id

> **agent\_id**: `` `oati:agent:${string}` ``

Defined in: [src/index.ts:101](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L101)

***

### commercial\_profile?

> `optional` **commercial\_profile?**: `string`

Defined in: [src/index.ts:114](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L114)

***

### decision

> **decision**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

Defined in: [src/index.ts:104](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L104)

***

### extensions?

> `optional` **extensions?**: `Record`\<`string`, `unknown`\>

Defined in: [src/index.ts:109](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L109)

***

### id

> **id**: `` `oati:receipt:${string}` ``

Defined in: [src/index.ts:99](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L99)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:107](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L107)

***

### mandate\_id

> **mandate\_id**: `` `oati:mandate:${string}` ``

Defined in: [src/index.ts:103](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L103)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:98](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L98)

***

### occurred\_at

> **occurred\_at**: `string`

Defined in: [src/index.ts:106](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L106)

***

### organisation\_id

> **organisation\_id**: `` `oati:org:${string}` ``

Defined in: [src/index.ts:102](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L102)

***

### outcome

> **outcome**: `"unknown"` \| `"succeeded"` \| `"failed"` \| `"denied"` \| `"pending"`

Defined in: [src/index.ts:105](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L105)

***

### policy\_digest?

> `optional` **policy\_digest?**: `string`

Defined in: [src/index.ts:111](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L111)

***

### profile?

> `optional` **profile?**: `string`

Defined in: [src/index.ts:108](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L108)

***

### proof

> **proof**: [`Proof`](Proof.md)

Defined in: [src/index.ts:110](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L110)

***

### request\_digest?

> `optional` **request\_digest?**: `string`

Defined in: [src/index.ts:112](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L112)

***

### response\_digest?

> `optional` **response\_digest?**: `string`

Defined in: [src/index.ts:113](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L113)

***

### transaction\_id

> **transaction\_id**: `string`

Defined in: [src/index.ts:100](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L100)
