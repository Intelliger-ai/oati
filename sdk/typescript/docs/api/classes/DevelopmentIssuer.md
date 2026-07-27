[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / DevelopmentIssuer

# Class: DevelopmentIssuer

Defined in: src/development.ts:14

In-memory, development-only issuer. Never use its ephemeral keys for production identities.

## Properties

### issuerId

> `readonly` **issuerId**: `string`

Defined in: src/development.ts:16

***

### organisationId

> `readonly` **organisationId**: `` `oati:org:${string}` ``

Defined in: src/development.ts:15

***

### verificationMethod

> `readonly` **verificationMethod**: `string`

Defined in: src/development.ts:17

## Methods

### createMandate()

> **createMandate**(`agentId`, `input`, `now?`): `Promise`\<[`AgentMandate`](../interfaces/AgentMandate.md) & `Record`\<`string`, `unknown`\>\>

Defined in: src/development.ts:61

#### Parameters

##### agentId

`` `oati:agent:${string}` ``

##### input

[`DevelopmentMandateInput`](../interfaces/DevelopmentMandateInput.md)

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`AgentMandate`](../interfaces/AgentMandate.md) & `Record`\<`string`, `unknown`\>\>

***

### publish()

> **publish**(`type`, `id`): [`PublicOatiRecord`](../interfaces/PublicOatiRecord.md)

Defined in: src/development.ts:82

#### Parameters

##### type

`string`

##### id

`string`

#### Returns

[`PublicOatiRecord`](../interfaces/PublicOatiRecord.md)

***

### registerAgent()

> **registerAgent**(`input`, `now?`): `Promise`\<[`AgentPassport`](../interfaces/AgentPassport.md) & `Record`\<`string`, `unknown`\>\>

Defined in: src/development.ts:46

#### Parameters

##### input

[`DevelopmentAgentInput`](../interfaces/DevelopmentAgentInput.md)

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`AgentPassport`](../interfaces/AgentPassport.md) & `Record`\<`string`, `unknown`\>\>

***

### registryRecords()

> **registryRecords**(): [`RegistryProjectionSource`](../interfaces/RegistryProjectionSource.md)[]

Defined in: src/development.ts:89

Export tenant-private registry records for the development control-plane API.

#### Returns

[`RegistryProjectionSource`](../interfaces/RegistryProjectionSource.md)[]

***

### setStatus()

> **setStatus**(`type`, `id`, `status`, `now?`): [`PublicOatiRecord`](../interfaces/PublicOatiRecord.md)

Defined in: src/development.ts:91

#### Parameters

##### type

`"agent"` \| `"passport"` \| `"mandate"`

##### id

`string`

##### status

[`DevelopmentRecordStatus`](../type-aliases/DevelopmentRecordStatus.md)

##### now?

`Date` = `...`

#### Returns

[`PublicOatiRecord`](../interfaces/PublicOatiRecord.md)

***

### signTransaction()

> **signTransaction**(`agentId`, `mandate`, `input`, `now?`): `Promise`\<[`TransactionEnvelope`](../interfaces/TransactionEnvelope.md) & `Record`\<`string`, `unknown`\>\>

Defined in: src/development.ts:72

#### Parameters

##### agentId

`` `oati:agent:${string}` ``

##### mandate

[`AgentMandate`](../interfaces/AgentMandate.md)

##### input

[`DevelopmentTransactionInput`](../interfaces/DevelopmentTransactionInput.md)

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`TransactionEnvelope`](../interfaces/TransactionEnvelope.md) & `Record`\<`string`, `unknown`\>\>

***

### create()

> `static` **create**(`input`): `Promise`\<`DevelopmentIssuer`\>

Defined in: src/development.ts:40

#### Parameters

##### input

[`DevelopmentOrganisationInput`](../interfaces/DevelopmentOrganisationInput.md)

#### Returns

`Promise`\<`DevelopmentIssuer`\>
