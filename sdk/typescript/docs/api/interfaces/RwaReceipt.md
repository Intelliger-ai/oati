[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / RwaReceipt

# Interface: RwaReceipt

Defined in: [src/index.ts:215](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L215)

## Extends

- [`ActionReceipt`](ActionReceipt.md)

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### agent\_id

> **agent\_id**: `` `oati:agent:${string}` ``

Defined in: [src/index.ts:110](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L110)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`agent_id`](ActionReceipt.md#agent_id)

***

### commercial\_profile?

> `optional` **commercial\_profile?**: `string`

Defined in: [src/index.ts:123](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L123)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`commercial_profile`](ActionReceipt.md#commercial_profile)

***

### decision

> **decision**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

Defined in: [src/index.ts:113](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L113)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`decision`](ActionReceipt.md#decision)

***

### extensions

> **extensions**: `object`

Defined in: [src/index.ts:217](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L217)

#### rwa

> **rwa**: [`RwaReceiptTerms`](RwaReceiptTerms.md)

#### Overrides

[`ActionReceipt`](ActionReceipt.md).[`extensions`](ActionReceipt.md#extensions)

***

### id

> **id**: `` `oati:receipt:${string}` ``

Defined in: [src/index.ts:108](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L108)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`id`](ActionReceipt.md#id)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:116](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L116)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`issuer`](ActionReceipt.md#issuer)

***

### mandate\_id

> **mandate\_id**: `` `oati:mandate:${string}` ``

Defined in: [src/index.ts:112](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L112)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`mandate_id`](ActionReceipt.md#mandate_id)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:107](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L107)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`oati_version`](ActionReceipt.md#oati_version)

***

### occurred\_at

> **occurred\_at**: `string`

Defined in: [src/index.ts:115](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L115)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`occurred_at`](ActionReceipt.md#occurred_at)

***

### organisation\_id

> **organisation\_id**: `` `oati:org:${string}` ``

Defined in: [src/index.ts:111](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L111)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`organisation_id`](ActionReceipt.md#organisation_id)

***

### outcome

> **outcome**: `"succeeded"` \| `"failed"` \| `"denied"` \| `"pending"` \| `"unknown"`

Defined in: [src/index.ts:114](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L114)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`outcome`](ActionReceipt.md#outcome)

***

### policy\_digest?

> `optional` **policy\_digest?**: `string`

Defined in: [src/index.ts:120](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L120)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`policy_digest`](ActionReceipt.md#policy_digest)

***

### profile

> **profile**: `"https://specs.intelliger.ai/oati/profiles/rwa/v0.1"`

Defined in: [src/index.ts:216](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L216)

#### Overrides

[`ActionReceipt`](ActionReceipt.md).[`profile`](ActionReceipt.md#profile)

***

### proof

> **proof**: [`Proof`](Proof.md)

Defined in: [src/index.ts:119](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L119)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`proof`](ActionReceipt.md#proof)

***

### request\_digest?

> `optional` **request\_digest?**: `string`

Defined in: [src/index.ts:121](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L121)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`request_digest`](ActionReceipt.md#request_digest)

***

### response\_digest?

> `optional` **response\_digest?**: `string`

Defined in: [src/index.ts:122](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L122)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`response_digest`](ActionReceipt.md#response_digest)

***

### transaction\_id

> **transaction\_id**: `string`

Defined in: [src/index.ts:109](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/index.ts#L109)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`transaction_id`](ActionReceipt.md#transaction_id)
