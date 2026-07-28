[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / ReplayCache

# Interface: ReplayCache

## Methods

### checkAndStore()

> **checkAndStore**(`key`, `expiresAt`, `now?`): `boolean` \| `Promise`\<`boolean`\>

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
