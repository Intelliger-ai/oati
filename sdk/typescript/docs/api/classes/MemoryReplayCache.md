[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / MemoryReplayCache

# Class: MemoryReplayCache

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
