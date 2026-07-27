[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / ReplayCache

# Interface: ReplayCache

Defined in: [src/crypto.ts:71](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L71)

## Methods

### checkAndStore()

> **checkAndStore**(`key`, `expiresAt`, `now?`): `boolean` \| `Promise`\<`boolean`\>

Defined in: [src/crypto.ts:73](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L73)

Atomically return false when the key was already present and unexpired.

#### Parameters

##### key

`string`

##### expiresAt

`Date`

##### now?

`Date`

#### Returns

`boolean` \| `Promise`\<`boolean`\>
