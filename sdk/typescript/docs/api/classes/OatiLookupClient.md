[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiLookupClient

# Class: OatiLookupClient

Production client for OATI-compatible public resolvers.

## Constructors

### Constructor

> **new OatiLookupClient**(`options?`): `OatiLookupClient`

#### Parameters

##### options?

[`LookupClientOptions`](../interfaces/LookupClientOptions.md) = `{}`

#### Returns

`OatiLookupClient`

## Properties

### baseUrl

> `readonly` **baseUrl**: `string`

First configured resolver, retained for source compatibility.

***

### resolverUrls

> `readonly` **resolverUrls**: readonly `string`[]

## Methods

### clearCache()

> **clearCache**(`type?`, `id?`): `void`

#### Parameters

##### type?

`"issuer"` \| `"organisation"` \| `"agent"` \| `"passport"` \| `"mandate"` \| `"receipt"` \| `"key"` \| `"revocation"`

##### id?

`string`

#### Returns

`void`

***

### lookup()

> **lookup**\<`T`\>(`type`, `id`, `options?`): `Promise`\<[`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]\>

#### Type Parameters

##### T

`T` *extends* `"issuer"` \| `"organisation"` \| `"agent"` \| `"passport"` \| `"mandate"` \| `"receipt"` \| `"key"` \| `"revocation"`

#### Parameters

##### type

`T`

##### id

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]\>

***

### lookupDetailed()

> **lookupDetailed**\<`T`\>(`type`, `id`, `options?`): `Promise`\<[`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>\>

Lookup with resolver, cache, and rate-limit metadata.

#### Type Parameters

##### T

`T` *extends* `"issuer"` \| `"organisation"` \| `"agent"` \| `"passport"` \| `"mandate"` \| `"receipt"` \| `"key"` \| `"revocation"`

#### Parameters

##### type

`T`

##### id

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>\>

***

### lookupState()

> **lookupState**\<`T`\>(`type`, `id`, `options?`): `Promise`\<[`LookupState`](../type-aliases/LookupState.md)\<`T`\>\>

Resolve expected absence and proof-state failures without exception-based control flow.

#### Type Parameters

##### T

`T` *extends* `"issuer"` \| `"organisation"` \| `"agent"` \| `"passport"` \| `"mandate"` \| `"receipt"` \| `"key"` \| `"revocation"`

#### Parameters

##### type

`T`

##### id

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`LookupState`](../type-aliases/LookupState.md)\<`T`\>\>
