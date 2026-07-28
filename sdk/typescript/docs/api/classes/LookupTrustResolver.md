[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / LookupTrustResolver

# Class: LookupTrustResolver

Resolve key, issuer, and revocation records through the public OATI lookup API.

## Implements

- [`TrustResolver`](../interfaces/TrustResolver.md)

## Constructors

### Constructor

> **new LookupTrustResolver**(`lookup`): `LookupTrustResolver`

#### Parameters

##### lookup

[`OatiLookupClient`](OatiLookupClient.md)

#### Returns

`LookupTrustResolver`

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
