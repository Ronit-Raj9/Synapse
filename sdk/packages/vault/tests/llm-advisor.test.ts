import { describe, it, expect } from 'vitest';
import { llmAdvisor, type AdviseFn } from '../src/strategies/llm-advisor.js';
import type { StrategyInput } from '../src/types.js';

const BASE = '0x2::sui::SUI';
const QUOTE = '0xq::usdc::USDC';
const POOL = '0xpool';

function makeInput(overrides: Partial<StrategyInput> = {}): StrategyInput {
  return {
    vaultId: '0xvault',
    navUsd: 100,
    currentEpoch: 100n,
    holdings: [
      { coinTypeTag: BASE, symbol: 'SUI', amount: 80_000_000_000n, decimals: 9, priceUsd: 1, valueUsd: 80 },
      { coinTypeTag: QUOTE, symbol: 'USDC', amount: 20_000_000n, decimals: 6, priceUsd: 1, valueUsd: 20 },
    ],
    market: {
      prices: { SUI: 1, USDC: 1 },
      pools: [{ poolId: POOL, baseTypeTag: BASE, quoteTypeTag: QUOTE, bestBid: 0.99, bestAsk: 1.01, mid: 1, volume24h: 1000 }],
      asOf: new Date().toISOString(),
    },
    memory: { strategyId: 'llm-advisor', counters: {}, facts: [] },
    policy: {
      spendPerEpochUsd: 1000,
      expiryEpoch: 1_000_000n,
      revoked: false,
      approvedPackages: [],
    } as StrategyInput['policy'],
    ...overrides,
  };
}

function build(advise: AdviseFn) {
  return llmAdvisor(
    {
      baseTypeTag: BASE,
      baseSymbol: 'SUI',
      quoteTypeTag: QUOTE,
      quoteSymbol: 'USDC',
      poolId: POOL,
      slippageTolerance: 0.005,
      driftThreshold: 0.05,
    },
    { advise },
  );
}

describe('llmAdvisor', () => {
  it('noops when the advisor is not configured (null)', async () => {
    const s = build(async () => null);
    const d = await s.evaluate(makeInput());
    expect(d.kind).toBe('noop');
    expect(d.signals?.advisorConfigured).toBe(false);
  });

  it('noops (without throwing) when the advisor errors', async () => {
    const s = build(async () => {
      throw new Error('rate limited');
    });
    const d = await s.evaluate(makeInput());
    expect(d.kind).toBe('noop');
    expect(d.signals?.advisorError).toBe(true);
  });

  it('rebalances toward the LLM-chosen target weight (80% SUI → 50%)', async () => {
    const s = build(async () => ({ targetBaseWeight: 0.5, confidence: 1, rationale: 'trim SUI' }));
    const d = await s.evaluate(makeInput());
    expect(d.kind).toBe('rebalance');
    if (d.kind === 'rebalance') {
      // base over-weight (80% vs 50% target) → sell SUI (base→quote, direction 0)
      expect(d.trades[0]?.direction).toBe(0);
      expect(d.rationaleMarkdown).toContain('AI rationale');
      expect(d.rationaleMarkdown).toContain('trim SUI');
      expect(d.signals.llmTargetBaseWeight).toBe(0.5);
    }
  });

  it('holds when the LLM target matches the current weight', async () => {
    const s = build(async () => ({ targetBaseWeight: 0.8, confidence: 1, rationale: 'balanced' }));
    const d = await s.evaluate(makeInput()); // current is already 80% SUI
    expect(d.kind).toBe('noop');
  });

  it('low confidence widens the threshold and suppresses a marginal trade', async () => {
    // 80% actual vs 70% target = 10% drift. At confidence 1 the 5% threshold
    // would trade; at confidence 0.1 the effective threshold is 0.5 → hold.
    const input = makeInput();
    const trade = await build(async () => ({ targetBaseWeight: 0.7, confidence: 1, rationale: 'x' })).evaluate(input);
    const hold = await build(async () => ({ targetBaseWeight: 0.7, confidence: 0.1, rationale: 'unsure' })).evaluate(input);
    expect(trade.kind).toBe('rebalance');
    expect(hold.kind).toBe('noop');
  });

  it('clamps an out-of-range target weight into [0,1]', async () => {
    const s = build(async () => ({ targetBaseWeight: 5, confidence: 1, rationale: 'all in' }));
    const d = await s.evaluate(makeInput());
    // target clamps to 1.0 → buy SUI with USDC (quote→base, direction 1)
    expect(d.kind).toBe('rebalance');
    if (d.kind === 'rebalance') expect(d.signals.llmTargetBaseWeight).toBe(1);
  });

  it('records an AI memory fact + bumps the tick counter', async () => {
    const s = build(async () => ({ targetBaseWeight: 0.5, confidence: 1, rationale: 'trim' }));
    const input = makeInput({ memory: { strategyId: 'llm-advisor', counters: { llmTicks: 4 }, facts: [] } });
    const decision = await s.evaluate(input);
    const write = await s.prepareMemoryWrite!({ input, decision });
    expect(write.counters?.llmTicks).toBe(5);
    expect(write.facts?.[0]).toContain('AI rebalanced');
  });

  it('noops immediately when the vault is revoked (no advisor call)', async () => {
    let called = false;
    const s = build(async () => {
      called = true;
      return { targetBaseWeight: 0.5, confidence: 1, rationale: 'x' };
    });
    const input = makeInput({ policy: { ...makeInput().policy, revoked: true } });
    const d = await s.evaluate(input);
    expect(d.kind).toBe('noop');
    expect(called).toBe(false);
  });
});

