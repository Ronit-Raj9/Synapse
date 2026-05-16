#!/usr/bin/env tsx
/**
 * Backtest the three shipped strategies against the last 90 days of SUI/USD
 * spot prices from CoinGecko's public API. Replays each strategy on a
 * synthetic two-asset portfolio (1000 SUI + 2000 USDC starting) using the
 * SAME deterministic evaluate() function the live runtime uses, then writes
 * a JSON report each strategy can carry as its backtest commitment.
 *
 *   npx tsx scripts/backtest-strategies.ts
 *
 * Output: web/dashboard/public/backtests/<slug>.json
 *
 * Stretch: subsequent run uploads each JSON to Walrus and republishes the
 * Strategy with the backtest blob ID; for now we keep results in the repo
 * so the marketplace UI can fetch them statically.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  aggressiveMomentum,
  balancedYield,
  conservativeRebalancer,
} from '../sdk/packages/vault/src/strategies/index.js';
import type {
  PastDecision,
  Strategy,
  StrategyInput,
  StrategyMemory,
  HoldingSnapshot,
} from '../sdk/packages/vault/src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, '..', 'web', 'dashboard', 'public', 'backtests');

const SUI_TYPE_TAG = '0x2::sui::SUI';
const USDC_TYPE_TAG = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
const POOL_ID = '0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22';

const START_SUI = 1000; // 1000 SUI base position
const START_USDC = 2000; // 2000 USDC quote position
const FEE_BPS = 25; // 0.25% round-trip swap fee assumption

interface DailyPrice {
  ts: number; // epoch ms
  priceUsd: number;
}

interface BacktestPoint {
  date: string;
  priceUsd: number;
  navUsd: number;
  suiUnits: number;
  usdcUnits: number;
  decision: 'rebalance' | 'noop';
  rationale: string;
}

interface BacktestSummary {
  strategySlug: string;
  strategyName: string;
  startDate: string;
  endDate: string;
  startNavUsd: number;
  endNavUsd: number;
  totalReturnPct: number;
  benchmarkReturnPct: number; // buy-and-hold of the same 50/50 starting basket
  alphaPct: number;
  maxDrawdownPct: number;
  volatilityPct: number;
  sharpeAnnualized: number;
  tradesExecuted: number;
  noops: number;
  series: BacktestPoint[];
  generatedAt: string;
}

async function fetchSuiHistory(): Promise<DailyPrice[]> {
  // CoinGecko free public endpoint. No key needed for 90-day daily data.
  const url =
    'https://api.coingecko.com/api/v3/coins/sui/market_chart?vs_currency=usd&days=90&interval=daily';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CoinGecko ${response.status}: ${await response.text()}`);
  }
  const json = (await response.json()) as { prices: [number, number][] };
  return json.prices.map(([ts, priceUsd]) => ({ ts, priceUsd }));
}

function buildHoldings(
  suiUnits: number,
  usdcUnits: number,
  suiPriceUsd: number,
): HoldingSnapshot[] {
  return [
    {
      coinTypeTag: SUI_TYPE_TAG,
      symbol: 'SUI',
      amount: BigInt(Math.round(suiUnits * 1e9)),
      decimals: 9,
      priceUsd: suiPriceUsd,
      valueUsd: suiUnits * suiPriceUsd,
    },
    {
      coinTypeTag: USDC_TYPE_TAG,
      symbol: 'USDC',
      amount: BigInt(Math.round(usdcUnits * 1e6)),
      decimals: 6,
      priceUsd: 1,
      valueUsd: usdcUnits,
    },
  ];
}

function buildMemory(decisions: PastDecision[], priceLookback: number, confBps: number): StrategyMemory {
  return {
    recentDecisions: decisions.slice(-30),
    counters: { price_lookback_usd: priceLookback, pyth_conf_bps: confBps },
    facts: [],
  };
}

async function runBacktest(
  slug: string,
  strategy: Strategy,
  prices: DailyPrice[],
): Promise<BacktestSummary> {
  let suiUnits = START_SUI;
  let usdcUnits = START_USDC;
  const decisions: PastDecision[] = [];
  const series: BacktestPoint[] = [];
  let tradesExecuted = 0;
  let noops = 0;

  for (let i = 0; i < prices.length; i++) {
    const tick = prices[i]!;
    const lookback = i >= 7 ? prices[i - 7]!.priceUsd : tick.priceUsd;
    // Synthetic Pyth confidence: scale with price-vs-trend deviation, in bps.
    const confBps = Math.min(
      300,
      Math.round(Math.abs(tick.priceUsd - lookback) / lookback * 10_000 * 0.3),
    );

    const holdings = buildHoldings(suiUnits, usdcUnits, tick.priceUsd);
    const navUsd = holdings.reduce((acc, h) => acc + h.valueUsd, 0);
    const input: StrategyInput = {
      vaultId: `backtest-${slug}`,
      holdings,
      navUsd,
      market: {
        prices: { SUI: tick.priceUsd, USDC: 1 },
        pools: [
          {
            poolId: POOL_ID,
            baseTypeTag: SUI_TYPE_TAG,
            quoteTypeTag: USDC_TYPE_TAG,
            bestBid: tick.priceUsd * 0.999,
            bestAsk: tick.priceUsd * 1.001,
            mid: tick.priceUsd,
            volume24h: 1_000_000,
          },
        ],
        asOf: new Date(tick.ts).toISOString(),
      },
      memory: buildMemory(decisions, lookback, confBps),
      currentEpoch: BigInt(i),
      policy: {
        spendPerEpochUsd: navUsd, // unconstrained in backtest
        approvedPackages: [POOL_ID],
        expiryEpoch: BigInt(prices.length + 100),
        revoked: false,
      },
    };

    const decision = await strategy.evaluate(input);

    let realizedPnlUsd = 0;
    if (decision.kind === 'rebalance') {
      // Apply each trade against current holdings with a fee haircut.
      for (const trade of decision.trades) {
        const fromBalance = trade.fromTypeTag === SUI_TYPE_TAG ? suiUnits : usdcUnits;
        const fromPrice = trade.fromTypeTag === SUI_TYPE_TAG ? tick.priceUsd : 1;
        const toPrice = trade.toTypeTag === SUI_TYPE_TAG ? tick.priceUsd : 1;
        const amountInUnits =
          Number(trade.amountIn) / 10 ** (trade.fromTypeTag === SUI_TYPE_TAG ? 9 : 6);
        const effectiveIn = Math.min(amountInUnits, fromBalance);
        const fee = effectiveIn * (FEE_BPS / 10_000);
        const grossOutUsd = (effectiveIn - fee) * fromPrice;
        const outUnits = grossOutUsd / toPrice;

        if (trade.fromTypeTag === SUI_TYPE_TAG) {
          suiUnits -= effectiveIn;
          usdcUnits += outUnits;
        } else {
          usdcUnits -= effectiveIn;
          suiUnits += outUnits;
        }
      }
      tradesExecuted++;
      const newHoldings = buildHoldings(suiUnits, usdcUnits, tick.priceUsd);
      const newNav = newHoldings.reduce((acc, h) => acc + h.valueUsd, 0);
      realizedPnlUsd = newNav - navUsd;
      decisions.push({
        decisionId: decision.planId,
        epoch: BigInt(i),
        kind: 'rebalance',
        rationale: decision.summary,
        realizedPnlUsd,
      });
    } else {
      noops++;
      decisions.push({
        decisionId: `noop-${i}`,
        epoch: BigInt(i),
        kind: 'noop',
        rationale: decision.rationale,
      });
    }

    const postHoldings = buildHoldings(suiUnits, usdcUnits, tick.priceUsd);
    const postNav = postHoldings.reduce((acc, h) => acc + h.valueUsd, 0);
    series.push({
      date: new Date(tick.ts).toISOString().slice(0, 10),
      priceUsd: tick.priceUsd,
      navUsd: postNav,
      suiUnits,
      usdcUnits,
      decision: decision.kind,
      rationale: decision.kind === 'noop' ? decision.rationale : decision.summary,
    });
  }

  // Benchmark: untouched 50/50 starting basket valued at each closing price.
  const benchSeries = prices.map(
    (p) => START_SUI * p.priceUsd + START_USDC,
  );
  const startNav = series[0]?.navUsd ?? 0;
  const endNav = series[series.length - 1]?.navUsd ?? startNav;
  const totalReturnPct = ((endNav - startNav) / startNav) * 100;
  const benchmarkReturnPct =
    ((benchSeries[benchSeries.length - 1]! - benchSeries[0]!) / benchSeries[0]!) * 100;
  const alphaPct = totalReturnPct - benchmarkReturnPct;

  // Max drawdown
  let peak = startNav;
  let maxDd = 0;
  for (const point of series) {
    if (point.navUsd > peak) peak = point.navUsd;
    const dd = (peak - point.navUsd) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  // Daily returns
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1]!.navUsd;
    const b = series[i]!.navUsd;
    if (a > 0) returns.push((b - a) / a);
  }
  const meanRet = returns.reduce((s, x) => s + x, 0) / Math.max(1, returns.length);
  const variance =
    returns.reduce((acc, x) => acc + (x - meanRet) ** 2, 0) /
    Math.max(1, returns.length - 1);
  const stddev = Math.sqrt(variance);
  const volatilityPct = stddev * Math.sqrt(365) * 100;
  // Annualized Sharpe with rf = 0 (testnet assets pay no risk-free rate).
  const sharpeAnnualized = stddev > 0 ? (meanRet / stddev) * Math.sqrt(365) : 0;

  return {
    strategySlug: slug,
    strategyName: strategy.name,
    startDate: series[0]!.date,
    endDate: series[series.length - 1]!.date,
    startNavUsd: startNav,
    endNavUsd: endNav,
    totalReturnPct,
    benchmarkReturnPct,
    alphaPct,
    maxDrawdownPct: maxDd * 100,
    volatilityPct,
    sharpeAnnualized,
    tradesExecuted,
    noops,
    series,
    generatedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Fetching 90-day SUI/USD daily prices from CoinGecko…');
  const prices = await fetchSuiHistory();
  console.log(`  got ${prices.length} daily samples`);
  console.log(
    `  ${new Date(prices[0]!.ts).toISOString().slice(0, 10)} → ${new Date(prices[prices.length - 1]!.ts).toISOString().slice(0, 10)}`,
  );

  const strategies: Array<{ slug: string; strategy: Strategy }> = [
    {
      slug: 'conservative-rebalancer',
      strategy: conservativeRebalancer({
        baseTypeTag: SUI_TYPE_TAG,
        baseSymbol: 'SUI',
        quoteTypeTag: USDC_TYPE_TAG,
        quoteSymbol: 'USDC',
        targetBaseWeight: 0.5,
        driftThreshold: 0.05,
        poolId: POOL_ID,
        slippageTolerance: 0.005,
      }),
    },
    {
      slug: 'balanced-yield',
      strategy: balancedYield({
        baseTypeTag: SUI_TYPE_TAG,
        baseSymbol: 'SUI',
        quoteTypeTag: USDC_TYPE_TAG,
        quoteSymbol: 'USDC',
        targetBaseWeight: 0.6,
        thresholdLow: 0.02,
        thresholdHigh: 0.08,
        slippageLow: 0.005,
        slippageHigh: 0.02,
        volWindow: 12,
        poolId: POOL_ID,
      }),
    },
    {
      slug: 'aggressive-momentum',
      strategy: aggressiveMomentum({
        baseTypeTag: SUI_TYPE_TAG,
        baseSymbol: 'SUI',
        quoteTypeTag: USDC_TYPE_TAG,
        quoteSymbol: 'USDC',
        entryThreshold: 0.02,
        exitThreshold: -0.01,
        maxConfBps: 75,
        slippageTolerance: 0.01,
        maxPositionFraction: 0.5,
        poolId: POOL_ID,
      }),
    },
  ];

  const summaries: BacktestSummary[] = [];
  for (const { slug, strategy } of strategies) {
    console.log(`\n→ ${strategy.name}`);
    const summary = await runBacktest(slug, strategy, prices);
    summaries.push(summary);

    const filePath = join(OUT_DIR, `${slug}.json`);
    writeFileSync(filePath, JSON.stringify(summary, null, 2));
    console.log(`  wrote ${filePath}`);
    console.log(`  total return: ${summary.totalReturnPct.toFixed(2)}%`);
    console.log(`  benchmark:    ${summary.benchmarkReturnPct.toFixed(2)}%`);
    console.log(`  alpha:        ${summary.alphaPct >= 0 ? '+' : ''}${summary.alphaPct.toFixed(2)}%`);
    console.log(`  max drawdown: ${summary.maxDrawdownPct.toFixed(2)}%`);
    console.log(`  sharpe (ann): ${summary.sharpeAnnualized.toFixed(2)}`);
    console.log(`  trades:       ${summary.tradesExecuted} (noops: ${summary.noops})`);
  }

  const indexPath = join(OUT_DIR, 'index.json');
  writeFileSync(
    indexPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        startDate: summaries[0]?.startDate,
        endDate: summaries[0]?.endDate,
        strategies: summaries.map((s) => ({
          slug: s.strategySlug,
          name: s.strategyName,
          totalReturnPct: s.totalReturnPct,
          benchmarkReturnPct: s.benchmarkReturnPct,
          alphaPct: s.alphaPct,
          maxDrawdownPct: s.maxDrawdownPct,
          sharpeAnnualized: s.sharpeAnnualized,
          tradesExecuted: s.tradesExecuted,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote index → ${indexPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
