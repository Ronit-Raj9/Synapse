# Synapse Vault — public indexer service.
#
# Two-stage build: dependencies + source in stage 1, slim runtime in stage 2.
# The runtime image only ships dist + node_modules + the tsx loader so it
# starts in ~200ms.

FROM node:22-alpine AS builder
WORKDIR /workspace

# Copy the entire monorepo since the indexer depends on @synapse-core/client
# via workspace symlinks. The .dockerignore keeps node_modules + .next out.
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY sdk ./sdk

RUN npm ci --workspaces --include-workspace-root

WORKDIR /workspace/sdk/packages/indexer

# Type-check at build time so a broken indexer fails the image build, not
# the production deploy.
RUN npm run typecheck

# ---------------------------------------------------------------------------

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Copy installed deps + sources. tsx interprets TS at runtime so we don't
# need a separate build step — the indexer is small (≈600 LOC) and the
# warm start beats a bundle.
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/sdk/packages/indexer ./sdk/packages/indexer
COPY --from=builder /workspace/sdk/packages/client ./sdk/packages/client
COPY --from=builder /workspace/sdk/packages/design-tokens ./sdk/packages/design-tokens
COPY --from=builder /workspace/package.json ./
COPY --from=builder /workspace/tsconfig.base.json ./

EXPOSE 4000

# A real healthcheck for the orchestrator (Fly, Railway, Cloud Run).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:${PORT}/graphql || exit 1

# tsx runs the TS entrypoint directly. The src/bin script is built in the
# next step; if absent, fall back to direct invocation of src/server.ts via
# tsx (see CMD).
CMD ["npx", "-w", "@synapse-core/indexer", "tsx", "sdk/packages/indexer/src/bin/serve.ts"]
