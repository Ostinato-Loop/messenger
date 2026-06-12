FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ── Dependency layer (cache-friendly) ──────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/api-server/package.json  ./artifacts/api-server/
COPY lib/                               ./lib/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Build layer ────────────────────────────────────────────────────────────
FROM deps AS builder
COPY artifacts/api-server/  ./artifacts/api-server/
RUN pnpm --filter @workspace/api-server run build

# ── Runtime image (minimal) ────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/node_modules              ./node_modules

ENV NODE_ENV=production
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
