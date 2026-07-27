[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AgentMandate

# Interface: AgentMandate

Defined in: [src/index.ts:46](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L46)

## Extended by

- [`PurchaseMandate`](PurchaseMandate.md)
- [`AssetMandate`](AssetMandate.md)

## Properties

### actions

> **actions**: `string`[]

Defined in: [src/index.ts:54](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L54)

***

### counterparties?

> `optional` **counterparties?**: `string`[]

Defined in: [src/index.ts:56](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L56)

***

### data\_use?

> `optional` **data\_use?**: `Record`\<`string`, `unknown`\>

Defined in: [src/index.ts:59](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L59)

***

### delegation?

> `optional` **delegation?**: `object`

Defined in: [src/index.ts:60](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L60)

#### allowed

> **allowed**: `boolean`

#### max\_depth

> **max\_depth**: `number`

***

### destinations?

> `optional` **destinations?**: `string`[]

Defined in: [src/index.ts:57](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L57)

***

### expires\_at

> **expires\_at**: `string`

Defined in: [src/index.ts:62](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L62)

***

### extensions?

> `optional` **extensions?**: `Record`\<`string`, `unknown`\>

Defined in: [src/index.ts:65](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L65)

***

### id

> **id**: `` `oati:mandate:${string}` ``

Defined in: [src/index.ts:48](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L48)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:49](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L49)

***

### limits?

> `optional` **limits?**: `Record`\<`string`, `unknown`\>

Defined in: [src/index.ts:58](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L58)

***

### not\_before

> **not\_before**: `string`

Defined in: [src/index.ts:61](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L61)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:47](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L47)

***

### parent\_mandate?

> `optional` **parent\_mandate?**: `string`

Defined in: [src/index.ts:52](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L52)

***

### profile?

> `optional` **profile?**: `string`

Defined in: [src/index.ts:64](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L64)

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

Defined in: [src/index.ts:66](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L66)

***

### purpose

> **purpose**: `string`

Defined in: [src/index.ts:53](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L53)

***

### resources?

> `optional` **resources?**: `string`[]

Defined in: [src/index.ts:55](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L55)

***

### sponsor?

> `optional` **sponsor?**: `string`

Defined in: [src/index.ts:51](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L51)

***

### status

> **status**: `"active"` \| `"suspended"` \| `"revoked"` \| `"expired"` \| `"consumed"`

Defined in: [src/index.ts:63](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L63)

***

### subject

> **subject**: `` `oati:agent:${string}` ``

Defined in: [src/index.ts:50](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L50)
