[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AssetMandate

# Interface: AssetMandate

## Extends

- [`AgentMandate`](AgentMandate.md)

## Properties

### actions

> **actions**: `string`[]

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`actions`](AgentMandate.md#actions)

***

### counterparties?

> `optional` **counterparties?**: `string`[]

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`counterparties`](AgentMandate.md#counterparties)

***

### data\_use?

> `optional` **data\_use?**: `Record`\<`string`, `unknown`\>

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`data_use`](AgentMandate.md#data_use)

***

### delegation?

> `optional` **delegation?**: `object`

#### allowed

> **allowed**: `boolean`

#### max\_depth

> **max\_depth**: `number`

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`delegation`](AgentMandate.md#delegation)

***

### destinations?

> `optional` **destinations?**: `string`[]

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`destinations`](AgentMandate.md#destinations)

***

### expires\_at

> **expires\_at**: `string`

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`expires_at`](AgentMandate.md#expires_at)

***

### extensions

> **extensions**: `object`

#### rwa

> **rwa**: [`RwaMandateTerms`](RwaMandateTerms.md)

#### Overrides

[`AgentMandate`](AgentMandate.md).[`extensions`](AgentMandate.md#extensions)

***

### id

> **id**: `` `oati:mandate:${string}` ``

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`id`](AgentMandate.md#id)

***

### issuer

> **issuer**: `string`

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`issuer`](AgentMandate.md#issuer)

***

### limits?

> `optional` **limits?**: `Record`\<`string`, `unknown`\>

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`limits`](AgentMandate.md#limits)

***

### not\_before

> **not\_before**: `string`

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`not_before`](AgentMandate.md#not_before)

***

### oati\_version

> **oati\_version**: `"1.0"`

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`oati_version`](AgentMandate.md#oati_version)

***

### parent\_mandate?

> `optional` **parent\_mandate?**: `string`

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`parent_mandate`](AgentMandate.md#parent_mandate)

***

### profile

> **profile**: `"https://specs.intelliger.ai/oati/profiles/rwa/v0.1"`

#### Overrides

[`AgentMandate`](AgentMandate.md).[`profile`](AgentMandate.md#profile)

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`proof`](AgentMandate.md#proof)

***

### purpose

> **purpose**: `string`

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`purpose`](AgentMandate.md#purpose)

***

### resources?

> `optional` **resources?**: `string`[]

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`resources`](AgentMandate.md#resources)

***

### sponsor?

> `optional` **sponsor?**: `string`

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`sponsor`](AgentMandate.md#sponsor)

***

### status

> **status**: `"active"` \| `"suspended"` \| `"revoked"` \| `"expired"` \| `"consumed"`

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`status`](AgentMandate.md#status)

***

### subject

> **subject**: `` `oati:agent:${string}` ``

#### Inherited from

[`AgentMandate`](AgentMandate.md).[`subject`](AgentMandate.md#subject)
