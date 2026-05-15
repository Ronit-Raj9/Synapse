'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import type { LiveStrategy } from '@/lib/strategies';
import { DeprecateModal } from './deprecate-modal';
import { VersionModal } from './version-modal';
import { TransferCapModal } from './transfer-modal';

type ActiveModal = 'deprecate' | 'reactivate' | 'version' | 'transfer' | null;

export function StrategyAdminPanel({
  strategy,
  capId,
  onAfterAction,
}: {
  strategy: LiveStrategy;
  capId: string;
  onAfterAction: () => void;
}) {
  const [active, setActive] = useState<ActiveModal>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 grid gap-3 border-t border-divider pt-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
        owner actions
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <ActionCard
          color="var(--accent-blue)"
          label="Publish new version"
          body="Ship updated strategy code. Bumps the on-chain version + replaces the code_hash and Walrus source pointer. Existing vaults keep their current behavior until the runtime re-resolves."
          cta="Version bump"
          onClick={() => setActive('version')}
        />
        {strategy.active ? (
          <ActionCard
            color="var(--accent-orange)"
            label="Deprecate strategy"
            body="Marks the strategy inactive. New vaults can no longer adopt it; existing vaults keep running. Reversible — you can reactivate it any time."
            cta="Deprecate"
            onClick={() => setActive('deprecate')}
            danger
          />
        ) : (
          <ActionCard
            color="var(--accent-green)"
            label="Reactivate strategy"
            body="Re-enables this strategy in the marketplace. Vaults can adopt it again, all counters resume as before."
            cta="Reactivate"
            onClick={() => setActive('reactivate')}
          />
        )}
        <ActionCard
          color="var(--accent-purple)"
          label="Transfer / sell capability"
          body="Hand off the StrategistCap to another Sui address. The new holder gains full governance over this strategy. Once transferred, you cannot recover it without their cooperation."
          cta="Transfer cap"
          onClick={() => setActive('transfer')}
          danger
        />
      </div>

      {active === 'deprecate' && (
        <DeprecateModal
          mode="deprecate"
          strategy={strategy}
          capId={capId}
          onClose={() => setActive(null)}
          onSuccess={() => {
            setActive(null);
            onAfterAction();
          }}
        />
      )}
      {active === 'reactivate' && (
        <DeprecateModal
          mode="reactivate"
          strategy={strategy}
          capId={capId}
          onClose={() => setActive(null)}
          onSuccess={() => {
            setActive(null);
            onAfterAction();
          }}
        />
      )}
      {active === 'version' && (
        <VersionModal
          strategy={strategy}
          capId={capId}
          onClose={() => setActive(null)}
          onSuccess={() => {
            setActive(null);
            onAfterAction();
          }}
        />
      )}
      {active === 'transfer' && (
        <TransferCapModal
          strategy={strategy}
          capId={capId}
          onClose={() => setActive(null)}
          onSuccess={() => {
            setActive(null);
            onAfterAction();
          }}
        />
      )}
    </motion.div>
  );
}

function ActionCard({
  color,
  label,
  body,
  cta,
  onClick,
  danger = false,
}: {
  color: string;
  label: string;
  body: string;
  cta: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border border-divider bg-paper p-4">
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <p className="font-display text-sm font-semibold">{label}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{body}</p>
      <button
        type="button"
        onClick={onClick}
        className="btn-flat mt-4"
        data-variant={danger ? 'danger' : 'primary'}
      >
        {cta}
      </button>
    </div>
  );
}
