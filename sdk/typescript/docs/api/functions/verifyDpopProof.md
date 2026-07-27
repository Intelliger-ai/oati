[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / verifyDpopProof

# Function: verifyDpopProof()

> **verifyDpopProof**(`proof`, `request`, `options`): `Promise`\<[`DpopVerificationResult`](../interfaces/DpopVerificationResult.md)\>

Defined in: [src/adapters.ts:75](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/adapters.ts#L75)

Verify an RFC 9449 ES256 or EdDSA DPoP proof and its access-token/request binding.

## Parameters

### proof

`string`

### request

`Request`

### options

[`DpopVerificationOptions`](../interfaces/DpopVerificationOptions.md)

## Returns

`Promise`\<[`DpopVerificationResult`](../interfaces/DpopVerificationResult.md)\>
