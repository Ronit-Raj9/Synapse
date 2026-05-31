// llm-advisor.strategy.ts — publishable Walrus bundle (self-contained, no runtime imports).
//
// AI-driven treasury strategy. Each tick, Claude reasons over the live market
// snapshot AND the vault's recalled MemWal memory to choose a target SUI weight.
// The deterministic rebalance math below turns that weight into a swap; the
// Move VM still enforces spend cap / expiry / revocation / swap allowlist.
//
// Runs SERVER-SIDE only: reads ANTHROPIC_API_KEY from the runtime env and calls
// the Anthropic API directly. In a browser runtime (no key, API CORS) it
// degrades to a transparent noop. Requires the vault to consent to Walrus
// execution so the runtime loads this bundle.
//
// Types are type-only imports — erased at compile, zero runtime cost.
import type { Strategy, StrategyInput, StrategyDecision, PlannedTrade } from '@synapse-core/vault';

// --- tune these to the pair / pool the vault holds ----------------------------
const BASE_TYPE = '0x2::sui::SUI';
const BASE_SYMBOL = 'SUI';
const QUOTE_TYPE =
  'f7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC';
const QUOTE_SYMBOL = 'DBUSDC';
const POOL_ID = '0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5';
const SLIPPAGE = 0.005;
const BASE_DRIFT = 0.05;
const MODEL = 'claude-opus-4-8';
// -----------------------------------------------------------------------------

const strategy: Strategy = {
  id: 'llm-advisor',
  name: 'LLM Advisor',
  version: '1.0.0',
  description:
    'AI-driven: Claude reasons over market data and the vault’s recalled ' +
    'Walrus memory each tick to set the SUI/DBUSDC target weight; deterministic ' +
    'rebalance math executes it within on-chain policy. Server-side; degrades to a noop without a key.',

  evaluate: async (input: StrategyInput): Promise<StrategyDecision> => {
    if (input.policy.revoked) return { kind: 'noop', rationale: 'Vault revoked.' };

    const base = input.holdings.find((h) => h.coinTypeTag === BASE_TYPE);
    const quote = input.holdings.find((h) => h.coinTypeTag === QUOTE_TYPE);
    if (!base || !quote) {
      return { kind: 'noop', rationale: `Missing asset (base=${!!base}, quote=${!!quote}).` };
    }
    const totalUsd = base.valueUsd + quote.valueUsd;
    if (totalUsd <= 0) return { kind: 'noop', rationale: 'Zero NAV.' };
    const actualBaseWeight = base.valueUsd / totalUsd;

    const rec = await advise(input, actualBaseWeight);
    if (!rec) {
      return {
        kind: 'noop',
        rationale: 'LLM advisor unavailable (no ANTHROPIC_API_KEY or API error); holding.',
        signals: { advisorConfigured: false },
      };
    }
    const targetBaseWeight = clamp01(rec.targetBaseWeight);
    const confidence = clamp01(rec.confidence);
    const threshold = clamp(BASE_DRIFT / Math.max(confidence, 0.1), 0.005, 1);

    const drift = actualBaseWeight - targetBaseWeight;
    const absDrift = Math.abs(drift);
    const signals = {
      actualBaseWeight,
      llmTargetBaseWeight: targetBaseWeight,
      llmConfidence: confidence,
      effectiveThreshold: threshold,
      navUsd: totalUsd,
      model: MODEL,
    };

    if (absDrift < threshold) {
      return {
        kind: 'noop',
        rationale: `AI: ${rec.rationale} — drift ${(absDrift * 100).toFixed(2)}% below ${(threshold * 100).toFixed(2)}%; hold.`,
        signals,
      };
    }

    const pool = input.market.pools.find((p) => p.poolId === POOL_ID);
    if (!pool) return { kind: 'noop', rationale: `Pool ${POOL_ID} unavailable.`, signals };

    const targetBaseUsd = totalUsd * targetBaseWeight;
    const baseExcessUsd = base.valueUsd - targetBaseUsd;
    let trade: PlannedTrade;
    let dir: string;
    if (baseExcessUsd > 0) {
      const sellUsd = baseExcessUsd;
      trade = {
        poolId: POOL_ID,
        fromTypeTag: BASE_TYPE,
        toTypeTag: QUOTE_TYPE,
        amountIn: usdToAtomic(sellUsd, base.priceUsd, base.decimals),
        minAmountOut: usdToAtomic(sellUsd * (1 - SLIPPAGE), quote.priceUsd, quote.decimals),
        direction: 0,
      };
      dir = `sell ${BASE_SYMBOL}`;
    } else {
      const buyUsd = -baseExcessUsd;
      trade = {
        poolId: POOL_ID,
        fromTypeTag: QUOTE_TYPE,
        toTypeTag: BASE_TYPE,
        amountIn: usdToAtomic(buyUsd, quote.priceUsd, quote.decimals),
        minAmountOut: usdToAtomic(buyUsd * (1 - SLIPPAGE), base.priceUsd, base.decimals),
        direction: 1,
      };
      dir = `buy ${BASE_SYMBOL}`;
    }

    const planId = `llm-${input.vaultId.slice(0, 10)}-e${input.currentEpoch}-${trade.amountIn}`;
    return {
      kind: 'rebalance',
      planId,
      summary: `AI ${dir}: target ${(targetBaseWeight * 100).toFixed(0)}% ${BASE_SYMBOL}, drift ${(absDrift * 100).toFixed(2)}%.`,
      trades: [trade],
      rationaleMarkdown:
        `### AI rationale\n\n${rec.rationale}\n\n` +
        `- NAV: $${totalUsd.toFixed(2)}\n` +
        `- ${BASE_SYMBOL} weight: ${(actualBaseWeight * 100).toFixed(2)}% → target ${(targetBaseWeight * 100).toFixed(2)}%\n` +
        `- Confidence: ${(confidence * 100).toFixed(0)}% → threshold ${(threshold * 100).toFixed(2)}%\n` +
        `- Action: ${dir} via pool \`${POOL_ID.slice(0, 10)}…\``,
      signals: { ...signals, drift, absDrift, poolMid: pool.mid },
    };
  },

  prepareMemoryWrite: async ({ input, decision }) => {
    const prior = input.memory.counters['llmTicks'] ?? 0;
    const fact =
      decision.kind === 'rebalance'
        ? `epoch ${input.currentEpoch}: AI rebalanced — ${decision.summary}`
        : `epoch ${input.currentEpoch}: AI held — ${decision.rationale.slice(0, 160)}`;
    return { counters: { llmTicks: prior + 1 }, facts: [fact] };
  },
};

