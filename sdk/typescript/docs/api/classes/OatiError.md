[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiError

# Class: OatiError

Defined in: [src/errors.ts:23](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/errors.ts#L23)

Base error for failures produced by the OATI SDK.

## Extends

- `Error`

## Extended by

- [`OatiValidationError`](OatiValidationError.md)
- [`OatiLookupError`](OatiLookupError.md)

## Constructors

### Constructor

> **new OatiError**(`code`, `message`, `options?`): `OatiError`

Defined in: [src/errors.ts:31](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/errors.ts#L31)

#### Parameters

##### code

[`OatiErrorCode`](../type-aliases/OatiErrorCode.md)

##### message

`string`

##### options?

[`OatiErrorOptions`](../interfaces/OatiErrorOptions.md) = `{}`

#### Returns

`OatiError`

#### Overrides

`Error.constructor`

## Properties

### cache?

> `readonly` `optional` **cache?**: `"hit"` \| `"miss"` \| `"revalidated"`

Defined in: [src/errors.ts:29](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/errors.ts#L29)

***

### cause?

> `optional` **cause?**: `unknown`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

#### Inherited from

`Error.cause`

***

### code

> `readonly` **code**: [`OatiErrorCode`](../type-aliases/OatiErrorCode.md)

Defined in: [src/errors.ts:24](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/errors.ts#L24)

***

### details?

> `readonly` `optional` **details?**: `unknown`

Defined in: [src/errors.ts:25](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/errors.ts#L25)

***

### message

> **message**: `string`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1077

#### Inherited from

`Error.message`

***

### name

> **name**: `string`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

`Error.name`

***

### rateLimit?

> `readonly` `optional` **rateLimit?**: `object`

Defined in: [src/errors.ts:28](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/errors.ts#L28)

#### limit?

> `optional` **limit?**: `number`

#### remaining?

> `optional` **remaining?**: `number`

#### resetAt?

> `optional` **resetAt?**: `string`

#### retryAfter?

> `optional` **retryAfter?**: `number`

***

### retryAfter?

> `readonly` `optional` **retryAfter?**: `number`

Defined in: [src/errors.ts:27](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/errors.ts#L27)

***

### stack?

> `optional` **stack?**: `string`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

`Error.stack`

***

### status?

> `readonly` `optional` **status?**: `number`

Defined in: [src/errors.ts:26](https://github.com/Intelliger-ai/oati/blob/5c4cc47720dc4d46e2801d67bc02d86719c82831/sdk/typescript/src/errors.ts#L26)
