[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiError

# Class: OatiError

Base error for failures produced by the OATI SDK.

## Extends

- `Error`

## Extended by

- [`OatiValidationError`](OatiValidationError.md)
- [`OatiLookupError`](OatiLookupError.md)

## Constructors

### Constructor

> **new OatiError**(`code`, `message`, `options?`): `OatiError`

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

***

### cause?

> `optional` **cause?**: `unknown`

#### Inherited from

`Error.cause`

***

### code

> `readonly` **code**: [`OatiErrorCode`](../type-aliases/OatiErrorCode.md)

***

### details?

> `readonly` `optional` **details?**: `unknown`

***

### message

> **message**: `string`

#### Inherited from

`Error.message`

***

### name

> **name**: `string`

#### Inherited from

`Error.name`

***

### rateLimit?

> `readonly` `optional` **rateLimit?**: `object`

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

***

### stack?

> `optional` **stack?**: `string`

#### Inherited from

`Error.stack`

***

### status?

> `readonly` `optional` **status?**: `number`
