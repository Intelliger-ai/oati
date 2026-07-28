[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AuthorisationDecision

# Interface: AuthorisationDecision

## Properties

### decided\_at

> **decided\_at**: `string`

***

### decision

> **decision**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

***

### expires\_at?

> `optional` **expires\_at?**: `string`

***

### id

> **id**: `` `oati:decision:${string}` ``

***

### issuer

> **issuer**: `string`

***

### oati\_version

> **oati\_version**: `"1.0"`

***

### obligations?

> `optional` **obligations?**: `Record`\<`string`, `unknown`\>[]

***

### policy\_digest

> **policy\_digest**: `string`

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

***

### reason\_codes?

> `optional` **reason\_codes?**: `string`[]

***

### transaction\_id

> **transaction\_id**: `` `oati:tx:${string}` ``
