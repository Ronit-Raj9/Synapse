'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { CodeTag } from '../ui/code-tag';
import { useOwnedVaults } from '../../hooks/use-owned-vaults';
import type { OwnedVault } from '@/lib/owned-vaults';
import type { LocalVaultRecord } from '@/lib/local-vaults';
import { explorerObjectUrl } from '@/lib/synapse-config';
import { shortenHash, timeAgo } from '@/lib/format';

interface LiveVaultBannerProps {
  /** Called whenever the active vault changes (or clears). */
  onVaultDetected?: (record: LocalVaultRecord | null) => void;
  /**
   * When non-null, the URL dictates which vault is active and the
   * banner just renders metadata for it. When null (the `/dashboard`
   * no-id entry), the banner falls back to auto-picking the newest
   * owned vault and surfacing a dropdown for switching.
   */
  activeVaultId?: string | null;
}

/**
 * On-chain vault picker. Queries `AgentMintedEvent` against the active
 * Synapse package, filters by the connected wallet, and surfaces every
 * vault the wallet owns — independent of localStorage. When the wallet
 * owns more than one, the user picks which to focus the dashboard on.
 */
export function LiveVaultBanner({
  onVaultDetected,
  activeVaultId,
}: LiveVaultBannerProps) {
  const account = useCurrentAccount();
  const router = useRouter();
  const query = useOwnedVaults();
  const owned = useMemo(() => query.data ?? [], [query.data]);
  const [internalActiveId, setInternalActiveId] = useState<string | null>(null);

  // URL-driven mode (activeVaultId provided) wins. Otherwise fall
  // back to internal-state picker (newest owned vault).
  const activeId = activeVaultId ?? internalActiveId;

  useEffect(() => {
    if (activeVaultId !== undefined && activeVaultId !== null) return; // URL drives, no auto-pick
    if (!owned.length) {
      setInternalActiveId(null);
      return;
    }
    if (internalActiveId && owned.some((v) => v.agentId === internalActiveId)) return;
    setInternalActiveId(owned[0]!.agentId);
  }, [owned, internalActiveId, activeVaultId]);

  // Bridge to the existing `LocalVaultRecord` consumer shape so the
  // downstream dashboard components don't need to change.
  useEffect(() => {
    if (!activeId) {
      onVaultDetected?.(null);
      return;
    }
    const vault = owned.find((v) => v.agentId === activeId);
    if (!vault) {
      onVaultDetected?.(null);
      return;
    }
    onVaultDetected?.(toLocalRecord(vault, account?.address ?? ''));
  }, [activeId, owned, account, onVaultDetected]);

  if (!account) {
    return <DisconnectedBanner />;
  }
  if (query.isLoading) {
    return (
      <BannerShell tone="muted">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          <CodeTag>scanning</CodeTag>
        </span>
        <span className="font-display text-sm text-ink-soft">
          Reading on-chain vaults owned by{' '}
          <span className="font-mono text-[11px]">{shortenHash(account.address)}</span>…
        </span>
      </BannerShell>
    );
  }
  if (!owned.length) {
    return <NoVaultBanner />;
  }

  const active = owned.find((v) => v.agentId === activeId) ?? owned[0]!;

  return (
    <BannerShell tone="live">
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-state-active">
          <CodeTag>live</CodeTag>
        </span>
        <div>
          <p className="font-display text-sm font-semibold text-ink">
            On-chain controls wired to {shortenHash(active.agentId)}
          </p>
          <p className="font-mono text-[11px] text-ink-mute">
            minted {active.mintedAtMs ? timeAgo(active.mintedAtMs) : 'recently'} · session{' '}
            {shortenHash(active.sessionAddr)}
            {active.strategyId
              ? ` · strategy ${shortenHash(active.strategyId)}`
              : ''}{' '}
            · <span className="text-ink">{owned.length} vault{owned.length === 1 ? '' : 's'} owned</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {owned.length > 1 && (
          <label className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            vault
            <select
              value={active.agentId}
              onChange={(e) => {
                // Always navigate via URL — keeps the active vault
                // shareable, bookmarkable, and back-button friendly.
                router.push(`/dashboard/${e.target.value}`);
              }}
              className="rounded-sm border border-divider bg-paper-strong px-2 py-1.5 font-mono text-xs text-ink outline-none focus:border-ink"
            >
              {owned.map((v) => (
                <option key={v.agentId} value={v.agentId}>
                  {shortenHash(v.agentId)} ·{' '}
                  {v.strategyId ? shortenHash(v.strategyId) : 'no strategy'}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-ink/15 bg-paper-strong px-2.5 font-mono text-[11px] text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
          title="Re-query AgentMintedEvent for this wallet"
        >
          <RefreshIcon spinning={query.isFetching} />
          {query.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
        <a
          href={explorerObjectUrl(active.agentId)}
          target="_blank"
          rel="noreferrer"
          className="btn-flat"
          data-variant="ghost"
        >
          View on suiscan ↗
        </a>
      </div>
    </BannerShell>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={spinning ? 'animate-spin' : ''}
    >
      <path
        d="M10.5 2.5v3h-3M1.5 9.5v-3h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 6a3.5 3.5 0 0 1 6-2.5L10.5 5.5M9.5 6a3.5 3.5 0 0 1-6 2.5L1.5 6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function toLocalRecord(vault: OwnedVault, ownerAddress: string): LocalVaultRecord {
  return {
    agentId: vault.agentId,
    ownerAddress,
    digest: vault.mintDigest,
    sessionAddress: vault.sessionAddr,
    memwalAccountId: null,
    mintedAtMs: vault.mintedAtMs,
  };
}

function DisconnectedBanner() {
  return (
    <BannerShell tone="muted">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
        <CodeTag>read-only</CodeTag>
      </span>
      <span className="font-display text-sm text-ink-soft">
        Connect a wallet to discover the vaults you own and enable on-chain controls.
      </span>
    </BannerShell>
  );
}

function NoVaultBanner() {
  return (
    <BannerShell tone="muted">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          <CodeTag>no vaults</CodeTag>
        </span>
        <span className="font-display text-sm text-ink-soft">
          This wallet hasn't minted any vault yet. Mint one to enable revoke + run-tick.
        </span>
      </div>
      <Link href="/mint" className="btn-flat" data-variant="primary">
        Mint a vault →
      </Link>
    </BannerShell>
  );
}

function BannerShell({
  tone,
  children,
}: {
  tone: 'live' | 'muted';
  children: React.ReactNode;
}) {
  const className =
    tone === 'live'
      ? 'flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-ink bg-paper-strong px-5 py-3 shadow-[2px_2px_0_0_var(--ink)]'
      : 'flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-dashed border-ink-mute bg-paper-strong/60 px-5 py-3';
  return <div className={className}>{children}</div>;
}
