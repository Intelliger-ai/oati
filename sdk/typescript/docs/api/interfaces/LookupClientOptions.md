[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / LookupClientOptions

# Interface: LookupClientOptions

Defined in: [src/lookup.ts:58](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/lookup.ts#L58)

## Properties

### ~~baseUrl?~~

> `optional` **baseUrl?**: `string`

Defined in: [src/lookup.ts:62](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/lookup.ts#L62)

#### Deprecated

Use resolverUrls.

***

### cache?

> `optional` **cache?**: `false` \| [`LookupCacheOptions`](LookupCacheOptions.md)

Defined in: [src/lookup.ts:67](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/lookup.ts#L67)

***

### fetch?

> `optional` **fetch?**: (`input`, `init?`) => `Promise`\<`Response`\>

Defined in: [src/lookup.ts:63](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/lookup.ts#L63)

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

#### Parameters

##### input

`URL` \| `RequestInfo`

##### init?

`RequestInit`

#### Returns

`Promise`\<`Response`\>

***

### headers?

> `optional` **headers?**: `HeadersInit`

Defined in: [src/lookup.ts:65](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/lookup.ts#L65)

***

### resolverUrls?

> `optional` **resolverUrls?**: readonly `string`[]

Defined in: [src/lookup.ts:60](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/lookup.ts#L60)

Resolver base URLs. Calls fail over in order; each URL must expose `/lookup`.

***

### retry?

> `optional` **retry?**: [`LookupRetryOptions`](LookupRetryOptions.md)

Defined in: [src/lookup.ts:66](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/lookup.ts#L66)

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [src/lookup.ts:64](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/lookup.ts#L64)
