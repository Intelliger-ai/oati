# OATI lookup API

Public, read-only resolver and verifier API. The current implementation is a dependency-free Go reference service with an in-memory sample record and IP-based rate limiting. Production adapters will replace the sample store with PostgreSQL and distributed limits with Redis/Valkey.

```bash
go run ./cmd/server
curl 'http://localhost:8080/oati/v1/lookup?type=agent&id=oati:agent:intelliger:commerce-demo'
```

Environment:

- `PORT` — defaults to `8080`
- `OATI_ALLOWED_ORIGIN` — defaults to `http://localhost:3000`
- `OATI_RATE_LIMIT_PER_MINUTE` — defaults to `60`
