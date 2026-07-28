# Integrate MCP and A2A

MCP and A2A use the same signed Envelope, Mandate, trust verification, deterministic evaluation, replay protection, and Receipt pipeline. Adapters only translate protocol metadata; they never grant authority.

## MCP server

Advertise OAuth and OATI in protected-resource metadata:

```ts
import {
  mcpAuthorizationHeaders, mcpProtectedResourceMetadata, mcpToolCallEnvelope,
  mcpResultWithReceipt,
} from "@intelliger/oati/adapters"

const metadata = mcpProtectedResourceMetadata(
  "https://mcp.example", ["https://identity.example"],
  "https://api.intelliger.ai/oati/v1", ["catalog.read"],
)
const envelope = await mcpToolCallEnvelope({
  agentId: passport.id, organisationId: passport.organisation_id, mandateId: mandate.id,
  serverId: "catalog", toolName: "search", arguments: { query: "bearings" },
})
const headers = mcpAuthorizationHeaders(envelope, mandate, accessToken)
const result = mcpResultWithReceipt({ content: [{ type: "text", text: "…" }] }, receipt)
```

The server verifies OAuth independently, then verifies and evaluates OATI before invoking the tool. Tool arguments are digest-bound in the Envelope. Return the signed Receipt in result metadata.

## A2A agent

Extend the Agent Card and attach authority metadata to a Message:

```ts
import { a2aAgentCard, a2aMessageEnvelope, a2aMessageWithAuthority } from "@intelliger/oati/adapters"

const card = a2aAgentCard(baseCard, authorizationUrl, tokenUrl, { "a2a.message.send": "Send messages" })
const envelope = await a2aMessageEnvelope({
  agentId: passport.id, organisationId: passport.organisation_id, mandateId: mandate.id,
  targetAgentId: "oati:agent:seller:support", messageId: "msg-42",
  contextId: "ctx-7", taskId: "task-9", parts: message.parts,
})
const authorisedMessage = a2aMessageWithAuthority(message, envelope, mandate)
```

Keep OAuth credentials in HTTP headers. Message/task/context identifiers and Parts digests prevent authority from being detached and reused for another conversation. Verify DPoP, OAuth/OATI claim binding, and replay state at the receiving edge.

See the [Protocol Adapter Profile](../../specification/PROTOCOL_ADAPTERS.md) for exact mappings and fail-closed rules.
