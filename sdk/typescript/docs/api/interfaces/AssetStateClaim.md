[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AssetStateClaim

# Interface: AssetStateClaim

Defined in: [src/index.ts:160](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L160)

## Properties

### asset\_id

> **asset\_id**: `` `oati:asset:${string}` ``

Defined in: [src/index.ts:164](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L164)

***

### claim\_type

> **claim\_type**: `"reserve_balance"` \| `"nav"` \| `"eligibility"` \| `"covenant"` \| `"custody"` \| `"collateral"`

Defined in: [src/index.ts:165](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L165)

***

### evidence

> **evidence**: `object`

Defined in: [src/index.ts:178](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L178)

#### digest

> **digest**: `string`

#### media\_type

> **media\_type**: `string`

#### uri?

> `optional` **uri?**: `string`

***

### id

> **id**: `` `oati:claim:${string}` ``

Defined in: [src/index.ts:163](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L163)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:176](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L176)

***

### issuer\_role

> **issuer\_role**: `"custodian"` \| `"administrator"` \| `"oracle"` \| `"auditor"`

Defined in: [src/index.ts:177](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L177)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:161](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L161)

***

### observed\_at

> **observed\_at**: `string`

Defined in: [src/index.ts:174](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L174)

***

### profile

> **profile**: `"https://specs.intelliger.ai/oati/profiles/rwa/v0.1"`

Defined in: [src/index.ts:162](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L162)

***

### proof

> **proof**: [`Proof`](Proof.md)

Defined in: [src/index.ts:179](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L179)

***

### unit

> **unit**: `string`

Defined in: [src/index.ts:173](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L173)

***

### valid\_until

> **valid\_until**: `string`

Defined in: [src/index.ts:175](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L175)

***

### value

> **value**: `` `${number}` ``

Defined in: [src/index.ts:172](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/index.ts#L172)
