/**
 * Browser-safe loader: every `StrategistCap` owned by a given address, plus
 * the live `Strategy` it controls. Powers the `/strategist` console where
 * cap-holders deprecate, version-bump, or transfer ownership.
 */

import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { SYNAPSE_PACKAGE_ID } from './synapse-config';
import { fetchStrategy, type LiveStrategy } from './strategies';

export interface OwnedStrategistCap {
  capId: string;
  strategyId: string;
  strategy: LiveStrategy;
}

interface LoadArgs {
  client: SuiJsonRpcClient;
  owner: string;
  packageId?: string;
}

/**
 * Paginate through every owned object on `owner` filtered to the Synapse
 * `StrategistCap` type, then hydrate each cap's Strategy reference.
 */
export async function loadOwnedStrategistCaps({
  client,
  owner,
  packageId = SYNAPSE_PACKAGE_ID,
}: LoadArgs): Promise<OwnedStrategistCap[]> {
  const capType = `${packageId}::strategy_registry::StrategistCap`;
  const out: OwnedStrategistCap[] = [];

  let cursor: string | null | undefined;
  do {
    const page = await client.getOwnedObjects({
      owner,
      filter: { StructType: capType },
      options: { showContent: true, showType: true },
      ...(cursor ? { cursor } : {}),
    });
    for (const item of page.data) {
      const content = item.data?.content;
      if (!content || content.dataType !== 'moveObject') continue;
      const fields = (content as { fields: unknown }).fields;
      const strategyId = readStrategyIdField(fields);
      const capId = item.data?.objectId;
      if (!capId || !strategyId) continue;
      const strategy = await fetchStrategy(client, packageId, strategyId);
      if (!strategy) continue;
      out.push({ capId, strategyId, strategy });
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return out.sort((a, b) => Number(b.strategy.publishedAtEpoch - a.strategy.publishedAtEpoch));
}

function readStrategyIdField(fields: unknown): string | null {
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) return null;
  const obj = fields as Record<string, unknown>;
  const raw = obj['strategy_id'];
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const inner = raw as Record<string, unknown>;
    if (typeof inner['id'] === 'string') return inner['id'] as string;
    if (typeof inner['fields'] === 'object' && inner['fields'] !== null) {
      const f = inner['fields'] as Record<string, unknown>;
      if (typeof f['id'] === 'string') return f['id'] as string;
    }
  }
  return null;
}
