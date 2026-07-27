[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiLookupError

# Class: OatiLookupError

Defined in: [src/errors.ts:57](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/errors.ts#L57)

Base error for failures produced by the OATI SDK.

## Extends

- [`OatiError`](OatiError.md)

## Constructors

### Constructor

> **new OatiLookupError**(`code`, `message`, `options?`): `OatiLookupError`

Defined in: [src/errors.ts:58](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/errors.ts#L58)

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

Defined in: [src/errors.ts:36](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/errors.ts#L36)

#### Inherited from

[`OatiError`](OatiError.md).[`cache`](OatiError.md#cache)

***

### cause?

> `optional` **cause?**: `unknown`

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

#### Inherited from

[`OatiError`](OatiError.md).[`cause`](OatiError.md#cause)

***

### code

> `readonly` **code**: [`OatiErrorCode`](../type-aliases/OatiErrorCode.md)

Defined in: [src/errors.ts:31](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/errors.ts#L31)

#### Inherited from

[`OatiError`](OatiError.md).[`code`](OatiError.md#code)

***

### details?

> `readonly` `optional` **details?**: `unknown`

Defined in: [src/errors.ts:32](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/errors.ts#L32)

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

### rateLimit?

> `readonly` `optional` **rateLimit?**: `object`

Defined in: [src/errors.ts:35](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/errors.ts#L35)

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

Defined in: [src/errors.ts:34](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/errors.ts#L34)

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

Defined in: [src/errors.ts:33](https://github.com/Intelliger-ai/oati/blob/fb53f49753ff3953e73a68b65793610a73015837/sdk/typescript/src/errors.ts#L33)

#### Inherited from

[`OatiError`](OatiError.md).[`status`](OatiError.md#status)
