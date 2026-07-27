[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / LookupTrustResolver

# Class: LookupTrustResolver

Defined in: [src/crypto.ts:211](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L211)

Resolve key, issuer, and revocation records through the public OATI lookup API.

## Implements

- [`TrustResolver`](../interfaces/TrustResolver.md)

## Constructors

### Constructor

> **new LookupTrustResolver**(`lookup`): `LookupTrustResolver`

Defined in: [src/crypto.ts:212](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L212)

#### Parameters

##### lookup

[`OatiLookupClient`](OatiLookupClient.md)

#### Returns

`LookupTrustResolver`

## Methods

### resolveIssuer()

> **resolveIssuer**(`id`): `Promise`\<[`TrustedIssuer`](../interfaces/TrustedIssuer.md) \| `null`\>

Defined in: [src/crypto.ts:227](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L227)

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

Defined in: [src/crypto.ts:213](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L213)

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

Defined in: [src/crypto.ts:238](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/crypto.ts#L238)

#### Parameters

##### target

`string`

#### Returns

`Promise`\<[`RevocationStatus`](../interfaces/RevocationStatus.md) \| `null`\>

#### Implementation of

[`TrustResolver`](../interfaces/TrustResolver.md).[`resolveRevocation`](../interfaces/TrustResolver.md#resolverevocation)
