[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / verifyDocument

# Function: verifyDocument()

> **verifyDocument**(`document`, `policy`): `Promise`\<[`VerificationResult`](../interfaces/VerificationResult.md)\>

Defined in: [src/crypto.ts:137](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L137)

Verify signature, trust chain, key lifecycle, revocation, time, audience, and replay in one operation.

## Parameters

### document

`Record`\<`string`, `unknown`\>

### policy

[`VerificationPolicy`](../interfaces/VerificationPolicy.md)

## Returns

`Promise`\<[`VerificationResult`](../interfaces/VerificationResult.md)\>
