[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / TrustResolver

# Interface: TrustResolver

Defined in: [src/crypto.ts:65](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L65)

## Methods

### resolveIssuer()

> **resolveIssuer**(`id`): `Promise`\<[`TrustedIssuer`](TrustedIssuer.md) \| `null`\>

Defined in: [src/crypto.ts:67](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L67)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`TrustedIssuer`](TrustedIssuer.md) \| `null`\>

***

### resolveKey()

> **resolveKey**(`id`): `Promise`\<[`VerificationKey`](VerificationKey.md) \| `null`\>

Defined in: [src/crypto.ts:66](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L66)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`VerificationKey`](VerificationKey.md) \| `null`\>

***

### resolveRevocation()

> **resolveRevocation**(`target`): `Promise`\<[`RevocationStatus`](RevocationStatus.md) \| `null`\>

Defined in: [src/crypto.ts:68](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L68)

#### Parameters

##### target

`string`

#### Returns

`Promise`\<[`RevocationStatus`](RevocationStatus.md) \| `null`\>
