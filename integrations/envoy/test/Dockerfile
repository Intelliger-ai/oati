FROM alpine:3.21 AS certgen
RUN apk add --no-cache openssl
COPY integrations/envoy/test/generate-certs.sh /generate-certs.sh
ENTRYPOINT ["/generate-certs.sh"]

FROM node:24-alpine AS build
WORKDIR /source/sdk/typescript
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY sdk/typescript/package.json sdk/typescript/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY schemas /source/schemas
COPY sdk/typescript /source/sdk/typescript
RUN pnpm build && pnpm prune --prod

FROM node:24-alpine AS support
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /source/sdk/typescript/dist /app/sdk/typescript/dist
COPY --from=build /source/sdk/typescript/node_modules /app/sdk/typescript/node_modules
COPY conformance/crypto/ed25519-private.jwk /app/fixtures/ed25519-private.jwk.json
COPY integrations/envoy/test/support.mjs /app/integration/support.mjs
USER node
ENTRYPOINT ["node", "/app/integration/support.mjs"]
