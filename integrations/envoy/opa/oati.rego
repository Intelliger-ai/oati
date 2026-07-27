package envoy.authz

import rego.v1

default allow := false

allow if {
  input.oati.decision == "allow"
  input.oati.envelope.id == input.context.transaction_id
  input.oati.envelope.mandate_id == input.oati.mandate.id
  input.oati.envelope.agent_id == input.oati.mandate.subject
  input.oati.mandate.status == "active"
}

decision := {
  "allowed": allow,
  "headers": {
    "x-oati-decision": input.oati.decision,
    "x-oati-transaction-id": input.oati.envelope.id,
  },
}
