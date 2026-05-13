import {
  createMemWalClient,
  recall,
  rememberAndWait,
  type MemWal,
} from '@synapse-core/memwal-bridge';
import type { AgentIdentity } from '@synapse-core/client';
import type {
  ExecutionReceipt,
  PastDecision,
  RebalancePlan,
  StrategyMemory,
} from '../types.js';

export interface RuntimeMemWalConfig {
  delegateKeyHex: string;
  relayerUrl?: string;
}

export function createRuntimeMemWalClient(args: {
  identity: AgentIdentity;
  config: RuntimeMemWalConfig;
}): MemWal | null {
  if (args.identity.memwalAccountId.length === 0 || args.identity.memwalNamespace.length === 0) {
    return null;
  }
  return createMemWalClient({
    identity: args.identity,
    credentials: {
      delegateKeyHex: args.config.delegateKeyHex,
      ...(args.config.relayerUrl ? { serverUrl: args.config.relayerUrl } : {}),
    },
  });
}

export async function recallStrategyMemory(args: {
  client: MemWal;
  namespace: string;
  strategyId: string;
}): Promise<StrategyMemory> {
  const result = await recall({
    client: args.client,
    namespace: args.namespace,
    query: `recent ${args.strategyId} Synapse Vault rebalance decisions and outcomes`,
    limit: 8,
  });
  const recentDecisions: PastDecision[] = [];
  const facts: string[] = [];
  for (const memory of result.results) {
    const parsed = parsePastDecision(memory.text);
    if (parsed) {
      recentDecisions.push(parsed);
    } else {
      facts.push(memory.text);
    }
  }
  return {
    recentDecisions: recentDecisions.sort((a, b) => Number(a.epoch - b.epoch)),
    counters: { recalled: result.total },
    facts,
  };
}

export async function rememberStrategyOutcome(args: {
  memwal: MemWal | null;
  namespace: string;
  plan: RebalancePlan;
  receipt: ExecutionReceipt;
}): Promise<void> {
  if (!args.memwal) return;
  await rememberAndWait({
    client: args.memwal,
    namespace: args.namespace,
    text: JSON.stringify({
      type: 'synapse.strategy.outcome',
      decisionId: args.plan.planId,
      epoch: args.receipt.epoch.toString(),
      kind: 'rebalance',
      rationale: args.plan.summary,
      txDigest: args.receipt.txDigest,
      reportWalrusBlobId: args.receipt.reportWalrusBlobId,
      executedAt: args.receipt.executedAt,
    }),
    timeoutMs: 120_000,
  });
}

export function emptyStrategyMemory(): StrategyMemory {
  return {
    recentDecisions: [],
    counters: {},
    facts: [],
  };
}

export function namespaceFromIdentity(identity: AgentIdentity): string {
  if (identity.memwalNamespace.length === 0) return `synapse:${identity.id}`;
  return new TextDecoder('utf-8', { fatal: false }).decode(identity.memwalNamespace);
}

function parsePastDecision(text: string): PastDecision | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (record.type !== 'synapse.strategy.outcome') return null;
    const decisionId = stringValue(record.decisionId);
    const epochText = stringValue(record.epoch);
    const kind = record.kind === 'rebalance' || record.kind === 'noop' ? record.kind : null;
    const rationale = stringValue(record.rationale);
    if (!decisionId || !epochText || !kind || !rationale) return null;
    return {
      decisionId,
      epoch: BigInt(epochText),
      kind,
      rationale,
    };
  } catch {
    return null;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
