[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiJwsProof

# Interface: OatiJwsProof

Defined in: [src/crypto.ts:13](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L13)

## Extends

- [`Proof`](Proof.md)

## Properties

### algorithm

> **algorithm**: `"EdDSA"` \| `"ES256"`

Defined in: [src/crypto.ts:16](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L16)

#### Overrides

[`Proof`](Proof.md).[`algorithm`](Proof.md#algorithm)

***

### audience

> **audience**: `string` \| `string`[]

Defined in: [src/crypto.ts:21](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L21)

#### Overrides

[`Proof`](Proof.md).[`audience`](Proof.md#audience)

***

### created

> **created**: `string`

Defined in: [src/crypto.ts:17](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L17)

#### Overrides

[`Proof`](Proof.md).[`created`](Proof.md#created)

***

### cryptosuite

> **cryptosuite**: [`OatiCryptosuite`](../type-aliases/OatiCryptosuite.md)

Defined in: [src/crypto.ts:15](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L15)

#### Overrides

[`Proof`](Proof.md).[`cryptosuite`](Proof.md#cryptosuite)

***

### expires

> **expires**: `string`

Defined in: [src/crypto.ts:18](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L18)

#### Overrides

[`Proof`](Proof.md).[`expires`](Proof.md#expires)

***

### nonce

> **nonce**: `string`

Defined in: [src/crypto.ts:22](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L22)

#### Overrides

[`Proof`](Proof.md).[`nonce`](Proof.md#nonce)

***

### proof\_purpose

> **proof\_purpose**: `"assertionMethod"`

Defined in: [src/crypto.ts:20](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L20)

#### Overrides

[`Proof`](Proof.md).[`proof_purpose`](Proof.md#proof_purpose)

***

### signature

> **signature**: `string`

Defined in: [src/crypto.ts:23](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L23)

RFC 7797 detached compact JWS: protected-header..signature

#### Overrides

[`Proof`](Proof.md).[`signature`](Proof.md#signature)

***

### type

> **type**: `"OatiJwsProof2026"`

Defined in: [src/crypto.ts:14](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L14)

#### Overrides

[`Proof`](Proof.md).[`type`](Proof.md#type)

***

### verification\_method

> **verification\_method**: `string`

Defined in: [src/crypto.ts:19](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/crypto.ts#L19)

#### Overrides

[`Proof`](Proof.md).[`verification_method`](Proof.md#verification_method)
