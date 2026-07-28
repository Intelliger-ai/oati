[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / LookupClientOptions

# Interface: LookupClientOptions

## Properties

### ~~baseUrl?~~

> `optional` **baseUrl?**: `string`

#### Deprecated

Use resolverUrls.

***

### cache?

> `optional` **cache?**: `false` \| [`LookupCacheOptions`](LookupCacheOptions.md)

***

### fetch?

> `optional` **fetch?**: (`input`, `init?`) => `Promise`\<`Response`\>

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

***

### resolverUrls?

> `optional` **resolverUrls?**: readonly `string`[]

Resolver base URLs. Calls fail over in order; each URL must expose `/lookup`.

***

### retry?

> `optional` **retry?**: [`LookupRetryOptions`](LookupRetryOptions.md)

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`
