[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiValidationError

# Class: OatiValidationError

Defined in: src/errors.ts:35

Base error for failures produced by the OATI SDK.

## Extends

- [`OatiError`](OatiError.md)

## Constructors

### Constructor

> **new OatiValidationError**(`message`, `details`): `OatiValidationError`

Defined in: src/errors.ts:36

#### Parameters

##### message

`string`

##### details

`unknown`

#### Returns

`OatiValidationError`

#### Overrides

[`OatiError`](OatiError.md).[`constructor`](OatiError.md#constructor)

## Properties

### cause?

> `optional` **cause?**: `unknown`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

#### Inherited from

[`OatiError`](OatiError.md).[`cause`](OatiError.md#cause)

***

### code

> `readonly` **code**: [`OatiErrorCode`](../type-aliases/OatiErrorCode.md)

Defined in: src/errors.ts:20

#### Inherited from

[`OatiError`](OatiError.md).[`code`](OatiError.md#code)

***

### details?

> `readonly` `optional` **details?**: `unknown`

Defined in: src/errors.ts:21

#### Inherited from

[`OatiError`](OatiError.md).[`details`](OatiError.md#details)

***

### message

> **message**: `string`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1077

#### Inherited from

[`OatiError`](OatiError.md).[`message`](OatiError.md#message)

***

### name

> **name**: `string`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

[`OatiError`](OatiError.md).[`name`](OatiError.md#name)

***

### retryAfter?

> `readonly` `optional` **retryAfter?**: `number`

Defined in: src/errors.ts:23

#### Inherited from

[`OatiError`](OatiError.md).[`retryAfter`](OatiError.md#retryafter)

***

### stack?

> `optional` **stack?**: `string`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

[`OatiError`](OatiError.md).[`stack`](OatiError.md#stack)

***

### status?

> `readonly` `optional` **status?**: `number`

Defined in: src/errors.ts:22

#### Inherited from

[`OatiError`](OatiError.md).[`status`](OatiError.md#status)
