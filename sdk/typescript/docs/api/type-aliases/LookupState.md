[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / LookupState

# Type Alias: LookupState\<T\>

> **LookupState**\<`T`\> = \{ `response`: [`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>; `state`: `"found"`; \} \| \{ `error`: [`OatiLookupError`](../classes/OatiLookupError.md); `state`: `"not_found"`; \} \| \{ `error`: [`OatiLookupError`](../classes/OatiLookupError.md); `state`: `"unavailable"`; \} \| \{ `record`: [`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]; `response`: [`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>; `state`: `"unavailable"`; \} \| \{ `record`: [`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]; `response`: [`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>; `state`: `"invalid_proof"`; \} \| \{ `record`: [`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]; `response`: [`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>; `state`: `"unknown"`; \}

## Type Parameters

### T

`T` *extends* [`OatiRecordType`](OatiRecordType.md)
