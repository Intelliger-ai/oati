[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / ActionReceipt

# Interface: ActionReceipt

## Extended by

- [`CommerceReceipt`](CommerceReceipt.md)
- [`RwaReceipt`](RwaReceipt.md)

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### agent\_id

> **agent\_id**: `` `oati:agent:${string}` ``

***

### commercial\_profile?

> `optional` **commercial\_profile?**: `string`

***

### decision

> **decision**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

***

### extensions?

> `optional` **extensions?**: `Record`\<`string`, `unknown`\>

***

### id

> **id**: `` `oati:receipt:${string}` ``

***

### issuer

> **issuer**: `string`

***

### mandate\_id

> **mandate\_id**: `` `oati:mandate:${string}` ``

***

### oati\_version

> **oati\_version**: `"1.0"`

***

### occurred\_at

> **occurred\_at**: `string`

***

### organisation\_id

> **organisation\_id**: `` `oati:org:${string}` ``

***

### outcome

> **outcome**: `"succeeded"` \| `"failed"` \| `"denied"` \| `"pending"` \| `"unknown"`

***

### policy\_digest?

> `optional` **policy\_digest?**: `string`

***

### profile?

> `optional` **profile?**: `string`

***

### proof

> **proof**: [`Proof`](Proof.md)

***

### request\_digest?

> `optional` **request\_digest?**: `string`

***

### response\_digest?

> `optional` **response\_digest?**: `string`

***

### transaction\_id

> **transaction\_id**: `string`
