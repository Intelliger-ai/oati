[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiLookupError

# Class: OatiLookupError

Base error for failures produced by the OATI SDK.

## Extends

- [`OatiError`](OatiError.md)

## Constructors

### Constructor

> **new OatiLookupError**(`code`, `message`, `options?`): `OatiLookupError`

#### Parameters

##### code

`"CRYPTO_UNAVAILABLE"` \| `"LOOKUP_BAD_REQUEST"` \| `"LOOKUP_NOT_FOUND"` \| `"LOOKUP_RATE_LIMITED"` \| `"LOOKUP_UNAVAILABLE"` \| `"LOOKUP_INVALID_RESPONSE"` \| `"LOOKUP_TIMEOUT"` \| `"LOOKUP_CANCELLED"` \| `"MIDDLEWARE_BAD_REQUEST"` \| `"MIDDLEWARE_UNAUTHENTICATED"` \| `"MIDDLEWARE_FORBIDDEN"` \| `"MIDDLEWARE_REPLAY"` \| `"MIDDLEWARE_USAGE_CONFLICT"` \| `"MIDDLEWARE_UNAVAILABLE"` \| `"ADAPTER_INVALID_INPUT"`

##### message

`string`

##### options?

[`OatiErrorOptions`](../interfaces/OatiErrorOptions.md) = `{}`

#### Returns

`OatiLookupError`

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
