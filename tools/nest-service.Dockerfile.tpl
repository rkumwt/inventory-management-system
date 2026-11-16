# syntax=docker/dockerfile:1
#
# __APP__: multi-stage build, non-root runtime.
# The build context is the repository root:
#
#   docker build -f apps/__APP__/Dockerfile -t ims/__APP__ .
#
# Generated from tools/nest-service.Dockerfile.tpl by tools/scaffold-app.sh;
# every NestJS service uses the same recipe.

ARG NODE_VERSION=22.12.0

# ---- base: pnpm and the dependency manifests -------------------------------
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /repo
RUN npm install --global pnpm@9.15.9
# Only the manifests: this layer, and the installs below, are rebuilt only
# when dependencies change, not on every source edit.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# ---- build: all dependencies, compile the service --------------------------
FROM base AS build
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.base.json ./
COPY tools/vite tools/vite
COPY libs libs
COPY apps/__APP__ apps/__APP__
RUN pnpm exec vite build --config apps/__APP__/vite.config.mts

# ---- prod-deps: runtime dependencies only (no compilers, no test tools) ----
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# ---- runtime ----------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production \
    PORT=__PORT__
WORKDIR /app
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/dist/apps/__APP__ ./

# The official image ships an unprivileged "node" user; never run as root.
USER node
EXPOSE __PORT__

# Same endpoint the orchestrator's health check uses (ECS, Kubernetes).
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# All configuration comes from environment variables; there is no .env file
# in the image. SIGTERM reaches Node directly (exec form), so the graceful
# shutdown hooks run.
CMD ["node", "--enable-source-maps", "main.js"]
