# @synapse-core/indexer

Sui event indexer + GraphQL service for the Synapse Vault ecosystem.

It subscribes to every event emitted by the seven deployed `synapse_core`
Move modules, joins them into a per-vault timeline, and exposes a GraphQL
endpoint the dashboard and Memory Inspector can query for richer state than
direct `queryEvents` calls allow (pagination, cross-agent joins, etc.).

## Run locally

```bash
# From the repo root
export SYNAPSE_PACKAGE_ID=0x70db8ce760ac41322284f1fab73016438639e4f5ab5ae2ad6f5362cb3f50ec16
export SYNAPSE_NETWORK=testnet
npx -w @synapse-core/indexer tsx sdk/packages/indexer/src/bin/serve.ts
```

The server starts on `http://localhost:4000/graphql`. Visit it in a browser
to get the Yoga interactive playground.

## Deploy to Fly.io

```bash
cd sdk/packages/indexer
fly launch --copy-config --name synapse-indexer-testnet
fly secrets set \
  SYNAPSE_PACKAGE_ID=0x70db8ce760ac41322284f1fab73016438639e4f5ab5ae2ad6f5362cb3f50ec16 \
  SYNAPSE_NETWORK=testnet
fly deploy
```

The bundled `fly.toml` defaults to:
- `iad` region (closest US-East to Sui's fullnodes)
- 512MB RAM / 1 shared vCPU — enough for testnet event volume
- HTTP healthcheck on `/graphql`

For mainnet deployment, override the secrets:

```bash
fly secrets set \
  SYNAPSE_PACKAGE_ID=<mainnet package ID> \
  SYNAPSE_NETWORK=mainnet
```

## Wiring the dashboard

The dashboard reads events directly from Sui RPC by default. To point it
at a hosted indexer, set:

```bash
# web/dashboard/.env.local
NEXT_PUBLIC_SYNAPSE_INDEXER_URL=https://synapse-indexer-testnet.fly.dev/graphql
```

The dashboard's `loadLiveTimeline` falls back to direct RPC if the env var
is unset or the endpoint is unreachable, so the dependency is soft.

## GraphQL schema

The schema is defined in `src/schema.ts`. Highlights:

```graphql
type Query {
  events(limit: Int, offset: Int): [IndexedEvent!]!
  vaultTimeline(vaultId: ID!): [TimelineEntry!]!
  holdings(vaultId: ID!): HoldingsSnapshot!
  rebalances(vaultId: ID!, limit: Int): [Rebalance!]!
}
```

## Operational notes

- The in-memory event log is wiped on restart. Phase 4 will swap in
  Postgres behind the same interface; the dashboard reads are stable.
- Polling rate is 2s by default. Adjust via `SYNAPSE_POLL_MS` if you're
  hitting fullnode rate limits.
- The indexer never signs transactions — it has no wallet, no keys, and
  zero on-chain authority. It is purely a read-side cache.
