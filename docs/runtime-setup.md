# Synapse Vault Runtime Setup

The Vault runtime is a Node.js worker that evaluates the configured strategy, writes audit reports to Walrus, and submits Synapse-gated PTBs to Sui testnet.

## Install

```bash
npm install
npm --workspace @synapse-core/vault run typecheck
```

## Required Environment

```bash
export SYNAPSE_PACKAGE_ID=0x70db8ce760ac41322284f1fab73016438639e4f5ab5ae2ad6f5362cb3f50ec16
export SYNAPSE_AGENT_ID=0x...
export SYNAPSE_FULLNODE_URL=https://fullnode.testnet.sui.io:443
export SYNAPSE_WALRUS_NETWORK=testnet
export SYNAPSE_SESSION_KEY_PATH=$HOME/.synapse/session.key
```

`SYNAPSE_SESSION_KEY_PATH` must point to either a `suiprivkey...` string or a base64-encoded 32-byte Ed25519 secret.

Optional MemWal:

```bash
export MEMWAL_DELEGATE_KEY=...
export MEMWAL_RELAYER_URL=https://relayer.memwal.ai
```

Optional strategy knobs:

```bash
export SYNAPSE_DEEPBOOK_POOL_ID=0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5
export SYNAPSE_TARGET_BASE_WEIGHT=0.5
export SYNAPSE_DRIFT_THRESHOLD=0.05
export SYNAPSE_SLIPPAGE_TOLERANCE=0.005
export SYNAPSE_WALRUS_EPOCHS=5
```

## Run Once

```bash
npx -w @synapse-core/vault tsx src/runtime/bin/run.ts \
  --once \
  --agent-id "$SYNAPSE_AGENT_ID" \
  --session-key-path "$SYNAPSE_SESSION_KEY_PATH" \
  --memwal-delegate "$MEMWAL_DELEGATE_KEY"
```

Logs are JSON via `pino`. A successful tick includes `txDigest`, `walrusBlobId`, `artifactSlot`, and `planId`.

## Run Continuously

```bash
npx -w @synapse-core/vault tsx src/runtime/bin/run.ts
```

The loop defaults to one tick every 10 minutes and exits after 5 consecutive failures. Override with:

```bash
export SYNAPSE_TICK_INTERVAL_MS=600000
export SYNAPSE_MAX_FAILURES=5
```
