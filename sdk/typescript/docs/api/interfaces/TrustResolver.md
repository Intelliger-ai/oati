[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / TrustResolver

# Interface: TrustResolver

Defined in: src/crypto.ts:65

## Methods

### resolveIssuer()

> **resolveIssuer**(`id`): `Promise`\<[`TrustedIssuer`](TrustedIssuer.md) \| `null`\>

Defined in: src/crypto.ts:67

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`TrustedIssuer`](TrustedIssuer.md) \| `null`\>

***

### resolveKey()

> **resolveKey**(`id`): `Promise`\<[`VerificationKey`](VerificationKey.md) \| `null`\>

Defined in: src/crypto.ts:66

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`VerificationKey`](VerificationKey.md) \| `null`\>

***

### resolveRevocation()

> **resolveRevocation**(`target`): `Promise`\<[`RevocationStatus`](RevocationStatus.md) \| `null`\>

Defined in: src/crypto.ts:68

#### Parameters

##### target

`string`

#### Returns

`Promise`\<[`RevocationStatus`](RevocationStatus.md) \| `null`\>
