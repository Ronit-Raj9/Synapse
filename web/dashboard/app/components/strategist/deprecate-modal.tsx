'use client';

import { useState } from 'react';
import {
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Modal } from '../ui/modal';
import { useToast } from '../ui/toast';
import { synapseTarget, explorerTxUrl } from '@/lib/synapse-config';
import { shortenHash } from '@/lib/format';
import type { LiveStrategy } from '@/lib/strategies';

export function DeprecateModal({
  mode,
  strategy,
  capId,
  onClose,
  onSuccess,
}: {
  mode: 'deprecate' | 'reactivate';
  strategy: LiveStrategy;
  capId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const toast = useToast();
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fn = mode === 'deprecate' ? 'deprecate' : 'reactivate';
  const title = mode === 'deprecate' ? 'Deprecate strategy' : 'Reactivate strategy';

  async function submit() {
    setError(null);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: synapseTarget('strategy_registry', fn),
        arguments: [tx.object(strategy.id), tx.object(capId)],
      });
      const signed = await signAndExecute({ transaction: tx });
      await suiClient.waitForTransaction({ digest: signed.digest, timeout: 30_000 });
      setDigest(signed.digest);
      toast.push({
        variant: mode === 'deprecate' ? 'danger' : 'success',
        title:
          mode === 'deprecate'
            ? 'Strategy deprecated on-chain'
            : 'Strategy reactivated on-chain',
        body: `tx ${shortenHash(signed.digest)}`,
        durationMs: 6000,
      });
      setTimeout(onSuccess, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={digest ? 'Done' : title}
      accent={mode === 'deprecate' ? 'var(--accent-orange)' : 'var(--accent-green)'}
      footer={
        digest ? (
          <button type="button" className="btn-flat" data-variant="primary" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-flat"
              data-variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-flat"
              data-variant={mode === 'deprecate' ? 'danger' : 'primary'}
              onClick={submit}
              disabled={isPending}
            >
              {isPending ? 'Awaiting wallet…' : mode === 'deprecate' ? 'Deprecate now' : 'Reactivate now'}
            </button>
          </>
        )
      }
    >
      {digest ? (
        <div className="space-y-3 text-sm">
          <p className="text-ink-soft">
            {mode === 'deprecate'
              ? 'The strategy is now marked inactive. The marketplace will hide it under the default Active filter.'
              : 'The strategy is back in circulation — vault owners can hire it again.'}
          </p>
          <a
            href={explorerTxUrl(digest)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-accent-blue underline"
          >
            tx {shortenHash(digest)} ↗
          </a>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-ink-soft">
            You're about to call{' '}
            <code className="font-mono text-[11px]">
              strategy_registry::{fn}
            </code>{' '}
            on <span className="font-mono text-[11px]">{shortenHash(strategy.id)}</span>. The
            Move VM verifies your StrategistCap and rejects any other caller.
          </p>
          {mode === 'deprecate' && Number(strategy.activeVaultCount) > 0 && (
            <p className="rounded-sm border-l-2 border-accent-orange bg-paper p-3 font-mono text-[11px] text-ink-soft">
              <span className="text-accent-orange">!</span>{' '}
              {strategy.activeVaultCount.toString()} vault
              {strategy.activeVaultCount === 1n ? '' : 's'} currently hire{' '}
              {strategy.activeVaultCount === 1n ? 's' : ''} this strategy. They will keep running
              their current version; only new adoptions are blocked.
            </p>
          )}
          {error && (
            <pre className="overflow-x-auto rounded-sm border border-divider bg-paper p-3 font-mono text-[10px] text-ink-soft">
              {error}
            </pre>
          )}
        </div>
      )}
    </Modal>
  );
}
