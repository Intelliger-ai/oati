[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiLookupClient

# Class: OatiLookupClient

Defined in: [src/lookup.ts:35](https://github.com/Intelliger-ai/oati/blob/c08e10897dc5a776cbc5701b35b0139c32a1c30b/sdk/typescript/src/lookup.ts#L35)

Client for an OATI-compatible public resolver.

## Constructors

### Constructor

> **new OatiLookupClient**(`options?`): `OatiLookupClient`

Defined in: [src/lookup.ts:41](https://github.com/Intelliger-ai/oati/blob/c08e10897dc5a776cbc5701b35b0139c32a1c30b/sdk/typescript/src/lookup.ts#L41)

#### Parameters

##### options?

[`LookupClientOptions`](../interfaces/LookupClientOptions.md) = `{}`

#### Returns

`OatiLookupClient`

## Properties

### baseUrl

> `readonly` **baseUrl**: `string`

Defined in: [src/lookup.ts:36](https://github.com/Intelliger-ai/oati/blob/c08e10897dc5a776cbc5701b35b0139c32a1c30b/sdk/typescript/src/lookup.ts#L36)

## Methods

### lookup()

> **lookup**(`type`, `id`, `options?`): `Promise`\<[`PublicOatiRecord`](../interfaces/PublicOatiRecord.md)\>

Defined in: [src/lookup.ts:50](https://github.com/Intelliger-ai/oati/blob/c08e10897dc5a776cbc5701b35b0139c32a1c30b/sdk/typescript/src/lookup.ts#L50)

#### Parameters

##### type

`"organisation"` \| `"agent"` \| `"passport"` \| `"mandate"` \| `"receipt"` \| `"issuer"` \| `"key"` \| `"revocation"`

##### id

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`PublicOatiRecord`](../interfaces/PublicOatiRecord.md)\>
