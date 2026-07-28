[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AssetStateClaim

# Interface: AssetStateClaim

## Properties

### asset\_id

> **asset\_id**: `` `oati:asset:${string}` ``

***

### claim\_type

> **claim\_type**: `"reserve_balance"` \| `"nav"` \| `"eligibility"` \| `"covenant"` \| `"custody"` \| `"collateral"`

***

### evidence

> **evidence**: `object`

#### digest

> **digest**: `string`

#### media\_type

> **media\_type**: `string`

#### uri?

> `optional` **uri?**: `string`

***

### id

> **id**: `` `oati:claim:${string}` ``

***

### issuer

> **issuer**: `string`

***

### issuer\_role

> **issuer\_role**: `"custodian"` \| `"administrator"` \| `"oracle"` \| `"auditor"`

***

### oati\_version

> **oati\_version**: `"1.0"`

***

### observed\_at

> **observed\_at**: `string`

***

### profile

> **profile**: `"https://specs.intelliger.ai/oati/profiles/rwa/v0.1"`

***

### proof

> **proof**: [`Proof`](Proof.md)

***

### unit

> **unit**: `string`

***

### valid\_until

> **valid\_until**: `string`

***

### value

> **value**: `` `${number}` ``
