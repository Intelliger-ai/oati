import type {
  ActionReceipt,
  AgentMandate,
  AgentPassport,
  AuthorisationDecision,
  TransactionEnvelope,
} from "./index.js"

export type WithoutVersion<T> = Omit<T, "oati_version">

export type ReceiptInput = Pick<ActionReceipt,
  "id" | "transaction_id" | "agent_id" | "organisation_id" | "mandate_id" |
  "decision" | "outcome" | "occurred_at" | "issuer" | "proof"
> & Partial<Pick<ActionReceipt,
  "profile" | "extensions" | "policy_digest" | "request_digest" | "response_digest" | "commercial_profile"
>> & Record<string, unknown>

/** Build a schema-compatible Agent Passport without mutating the input. */
export function createPassport(input: WithoutVersion<AgentPassport>): AgentPassport {
  return { ...structuredClone(input), oati_version: "1.0" }
}

/** Build a core Agent Mandate. Domain-specific builders may add profiles. */
export function createMandate(input: WithoutVersion<AgentMandate>): AgentMandate {
  return { ...structuredClone(input), oati_version: "1.0" }
}

/** Build a transaction envelope to bind an action to an agent and Mandate. */
export function createTransactionEnvelope(input: WithoutVersion<TransactionEnvelope>): TransactionEnvelope {
  return { ...structuredClone(input), oati_version: "1.0" }
}

/** Build a deterministic authorisation decision record. */
export function createDecision(input: WithoutVersion<AuthorisationDecision>): AuthorisationDecision {
  return { ...structuredClone(input), oati_version: "1.0" }
}

/** Build an Action Receipt describing the resulting transaction outcome. */
export function createReceipt(input: ReceiptInput): ActionReceipt {
  return { ...structuredClone(input), oati_version: "1.0" }
}
