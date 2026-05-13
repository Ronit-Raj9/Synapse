/**
 * @synapse-core/adapter-langgraph
 *
 * `SynapseStore` — a `BaseStore` implementation backed by Synapse Core's
 * MemWal bridge. Any LangGraph workflow can drop this in as its
 * persistence layer to get:
 *
 *   - Walrus-durable semantic memory (via MemWal)
 *   - On-chain delegate-key authorization (the agent must hold the key
 *     bound to the `AgentIdentity` it operates as)
 *   - Cryptographic revocation: when the AgentIdentity is revoked, the
 *     MemWal delegate is invalidated server-side and no further reads
 *     or writes succeed
 *
 * The implementation maps LangGraph's `namespace: string[]` hierarchy to
 * MemWal namespaces by joining with `/`, and serializes the LangGraph
 * `value: Record<string, any>` payload as JSON inside the MemWal memory
 * text. A small in-memory key index keeps `get(namespace, key)` an O(1)
 * lookup; `search(namespacePrefix, { query })` proxies to MemWal's
 * semantic recall.
 *
 * Limitations of v1 (documented intentionally — no mocks):
 *   - `delete` is implemented as a tombstone memory plus an in-memory
 *     key-index removal. The underlying MemWal blob is not yet evicted
 *     because the MemWal SDK 0.0.3 does not expose a forget API; we
 *     surface the limitation rather than fake it.
 *   - `listNamespaces` returns namespaces observed via this store
 *     instance only. Recovering historical namespaces from MemWal
 *     requires the relayer's restore endpoint (deferred to v2).
 */

import { BaseStore } from '@langchain/langgraph-checkpoint';
import type {
  GetOperation,
  Item,
  ListNamespacesOperation,
  Operation,
  OperationResults,
  PutOperation,
  SearchItem,
  SearchOperation,
} from '@langchain/langgraph-checkpoint';
import {
  createMemWalClient,
  rememberAndWait,
  recall,
  type AgentMemWalCredentials,
} from '@synapse-core/memwal-bridge';
import type { AgentIdentity } from '@synapse-core/client';
import type { MemWal } from '@mysten-incubation/memwal';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SynapseStoreOptions {
  /** AgentIdentity the store operates on behalf of. */
  identity: AgentIdentity;
  /** Off-chain MemWal delegate credentials. */
  credentials: AgentMemWalCredentials;
  /**
   * Override the auto-constructed MemWal client. Useful for tests or for
   * sharing a client across multiple store instances.
   */
  client?: MemWal;
  /**
   * MemWal recall limit when the caller does not specify one. Default 5.
   */
  defaultSearchLimit?: number;
}

// ---------------------------------------------------------------------------
// Item encoding helpers
// ---------------------------------------------------------------------------

interface EncodedItem {
  /** Discriminator so we can later add more record types. */
  kind: 'synapse-store-item-v1';
  /** Slash-joined namespace path. */
  namespacePath: string;
  /** Hierarchical namespace as stored. */
  namespace: string[];
  /** Item key within the namespace. */
  key: string;
  /** User payload. */
  value: Record<string, unknown>;
  /** Wall-clock timestamp the item was written. */
  writtenAt: string;
  /** Tombstone marker for deletions (true == this record deletes prior). */
  tombstone?: boolean;
}

function encode(item: EncodedItem): string {
  return JSON.stringify(item);
}

function tryDecode(text: string): EncodedItem | null {
  try {
    const parsed = JSON.parse(text) as Partial<EncodedItem>;
    if (parsed.kind !== 'synapse-store-item-v1') return null;
    if (typeof parsed.key !== 'string') return null;
    if (!Array.isArray(parsed.namespace)) return null;
    if (typeof parsed.value !== 'object' || parsed.value === null) return null;
    return parsed as EncodedItem;
  } catch {
    return null;
  }
}

function namespacePath(namespace: string[]): string {
  return namespace.join('/');
}

