[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AgentPassport

# Interface: AgentPassport

## Properties

### assurance\_level?

> `optional` **assurance\_level?**: `string`

***

### capabilities?

> `optional` **capabilities?**: `string`[]

***

### display\_name?

> `optional` **display\_name?**: `string`

***

### expires\_at

> **expires\_at**: `string`

***

### id

> **id**: `` `oati:agent:${string}` ``

***

### issued\_at

> **issued\_at**: `string`

***

### issuer

> **issuer**: `string`

***

### oati\_version

> **oati\_version**: `"1.0"`

***

### organisation\_id

> **organisation\_id**: `` `oati:org:${string}` ``

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

***

### protocols?

> `optional` **protocols?**: (`"http"` \| `"grpc"` \| `"mcp"` \| `"a2a"`)[]

***

### status

> **status**: `"active"` \| `"suspended"` \| `"revoked"` \| `"expired"`

***

### status\_endpoint?

> `optional` **status\_endpoint?**: `string`

***

### verification\_methods

> **verification\_methods**: [`VerificationMethod`](VerificationMethod.md)[]
