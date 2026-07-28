[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / KeyAttributes

# Interface: KeyAttributes

## Extends

- `Record`\<`string`, `string`\>

## Indexable

> \[`key`: `string`\]: `string`

## Properties

### algorithm

> **algorithm**: `"EdDSA"` \| `"ES256"`

***

### controller

> **controller**: `string`

***

### ~~issuer?~~

> `optional` **issuer?**: `string`

#### Deprecated

Key issuer is canonical at `record.issuer`.

***

### public\_key\_jwk

> **public\_key\_jwk**: `string`

***

### revoked\_at?

> `optional` **revoked\_at?**: `string`

***

### ~~valid\_from?~~

> `optional` **valid\_from?**: `string`

#### Deprecated

Key activation is canonical at `record.issued_at`.

***

### ~~valid\_until?~~

> `optional` **valid\_until?**: `string`

#### Deprecated

Key expiry is canonical at `record.expires_at`.
