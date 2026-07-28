# Security policy

OATI is a developer preview. Its cryptographic and protocol profiles have not yet completed independent specialist review and MUST NOT be represented as independently audited or production-secure.

Please report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/Intelliger-ai/oati/security/advisories/new). Do not open a public issue for an undisclosed vulnerability or include secrets, private keys, production credentials, personal data, or exploitable details in public channels.

Reports should include the affected commit and component, impact, reproduction steps, relevant test vectors, and any suggested remediation. Intelliger will coordinate acknowledgement, remediation, retesting, and disclosure with the reporter. No response-time or bounty commitment is implied until a separate published policy states one.

The current independent-review state and the evidence required to change it are defined in [`security/independent-review/status.json`](security/independent-review/status.json) and [`security/independent-review/README.md`](security/independent-review/README.md). Release automation fails closed through the [independent-review release workflow](.github/workflows/release-security-gate.yml); the current pre-review status is intentionally not release-eligible.
