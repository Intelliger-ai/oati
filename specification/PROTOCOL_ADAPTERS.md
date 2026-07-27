# OATI Protocol Adapter Profile 0.1

Status: developer preview

The adapters preserve the OATI security invariants while translating protocol-native metadata into Transaction Envelopes and policy-engine requests. An adapter does not itself grant authority: schema validation, cryptographic verification, replay prevention, deterministic evaluation, and Receipt generation remain mandatory.

## MCP

HTTP MCP servers use RFC 9728 protected-resource metadata and OAuth authorization-server discovery. OATI metadata identifies this extension, the public lookup resolver, and the `OATI-Envelope` and `OATI-Mandate` carriers. A `tools/call` maps to action `mcp.tools.call`, resource `mcp:server:<server>:tool:<tool>`, and a SHA-256 digest of canonical tool arguments. Results may carry a signed Receipt under the OATI MCP extension URI.

## A2A

Agent Cards advertise the OATI extension and an OAuth security scheme. A sent Message maps to action `a2a.message.send`; its resource is the target agent identifier. Message, task, context, and Parts digests remain bound in the Envelope extension. Credentials stay in HTTP headers as required by A2A; the message metadata extension carries OATI objects where the selected binding permits metadata.

## OAuth and DPoP

OAuth access tokens remain independently validated for issuer, audience, expiry, and scopes. The OATI token extension binds agent, organisation, Mandate, and transaction identifiers. RFC 9449 DPoP validation checks ES256 or EdDSA signatures, public JWK, `typ`, `jti`, `htm`, `htu`, `iat`, `ath`, token `cnf.jkt`, and replay. OATI verification fails closed if either OAuth, DPoP, or OATI binding fails.

## AuthZEN

The Envelope agent, action, and resource map to AuthZEN subject/action/resource entities. Transaction, Mandate, purpose, destination, and counterparty map to context. A boolean AuthZEN response maps to an OATI allow/deny Decision; obligations, reason codes, and policy digest may be read from response context. AuthZEN output cannot override an OATI deterministic denial.

## Cedar and OPA

Cedar uses PARC: `OatiAgent`, `OatiAction`, and `OatiResource` entity UIDs plus normalized OATI context. OPA receives the same normalized fields and full public Envelope/Mandate under `input.oati`. Only the exact boolean `true` is treated as an OPA allow response. Policy-engine errors, missing results, and malformed responses deny.

## Envoy

Envoy v3 `ext_authz` forwards a strict allowlist of OAuth/DPoP and OATI headers to the OATI authorizer. `failure_mode_allow` is false and authorizer transport errors return 503. The authorizer returns only reviewed `x-oati-*` decision, transaction, reason, and Receipt headers. See [`../integrations/envoy/`](../integrations/envoy/).
