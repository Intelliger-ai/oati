[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiMiddlewareOptions

# Interface: OatiMiddlewareOptions

Defined in: src/middleware.ts:43

## Properties

### generateCorrelationId?

> `optional` **generateCorrelationId?**: () => `string`

Defined in: src/middleware.ts:54

#### Returns

`string`

***

### generateReceiptId?

> `optional` **generateReceiptId?**: (`transactionId`) => `string`

Defined in: src/middleware.ts:55

#### Parameters

##### transactionId

`string`

#### Returns

`string`

***

### maxBodyBytes?

> `optional` **maxBodyBytes?**: `number`

Defined in: src/middleware.ts:60

***

### maxHeaderBytes?

> `optional` **maxHeaderBytes?**: `number`

Defined in: src/middleware.ts:57

***

### now?

> `optional` **now?**: () => `Date`

Defined in: src/middleware.ts:53

#### Returns

`Date`

***

### policyDigest?

> `optional` **policyDigest?**: `string`

Defined in: src/middleware.ts:56

***

### receiptIssuer

> **receiptIssuer**: `string`

Defined in: src/middleware.ts:46

***

### requireRequestDigest?

> `optional` **requireRequestDigest?**: `boolean`

Defined in: src/middleware.ts:59

Require Envelope.request_digest to bind method, target, and body. Defaults to true.

***

### usageStore?

> `optional` **usageStore?**: [`OatiUsageStore`](OatiUsageStore.md)

Defined in: src/middleware.ts:49

## Methods

### emitReceipt()?

> `optional` **emitReceipt**(`receipt`, `context`): `void` \| `Promise`\<`void`\>

Defined in: src/middleware.ts:52

#### Parameters

##### receipt

[`ActionReceipt`](ActionReceipt.md)

##### context

[`OatiMiddlewareContext`](OatiMiddlewareContext.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### evaluationExtensions()?

> `optional` **evaluationExtensions**(`request`, `extracted`): [`OatiEvaluationExtensions`](OatiEvaluationExtensions.md) \| `Promise`\<[`OatiEvaluationExtensions`](OatiEvaluationExtensions.md)\>

Defined in: src/middleware.ts:50

#### Parameters

##### request

`Request`

##### extracted

[`ExtractedOatiRequest`](ExtractedOatiRequest.md)

#### Returns

[`OatiEvaluationExtensions`](OatiEvaluationExtensions.md) \| `Promise`\<[`OatiEvaluationExtensions`](OatiEvaluationExtensions.md)\>

***

### extract()?

> `optional` **extract**(`request`): [`ExtractedOatiRequest`](ExtractedOatiRequest.md) \| `Promise`\<[`ExtractedOatiRequest`](ExtractedOatiRequest.md)\>

Defined in: src/middleware.ts:51

#### Parameters

##### request

`Request`

#### Returns

[`ExtractedOatiRequest`](ExtractedOatiRequest.md) \| `Promise`\<[`ExtractedOatiRequest`](ExtractedOatiRequest.md)\>

***

### signReceipt()

> **signReceipt**(`draft`, `context`): `Promise`\<[`ActionReceipt`](ActionReceipt.md)\>

Defined in: src/middleware.ts:48

Sign and return a schema-valid receipt. No unsigned fallback is permitted.

#### Parameters

##### draft

[`ReceiptDraft`](../type-aliases/ReceiptDraft.md)

##### context

[`OatiMiddlewareContext`](OatiMiddlewareContext.md)

#### Returns

`Promise`\<[`ActionReceipt`](ActionReceipt.md)\>

***

### verificationPolicy()

> **verificationPolicy**(`kind`, `request`): [`VerificationPolicy`](VerificationPolicy.md) \| `Promise`\<[`VerificationPolicy`](VerificationPolicy.md)\>

Defined in: src/middleware.ts:45

Policy factory. Envelope policies must use a shared replay cache.

#### Parameters

##### kind

[`OatiDocumentKind`](../type-aliases/OatiDocumentKind.md)

##### request

`Request`

#### Returns

[`VerificationPolicy`](VerificationPolicy.md) \| `Promise`\<[`VerificationPolicy`](VerificationPolicy.md)\>
