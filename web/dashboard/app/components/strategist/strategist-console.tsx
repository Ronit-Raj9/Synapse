'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'motion/react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useOwnedStrategies } from '../../hooks/use-owned-strategies';
import { CodeTag } from '../ui/code-tag';
import { WalletButton } from '../ui/wallet-button';
import { RISK_LABEL } from '@/lib/strategies';
import {
  alphaSummary,
  type LiveStrategy,
} from '@/lib/strategies';
import { explorerObjectUrl } from '@/lib/synapse-config';
import { shortenHash } from '@/lib/format';
import { StrategyAdminPanel } from './admin-panel';

export function StrategistConsole() {
  const account = useCurrentAccount();
  const query = useOwnedStrategies();
  const owned = query.data ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!account) {
    return (
      <div className="card-flat flex flex-col items-start gap-4 p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          <CodeTag>connect</CodeTag>
        </p>
        <h2 className="font-display text-2xl font-bold">
          Connect a wallet to view your strategies
        </h2>
        <p className="max-w-md text-sm text-ink-soft">
          The console reads every StrategistCap your address owns. Without a connected wallet,
          there's nothing to manage here.
        </p>
        <WalletButton />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <p className="font-mono text-sm text-ink-mute">Loading owned strategies…</p>
    );
  }

  if (owned.length === 0) {
    return (
      <div className="card-flat flex flex-col items-start gap-4 p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          <CodeTag>empty</CodeTag>
        </p>
        <h2 className="font-display text-2xl font-bold">No strategies published yet</h2>
        <p className="max-w-md text-sm text-ink-soft">
          Publish your first strategy to start earning royalties on every vault that hires it.
        </p>
        <Link href="/marketplace/publish" className="btn-flat" data-variant="accent">
          Publish a strategy →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {owned.map((entry) => (
        <motion.section
          key={entry.capId}
          layout
          className="card-flat relative overflow-hidden p-6"
        >
          <StrategyRow
            strategy={entry.strategy}
            capId={entry.capId}
            expanded={activeId === entry.strategyId}
            onToggle={() =>
              setActiveId((id) => (id === entry.strategyId ? null : entry.strategyId))
            }
          />
          {activeId === entry.strategyId && (
            <StrategyAdminPanel
              strategy={entry.strategy}
              capId={entry.capId}
              onAfterAction={() => query.refetch()}
            />
          )}
        </motion.section>
      ))}
    </div>
  );
}

function StrategyRow({
  strategy,
  capId,
  expanded,
  onToggle,
}: {
  strategy: LiveStrategy;
  capId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const alpha = alphaSummary(strategy);
  const accent =
    strategy.riskProfile === 0
      ? 'var(--accent-green)'
      : strategy.riskProfile === 1
        ? 'var(--accent-blue)'
        : 'var(--accent-orange)';
  return (
    <>
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accent }}
      />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CodeTag>strategy</CodeTag>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
              v{strategy.version.toString()}
            </span>
            {strategy.active ? (
              <span className="pill" data-state="active">
                Active
              </span>
            ) : (
              <span className="pill" data-state="expired">
                Deprecated
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-2xl font-bold leading-tight">
            {strategy.name}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {strategy.description}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Stat
              label="Risk"
              value={RISK_LABEL[strategy.riskProfile]}
            />
            <Stat
              label="Royalty"
              value={`${(strategy.royaltyBps / 100).toFixed(1)}%`}
            />
            <Stat
              label="Vaults"
              value={`${strategy.activeVaultCount.toString()}/${strategy.vaultCount.toString()}`}
            />
            <Stat
              label="Net α"
              value={
                alpha.ticks === 0n
                  ? '—'
                  : `${alpha.netBps >= 0n ? '+' : ''}${alpha.netBps.toString()}bps`
              }
            />
          </dl>
          <div className="mt-4 grid gap-1.5 font-mono text-[11px] text-ink-mute">
            <ExplorerRow label="Strategy" id={strategy.id} />
            <ExplorerRow label="Cap" id={capId} />
            <p>
              code_hash {strategy.codeHashHex.slice(0, 10)}…{strategy.codeHashHex.slice(-6)}
            </p>
            <p>walrus blob {strategy.sourceWalrusBlob || '—'}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="btn-flat"
            data-variant={expanded ? 'ghost' : 'primary'}
          >
            {expanded ? 'Close panel' : 'Manage'}
          </button>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
        {label}
      </p>
      <p className="font-display text-sm font-semibold">{value}</p>
    </div>
  );
}

function ExplorerRow({ label, id }: { label: string; id: string }) {
  return (
    <a
      href={explorerObjectUrl(id)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 hover:text-ink"
    >
      <span>{label}</span>
      <span>{shortenHash(id)}</span>
      <span>↗</span>
    </a>
  );
}
