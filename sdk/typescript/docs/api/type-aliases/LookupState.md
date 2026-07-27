[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / LookupState

# Type Alias: LookupState\<T\>

> **LookupState**\<`T`\> = \{ `response`: [`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>; `state`: `"found"`; \} \| \{ `error`: [`OatiLookupError`](../classes/OatiLookupError.md); `state`: `"not_found"`; \} \| \{ `error`: [`OatiLookupError`](../classes/OatiLookupError.md); `state`: `"unavailable"`; \} \| \{ `record`: [`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]; `response`: [`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>; `state`: `"unavailable"`; \} \| \{ `record`: [`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]; `response`: [`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>; `state`: `"invalid_proof"`; \} \| \{ `record`: [`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]; `response`: [`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>; `state`: `"unknown"`; \}

Defined in: [src/lookup.ts:48](https://github.com/Intelliger-ai/oati/blob/52f9fa955eeb6d95556b249267d471d080b5825c/sdk/typescript/src/lookup.ts#L48)

## Type Parameters

### T

`T` *extends* [`OatiRecordType`](OatiRecordType.md)
