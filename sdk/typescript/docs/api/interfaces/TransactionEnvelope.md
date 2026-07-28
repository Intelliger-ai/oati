[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / TransactionEnvelope

# Interface: TransactionEnvelope

## Properties

### action

> **action**: `string`

***

### agent\_id

> **agent\_id**: `` `oati:agent:${string}` ``

***

### commercial\_profile?

> `optional` **commercial\_profile?**: `string`

***

### counterparty?

> `optional` **counterparty?**: `string`

***

### destination?

> `optional` **destination?**: `string`

***

### extensions?

> `optional` **extensions?**: `Record`\<`string`, `unknown`\>

***

### id

> **id**: `` `oati:tx:${string}` ``

***

### issued\_at

> **issued\_at**: `string`

***

### mandate\_id

> **mandate\_id**: `` `oati:mandate:${string}` ``

***

### nonce

> **nonce**: `string`

***

### oati\_version

> **oati\_version**: `"1.0"`

***

### organisation\_id

> **organisation\_id**: `` `oati:org:${string}` ``

***

### profile?

> `optional` **profile?**: `string`

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

***

### protocol?

> `optional` **protocol?**: `"http"` \| `"grpc"` \| `"mcp"` \| `"a2a"`

***

### purpose?

> `optional` **purpose?**: `string`

***

### request\_digest?

> `optional` **request\_digest?**: `string`

***

### resource

> **resource**: `string`
