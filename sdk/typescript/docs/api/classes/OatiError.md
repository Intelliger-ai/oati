[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiError

# Class: OatiError

Defined in: src/errors.ts:19

Base error for failures produced by the OATI SDK.

## Extends

- `Error`

## Extended by

- [`OatiValidationError`](OatiValidationError.md)
- [`OatiLookupError`](OatiLookupError.md)

## Constructors

### Constructor

> **new OatiError**(`code`, `message`, `options?`): `OatiError`

Defined in: src/errors.ts:25

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

### cause?

> `optional` **cause?**: `unknown`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

#### Inherited from

`Error.cause`

***

### code

> `readonly` **code**: [`OatiErrorCode`](../type-aliases/OatiErrorCode.md)

Defined in: src/errors.ts:20

***

### details?

> `readonly` `optional` **details?**: `unknown`

Defined in: src/errors.ts:21

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

### retryAfter?

> `readonly` `optional` **retryAfter?**: `number`

Defined in: src/errors.ts:23

***

### stack?

> `optional` **stack?**: `string`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

`Error.stack`

***

### status?

> `readonly` `optional` **status?**: `number`

Defined in: src/errors.ts:22
