[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / LookupResponse

# Interface: LookupResponse\<T\>

Defined in: [src/lookup.ts:42](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L42)

## Type Parameters

### T

`T` *extends* [`OatiRecordType`](../type-aliases/OatiRecordType.md)

## Properties

### cache

> **cache**: `"hit"` \| `"miss"` \| `"revalidated"`

Defined in: [src/lookup.ts:45](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L45)

***

### rateLimit

> **rateLimit**: [`RateLimitInfo`](RateLimitInfo.md)

Defined in: [src/lookup.ts:46](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L46)

***

### record

> **record**: [`OatiRecordByType`](OatiRecordByType.md)\[`T`\]

Defined in: [src/lookup.ts:43](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L43)

***

### resolverUrl

> **resolverUrl**: `string`

Defined in: [src/lookup.ts:44](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L44)
