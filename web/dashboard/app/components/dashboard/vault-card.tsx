'use client';

import type { Vault } from '@/lib/sample-data';
import { formatUsd, shortenAddress, timeAgo } from '@/lib/format';
import { Sparkline } from './sparkline';
import { CodeTag } from '../ui/code-tag';

interface VaultCardProps {
  vault: Vault;
  history: number[];
}

/**
 * Top-of-dashboard hero card showing the active vault's NAV, 24h PnL,
 * inline sparkline, and fee economics. Sharp two-color flat-shadow style.
 */
export function VaultCard({ vault, history }: VaultCardProps) {
  const positive = vault.pnl24hUsd >= 0;
  const aumFeeUsdYear = (vault.navUsd * vault.managementFeeBps) / 10_000;

  return (
    <div className="card-flat relative overflow-hidden">
      <div className="absolute right-0 top-0 h-full w-1/3 crosshatch opacity-30" />

      <div className="relative grid gap-8 p-8 md:grid-cols-[1.4fr_1fr] md:p-10">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="pill" data-state={vault.status}>
              <span className="live-dot" /> {vault.status}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
              {vault.strategyName} v{vault.strategyVersion}
            </span>
          </div>

          <h2 className="headline text-5xl md:text-6xl">
            {vault.name}
            <span className="text-accent-orange">.</span>
          </h2>

          <div className="flex items-end gap-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                Net asset value
              </p>
              <p className="num-display mt-1 text-5xl">{formatUsd(vault.navUsd)}</p>
            </div>
            <div className="pb-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                24h change
              </p>
              <p
                className="num mt-1 text-xl font-semibold"
                style={{ color: positive ? 'var(--state-active)' : 'var(--state-revoked)' }}
              >
                {positive ? '+' : ''}
                {formatUsd(vault.pnl24hUsd)}{' '}
                <span className="text-base text-ink-mute">
                  ({positive ? '+' : ''}
                  {(vault.pnl24hPct * 100).toFixed(2)}%)
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <Detail label="Owner" value={shortenAddress(vault.owner)} />
            <Detail label="Session" value={shortenAddress(vault.sessionAddr)} />
            <Detail label="Inception" value={timeAgo(vault.inceptionTs)} />
            <Detail label="Expires at epoch" value={vault.expiryEpoch.toString()} />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div className="card-bare flex flex-col gap-2 p-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
              <CodeTag>fees</CodeTag>
            </span>
            <FeeRow
              label="Management"
              accent="var(--accent-blue)"
              value={`${vault.managementFeeBps / 100}%/yr`}
              hint={`${formatUsd(aumFeeUsdYear)} / yr at current NAV`}
            />
            <FeeRow
              label="Performance"
              accent="var(--accent-orange)"
              value={`${vault.performanceFeeBps / 100}%`}
              hint="of realised alpha vs benchmark"
            />
          </div>

          <div className="card-bare p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                NAV — 17 epochs
              </span>
              <span className="font-mono text-[11px] text-state-active">↑ 10.97%</span>
            </div>
            <Sparkline data={history} width={320} height={70} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono uppercase tracking-[0.18em] text-ink-mute">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </span>
  );
}

function FeeRow({
  label,
  accent,
  value,
  hint,
}: {
  label: string;
  accent: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: accent }} />
        <span className="font-display text-sm font-semibold text-ink">{label}</span>
      </div>
      <div className="text-right">
        <div className="num font-semibold text-ink">{value}</div>
        <div className="text-[10px] text-ink-mute">{hint}</div>
      </div>
    </div>
  );
}
