[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiLookupError

# Class: OatiLookupError

Defined in: [src/errors.ts:43](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/errors.ts#L43)

Base error for failures produced by the OATI SDK.

## Extends

- [`OatiError`](OatiError.md)

## Constructors

### Constructor

> **new OatiLookupError**(`code`, `message`, `options?`): `OatiLookupError`

Defined in: [src/errors.ts:44](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/errors.ts#L44)

#### Parameters

##### code

`"CRYPTO_UNAVAILABLE"` \| `"LOOKUP_BAD_REQUEST"` \| `"LOOKUP_NOT_FOUND"` \| `"LOOKUP_RATE_LIMITED"` \| `"LOOKUP_UNAVAILABLE"` \| `"LOOKUP_INVALID_RESPONSE"` \| `"LOOKUP_TIMEOUT"`

##### message

`string`

##### options?

[`OatiErrorOptions`](../interfaces/OatiErrorOptions.md) = `{}`

#### Returns

`OatiLookupError`

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

Defined in: [src/errors.ts:21](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/errors.ts#L21)

#### Inherited from

[`OatiError`](OatiError.md).[`code`](OatiError.md#code)

***

### details?

> `readonly` `optional` **details?**: `unknown`

Defined in: [src/errors.ts:22](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/errors.ts#L22)

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

Defined in: [src/errors.ts:24](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/errors.ts#L24)

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

Defined in: [src/errors.ts:23](https://github.com/Intelliger-ai/oati/blob/c5e5048f3717fa2834ac9d3541ad9c4be1c89965/sdk/typescript/src/errors.ts#L23)

#### Inherited from

[`OatiError`](OatiError.md).[`status`](OatiError.md#status)
