[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / AuthorisationDecision

# Interface: AuthorisationDecision

Defined in: [src/index.ts:83](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L83)

## Properties

### decided\_at

> **decided\_at**: `string`

Defined in: [src/index.ts:91](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L91)

***

### decision

> **decision**: `"allow"` \| `"deny"` \| `"transform"` \| `"approval_required"`

Defined in: [src/index.ts:87](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L87)

***

### expires\_at?

> `optional` **expires\_at?**: `string`

Defined in: [src/index.ts:92](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L92)

***

### id

> **id**: `` `oati:decision:${string}` ``

Defined in: [src/index.ts:85](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L85)

***

### issuer

> **issuer**: `string`

Defined in: [src/index.ts:93](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L93)

***

### oati\_version

> **oati\_version**: `"1.0"`

Defined in: [src/index.ts:84](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L84)

***

### obligations?

> `optional` **obligations?**: `Record`\<`string`, `unknown`\>[]

Defined in: [src/index.ts:90](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L90)

***

### policy\_digest

> **policy\_digest**: `string`

Defined in: [src/index.ts:88](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L88)

***

### proof?

> `optional` **proof?**: [`Proof`](Proof.md)

Defined in: [src/index.ts:94](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L94)

***

### reason\_codes?

> `optional` **reason\_codes?**: `string`[]

Defined in: [src/index.ts:89](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L89)

***

### transaction\_id

> **transaction\_id**: `` `oati:tx:${string}` ``

Defined in: [src/index.ts:86](https://github.com/Intelliger-ai/oati/blob/8572d85d40769921684aa768caf0fcf2b53cc4b2/sdk/typescript/src/index.ts#L86)
