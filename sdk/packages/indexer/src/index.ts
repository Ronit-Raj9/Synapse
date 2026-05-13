/**
 * @synapse-core/indexer
 *
 * Sui event indexer that subscribes to `synapse_core::*` events, parses them
 * into typed records, and exposes Vault-centric GraphQL views.
 *
 * Public API:
 *   - `SynapseIndexer`         the polling event loader
 *   - `buildSchema(indexer)`   constructs a GraphQL schema bound to the indexer
 *   - `startServer(opts)`      starts a graphql-yoga server on the given port
 *
 * The indexer is intentionally storage-agnostic — events are kept in memory
 * for the v1 dashboard. Phase 3 swaps in Postgres without touching the
 * resolver code.
 */

export { SynapseIndexer } from './indexer.js';
export type {
  IndexedEvent,
  EventKind,
  IndexerOptions,
  VaultTimelineEntry,
  VaultHoldingsSnapshot,
  RebalanceRecord,
} from './types.js';
export { buildSchema } from './schema.js';
export { startServer } from './server.js';

export const INDEXER_VERSION = '0.1.0';
