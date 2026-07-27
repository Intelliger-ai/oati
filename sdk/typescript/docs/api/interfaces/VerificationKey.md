[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / VerificationKey

# Interface: VerificationKey

Defined in: src/crypto.ts:36

## Properties

### algorithm

> **algorithm**: `"EdDSA"` \| `"ES256"`

Defined in: src/crypto.ts:40

***

### controller

> **controller**: `string`

Defined in: src/crypto.ts:38

***

### id

> **id**: `string`

Defined in: src/crypto.ts:37

***

### issuer

> **issuer**: `string`

Defined in: src/crypto.ts:39

***

### proofStatus?

> `optional` **proofStatus?**: `"verified"` \| `"invalid"` \| `"unavailable"` \| `"unknown"`

Defined in: src/crypto.ts:46

***

### publicKeyJwk

> **publicKeyJwk**: `JsonWebKey`

Defined in: src/crypto.ts:41

***

### revokedAt?

> `optional` **revokedAt?**: `string`

Defined in: src/crypto.ts:45

***

### status

> **status**: `"active"` \| `"retired"` \| `"revoked"`

Defined in: src/crypto.ts:42

***

### validFrom

> **validFrom**: `string`

Defined in: src/crypto.ts:43

***

### validUntil?

> `optional` **validUntil?**: `string`

Defined in: src/crypto.ts:44
