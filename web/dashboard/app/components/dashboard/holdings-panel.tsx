'use client';

import type { Vault } from '@/lib/sample-data';
import { formatUsd } from '@/lib/format';

interface HoldingsPanelProps {
  vault: Vault;
}

/**
 * Stacked holdings allocation bar + per-asset detail rows. Shows the
 * vault's current portfolio weights with the strategy's target overlay.
 */
export function HoldingsPanel({ vault }: HoldingsPanelProps) {
  const total = vault.holdings.reduce((s, h) => s + h.valueUsd, 0);

  return (
    <div className="card-flat p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold">Holdings</h3>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Target 50 / 50 · Drift {(Math.abs(0.5 - vault.holdings[0]!.valueUsd / total) * 100).toFixed(2)}%
          </p>
        </div>
        <span className="font-serif italic text-ink-mute">live</span>
      </div>

      {/* Stacked bar */}
      <div className="mb-6 flex h-12 overflow-hidden rounded-sm border-2 border-ink">
        {vault.holdings.map((h) => (
          <div
            key={h.symbol}
            className="relative flex items-center justify-center transition-all duration-500"
            style={{ width: `${(h.valueUsd / total) * 100}%`, backgroundColor: h.accentColor }}
          >
            <span className="font-display text-xs font-bold text-ink">{h.symbol}</span>
            <span className="absolute -bottom-5 left-2 font-mono text-[10px] text-ink-mute">
              {((h.valueUsd / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-4">
        {vault.holdings.map((h) => (
          <HoldingRow key={h.symbol} holding={h} />
        ))}
      </div>
    </div>
  );
}

function HoldingRow({ holding }: { holding: Vault['holdings'][number] }) {
  return (
    <div className="grid grid-cols-[40px_1fr_auto_auto] items-center gap-4 border-b border-divider pb-4 last:border-0">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-sm border-2 border-ink"
        style={{ backgroundColor: holding.accentColor }}
      >
        <span className="font-display text-sm font-extrabold text-ink">{holding.symbol[0]}</span>
      </div>
      <div>
        <div className="font-display font-semibold">{holding.symbol}</div>
        <div className="font-mono text-[10px] text-ink-mute">
          {holding.typeTag.length > 28 ? `${holding.typeTag.slice(0, 22)}…` : holding.typeTag}
        </div>
      </div>
      <div className="text-right">
        <div className="num text-sm">{holding.amount.toLocaleString('en-US')}</div>
        <div className="font-mono text-[10px] text-ink-mute">
          @ {formatUsd(holding.priceUsd, { fine: true })}
        </div>
      </div>
      <div className="text-right">
        <div className="num font-semibold">{formatUsd(holding.valueUsd)}</div>
        <div className="font-mono text-[10px] text-state-active">▲ live</div>
      </div>
    </div>
  );
}