describe('llmAdvisor tick-gating', () => {
  function buildGated(advise: AdviseFn) {
    return llmAdvisor(
      {
        baseTypeTag: BASE, baseSymbol: 'SUI', quoteTypeTag: QUOTE, quoteSymbol: 'USDC',
        poolId: POOL, slippageTolerance: 0.005, driftThreshold: 0.05,
        llmRecallThreshold: 0.015, llmMaxIdleEpochs: 5,
      },
      { advise },
    );
  }

  it('does NOT call advise when within idle epochs and under drift', async () => {
    let calls = 0;
    const s = buildGated(async () => {
      calls += 1;
      return { targetBaseWeight: 0.5, confidence: 0.9, rationale: 'r' };
    });
    const input = makeInput({
      currentEpoch: 101n,
      memory: {
        strategyId: 'llm-advisor',
        counters: { lastLlmEpoch: 100, lastLlmPriceMilli: 1000, lastTargetWeightMilli: 500 },
        facts: [],
      },
    });
    const d = await s.evaluate(input);
    expect(calls).toBe(0);
    expect(d.signals?.llmGated).toBe(true);
  });

  it('calls advise when price drift exceeds the recall threshold', async () => {
    let calls = 0;
    const s = buildGated(async () => {
      calls += 1;
      return { targetBaseWeight: 0.7, confidence: 0.9, rationale: 'r' };
    });
    const input = makeInput({
      currentEpoch: 101n,
      market: {
        prices: { SUI: 1.1, USDC: 1 },
        pools: [{ poolId: POOL, baseTypeTag: BASE, quoteTypeTag: QUOTE, bestBid: 1.09, bestAsk: 1.11, mid: 1.1, volume24h: 1000 }],
        asOf: new Date().toISOString(),
      },
      holdings: [
        { coinTypeTag: BASE, symbol: 'SUI', amount: 80_000_000_000n, decimals: 9, priceUsd: 1.1, valueUsd: 88 },
        { coinTypeTag: QUOTE, symbol: 'USDC', amount: 20_000_000n, decimals: 6, priceUsd: 1, valueUsd: 20 },
      ],
      memory: {
        strategyId: 'llm-advisor',
        counters: { lastLlmEpoch: 100, lastLlmPriceMilli: 1000, lastTargetWeightMilli: 500 },
        facts: [],
      },
    });
    await s.evaluate(input);
    expect(calls).toBe(1);
  });

  it('calls advise on first run (no prior state)', async () => {
    let calls = 0;
    const s = buildGated(async () => {
      calls += 1;
      return { targetBaseWeight: 0.5, confidence: 0.9, rationale: 'r' };
    });
    await s.evaluate(makeInput());
    expect(calls).toBe(1);
  });
});
