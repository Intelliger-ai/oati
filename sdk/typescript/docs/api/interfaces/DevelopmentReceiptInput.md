[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / DevelopmentReceiptInput

# Interface: DevelopmentReceiptInput

## Properties

### audience

> **audience**: `string`

***

### decision

> **decision**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

***

### extensions?

> `optional` **extensions?**: `Record`\<`string`, `unknown`\>

***

### outcome

> **outcome**: `"succeeded"` \| `"failed"` \| `"denied"` \| `"pending"` \| `"unknown"`

***

### policyDigest?

> `optional` **policyDigest?**: `string`

***

### profile?

> `optional` **profile?**: `string`

***

### transaction

> **transaction**: [`TransactionEnvelope`](TransactionEnvelope.md)
