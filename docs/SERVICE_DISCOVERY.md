# OATI service and profile discovery

OATI discovery removes the bilateral spreadsheet or email exchange previously needed to communicate service endpoints, Mandate audiences, and accepted profiles. It does not replace DNS, TLS, Passports, Mandates, or request verification.

An enterprise publishes two signed record types:

- a **Profile** pins a named/versioned interoperability profile to its canonical HTTPS JSON Schema and `sha256:` digest;
- a **Service** lists HTTPS endpoints, protocols, the exact audience each endpoint expects, supported actions, and accepted Profile IDs.

Both records name the owning `organisation_id` and approved `issuer`. The public resolver only includes active, unexpired, `proof_status=verified` records in organisation discovery.

```ts
import { OatiLookupClient } from "@intelliger/oati/lookup"

const oati = new OatiLookupClient()
const discovery = await oati.discoverOrganisation("oati:org:merchant-b")
const checkout = discovery.services
  .flatMap(({ document }) => document.endpoints)
  .find((endpoint) => endpoint.actions?.includes("commerce.purchase"))

// Bind the issued Mandate and signed request to checkout.audience, then use
// normal OATI request verification at checkout.url.
```

## Federated discovery

An organisation may host this document at `https://enterprise.example/.well-known/oati`:

```json
{
  "oati_version": "1.0",
  "organisations": ["oati:org:merchant-b"],
  "resolvers": ["https://trust.enterprise.example/oati/v1"],
  "expires_at": "2027-01-01T00:00:00Z"
}
```

Use `discoverFederated("enterprise.example", "oati:org:merchant-b")`. The SDK requires HTTPS, checks that the domain claims the requested organisation, rejects expired metadata, and then applies the same proof/status checks to resolver results. A caller must still establish that the domain is authorised for the organisation (for example from an organisation record or an existing business relationship); a well-known file alone is not an identity proof.

Resolvers implement `GET /discovery?organisation_id=oati:org:...`. Direct `GET /lookup?type=service&id=...` and `type=profile` remain available when an identifier is already known.

## Publication safety

Service records are public. Publish only externally reachable HTTPS endpoints and public audience strings. Do not publish bearer tokens, API keys, tenant-internal hostnames, customer-specific routes, pricing terms, or private policy. Rotate or suspend the record before changing an endpoint's trust semantics; clients must fail closed if no active verified service/profile combination satisfies the requested action.
