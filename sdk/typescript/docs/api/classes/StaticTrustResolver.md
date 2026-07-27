[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / StaticTrustResolver

# Class: StaticTrustResolver

Defined in: [src/crypto.ts:199](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/crypto.ts#L199)

## Implements

- [`TrustResolver`](../interfaces/TrustResolver.md)

## Constructors

### Constructor

> **new StaticTrustResolver**(`keys`, `issuers`, `revocations?`): `StaticTrustResolver`

Defined in: [src/crypto.ts:200](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/crypto.ts#L200)

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

Defined in: [src/crypto.ts:206](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/crypto.ts#L206)

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

Defined in: [src/crypto.ts:205](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/crypto.ts#L205)

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

Defined in: [src/crypto.ts:207](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/crypto.ts#L207)

#### Parameters

##### target

`string`

#### Returns

`Promise`\<[`RevocationStatus`](../interfaces/RevocationStatus.md) \| `null`\>

#### Implementation of

[`TrustResolver`](../interfaces/TrustResolver.md).[`resolveRevocation`](../interfaces/TrustResolver.md#resolverevocation)
