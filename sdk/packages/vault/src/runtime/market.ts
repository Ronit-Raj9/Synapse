import { DeepBookClient, testnetCoins, testnetPools } from '@mysten/deepbook-v3';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import type { MarketSnapshot, PoolSnapshot, Strategy } from '../types.js';

export interface LoadMarketSnapshotArgs {
  client: SuiJsonRpcClient;
  pools: string[];
  oracleSources?: string[];
  senderAddress: string;
}

export async function loadMarketSnapshot(args: LoadMarketSnapshotArgs): Promise<MarketSnapshot> {
  const deepbook = new DeepBookClient({
    client: args.client,
    address: args.senderAddress,
    network: 'testnet',
  });

  const pools: PoolSnapshot[] = [];
  for (const poolId of args.pools) {
    const poolKey = poolKeyFromId(poolId);
    const pool = testnetPools[poolKey];
    const base = testnetCoins[pool.baseCoin];
    const quote = testnetCoins[pool.quoteCoin];
    const mid = await deepbook.midPrice(poolKey);
    const l2 = await deepbook.getLevel2TicksFromMid(poolKey, 1);
    const bestBid = l2.bid_prices[0] ?? mid;
    const bestAsk = l2.ask_prices[0] ?? mid;
    const vaultBalances = await deepbook.vaultBalances(poolKey);
    pools.push({
      poolId: pool.address,
      baseTypeTag: base.type,
      quoteTypeTag: quote.type,
      bestBid,
      bestAsk,
      mid,
      volume24h: vaultBalances.base,
    });
  }

  return {
    prices: pricesFromPools(pools),
    pools,
    asOf: new Date().toISOString(),
  };
}

export function requiredPoolsForStrategy(strategy: Strategy & {
  requiredPools?: () => string[];
}): string[] {
  return strategy.requiredPools?.() ?? [testnetPools.SUI_DBUSDC.address];
}

function poolKeyFromId(poolId: string): keyof typeof testnetPools {
  for (const [key, value] of Object.entries(testnetPools)) {
    if (value.address.toLowerCase() === poolId.toLowerCase()) {
      return key as keyof typeof testnetPools;
    }
  }
  throw new Error(`DeepBook testnet pool ${poolId} is not present in @mysten/deepbook-v3 constants`);
}

function pricesFromPools(pools: PoolSnapshot[]): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const pool of pools) {
    prices[symbolFromTypeTag(pool.quoteTypeTag)] = 1;
    prices[symbolFromTypeTag(pool.baseTypeTag)] = pool.mid;
  }
  return prices;
}

function symbolFromTypeTag(typeTag: string): string {
  return typeTag.split('::').at(-1) ?? typeTag;
}
