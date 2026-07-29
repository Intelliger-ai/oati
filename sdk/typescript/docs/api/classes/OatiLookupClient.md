[**@intelliger/oati**](../README.md)

***

[@intelliger/oati](../README.md) / OatiLookupClient

# Class: OatiLookupClient

Production client for OATI-compatible public resolvers.

## Constructors

### Constructor

> **new OatiLookupClient**(`options?`): `OatiLookupClient`

#### Parameters

##### options?

[`LookupClientOptions`](../interfaces/LookupClientOptions.md) = `{}`

#### Returns

`OatiLookupClient`

## Properties

### baseUrl

> `readonly` **baseUrl**: `string`

First configured resolver, retained for source compatibility.

***

### resolverUrls

> `readonly` **resolverUrls**: readonly `string`[]

## Methods

### clearCache()

> **clearCache**(`type?`, `id?`): `void`

#### Parameters

##### type?

`"issuer"` \| `"profile"` \| `"mandate"` \| `"organisation"` \| `"agent"` \| `"passport"` \| `"receipt"` \| `"key"` \| `"revocation"` \| `"service"`

##### id?

`string`

#### Returns

`void`

***

### clearRevocationTargetCache()

> **clearRevocationTargetCache**(`target?`): `void`

#### Parameters

##### target?

`string`

#### Returns

`void`

***

### discoverFederated()

> **discoverFederated**(`domain`, `organisationId`, `options?`): `Promise`\<[`OrganisationDiscovery`](../interfaces/OrganisationDiscovery.md)\>

Resolve a domain's `/.well-known/oati`, then use its advertised resolver.

#### Parameters

##### domain

`string`

##### organisationId

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`OrganisationDiscovery`](../interfaces/OrganisationDiscovery.md)\>

***

### discoverOrganisation()

> **discoverOrganisation**(`organisationId`, `options?`): `Promise`\<[`OrganisationDiscovery`](../interfaces/OrganisationDiscovery.md)\>

Discover all active, verified services and profiles published by an organisation.

#### Parameters

##### organisationId

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`OrganisationDiscovery`](../interfaces/OrganisationDiscovery.md)\>

***

### lookup()

> **lookup**\<`T`\>(`type`, `id`, `options?`): `Promise`\<[`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]\>

#### Type Parameters

##### T

`T` *extends* `"issuer"` \| `"profile"` \| `"mandate"` \| `"organisation"` \| `"agent"` \| `"passport"` \| `"receipt"` \| `"key"` \| `"revocation"` \| `"service"`

#### Parameters

##### type

`T`

##### id

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`OatiRecordByType`](../interfaces/OatiRecordByType.md)\[`T`\]\>

***

### lookupDetailed()

> **lookupDetailed**\<`T`\>(`type`, `id`, `options?`): `Promise`\<[`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>\>

Lookup with resolver, cache, and rate-limit metadata.

#### Type Parameters

##### T

`T` *extends* `"issuer"` \| `"profile"` \| `"mandate"` \| `"organisation"` \| `"agent"` \| `"passport"` \| `"receipt"` \| `"key"` \| `"revocation"` \| `"service"`

#### Parameters

##### type

`T`

##### id

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`LookupResponse`](../interfaces/LookupResponse.md)\<`T`\>\>

***

### lookupRevocationByTarget()

> **lookupRevocationByTarget**(`target`, `options?`): `Promise`\<[`RevocationRecord`](../interfaces/RevocationRecord.md)\>

Resolve the authoritative published revocation record for a target identifier.

#### Parameters

##### target

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`RevocationRecord`](../interfaces/RevocationRecord.md)\>

***

### lookupRevocationByTargetDetailed()

> **lookupRevocationByTargetDetailed**(`target`, `options?`): `Promise`\<[`LookupResponse`](../interfaces/LookupResponse.md)\<`"revocation"`\>\>

Target-based revocation lookup with resolver, cache, and rate-limit metadata.

#### Parameters

##### target

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`LookupResponse`](../interfaces/LookupResponse.md)\<`"revocation"`\>\>

***

### lookupState()

> **lookupState**\<`T`\>(`type`, `id`, `options?`): `Promise`\<[`LookupState`](../type-aliases/LookupState.md)\<`T`\>\>

Resolve expected absence and proof-state failures without exception-based control flow.

#### Type Parameters

##### T

`T` *extends* `"issuer"` \| `"profile"` \| `"mandate"` \| `"organisation"` \| `"agent"` \| `"passport"` \| `"receipt"` \| `"key"` \| `"revocation"` \| `"service"`

#### Parameters

##### type

`T`

##### id

`string`

##### options?

[`LookupOptions`](../interfaces/LookupOptions.md) = `{}`

#### Returns

`Promise`\<[`LookupState`](../type-aliases/LookupState.md)\<`T`\>\>
