[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiLookupClient

# Class: OatiLookupClient

Defined in: [src/lookup.ts:78](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/lookup.ts#L78)

Production client for OATI-compatible public resolvers.

## Constructors

### Constructor

> **new OatiLookupClient**(`options?`): `OatiLookupClient`

Defined in: [src/lookup.ts:89](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/lookup.ts#L89)

#### Parameters

##### options?

[`LookupClientOptions`](../interfaces/LookupClientOptions.md) = `{}`

#### Returns

`OatiLookupClient`

## Properties

### baseUrl

> `readonly` **baseUrl**: `string`

Defined in: [src/lookup.ts:81](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/lookup.ts#L81)

First configured resolver, retained for source compatibility.

***

### resolverUrls

> `readonly` **resolverUrls**: readonly `string`[]

Defined in: [src/lookup.ts:79](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/lookup.ts#L79)

## Methods

### clearCache()

> **clearCache**(`type?`, `id?`): `void`

Defined in: [src/lookup.ts:167](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/lookup.ts#L167)

#### Parameters

##### type?

`"organisation"` \| `"agent"` \| `"passport"` \| `"mandate"` \| `"receipt"` \| `"issuer"` \| `"key"` \| `"revocation"`

##### id?

`string`

#### Returns

`void`

***

### lookup()

> **lookup**\<`T`\>(`type`, `id`, `options?`): `Promise`\<[`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]\>

Defined in: [src/lookup.ts:110](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/lookup.ts#L110)

#### Type Parameters

##### T

`T` *extends* `"organisation"` \| `"agent"` \| `"passport"` \| `"mandate"` \| `"receipt"` \| `"issuer"` \| `"key"` \| `"revocation"`

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

Defined in: [src/lookup.ts:115](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/lookup.ts#L115)

Lookup with resolver, cache, and rate-limit metadata.

#### Type Parameters

##### T

`T` *extends* `"organisation"` \| `"agent"` \| `"passport"` \| `"mandate"` \| `"receipt"` \| `"issuer"` \| `"key"` \| `"revocation"`

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

Defined in: [src/lookup.ts:152](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/lookup.ts#L152)

Resolve expected absence and proof-state failures without exception-based control flow.

#### Type Parameters

##### T

`T` *extends* `"organisation"` \| `"agent"` \| `"passport"` \| `"mandate"` \| `"receipt"` \| `"issuer"` \| `"key"` \| `"revocation"`

#### Parameters

##### type

`T`

##### id

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`LookupState`](../type-aliases/LookupState.md)\<`T`\>\>
