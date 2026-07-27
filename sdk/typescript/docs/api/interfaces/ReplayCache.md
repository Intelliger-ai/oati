[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / ReplayCache

# Interface: ReplayCache

Defined in: src/crypto.ts:71

## Methods

### checkAndStore()

> **checkAndStore**(`key`, `expiresAt`, `now?`): `boolean` \| `Promise`\<`boolean`\>

Defined in: src/crypto.ts:73

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
