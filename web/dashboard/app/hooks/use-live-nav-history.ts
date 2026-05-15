'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useSuiClient } from '@mysten/dapp-kit';
import { loadLiveTimeline } from '@/lib/live-events';
import type { TimelineEntry } from '@/lib/sample-data';
import type { PricedVaultState } from './use-live-vault';

export interface NavSeriesPoint {
  /** Wall-clock timestamp (epoch ms) of the event. */
  t: number;
  /** Cumulative NAV in USD at this point, valued at CURRENT prices. */
  navUsd: number;
}

export interface NavHistory {
  /** Sorted oldest → newest. */
  series: NavSeriesPoint[];
  /** Number of real on-chain events that moved the balance. */
  meaningfulEventCount: number;
  /**
   * Growth from first → last point, as a fraction (e.g. `0.0697` = +6.97%).
   * `null` when the first point is zero — "growth from nil" is undefined
   * and the UI surfaces a distinct label rather than misleading "0.00%".
   */
  growthPct: number | null;
  /** 24-hour change in USD, or null if we don't have a comparison point. */
  change24hUsd: number | null;
  change24hPct: number | null;
  /** The current NAV (== last point). */
  navUsd: number;
}

/**
 * Replays on-chain `agent_minted` / `agent_funded` / `spend` / `swap` events
 * into a NAV time series, valued using the CURRENT Pyth prices. This is a
 * deliberate choice: historical prices would require an oracle TWAP we
 * haven't wired yet, and the most useful chart for a treasury operator is
 * "how has the balance evolved" — not "how has the market moved."
 *
 * Empty / single-point histories are honest: we don't fake a curve. Callers
 * should render flat lines when `series.length < 2`.
 */
export function useLiveNavHistory(
  vaultId: string | null | undefined,
  priced: PricedVaultState | null,
): UseQueryResult<NavHistory | null, Error> {
  const client = useSuiClient();
  return useQuery<NavHistory | null, Error>({
    queryKey: ['synapse-nav-history', vaultId, priced?.asOf ?? ''],
    queryFn: async () => {
      if (!vaultId || !priced) return null;

      const timeline = await loadLiveTimeline({ client, agentId: vaultId, limit: 500 });
      const events = orderOldestFirst(timeline);
      const series = replayEvents(events, priced);

      const navUsd = series.length === 0 ? priced.navUsd : (series.at(-1)?.navUsd ?? priced.navUsd);
      const first = series[0]?.navUsd ?? navUsd;
      // Honest "from nil" — growth from a zero baseline is undefined.
      const growthPct: number | null = first > 0 ? (navUsd - first) / first : null;

      const nowMs = Date.now();
      const dayAgoMs = nowMs - 24 * 60 * 60 * 1000;
      let baseline24h: number | null = null;
      for (const point of series) {
        if (point.t <= dayAgoMs) baseline24h = point.navUsd;
        else break;
      }
      // If the entire history is younger than 24h, we don't have a fair
      // comparison point — leave change24h null rather than misreport.
      const change24hUsd = baseline24h === null ? null : navUsd - baseline24h;
      const change24hPct =
        baseline24h === null || baseline24h === 0 ? null : (navUsd - baseline24h) / baseline24h;

      return {
        series,
        meaningfulEventCount: events.filter(isBalanceMoving).length,
        growthPct,
        change24hUsd,
        change24hPct,
        navUsd,
      };
    },
    enabled: !!vaultId && !!priced,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function orderOldestFirst(timeline: readonly TimelineEntry[]): TimelineEntry[] {
  return [...timeline].sort((a, b) => a.timestamp - b.timestamp);
}

function isBalanceMoving(e: TimelineEntry): boolean {
  return (
    e.kind === 'agent_minted' ||
    e.kind === 'agent_funded' ||
    e.kind === 'spend' ||
    e.kind === 'swap'
  );
}

/**
 * Build the running NAV series. We track per-coin atomic balances forward;
 * at each event we recompute NAV = Σ (balance × current_price). Using a
 * single (current) price snapshot makes "value drift over time" attributable
 * to the agent's actions rather than the market — exactly what a treasury
 * operator wants.
 */
function replayEvents(events: readonly TimelineEntry[], priced: PricedVaultState): NavSeriesPoint[] {
  // Build a fast price lookup per symbol from the priced state.
  const priceBySymbol: Record<string, number> = {};
  const decimalsBySymbol: Record<string, number> = {};
  for (const h of priced.pricedHoldings) {
    priceBySymbol[h.symbol] = h.priceUsd;
    decimalsBySymbol[h.symbol] = h.decimals;
  }

  const balances = new Map<string, number>(); // symbol → display amount (already decimal-adjusted)
  const out: NavSeriesPoint[] = [];

  for (const event of events) {
    const symbol = canonicalSymbol(event);
    if (symbol && event.amount !== undefined) {
      const decimals = decimalsBySymbol[symbol] ?? 9; // SUI default
      const delta = decimalsAdjusted(event.amount, decimals);
      const current = balances.get(symbol) ?? 0;
      const next = isInflow(event.kind) ? current + delta : current - delta;
      balances.set(symbol, next);
    }

    const navUsd = computeNav(balances, priceBySymbol);
    out.push({ t: event.timestamp, navUsd });
  }

  // Always anchor the last point at the priced state's current NAV so the
  // sparkline endpoint matches the headline number exactly.
  if (out.length > 0) {
    const last = out.at(-1);
    if (last) last.navUsd = priced.navUsd;
  }

  return out;
}

function isInflow(kind: TimelineEntry['kind']): boolean {
  return kind === 'agent_minted' || kind === 'agent_funded' || kind === 'swap';
}

function canonicalSymbol(event: TimelineEntry): string | null {
  if (!event.tokenSymbol) return null;
  // Handle "SUI" or "SUI→USDC" / "USDC→SUI" swap labels.
  const direct = event.tokenSymbol.toUpperCase();
  if (direct.includes('→')) {
    // Treat swap output as the symbol that flowed INTO the treasury.
    const parts = direct.split('→');
    const dest = parts[1]?.trim();
    return dest ?? null;
  }
  return direct;
}

function decimalsAdjusted(amount: number, decimals: number): number {
  // The TimelineEntry amount is reported in display units for sample data
  // (`24170`) and atomic units for live data (`100_000_000` for 0.1 SUI).
  // Distinguish heuristically: if the amount is much larger than reasonable
  // display values for the coin (>1e6), treat it as atomic.
  if (amount > 1_000_000) return amount / Math.pow(10, decimals);
  return amount;
}

function computeNav(
  balances: Map<string, number>,
  priceBySymbol: Record<string, number>,
): number {
  let nav = 0;
  for (const [symbol, amount] of balances) {
    const price = priceBySymbol[symbol] ?? 0;
    nav += amount * price;
  }
  return nav;
}
