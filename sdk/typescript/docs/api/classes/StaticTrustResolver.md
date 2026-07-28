[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / StaticTrustResolver

# Class: StaticTrustResolver

## Implements

- [`TrustResolver`](../interfaces/TrustResolver.md)

## Constructors

### Constructor

> **new StaticTrustResolver**(`keys`, `issuers`, `revocations?`): `StaticTrustResolver`

#### Parameters

##### keys

readonly [`VerificationKey`](../interfaces/VerificationKey.md)[]

##### issuers

readonly [`TrustedIssuer`](../interfaces/TrustedIssuer.md)[]

##### revocations?

readonly [`RevocationStatus`](../interfaces/RevocationStatus.md)[] = `[]`

#### Returns

`StaticTrustResolver`

## Methods

### resolveIssuer()

> **resolveIssuer**(`id`): `Promise`\<[`TrustedIssuer`](../interfaces/TrustedIssuer.md) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`TrustedIssuer`](../interfaces/TrustedIssuer.md) \| `null`\>

#### Implementation of

[`TrustResolver`](../interfaces/TrustResolver.md).[`resolveIssuer`](../interfaces/TrustResolver.md#resolveissuer)

***

### resolveKey()

> **resolveKey**(`id`): `Promise`\<[`VerificationKey`](../interfaces/VerificationKey.md) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`VerificationKey`](../interfaces/VerificationKey.md) \| `null`\>

#### Implementation of

[`TrustResolver`](../interfaces/TrustResolver.md).[`resolveKey`](../interfaces/TrustResolver.md#resolvekey)

***

### resolveRevocation()

> **resolveRevocation**(`target`): `Promise`\<[`RevocationStatus`](../interfaces/RevocationStatus.md) \| `null`\>

#### Parameters

##### target

`string`

#### Returns

`Promise`\<[`RevocationStatus`](../interfaces/RevocationStatus.md) \| `null`\>

#### Implementation of

[`TrustResolver`](../interfaces/TrustResolver.md).[`resolveRevocation`](../interfaces/TrustResolver.md#resolverevocation)
