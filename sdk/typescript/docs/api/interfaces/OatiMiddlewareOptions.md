[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiMiddlewareOptions

# Interface: OatiMiddlewareOptions

## Properties

### allowedReceiptOutcome?

> `optional` **allowedReceiptOutcome?**: `"succeeded"` \| `"pending"`

Use `pending` when this middleware authorizes before a separate upstream executes.

***

### generateCorrelationId?

> `optional` **generateCorrelationId?**: () => `string`

#### Returns

`string`

***

### generateReceiptId?

> `optional` **generateReceiptId?**: (`transactionId`) => `string`

#### Parameters

##### transactionId

`string`

#### Returns

`string`

***

### maxBodyBytes?

> `optional` **maxBodyBytes?**: `number`

***

### maxHeaderBytes?

> `optional` **maxHeaderBytes?**: `number`

***

### now?

> `optional` **now?**: () => `Date`

#### Returns

`Date`

***

### policyDigest?

> `optional` **policyDigest?**: `string`

***

### receiptIssuer

> **receiptIssuer**: `string`

***

### requireRequestDigest?

> `optional` **requireRequestDigest?**: `boolean`

Require Envelope.request_digest to bind method, target, and body. Defaults to true.

***

### usageStore?

> `optional` **usageStore?**: [`OatiUsageStore`](OatiUsageStore.md)

## Methods

### emitReceipt()?

> `optional` **emitReceipt**(`receipt`, `context`): `void` \| `Promise`\<`void`\>

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

#### Parameters

##### request

`Request`

#### Returns

[`ExtractedOatiRequest`](ExtractedOatiRequest.md) \| `Promise`\<[`ExtractedOatiRequest`](ExtractedOatiRequest.md)\>

***

### signReceipt()

> **signReceipt**(`draft`, `context`): `Promise`\<[`ActionReceipt`](ActionReceipt.md)\>

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

Policy factory. Envelope policies must use a shared replay cache.

#### Parameters

##### kind

[`OatiDocumentKind`](../type-aliases/OatiDocumentKind.md)

##### request

`Request`

#### Returns

[`VerificationPolicy`](VerificationPolicy.md) \| `Promise`\<[`VerificationPolicy`](VerificationPolicy.md)\>
