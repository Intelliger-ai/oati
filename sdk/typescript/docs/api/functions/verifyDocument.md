[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / verifyDocument

# Function: verifyDocument()

> **verifyDocument**(`document`, `policy`): `Promise`\<[`VerificationResult`](../interfaces/VerificationResult.md)\>

Defined in: [src/crypto.ts:137](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L137)

Verify signature, trust chain, key lifecycle, revocation, time, audience, and replay in one operation.

## Parameters

### document

`Record`\<`string`, `unknown`\>

### policy

[`VerificationPolicy`](../interfaces/VerificationPolicy.md)

## Returns

`Promise`\<[`VerificationResult`](../interfaces/VerificationResult.md)\>
