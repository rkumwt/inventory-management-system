# syntax=docker/dockerfile:1
#
# web (Next.js): multi-stage build, non-root runtime.
# The build context is the repository root:
#
#   docker build -f apps/web/Dockerfile -t ims/web \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/v1 .
#
# NEXT_PUBLIC_API_URL is compiled into the browser bundle, so it is a build
# argument: one image per environment's API address.

ARG NODE_VERSION=22.12.0

# ---- build ------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /repo
RUN npm install --global pnpm@9.15.9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY apps/web apps/web
# `output: 'standalone'` traces exactly the files the server needs, so the
# runtime image carries no package manager and no full node_modules.
# Called by path: `pnpm exec` would run from the package root (/repo), not here.
WORKDIR /repo/apps/web
RUN ../../node_modules/.bin/next build

# ---- runtime ----------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/login').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/web/server.js"]
