FROM node:22-alpine AS build
WORKDIR /source/sdk/typescript
RUN corepack enable
COPY sdk/typescript/package.json sdk/typescript/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY schemas /source/schemas
COPY sdk/typescript /source/sdk/typescript
RUN pnpm build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /source/sdk/typescript/dist /app/sdk/typescript/dist
COPY --from=build /source/sdk/typescript/node_modules /app/sdk/typescript/node_modules
COPY sandbox /app/sandbox
USER node
ENTRYPOINT ["node", "/app/sandbox/service.mjs"]
