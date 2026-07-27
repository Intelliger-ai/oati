[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / PurchaseMandate

# Interface: PurchaseMandate

Defined in: [src/index.ts:137](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L137)

## Extends

- [`AgentMandate`](AgentMandate.md)

## Properties

### actions

> **actions**: `string`[]

Defined in: [src/index.ts:54](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L54)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`actions`](AgentMandate.md#actions)

***

### counterparties?

> `optional` **counterparties?**: `string`[]

Defined in: [src/index.ts:56](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L56)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`counterparties`](AgentMandate.md#counterparties)

***

### data\_use?

> `optional` **data\_use?**: `Record`\<`string`, `unknown`\>

Defined in: [src/index.ts:59](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L59)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`data_use`](AgentMandate.md#data_use)

***

### delegation?

> `optional` **delegation?**: `object`

Defined in: [src/index.ts:60](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L60)

#### allowed

> **allowed**: `boolean`

#### max\_depth

> **max\_depth**: `number`

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`delegation`](AgentMandate.md#delegation)

***

### destinations?

> `optional` **destinations?**: `string`[]

Defined in: [src/index.ts:57](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L57)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`destinations`](AgentMandate.md#destinations)

***

### expires\_at

> **expires\_at**: `string`

Defined in: [src/index.ts:62](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L62)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`expires_at`](AgentMandate.md#expires_at)

***

### extensions

> **extensions**: `object`

Defined in: [src/index.ts:139](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L139)

#### commerce

> **commerce**: [`CommerceTerms`](CommerceTerms.md)

#### Overrides

[`AgentMandate`](AgentMandate.md).[`extensions`](AgentMandate.md#extensions)

***

### id

> **id**: `` `oati:mandate:${string}` ``

Defined in: [src/index.ts:48](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L48)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`id`](AgentMandate.md#id)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:49](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L49)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`issuer`](AgentMandate.md#issuer)

***

### limits?

> `optional` **limits?**: `Record`\<`string`, `unknown`\>

Defined in: [src/index.ts:58](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L58)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`limits`](AgentMandate.md#limits)

***

### not\_before

> **not\_before**: `string`

Defined in: [src/index.ts:61](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L61)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`not_before`](AgentMandate.md#not_before)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:47](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L47)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`oati_version`](AgentMandate.md#oati_version)

***

### parent\_mandate?

> `optional` **parent\_mandate?**: `string`

Defined in: [src/index.ts:52](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L52)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`parent_mandate`](AgentMandate.md#parent_mandate)

***

### profile

> **profile**: `"https://specs.intelliger.ai/oati/profiles/commerce/v0.1"`

Defined in: [src/index.ts:138](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L138)

#### Overrides

[`AgentMandate`](AgentMandate.md).[`profile`](AgentMandate.md#profile)

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

Defined in: [src/index.ts:66](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L66)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`proof`](AgentMandate.md#proof)

***

### purpose

> **purpose**: `string`

Defined in: [src/index.ts:53](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L53)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`purpose`](AgentMandate.md#purpose)

***

### resources?

> `optional` **resources?**: `string`[]

Defined in: [src/index.ts:55](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L55)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`resources`](AgentMandate.md#resources)

***

### sponsor?

> `optional` **sponsor?**: `string`

Defined in: [src/index.ts:51](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L51)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`sponsor`](AgentMandate.md#sponsor)

***

### status

> **status**: `"active"` \| `"suspended"` \| `"revoked"` \| `"expired"` \| `"consumed"`

Defined in: [src/index.ts:63](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L63)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`status`](AgentMandate.md#status)

***

### subject

> **subject**: `` `oati:agent:${string}` ``

Defined in: [src/index.ts:50](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/index.ts#L50)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`subject`](AgentMandate.md#subject)
