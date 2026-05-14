'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { CodeTag } from '../ui/code-tag';
import { latestVaultFor, type LocalVaultRecord } from '@/lib/local-vaults';
import { explorerObjectUrl } from '@/lib/synapse-config';
import { shortenHash, timeAgo } from '@/lib/format';

interface LiveVaultBannerProps {
  /**
   * Callback so the parent dashboard can wire the real vault ID into
   * child components (Danger Zone, audit timeline filter, etc.).
   */
  onVaultDetected?: (record: LocalVaultRecord | null) => void;
}

/**
 * Detects the connected wallet's most recently minted vault from local
 * storage and surfaces a banner above the demo dashboard. When found, the
 * dashboard wires real on-chain controls; when absent, the dashboard
 * remains read-only sample data with a clear "mint a vault to interact"
 * call-to-action.
 */
export function LiveVaultBanner({ onVaultDetected }: LiveVaultBannerProps) {
  const account = useCurrentAccount();
  const [vault, setVault] = useState<LocalVaultRecord | null>(null);

  useEffect(() => {
    const next = account ? latestVaultFor(account.address) : null;
    setVault(next);
    onVaultDetected?.(next);
  }, [account, onVaultDetected]);

  if (!account) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-dashed border-ink-mute bg-paper-strong/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            <CodeTag>read-only</CodeTag>
          </span>
          <span className="font-display text-sm text-ink-soft">
            Connect a wallet to enable on-chain controls. Demo data shown below.
          </span>
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-dashed border-ink-mute bg-paper-strong/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            <CodeTag>no live vault</CodeTag>
          </span>
          <span className="font-display text-sm text-ink-soft">
            Mint your first vault to enable revoke and other on-chain actions.
          </span>
        </div>
        <Link href="/mint" className="btn-flat" data-variant="primary">
          Mint a vault →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-ink bg-paper-strong px-5 py-3 shadow-[2px_2px_0_0_var(--ink)]">
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-state-active">
          <CodeTag>live</CodeTag>
        </span>
        <div>
          <p className="font-display text-sm font-semibold text-ink">
            On-chain controls wired to {shortenHash(vault.agentId)}
          </p>
          <p className="font-mono text-[11px] text-ink-mute">
            minted {timeAgo(vault.mintedAtMs)} · session{' '}
            {shortenHash(vault.sessionAddress)}
          </p>
        </div>
      </div>
      <a
        href={explorerObjectUrl(vault.agentId)}
        target="_blank"
        rel="noreferrer"
        className="btn-flat"
        data-variant="ghost"
      >
        View on suiscan ↗
      </a>
    </div>
  );
}
