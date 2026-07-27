[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiError

# Class: OatiError

Defined in: [src/errors.ts:30](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/errors.ts#L30)

Base error for failures produced by the OATI SDK.

## Extends

- `Error`

## Extended by

- [`OatiValidationError`](OatiValidationError.md)
- [`OatiLookupError`](OatiLookupError.md)

## Constructors

### Constructor

> **new OatiError**(`code`, `message`, `options?`): `OatiError`

Defined in: [src/errors.ts:38](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/errors.ts#L38)

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

Defined in: [src/errors.ts:36](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/errors.ts#L36)

***

### cause?

> `optional` **cause?**: `unknown`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

#### Inherited from

`Error.cause`

***

### code

> `readonly` **code**: [`OatiErrorCode`](../type-aliases/OatiErrorCode.md)

Defined in: [src/errors.ts:31](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/errors.ts#L31)

***

### details?

> `readonly` `optional` **details?**: `unknown`

Defined in: [src/errors.ts:32](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/errors.ts#L32)

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

Defined in: [src/errors.ts:35](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/errors.ts#L35)

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

Defined in: [src/errors.ts:34](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/errors.ts#L34)

***

### stack?

> `optional` **stack?**: `string`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

`Error.stack`

***

### status?

> `readonly` `optional` **status?**: `number`

Defined in: [src/errors.ts:33](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/errors.ts#L33)
