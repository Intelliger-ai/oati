[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / CommerceReceipt

# Interface: CommerceReceipt

## Extends

- [`ActionReceipt`](ActionReceipt.md)

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### agent\_id

> **agent\_id**: `` `oati:agent:${string}` ``

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`agent_id`](ActionReceipt.md#agent_id)

***

### commercial\_profile?

> `optional` **commercial\_profile?**: `string`

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`commercial_profile`](ActionReceipt.md#commercial_profile)

***

### decision

> **decision**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`decision`](ActionReceipt.md#decision)

***

### extensions

> **extensions**: `object`

#### commerce

> **commerce**: [`CommerceReceiptTerms`](CommerceReceiptTerms.md)

#### Overrides

[`ActionReceipt`](ActionReceipt.md).[`extensions`](ActionReceipt.md#extensions)

***

### id

> **id**: `` `oati:receipt:${string}` ``

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`id`](ActionReceipt.md#id)

***

### issuer

> **issuer**: `string`

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`issuer`](ActionReceipt.md#issuer)

***

### mandate\_id

> **mandate\_id**: `` `oati:mandate:${string}` ``

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`mandate_id`](ActionReceipt.md#mandate_id)

***

### oati\_version

> **oati\_version**: `"1.0"`

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`oati_version`](ActionReceipt.md#oati_version)

***

### occurred\_at

> **occurred\_at**: `string`

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`occurred_at`](ActionReceipt.md#occurred_at)

***

### organisation\_id

> **organisation\_id**: `` `oati:org:${string}` ``

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`organisation_id`](ActionReceipt.md#organisation_id)

***

### outcome

> **outcome**: `"succeeded"` \| `"failed"` \| `"denied"` \| `"pending"` \| `"unknown"`

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`outcome`](ActionReceipt.md#outcome)

***

### policy\_digest?

> `optional` **policy\_digest?**: `string`

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`policy_digest`](ActionReceipt.md#policy_digest)

***

### profile

> **profile**: `"https://specs.intelliger.ai/oati/profiles/commerce/v0.1"`

#### Overrides

[`ActionReceipt`](ActionReceipt.md).[`profile`](ActionReceipt.md#profile)

***

### proof

> **proof**: [`Proof`](Proof.md)

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`proof`](ActionReceipt.md#proof)

***

### request\_digest?

> `optional` **request\_digest?**: `string`

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`request_digest`](ActionReceipt.md#request_digest)

***

### response\_digest?

> `optional` **response\_digest?**: `string`

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`response_digest`](ActionReceipt.md#response_digest)

***

### transaction\_id

> **transaction\_id**: `string`

#### Inherited from

[`ActionReceipt`](ActionReceipt.md).[`transaction_id`](ActionReceipt.md#transaction_id)
