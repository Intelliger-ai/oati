[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / TrustResolver

# Interface: TrustResolver

## Methods

### resolveIssuer()

> **resolveIssuer**(`id`): `Promise`\<[`TrustedIssuer`](TrustedIssuer.md) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`TrustedIssuer`](TrustedIssuer.md) \| `null`\>

***

### resolveKey()

> **resolveKey**(`id`): `Promise`\<[`VerificationKey`](VerificationKey.md) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`VerificationKey`](VerificationKey.md) \| `null`\>

***

### resolveRevocation()

> **resolveRevocation**(`target`): `Promise`\<[`RevocationStatus`](RevocationStatus.md) \| `null`\>

#### Parameters

##### target

`string`

#### Returns

`Promise`\<[`RevocationStatus`](RevocationStatus.md) \| `null`\>
