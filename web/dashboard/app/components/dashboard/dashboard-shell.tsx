'use client';

import { useState } from 'react';
import { VaultCard } from './vault-card';
import { HoldingsPanel } from './holdings-panel';
import { AuditTimeline } from './audit-timeline';
import { DangerZone } from './danger-zone';
import { DashboardToolbar } from './dashboard-toolbar';
import { LiveVaultBanner } from './live-vault-banner';
import { CodeTag } from '../ui/code-tag';
import {
  SAMPLE_REBALANCE_HISTORY,
  SAMPLE_TIMELINE,
  SAMPLE_VAULT,
} from '@/lib/sample-data';
import { formatUsd, shortenAddress, timeAgo } from '@/lib/format';
import type { LocalVaultRecord } from '@/lib/local-vaults';

/**
 * Top-level dashboard client island. Shares the detected live-vault state
 * with the Danger Zone (real `vaultId` enables on-chain revoke) and surfaces
 * a banner so the demo data is honest about its read-only nature.
 */
export function DashboardShell() {
  const [liveVault, setLiveVault] = useState<LocalVaultRecord | null>(null);
  const vault = SAMPLE_VAULT;
  const aumFeeAccruedToday = (vault.navUsd * vault.managementFeeBps) / 10_000 / 365;

  return (
    <>
      <DashboardToolbar />
      <div className="mt-5">
        <LiveVaultBanner onVaultDetected={setLiveVault} />
      </div>

      <div className="mt-6">
        <VaultCard vault={vault} history={SAMPLE_REBALANCE_HISTORY} />
      </div>

      <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MicroCard
          label="Fees accrued today"
          value={formatUsd(aumFeeAccruedToday)}
          accent="var(--accent-green)"
        />
        <MicroCard label="Walrus artifacts" value="73" accent="var(--accent-purple)" />
        <MicroCard label="Messages exchanged" value="142" accent="var(--accent-blue)" />
        <MicroCard label="Strategy revs" value="1.0.0" accent="var(--accent-yellow)" />
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[1.05fr_1fr]">
        <AuditTimeline
          sampleEntries={SAMPLE_TIMELINE}
          {...(liveVault ? { liveVaultId: liveVault.agentId } : {})}
        />
        <div className="flex flex-col gap-8">
          <HoldingsPanel vault={vault} />
          <PolicyPanel />
          <DangerZone {...(liveVault ? { vaultId: liveVault.agentId } : {})} />
        </div>
      </div>
    </>
  );
}

function MicroCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="card-flat group relative overflow-hidden p-4">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">{label}</p>
      <p className="num-display mt-2 text-2xl">{value}</p>
    </div>
  );
}

function PolicyPanel() {
  return (
    <div className="card-flat p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-2xl font-bold">Policy bounds</h3>
        <CodeTag>enforced on-chain</CodeTag>
      </div>
      <dl className="grid gap-4">
        <PolicyRow
          label="Spend cap"
          value="5%/epoch · ≈ $62,379"
          hint="Per-epoch outflow cap, enforced by wallet::spend"
          accent="var(--accent-blue)"
        />
        <PolicyRow
          label="Allowlisted contracts"
          value="DeepBookV3 SUI/USDC pool"
          hint="Single approved counterparty package"
          accent="var(--accent-green)"
        />
        <PolicyRow
          label="Expiry"
          value="63 epochs remaining"
          hint="Automatic kill at epoch 2148"
          accent="var(--accent-yellow)"
        />
        <PolicyRow
          label="Session key"
          value={shortenAddress(SAMPLE_VAULT.sessionAddr)}
          hint={`Active ${timeAgo(SAMPLE_VAULT.inceptionTs)} · rotatable`}
          accent="var(--accent-purple)"
        />
      </dl>
    </div>
  );
}

function PolicyRow({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-divider pb-3 last:border-0 last:pb-0">
      <span
        className="mt-1 h-2.5 w-2.5 rounded-sm border border-ink"
        style={{ backgroundColor: accent }}
      />
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-sm font-semibold">{label}</span>
          <span className="num text-right text-sm">{value}</span>
        </div>
        <p className="mt-0.5 font-mono text-[10px] text-ink-mute">{hint}</p>
      </div>
    </div>
  );
}