function namespaceMatchesPrefix(itemNamespace: string[], prefix: string[]): boolean {
  if (prefix.length > itemNamespace.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== itemNamespace[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// SynapseStore
// ---------------------------------------------------------------------------

export class SynapseStore extends BaseStore {
  private readonly client: MemWal;
  private readonly defaultLimit: number;
  /** Latest known MemWal blob for each (namespace, key). */
  private readonly keyIndex = new Map<string, { blobId: string; value: Record<string, unknown> }>();
  /** Known namespaces this store has observed locally. */
  private readonly observedNamespaces = new Set<string>();

  constructor(options: SynapseStoreOptions) {
    super();
    this.client = options.client ?? createMemWalClient({
      identity: options.identity,
      credentials: options.credentials,
    });
    this.defaultLimit = options.defaultSearchLimit ?? 5;
  }

  async batch<Op extends Operation[]>(operations: Op): Promise<OperationResults<Op>> {
    const results: unknown[] = new Array(operations.length);
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      if (op === undefined) {
        results[i] = null;
        continue;
      }
      if (isPut(op)) {
        await this.handlePut(op);
        results[i] = undefined;
        continue;
      }
      if (isGet(op)) {
        results[i] = await this.handleGet(op);
        continue;
      }
      if (isSearch(op)) {
        results[i] = await this.handleSearch(op);
        continue;
      }
      if (isListNamespaces(op)) {
        results[i] = this.handleListNamespaces(op);
        continue;
      }
      results[i] = null;
    }
    return results as OperationResults<Op>;
  }

  // -------------------------------------------------------------------------
  // Per-op handlers
  // -------------------------------------------------------------------------

  private async handlePut(op: PutOperation): Promise<void> {
    const indexKey = `${namespacePath(op.namespace)}::${op.key}`;
    this.observedNamespaces.add(namespacePath(op.namespace));

    if (op.value === null) {
      const tombstone: EncodedItem = {
        kind: 'synapse-store-item-v1',
        namespacePath: namespacePath(op.namespace),
        namespace: op.namespace,
        key: op.key,
        value: {},
        writtenAt: new Date().toISOString(),
        tombstone: true,
      };
      await rememberAndWait({
        client: this.client,
        text: encode(tombstone),
        namespace: namespacePath(op.namespace),
      });
      this.keyIndex.delete(indexKey);
      return;
    }

    const encoded: EncodedItem = {
      kind: 'synapse-store-item-v1',
      namespacePath: namespacePath(op.namespace),
      namespace: op.namespace,
      key: op.key,
      value: op.value as Record<string, unknown>,
      writtenAt: new Date().toISOString(),
    };

    const result = await rememberAndWait({
      client: this.client,
      text: encode(encoded),
      namespace: namespacePath(op.namespace),
    });

    this.keyIndex.set(indexKey, {
      blobId: result.blob_id,
      value: encoded.value,
    });
  }

  private async handleGet(op: GetOperation): Promise<Item | null> {
    const indexKey = `${namespacePath(op.namespace)}::${op.key}`;
    const cached = this.keyIndex.get(indexKey);
    if (cached) {
      return {
        namespace: op.namespace,
        key: op.key,
        value: cached.value as Record<string, unknown>,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Item;
    }
    // Cache miss — query MemWal semantically using the key itself as the
    // search query and filter by exact match. Imperfect because MemWal is
    // ranked-similarity rather than key-indexed; first match wins.
    const recalled = await recall({
      client: this.client,
      query: op.key,
      limit: this.defaultLimit,
      namespace: namespacePath(op.namespace),
    });
    for (const memory of recalled.results) {
      const decoded = tryDecode(memory.text);
      if (!decoded) continue;
      if (decoded.key !== op.key) continue;
      if (!arraysEqual(decoded.namespace, op.namespace)) continue;
      if (decoded.tombstone) return null;
      this.keyIndex.set(indexKey, { blobId: memory.blob_id, value: decoded.value });
      return {
        namespace: op.namespace,
        key: op.key,
        value: decoded.value,
        createdAt: new Date(decoded.writtenAt),
        updatedAt: new Date(decoded.writtenAt),
      } as Item;
    }
    return null;
  }

  private async handleSearch(op: SearchOperation): Promise<SearchItem[]> {
    const query = op.query ?? '*';
    const limit = op.limit ?? this.defaultLimit;
    const namespaceOverride =
      op.namespacePrefix.length > 0 ? namespacePath(op.namespacePrefix) : undefined;
    const recalled = await recall({
      client: this.client,
      query,
      limit,
      ...(namespaceOverride !== undefined ? { namespace: namespaceOverride } : {}),
    });

    const offset = op.offset ?? 0;
    const matches: SearchItem[] = [];
    for (const memory of recalled.results) {
      const decoded = tryDecode(memory.text);
      if (!decoded) continue;
      if (decoded.tombstone) continue;
      if (!namespaceMatchesPrefix(decoded.namespace, op.namespacePrefix)) continue;
      if (op.filter && !matchesFilter(decoded.value, op.filter)) continue;
      matches.push({
        namespace: decoded.namespace,
        key: decoded.key,
        value: decoded.value,
        score: similarityFromDistance(memory.distance),
        createdAt: new Date(decoded.writtenAt),
        updatedAt: new Date(decoded.writtenAt),
      } as SearchItem);
    }
    return matches.slice(offset, offset + limit);
  }

  private handleListNamespaces(op: ListNamespacesOperation): string[][] {
    const all = Array.from(this.observedNamespaces).map((p) => p.split('/').filter(Boolean));
    return all.slice(op.offset ?? 0, (op.offset ?? 0) + (op.limit ?? all.length));
  }
}

// ---------------------------------------------------------------------------
// Operation discriminators
// ---------------------------------------------------------------------------

function isPut(op: Operation): op is PutOperation {
  return 'key' in op && 'namespace' in op && 'value' in op;
}
function isGet(op: Operation): op is GetOperation {
  return 'key' in op && 'namespace' in op && !('value' in op);
}
function isSearch(op: Operation): op is SearchOperation {
  return 'namespacePrefix' in op;
}
function isListNamespaces(op: Operation): op is ListNamespacesOperation {
  return 'limit' in op && !('namespace' in op) && !('namespacePrefix' in op);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Convert MemWal's cosine *distance* (0 = identical, 2 = opposite) into a
 * BaseStore-compatible similarity score in [-1, 1] where 1 == identical.
 */
function similarityFromDistance(distance: number): number {
  return 1 - distance;
}

function matchesFilter(value: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  for (const [k, expected] of Object.entries(filter)) {
    const actual = value[k];
    if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
      const ops = expected as Record<string, unknown>;
      for (const [op, target] of Object.entries(ops)) {
        if (!applyComparator(op, actual, target)) return false;
      }
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

function applyComparator(op: string, actual: unknown, target: unknown): boolean {
  switch (op) {
    case '$eq':
      return actual === target;
    case '$ne':
      return actual !== target;
    case '$gt':
      return typeof actual === 'number' && typeof target === 'number' && actual > target;
    case '$gte':
      return typeof actual === 'number' && typeof target === 'number' && actual >= target;
    case '$lt':
      return typeof actual === 'number' && typeof target === 'number' && actual < target;
    case '$lte':
      return typeof actual === 'number' && typeof target === 'number' && actual <= target;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Convenience re-exports
// ---------------------------------------------------------------------------

export { BaseStore } from '@langchain/langgraph-checkpoint';
export type { AgentMemWalCredentials } from '@synapse-core/memwal-bridge';

export const SYNAPSE_LANGGRAPH_ADAPTER_VERSION = '0.1.0';
