[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiUsageStore

# Interface: OatiUsageStore

Defined in: src/middleware.ts:29

## Methods

### compareAndSet()

> **compareAndSet**(`mandateId`, `previous`, `next`): `Promise`\<`boolean`\>

Defined in: src/middleware.ts:33

Atomically replace `previous` with `next`; false indicates a concurrent update.

#### Parameters

##### mandateId

`string`

##### previous

[`UsageSnapshot`](UsageSnapshot.md)

##### next

[`UsageSnapshot`](UsageSnapshot.md)

#### Returns

`Promise`\<`boolean`\>

***

### load()

> **load**(`mandateId`): `Promise`\<[`UsageSnapshot`](UsageSnapshot.md)\>

Defined in: src/middleware.ts:31

Load the latest usage snapshot.

#### Parameters

##### mandateId

`string`

#### Returns

`Promise`\<[`UsageSnapshot`](UsageSnapshot.md)\>
