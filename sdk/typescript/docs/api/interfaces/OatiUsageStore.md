[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiUsageStore

# Interface: OatiUsageStore

Defined in: [src/middleware.ts:29](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/middleware.ts#L29)

## Methods

### compareAndSet()

> **compareAndSet**(`mandateId`, `previous`, `next`): `Promise`\<`boolean`\>

Defined in: [src/middleware.ts:33](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/middleware.ts#L33)

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

Defined in: [src/middleware.ts:31](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/middleware.ts#L31)

Load the latest usage snapshot.

#### Parameters

##### mandateId

`string`

#### Returns

`Promise`\<[`UsageSnapshot`](UsageSnapshot.md)\>
