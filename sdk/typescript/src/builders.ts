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
  return { ...input, verification_methods: [...input.verification_methods], oati_version: "1.0" }
}

/** Build a core Agent Mandate. Domain-specific builders may add profiles. */
export function createMandate(input: WithoutVersion<AgentMandate>): AgentMandate {
  return {
    ...input,
    actions: [...input.actions],
    ...(input.resources === undefined ? {} : { resources: [...input.resources] }),
    ...(input.counterparties === undefined ? {} : { counterparties: [...input.counterparties] }),
    ...(input.destinations === undefined ? {} : { destinations: [...input.destinations] }),
    oati_version: "1.0",
  }
}

/** Build a transaction envelope to bind an action to an agent and Mandate. */
export function createTransactionEnvelope(input: WithoutVersion<TransactionEnvelope>): TransactionEnvelope {
  return { ...input, oati_version: "1.0" }
}

/** Build a deterministic authorisation decision record. */
export function createDecision(input: WithoutVersion<AuthorisationDecision>): AuthorisationDecision {
  return {
    ...input,
    ...(input.reason_codes === undefined ? {} : { reason_codes: [...input.reason_codes] }),
    ...(input.obligations === undefined ? {} : { obligations: input.obligations.map((item) => ({ ...item })) }),
    oati_version: "1.0",
  }
}

/** Build an Action Receipt describing the resulting transaction outcome. */
export function createReceipt(input: ReceiptInput): ActionReceipt {
  return { ...input, oati_version: "1.0" }
}
