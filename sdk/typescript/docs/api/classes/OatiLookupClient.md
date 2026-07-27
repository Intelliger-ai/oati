[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiLookupClient

# Class: OatiLookupClient

Defined in: src/lookup.ts:35

Client for an OATI-compatible public resolver.

## Constructors

### Constructor

> **new OatiLookupClient**(`options?`): `OatiLookupClient`

Defined in: src/lookup.ts:41

#### Parameters

##### options?

[`LookupClientOptions`](../interfaces/LookupClientOptions.md) = `{}`

#### Returns

`OatiLookupClient`

## Properties

### baseUrl

> `readonly` **baseUrl**: `string`

Defined in: src/lookup.ts:36

## Methods

### lookup()

> **lookup**(`type`, `id`, `options?`): `Promise`\<[`PublicOatiRecord`](../interfaces/PublicOatiRecord.md)\>

Defined in: src/lookup.ts:50

#### Parameters

##### type

`"organisation"` \| `"agent"` \| `"passport"` \| `"mandate"` \| `"receipt"` \| `"issuer"` \| `"key"` \| `"revocation"`

##### id

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`PublicOatiRecord`](../interfaces/PublicOatiRecord.md)\>
