[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / VerificationKey

# Interface: VerificationKey

## Properties

### algorithm

> **algorithm**: `"EdDSA"` \| `"ES256"`

***

### controller

> **controller**: `string`

***

### id

> **id**: `string`

***

### issuer

> **issuer**: `string`

***

### proofStatus?

> `optional` **proofStatus?**: `"unknown"` \| `"verified"` \| `"invalid"` \| `"unavailable"`

***

### publicKeyJwk

> **publicKeyJwk**: `JsonWebKey`

***

### revokedAt?

> `optional` **revokedAt?**: `string`

***

### status

> **status**: `"active"` \| `"revoked"` \| `"retired"`

***

### validFrom

> **validFrom**: `string`

***

### validUntil?

> `optional` **validUntil?**: `string`
