[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / httpRequestDigest

# Function: httpRequestDigest()

> **httpRequestDigest**(`request`, `maxBodyBytes?`): `Promise`\<`string`\>

Defined in: [src/middleware.ts:177](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/middleware.ts#L177)

Compute the OATI HTTP binding digest over method, path/query target, and raw body bytes.

## Parameters

### request

`Request`

### maxBodyBytes?

`number` = `1_048_576`

## Returns

`Promise`\<`string`\>
