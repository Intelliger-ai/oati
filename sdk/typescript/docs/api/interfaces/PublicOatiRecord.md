[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / PublicOatiRecord

# Interface: PublicOatiRecord\<T, A\>

Defined in: [src/lookup.ts:9](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L9)

## Extended by

- [`OrganisationRecord`](OrganisationRecord.md)
- [`AgentRecord`](AgentRecord.md)
- [`PassportRecord`](PassportRecord.md)
- [`MandateRecord`](MandateRecord.md)
- [`ReceiptRecord`](ReceiptRecord.md)
- [`IssuerRecord`](IssuerRecord.md)
- [`KeyRecord`](KeyRecord.md)
- [`RevocationRecord`](RevocationRecord.md)
- [`RegistryProjectionSource`](RegistryProjectionSource.md)

## Type Parameters

### T

`T` *extends* [`OatiRecordType`](../type-aliases/OatiRecordType.md) = [`OatiRecordType`](../type-aliases/OatiRecordType.md)

### A

`A` *extends* `Record`\<`string`, `string`\> = `Record`\<`string`, `string`\>

## Properties

### assurance\_level?

> `optional` **assurance\_level?**: `string`

Defined in: [src/lookup.ts:18](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L18)

***

### display\_name?

> `optional` **display\_name?**: `string`

Defined in: [src/lookup.ts:12](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L12)

***

### expires\_at?

> `optional` **expires\_at?**: `string`

Defined in: [src/lookup.ts:17](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L17)

***

### id

> **id**: `string`

Defined in: [src/lookup.ts:11](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L11)

***

### issued\_at?

> `optional` **issued\_at?**: `string`

Defined in: [src/lookup.ts:16](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L16)

***

### issuer

> **issuer**: `string`

Defined in: [src/lookup.ts:14](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L14)

***

### organisation\_id?

> `optional` **organisation\_id?**: `string`

Defined in: [src/lookup.ts:15](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L15)

***

### proof\_status

> **proof\_status**: [`ProofStatus`](../type-aliases/ProofStatus.md)

Defined in: [src/lookup.ts:19](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L19)

***

### public\_attributes

> **public\_attributes**: `A`

Defined in: [src/lookup.ts:20](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L20)

***

### status

> **status**: `string`

Defined in: [src/lookup.ts:13](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L13)

***

### type

> **type**: `T`

Defined in: [src/lookup.ts:10](https://github.com/Intelliger-ai/oati/blob/48aa12c439121327e2a62aeff2e0eeaf4e838c11/sdk/typescript/src/lookup.ts#L10)
