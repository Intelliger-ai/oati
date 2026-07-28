# OATI local developer sandbox

The sandbox is a public, development-only environment for completing signed OATI transactions without Intelliger infrastructure, accounts, or credentials.

## Start everything

Requirements: Docker Engine with Docker Compose v2.

```bash
./sandbox/oati-sandbox
```

That command builds and starts six isolated services, waits for their health checks, and runs an end-to-end smoke transaction. A successful result contains `"status": "passed"`, two `allow` decisions, and two verified signed Receipts.

| Service | Responsibility | Host endpoint |
|---|---|---|
| Test issuer | Creates two ephemeral organisations, agent-bound keys, Passports, Commerce/RWA Mandates, Envelopes, and signed Receipts | `http://localhost:9082` |
| Development control plane | Holds the sandbox lifecycle boundary and produces strict public projections | `http://localhost:9081/inventory` |
| Public lookup | Resolves issuer, key, credential, Receipt, and revocation records | `http://localhost:9080/oati/v1` |
| Buyer agent | Orchestrates and verifies both transactions | `POST http://localhost:9083/run` |
| Commerce seller | Verifies and evaluates a paid weather API request | `POST http://localhost:9084/purchase` |
| RWA simulator | Verifies and evaluates a controlled one-time mint | `POST http://localhost:9085/mint` |

Run the end-to-end check again or stop the environment:

```bash
./sandbox/oati-sandbox test
./sandbox/oati-sandbox down
```

All identities and Ed25519 keys are generated in memory on startup. Restarting the issuer replaces them. The development control plane is intentionally a small open-source façade for interoperability testing; it is not Intelliger's private production control plane and must not be deployed as one.
