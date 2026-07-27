[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / signDocument

# Function: signDocument()

> **signDocument**\<`T`\>(`document`, `options`): `Promise`\<`T` & `object`\>

Defined in: src/crypto.ts:108

Sign an OATI object using an RFC 7797 detached JWS over its canonical JSON form.

## Type Parameters

### T

`T` *extends* `Record`\<`string`, `unknown`\>

## Parameters

### document

`T`

### options

[`SigningOptions`](../interfaces/SigningOptions.md)

## Returns

`Promise`\<`T` & `object`\>
