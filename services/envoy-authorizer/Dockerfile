FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build
WORKDIR /src/sdk/typescript
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY sdk/typescript/package.json sdk/typescript/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY sdk/typescript/ ./
COPY schemas/ /src/schemas/
RUN pnpm build
RUN pnpm prune --prod

FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /src/sdk/typescript/package.json /app/sdk/typescript/package.json
COPY --from=build --chown=node:node /src/sdk/typescript/dist /app/sdk/typescript/dist
COPY --from=build --chown=node:node /src/sdk/typescript/node_modules /app/sdk/typescript/node_modules
COPY --chown=node:node services/envoy-authorizer/server.mjs /app/services/envoy-authorizer/server.mjs
USER node
EXPOSE 9001
CMD ["node", "/app/services/envoy-authorizer/server.mjs"]
