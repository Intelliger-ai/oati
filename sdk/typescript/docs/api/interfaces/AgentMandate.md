[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AgentMandate

# Interface: AgentMandate

## Extended by

- [`PurchaseMandate`](PurchaseMandate.md)
- [`AssetMandate`](AssetMandate.md)

## Properties

### actions

> **actions**: `string`[]

***

### counterparties?

> `optional` **counterparties?**: `string`[]

***

### data\_use?

> `optional` **data\_use?**: `Record`\<`string`, `unknown`\>

***

### delegation?

> `optional` **delegation?**: `object`

#### allowed

> **allowed**: `boolean`

#### max\_depth

> **max\_depth**: `number`

***

### destinations?

> `optional` **destinations?**: `string`[]

***

### expires\_at

> **expires\_at**: `string`

***

### extensions?

> `optional` **extensions?**: `Record`\<`string`, `unknown`\>

***

### id

> **id**: `` `oati:mandate:${string}` ``

***

### issuer

> **issuer**: `string`

***

### limits?

> `optional` **limits?**: `Record`\<`string`, `unknown`\>

***

### not\_before

> **not\_before**: `string`

***

### oati\_version

> **oati\_version**: `"1.0"`

***

### parent\_mandate?

> `optional` **parent\_mandate?**: `string`

***

### profile?

> `optional` **profile?**: `string`

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

***

### purpose

> **purpose**: `string`

***

### resources?

> `optional` **resources?**: `string`[]

***

### sponsor?

> `optional` **sponsor?**: `string`

***

### status

> **status**: `"active"` \| `"suspended"` \| `"revoked"` \| `"expired"` \| `"consumed"`

***

### subject

> **subject**: `` `oati:agent:${string}` ``
