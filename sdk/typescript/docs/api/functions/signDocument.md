[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / signDocument

# Function: signDocument()

> **signDocument**\<`T`\>(`document`, `options`): `Promise`\<`T` & `object`\>

Defined in: [src/crypto.ts:108](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L108)

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
