[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiJwsProof

# Interface: OatiJwsProof

## Extends

- [`Proof`](Proof.md)

## Properties

### algorithm

> **algorithm**: `"EdDSA"` \| `"ES256"`

#### Overrides

[`Proof`](Proof.md).[`algorithm`](Proof.md#algorithm)

***

### audience

> **audience**: `string` \| `string`[]

#### Overrides

[`Proof`](Proof.md).[`audience`](Proof.md#audience)

***

### created

> **created**: `string`

#### Overrides

[`Proof`](Proof.md).[`created`](Proof.md#created)

***

### cryptosuite

> **cryptosuite**: [`OatiCryptosuite`](../type-aliases/OatiCryptosuite.md)

#### Overrides

[`Proof`](Proof.md).[`cryptosuite`](Proof.md#cryptosuite)

***

### expires

> **expires**: `string`

#### Overrides

[`Proof`](Proof.md).[`expires`](Proof.md#expires)

***

### nonce

> **nonce**: `string`

#### Overrides

[`Proof`](Proof.md).[`nonce`](Proof.md#nonce)

***

### proof\_purpose

> **proof\_purpose**: `"assertionMethod"`

#### Overrides

[`Proof`](Proof.md).[`proof_purpose`](Proof.md#proof_purpose)

***

### signature

> **signature**: `string`

RFC 7797 detached compact JWS: protected-header..signature

#### Overrides

[`Proof`](Proof.md).[`signature`](Proof.md#signature)

***

### type

> **type**: `"OatiJwsProof2026"`

#### Overrides

[`Proof`](Proof.md).[`type`](Proof.md#type)

***

### verification\_method

> **verification\_method**: `string`

#### Overrides

[`Proof`](Proof.md).[`verification_method`](Proof.md#verification_method)
