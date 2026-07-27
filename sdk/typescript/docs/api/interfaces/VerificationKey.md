[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / VerificationKey

# Interface: VerificationKey

Defined in: [src/crypto.ts:36](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L36)

## Properties

### algorithm

> **algorithm**: `"EdDSA"` \| `"ES256"`

Defined in: [src/crypto.ts:40](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L40)

***

### controller

> **controller**: `string`

Defined in: [src/crypto.ts:38](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L38)

***

### id

> **id**: `string`

Defined in: [src/crypto.ts:37](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L37)

***

### issuer

> **issuer**: `string`

Defined in: [src/crypto.ts:39](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L39)

***

### proofStatus?

> `optional` **proofStatus?**: `"verified"` \| `"invalid"` \| `"unavailable"` \| `"unknown"`

Defined in: [src/crypto.ts:46](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L46)

***

### publicKeyJwk

> **publicKeyJwk**: `JsonWebKey`

Defined in: [src/crypto.ts:41](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L41)

***

### revokedAt?

> `optional` **revokedAt?**: `string`

Defined in: [src/crypto.ts:45](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L45)

***

### status

> **status**: `"active"` \| `"revoked"` \| `"retired"`

Defined in: [src/crypto.ts:42](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L42)

***

### validFrom

> **validFrom**: `string`

Defined in: [src/crypto.ts:43](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L43)

***

### validUntil?

> `optional` **validUntil?**: `string`

Defined in: [src/crypto.ts:44](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/crypto.ts#L44)
