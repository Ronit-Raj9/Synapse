/**
 * Example: give a LangGraph agent Walrus-durable, verifiable memory in a
 * few lines by dropping in `SynapseStore`.
 *
 * `SynapseStore` implements LangGraph's `BaseStore`, so any graph that takes
 * a store gets MemWal-backed (Walrus-persistent) semantic memory, gated by
 * the agent's on-chain delegate key. Cross-session and cross-agent: another
 * process holding a delegate for the same AgentIdentity reads the same memory.
 *
 * Run (needs a funded AgentIdentity + its MemWal delegate key):
 *   SYNAPSE_AGENT_ID=0x… MEMWAL_DELEGATE_KEY=<hex> \
 *   npx tsx examples/persistent-memory.ts
 */
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { loadAgentState } from '@synapse-core/vault';
import { SynapseStore } from '../src/index.js';

async function main(): Promise<void> {
  const agentId = requireEnv('SYNAPSE_AGENT_ID');
  const delegateKeyHex = requireEnv('MEMWAL_DELEGATE_KEY');
  const packageId = requireEnv('SYNAPSE_PACKAGE_ID');

  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' });
  const { identity } = await loadAgentState({ client, agentId, packageId });

  // ── The whole integration: 1 object ──────────────────────────────────────
  const store = new SynapseStore({
    identity,
    credentials: { delegateKeyHex, serverUrl: 'https://relayer.staging.memwal.ai' },
  });

  // Write a memory (Walrus-durable, semantically recallable).
  await store.put(['research', 'sui'], 'finding-1', {
    note: 'DeepBook SUI/USDC depth thin on testnet; size trades < 5 USDC',
    epoch: 1115,
  });

  // Read it back by key.
  const item = await store.get(['research', 'sui'], 'finding-1');
  console.log('recalled by key:', item?.value);

  // Or semantically search the namespace.
  const hits = await store.search(['research', 'sui'], { query: 'trade sizing on thin liquidity' });
  console.log(`semantic hits: ${hits.length}`);
  for (const h of hits) console.log(`  [${h.score.toFixed(3)}] ${h.key}:`, h.value);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