async function advise(
  input: StrategyInput,
  actualBaseWeight: number,
): Promise<{ targetBaseWeight: number; confidence: number; rationale: string } | null> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const apiKey = env?.['ANTHROPIC_API_KEY'];
  if (!apiKey) return null;

  const recentFacts =
    input.memory.facts.slice(-8).map((f) => `- ${f}`).join('\n') || '- (no prior memory)';
  const prompt =
    `Epoch ${input.currentEpoch}. NAV $${input.navUsd.toFixed(2)}. ` +
    `Current ${BASE_SYMBOL} weight ${(actualBaseWeight * 100).toFixed(2)}%.\n` +
    `Your recalled memory (recent last):\n${recentFacts}\n` +
    `Ticks so far: ${input.memory.counters['llmTicks'] ?? 0}.\n\n` +
    `As a conservative treasury manager, choose the target ${BASE_SYMBOL} weight. ` +
    `Respond with ONLY a JSON object: ` +
    `{"targetBaseWeight": <0-1>, "confidence": <0-1>, "rationale": "<one or two sentences>"}. ` +
    `Be conservative; small adjustments compound.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system:
          'You are a conservative on-chain treasury manager allocating between a base and ' +
          'quote asset to preserve capital while capturing modest drift. Reply with JSON only.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((b) => b.type === 'text')?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<{
      targetBaseWeight: number;
      confidence: number;
      rationale: string;
    }>;
    if (
      typeof parsed.targetBaseWeight !== 'number' ||
      typeof parsed.confidence !== 'number' ||
      typeof parsed.rationale !== 'string'
    ) {
      return null;
    }
    return {
      targetBaseWeight: parsed.targetBaseWeight,
      confidence: parsed.confidence,
      rationale: parsed.rationale,
    };
  } catch {
    return null;
  }
}

function usdToAtomic(usd: number, priceUsd: number, decimals: number): bigint {
  if (priceUsd <= 0) return 0n;
  return BigInt(Math.max(0, Math.floor((usd / priceUsd) * Math.pow(10, decimals))));
}
function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}
function clamp(n: number, lo: number, hi: number): number {
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
}

export default strategy;
