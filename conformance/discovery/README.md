# Service and Profile discovery vectors

These language-neutral fixtures exercise the public discovery contracts introduced in conformance suite 0.2. They cover Service, Profile, and `/.well-known/oati` schema validity plus resolver-side trust filtering and record/document binding.

The `discover` operation receives an organisation discovery response as `input`, a federation document as `auxiliary`, and deterministic `organisation_id` and `now` values in `options`. It must evaluate checks in this order and return the first applicable stable code:

1. `FEDERATION_ORGANISATION_MISMATCH` when the well-known document does not claim the requested organisation.
2. `FEDERATION_EXPIRED` when its expiry is not after `now`.
3. `DISCOVERY_ORGANISATION_MISMATCH` when the response or a record belongs to another organisation.
4. `DISCOVERY_UNTRUSTED_RECORD` unless every returned record has the expected type, `active` status, and `verified` proof status.
5. `DISCOVERY_DOCUMENT_INVALID` when `public_attributes.document` is not JSON.
6. `DISCOVERY_DOCUMENT_MISMATCH` when the embedded ID, organisation, issuer, or status differs from the public record.
7. `DISCOVERY_EXPIRED` when the record or embedded document expiry is not after `now`.
8. JSON Schema codes when an otherwise bound embedded Service/Profile document is structurally invalid.
9. `DISCOVERY_PROFILE_NOT_FOUND` when a Service accepts a Profile that is absent from the same discovery response.

Runners must not perform network access. The fixtures model the response obtained after fetching the well-known document and resolver result so every language observes identical deterministic input.
