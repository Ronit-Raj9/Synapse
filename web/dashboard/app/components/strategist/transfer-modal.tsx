'use client';

import { useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Modal } from '../ui/modal';
import { useToast } from '../ui/toast';
import { explorerTxUrl, explorerAddressUrl } from '@/lib/synapse-config';
import { shortenAddress, shortenHash } from '@/lib/format';
import type { LiveStrategy } from '@/lib/strategies';

export function TransferCapModal({
  strategy,
  capId,
  onClose,
  onSuccess,
}: {
  strategy: LiveStrategy;
  capId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const toast = useToast();
  const [recipient, setRecipient] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = /^0x[0-9a-fA-F]{1,64}$/.test(recipient.trim()) && acknowledged;
  const self = account?.address === recipient.trim();

  async function submit() {
    setError(null);
    if (!valid) {
      setError('Recipient must be a 0x-prefixed Sui address.');
      return;
    }
    if (self) {
      setError('Recipient is your own address — nothing to do.');
      return;
    }
    try {
      const tx = new Transaction();
      tx.transferObjects([tx.object(capId)], tx.pure.address(recipient.trim()));
      const signed = await signAndExecute({ transaction: tx });
      await suiClient.waitForTransaction({ digest: signed.digest, timeout: 30_000 });
      setDigest(signed.digest);
      toast.push({
        variant: 'success',
        title: 'Capability transferred',
        body: `Cap now owned by ${shortenAddress(recipient.trim())}`,
        durationMs: 7000,
      });
      setTimeout(onSuccess, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={digest ? 'Capability transferred' : 'Transfer strategist capability'}
      accent="var(--accent-purple)"
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
              data-variant="danger"
              onClick={submit}
              disabled={!valid || isPending || self}
            >
              {isPending ? 'Signing…' : 'Transfer now'}
            </button>
          </>
        )
      }
    >
      {digest ? (
        <div className="space-y-3 text-sm">
          <p className="text-ink-soft">
            The StrategistCap for{' '}
            <span className="font-mono text-[11px]">{shortenHash(strategy.id)}</span> is now
            owned by{' '}
            <a
              href={explorerAddressUrl(recipient.trim())}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-accent-blue underline"
            >
              {shortenAddress(recipient.trim())}
            </a>
            . You no longer control this strategy.
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
        <div className="space-y-4 text-sm">
          <p className="text-ink-soft">
            Transfers ownership of <span className="font-mono">{shortenHash(capId)}</span> to
            another Sui address. The new owner gains the right to publish new versions,
            deprecate, reactivate, or transfer it again. There is no protocol-level reversal.
          </p>
          <label className="grid gap-1.5">
            <span className="font-display text-sm font-semibold">Recipient address</span>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x…"
              className="w-full rounded-sm border border-divider bg-paper-strong px-3 py-2 font-mono text-[11px] outline-none focus:border-ink"
            />
            <span className="font-mono text-[10px] text-ink-mute">
              Double-check this address. Once the transaction lands, the new owner has full
              governance.
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 accent-ink"
            />
            <span>
              I understand this transfer is irreversible. After it lands, only the new
              cap-holder can deprecate, version-bump, or further transfer this strategy.
            </span>
          </label>
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
