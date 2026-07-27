# OATI HTTP Middleware Profile 0.1

Status: developer preview

This profile defines the interoperable HTTP carrier used by the OATI reference middleware. It does not replace the core object schemas or cryptographic profile.

## Request headers

| Header | Requirement | Value |
| --- | --- | --- |
| `OATI-Envelope` | required | Base64url, without padding, of the canonical JSON Transaction Envelope. |
| `OATI-Mandate` | required | Base64url, without padding, of the canonical JSON Mandate. |
| `OATI-Parent-Mandate` | required for delegation | Base64url, without padding, of the canonical JSON parent Mandate. |
| `OATI-Transaction-ID` | optional assertion | Must equal `Envelope.id` when present. |
| `OATI-Correlation-ID` | optional | Caller value matching `[A-Za-z0-9._:-]{1,128}`; otherwise middleware generates one. |

Deployments with Mandates too large for their proxy header limits MUST provide an equivalent authenticated extraction mechanism. They MUST preserve the same validation and fail-closed behavior.

## HTTP request binding

The Envelope `request_digest` MUST equal the lowercase hexadecimal SHA-256 digest of UTF-8 canonical JSON with this logical shape:

```json
{
  "body_sha256": "sha256:<lowercase hex SHA-256 of raw body bytes>",
  "method": "<uppercase HTTP method>",
  "target": "<URL pathname followed by the query string>"
}
```

The final value is prefixed with `sha256:`. Scheme, authority, fragments, and HTTP headers are excluded. Query ordering and percent encoding are preserved exactly as received through the Web URL representation. Middleware MUST impose a body-size limit and fail closed when it cannot compute the digest.

## Processing order

1. Decode headers with configured size limits and validate published schemas.
2. Reject a conflicting transaction ID.
3. Verify Mandate and optional parent signatures, trust chains, lifecycle, and revocation. Reusable Mandates are not replay-consumed.
4. Verify the Envelope using a shared atomic replay cache. Envelope proofs are replay-consumed.
5. Verify the HTTP request binding digest.
6. Load usage, deterministically evaluate authority, and atomically compare-and-set the next usage snapshot.
7. Invoke the protected handler only after an allow decision and successful usage commit.
8. Generate, sign, and emit an Action Receipt for authenticated success, denial, usage conflict, or handler failure.

Any exception, unavailable trust dependency, absent required usage store, malformed object, proof failure, replay, digest mismatch, or usage race MUST fail closed.

## Response headers

The middleware returns `OATI-Transaction-ID`, `OATI-Correlation-ID`, and `OATI-Receipt-ID` whenever an authenticated request reaches receipt generation. A signed receipt MAY also be returned as base64url canonical JSON in `OATI-Receipt` when it fits configured transport limits. Implementations SHOULD persist receipts through an evidence sink rather than relying only on response headers.

Error bodies use `application/problem+json` and stable `MIDDLEWARE_*` codes. Authentication and replay failures use HTTP 401, authority denial uses 403, usage compare-and-set conflicts use 409, and unavailable security dependencies use 503.
