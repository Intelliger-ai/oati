[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / MemoryReplayCache

# Class: MemoryReplayCache

Defined in: [src/crypto.ts:187](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/crypto.ts#L187)

## Implements

- [`ReplayCache`](../interfaces/ReplayCache.md)

## Constructors

### Constructor

> **new MemoryReplayCache**(): `MemoryReplayCache`

#### Returns

`MemoryReplayCache`

## Methods

### checkAndStore()

> **checkAndStore**(`key`, `expiresAt`, `verificationTime?`): `boolean`

Defined in: [src/crypto.ts:189](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/crypto.ts#L189)

Atomically return false when the key was already present and unexpired.

#### Parameters

##### key

`string`

##### expiresAt

`Date`

##### verificationTime?

`Date` = `...`

#### Returns

`boolean`

#### Implementation of

[`ReplayCache`](../interfaces/ReplayCache.md).[`checkAndStore`](../interfaces/ReplayCache.md#checkandstore)
