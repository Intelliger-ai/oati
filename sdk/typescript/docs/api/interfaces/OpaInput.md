[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OpaInput

# Interface: OpaInput

Defined in: [src/adapters.ts:164](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/adapters.ts#L164)

## Properties

### input

> **input**: `object`

Defined in: [src/adapters.ts:164](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/adapters.ts#L164)

#### action

> **action**: `string`

#### context

> **context**: `Record`\<`string`, `unknown`\>

#### oati

> **oati**: `object`

##### oati.decision?

> `optional` **decision?**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

##### oati.envelope

> **envelope**: [`TransactionEnvelope`](TransactionEnvelope.md)

##### oati.mandate

> **mandate**: [`AgentMandate`](AgentMandate.md)

#### principal

> **principal**: `string`

#### resource

> **resource**: `string`
