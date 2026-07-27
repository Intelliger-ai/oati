[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / httpRequestDigest

# Function: httpRequestDigest()

> **httpRequestDigest**(`request`, `maxBodyBytes?`): `Promise`\<`string`\>

Defined in: [src/middleware.ts:177](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/middleware.ts#L177)

Compute the OATI HTTP binding digest over method, path/query target, and raw body bytes.

## Parameters

### request

`Request`

### maxBodyBytes?

`number` = `1_048_576`

## Returns

`Promise`\<`string`\>
