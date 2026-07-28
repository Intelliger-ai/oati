[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiValidationError

# Class: OatiValidationError

Base error for failures produced by the OATI SDK.

## Extends

- [`OatiError`](OatiError.md)

## Constructors

### Constructor

> **new OatiValidationError**(`message`, `details`): `OatiValidationError`

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

### cache?

> `readonly` `optional` **cache?**: `"hit"` \| `"miss"` \| `"revalidated"`

#### Inherited from

[`OatiError`](OatiError.md).[`cache`](OatiError.md#cache)

***

### cause?

> `optional` **cause?**: `unknown`

#### Inherited from

[`OatiError`](OatiError.md).[`cause`](OatiError.md#cause)

***

### code

> `readonly` **code**: [`OatiErrorCode`](../type-aliases/OatiErrorCode.md)

#### Inherited from

[`OatiError`](OatiError.md).[`code`](OatiError.md#code)

***

### details?

> `readonly` `optional` **details?**: `unknown`

#### Inherited from

[`OatiError`](OatiError.md).[`details`](OatiError.md#details)

***

### message

> **message**: `string`

#### Inherited from

[`OatiError`](OatiError.md).[`message`](OatiError.md#message)

***

### name

> **name**: `string`

#### Inherited from

[`OatiError`](OatiError.md).[`name`](OatiError.md#name)

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

#### Inherited from

[`OatiError`](OatiError.md).[`rateLimit`](OatiError.md#ratelimit)

***

### retryAfter?

> `readonly` `optional` **retryAfter?**: `number`

#### Inherited from

[`OatiError`](OatiError.md).[`retryAfter`](OatiError.md#retryafter)

***

### stack?

> `optional` **stack?**: `string`

#### Inherited from

[`OatiError`](OatiError.md).[`stack`](OatiError.md#stack)

***

### status?

> `readonly` `optional` **status?**: `number`

#### Inherited from

[`OatiError`](OatiError.md).[`status`](OatiError.md#status)
