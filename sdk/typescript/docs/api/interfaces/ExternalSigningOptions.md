[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / ExternalSigningOptions

# Interface: ExternalSigningOptions

## Extends

- `Omit`\<[`SigningOptions`](SigningOptions.md), `"privateKey"`\>

## Properties

### algorithm

> **algorithm**: `"EdDSA"` \| `"ES256"`

#### Inherited from

[`SigningOptions`](SigningOptions.md).[`algorithm`](SigningOptions.md#algorithm)

***

### audience

> **audience**: `string` \| `string`[]

#### Inherited from

[`SigningOptions`](SigningOptions.md).[`audience`](SigningOptions.md#audience)

***

### created?

> `optional` **created?**: `string` \| `Date`

#### Inherited from

[`SigningOptions`](SigningOptions.md).[`created`](SigningOptions.md#created)

***

### expires

> **expires**: `string` \| `Date`

#### Inherited from

[`SigningOptions`](SigningOptions.md).[`expires`](SigningOptions.md#expires)

***

### nonce

> **nonce**: `string`

#### Inherited from

[`SigningOptions`](SigningOptions.md).[`nonce`](SigningOptions.md#nonce)

***

### verificationMethod

> **verificationMethod**: `string`

#### Inherited from

[`SigningOptions`](SigningOptions.md).[`verificationMethod`](SigningOptions.md#verificationmethod)

## Methods

### sign()

> **sign**(`input`, `algorithm`, `verificationMethod`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Sign the exact RFC 7797 detached-JWS signing input inside a KMS/HSM boundary.

#### Parameters

##### input

`Uint8Array`

##### algorithm

`"EdDSA"` \| `"ES256"`

##### verificationMethod

`string`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>
