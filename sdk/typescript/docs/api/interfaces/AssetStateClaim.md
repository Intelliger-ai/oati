[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AssetStateClaim

# Interface: AssetStateClaim

Defined in: [src/index.ts:153](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L153)

## Properties

### asset\_id

> **asset\_id**: `` `oati:asset:${string}` ``

Defined in: [src/index.ts:157](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L157)

***

### claim\_type

> **claim\_type**: `"reserve_balance"` \| `"nav"` \| `"eligibility"` \| `"covenant"` \| `"custody"` \| `"collateral"`

Defined in: [src/index.ts:158](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L158)

***

### evidence

> **evidence**: `object`

Defined in: [src/index.ts:171](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L171)

#### digest

> **digest**: `string`

#### media\_type

> **media\_type**: `string`

#### uri?

> `optional` **uri?**: `string`

***

### id

> **id**: `` `oati:claim:${string}` ``

Defined in: [src/index.ts:156](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L156)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:169](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L169)

***

### issuer\_role

> **issuer\_role**: `"custodian"` \| `"administrator"` \| `"oracle"` \| `"auditor"`

Defined in: [src/index.ts:170](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L170)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:154](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L154)

***

### observed\_at

> **observed\_at**: `string`

Defined in: [src/index.ts:167](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L167)

***

### profile

> **profile**: `"https://specs.intelliger.ai/oati/profiles/rwa/v0.1"`

Defined in: [src/index.ts:155](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L155)

***

### proof

> **proof**: [`Proof`](Proof.md)

Defined in: [src/index.ts:172](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L172)

***

### unit

> **unit**: `string`

Defined in: [src/index.ts:166](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L166)

***

### valid\_until

> **valid\_until**: `string`

Defined in: [src/index.ts:168](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L168)

***

### value

> **value**: `` `${number}` ``

Defined in: [src/index.ts:165](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L165)
