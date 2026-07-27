[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AgentMandate

# Interface: AgentMandate

Defined in: [src/index.ts:40](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L40)

## Extended by

- [`PurchaseMandate`](PurchaseMandate.md)
- [`AssetMandate`](AssetMandate.md)

## Properties

### actions

> **actions**: `string`[]

Defined in: [src/index.ts:48](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L48)

***

### counterparties?

> `optional` **counterparties?**: `string`[]

Defined in: [src/index.ts:50](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L50)

***

### data\_use?

> `optional` **data\_use?**: `Record`\<`string`, `unknown`\>

Defined in: [src/index.ts:53](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L53)

***

### delegation?

> `optional` **delegation?**: `object`

Defined in: [src/index.ts:54](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L54)

#### allowed

> **allowed**: `boolean`

#### max\_depth

> **max\_depth**: `number`

***

### destinations?

> `optional` **destinations?**: `string`[]

Defined in: [src/index.ts:51](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L51)

***

### expires\_at

> **expires\_at**: `string`

Defined in: [src/index.ts:56](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L56)

***

### extensions?

> `optional` **extensions?**: `Record`\<`string`, `unknown`\>

Defined in: [src/index.ts:59](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L59)

***

### id

> **id**: `` `oati:mandate:${string}` ``

Defined in: [src/index.ts:42](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L42)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:43](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L43)

***

### limits?

> `optional` **limits?**: `Record`\<`string`, `unknown`\>

Defined in: [src/index.ts:52](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L52)

***

### not\_before

> **not\_before**: `string`

Defined in: [src/index.ts:55](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L55)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:41](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L41)

***

### parent\_mandate?

> `optional` **parent\_mandate?**: `string`

Defined in: [src/index.ts:46](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L46)

***

### profile?

> `optional` **profile?**: `string`

Defined in: [src/index.ts:58](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L58)

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

Defined in: [src/index.ts:60](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L60)

***

### purpose

> **purpose**: `string`

Defined in: [src/index.ts:47](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L47)

***

### resources?

> `optional` **resources?**: `string`[]

Defined in: [src/index.ts:49](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L49)

***

### sponsor?

> `optional` **sponsor?**: `string`

Defined in: [src/index.ts:45](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L45)

***

### status

> **status**: `"active"` \| `"suspended"` \| `"revoked"` \| `"expired"` \| `"consumed"`

Defined in: [src/index.ts:57](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L57)

***

### subject

> **subject**: `` `oati:agent:${string}` ``

Defined in: [src/index.ts:44](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L44)
