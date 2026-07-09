FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Install dependencies (all, including dev)
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# Build api
FROM deps AS build-api
COPY tooling ./tooling
COPY apps/api ./apps/api
RUN pnpm --filter @app/api exec prisma generate
RUN pnpm --filter @app/api build

# Production image
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --prod

COPY --from=build-api /app/apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm --filter @app/api exec prisma generate

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main.js"]
