# Synapse Vault runtime — production container image.
#
# Builds the autonomous tick loop (sdk/packages/vault/src/runtime/bin/run.ts)
# into a slim Node 22 image that can run as:
#   - A long-lived process (default): VaultRuntime.start() loops every
#     SYNAPSE_TICK_INTERVAL_MS milliseconds forever.
#   - A one-shot batch (CMD with --once): single tick + exit, intended for
#     ECS Fargate scheduled tasks or AWS Lambda.
#
# The runtime expects these env vars at runtime (set via ECS task definition
# secrets):
#   SYNAPSE_PACKAGE_ID            (public)
#   SYNAPSE_AGENT_ID              (public)
#   SYNAPSE_SESSION_KEY           (secret, from Secrets Manager)
#   MEMWAL_DELEGATE_KEY           (secret, optional)
#   SYNAPSE_FULLNODE_URL          (optional, defaults to testnet)
#   SYNAPSE_WALRUS_NETWORK        (optional, testnet|mainnet)
#   SYNAPSE_TICK_INTERVAL_MS      (optional, default 600000)

FROM node:22-alpine AS builder

WORKDIR /repo

# Workspace deps live across multiple package.json files. Copy the
# manifest skeleton first so npm install caches even when only source
# files change.
COPY package.json package-lock.json tsconfig.base.json ./
COPY sdk/packages/client/package.json ./sdk/packages/client/
COPY sdk/packages/memwal-bridge/package.json ./sdk/packages/memwal-bridge/
COPY sdk/packages/vault/package.json ./sdk/packages/vault/
COPY sdk/packages/design-tokens/package.json ./sdk/packages/design-tokens/
COPY sdk/packages/indexer/package.json ./sdk/packages/indexer/
COPY sdk/packages/adapters/langgraph/package.json ./sdk/packages/adapters/langgraph/
COPY sdk/packages/adapters/claude-sdk/package.json ./sdk/packages/adapters/claude-sdk/
COPY sdk/packages/adapters/eliza/package.json ./sdk/packages/adapters/eliza/

RUN npm ci --ignore-scripts

# Now bring in source.
COPY sdk/packages/client ./sdk/packages/client
COPY sdk/packages/memwal-bridge ./sdk/packages/memwal-bridge
COPY sdk/packages/vault ./sdk/packages/vault

# ---------- Runtime image ----------
FROM node:22-alpine AS runtime
WORKDIR /app

# Bring node_modules + source from the builder.
COPY --from=builder /repo/node_modules /app/node_modules
COPY --from=builder /repo/sdk /app/sdk
COPY --from=builder /repo/package.json /app/package.json
COPY --from=builder /repo/tsconfig.base.json /app/tsconfig.base.json

ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps

# Default: long-lived continuous loop. Override with `--once` in the ECS
# task command field to run a single tick (used by the EventBridge cron
# in infrastructure/aws).
ENTRYPOINT ["npx", "tsx", "sdk/packages/vault/src/runtime/bin/run.ts"]
