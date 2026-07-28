[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / PublicOatiRecord

# Interface: PublicOatiRecord\<T, A\>

## Extended by

- [`OrganisationRecord`](OrganisationRecord.md)
- [`AgentRecord`](AgentRecord.md)
- [`PassportRecord`](PassportRecord.md)
- [`MandateRecord`](MandateRecord.md)
- [`ReceiptRecord`](ReceiptRecord.md)
- [`IssuerRecord`](IssuerRecord.md)
- [`KeyRecord`](KeyRecord.md)
- [`RevocationRecord`](RevocationRecord.md)
- [`ServiceRecord`](ServiceRecord.md)
- [`ProfileRecord`](ProfileRecord.md)
- [`RegistryProjectionSource`](RegistryProjectionSource.md)

## Type Parameters

### T

`T` *extends* [`OatiRecordType`](../type-aliases/OatiRecordType.md) = [`OatiRecordType`](../type-aliases/OatiRecordType.md)

### A

`A` *extends* `Record`\<`string`, `string` \| `undefined`\> = `Record`\<`string`, `string` \| `undefined`\>

## Properties

### assurance\_level?

> `optional` **assurance\_level?**: `string`

***

### display\_name?

> `optional` **display\_name?**: `string`

***

### expires\_at?

> `optional` **expires\_at?**: `string`

***

### id

> **id**: `string`

***

### issued\_at?

> `optional` **issued\_at?**: `string`

***

### issuer

> **issuer**: `string`

***

### organisation\_id?

> `optional` **organisation\_id?**: `string`

***

### proof\_status

> **proof\_status**: [`ProofStatus`](../type-aliases/ProofStatus.md)

***

### public\_attributes

> **public\_attributes**: `A`

***

### status

> **status**: `string`

***

### type

> **type**: `T`
