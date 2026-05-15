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

export function VersionModal({
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
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const toast = useToast();
  const [newSource, setNewSource] = useState('');
  const [newWalrusBlob, setNewWalrusBlob] = useState(strategy.sourceWalrusBlob);
  const [newCodeHashHex, setNewCodeHashHex] = useState('');
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    /^0x[0-9a-fA-F]{64}$/.test(newCodeHashHex.trim()) &&
    newWalrusBlob.trim().length > 0;

  async function deriveHash() {
    if (!newSource.trim()) {
      toast.push({
        variant: 'warn',
        title: 'Paste source first',
        body: 'Paste the canonical bundle bytes to derive a sha256 commitment.',
      });
      return;
    }
    const bytes = new TextEncoder().encode(newSource);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex =
      '0x' +
      Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    setNewCodeHashHex(hex);
  }

  async function submit() {
    setError(null);
    if (!canSubmit) {
      setError('code_hash must be 0x + 64 hex chars; Walrus blob is required.');
      return;
    }
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: synapseTarget('strategy_registry', 'publish_new_version'),
        arguments: [
          tx.object(strategy.id),
          tx.object(capId),
          tx.pure.vector('u8', Array.from(hexToBytes(newCodeHashHex.trim()))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(newWalrusBlob.trim()))),
        ],
      });
      const signed = await signAndExecute({ transaction: tx });
      await suiClient.waitForTransaction({ digest: signed.digest, timeout: 30_000 });
      setDigest(signed.digest);
      toast.push({
        variant: 'success',
        title: `Strategy bumped to v${(strategy.version + 1n).toString()}`,
        body: `tx ${shortenHash(signed.digest)}`,
        durationMs: 6000,
      });
      setTimeout(onSuccess, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={digest ? `Strategy is now v${(strategy.version + 1n).toString()}` : 'Publish new version'}
      accent="var(--accent-blue)"
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
              data-variant="primary"
              onClick={submit}
              disabled={!canSubmit || isPending}
            >
              {isPending ? 'Signing…' : `Publish v${(strategy.version + 1n).toString()}`}
            </button>
          </>
        )
      }
    >
      {digest ? (
        <div className="space-y-3 text-sm">
          <p className="text-ink-soft">
            The new code_hash and Walrus pointer are now the canonical commitment for this strategy.
            Runtimes pulling the latest version will pick up the new bundle on their next tick.
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
            Bumps the on-chain version from{' '}
            <span className="font-mono">v{strategy.version.toString()}</span> to{' '}
            <span className="font-mono">v{(strategy.version + 1n).toString()}</span>. Existing
            vaults keep their current behavior until the operator's runtime opts into the new
            bundle.
          </p>
          <Field
            label="Canonical bundle text"
            hint="Paste your strategy source / manifest. Used to derive sha256 below."
          >
            <textarea
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              rows={4}
              placeholder="// canonical bundle bytes — typically a manifest JSON…"
              className="w-full resize-y rounded-sm border border-divider bg-paper-strong px-3 py-2 font-mono text-[11px] outline-none focus:border-ink"
            />
            <button
              type="button"
              className="btn-flat mt-2"
              data-variant="ghost"
              onClick={deriveHash}
            >
              Derive sha256
            </button>
          </Field>
          <Field
            label="New code_hash (sha256, 32 bytes hex)"
            hint="Auto-fills after Derive sha256. Edit if you computed it elsewhere."
          >
            <input
              type="text"
              value={newCodeHashHex}
              onChange={(e) => setNewCodeHashHex(e.target.value)}
              placeholder="0x…"
              maxLength={66}
              className="w-full rounded-sm border border-divider bg-paper-strong px-3 py-2 font-mono text-[11px] outline-none focus:border-ink"
            />
          </Field>
          <Field
            label="New Walrus blob ID"
            hint="Upload the bundle to Walrus, paste the returned blob ID here."
          >
            <input
              type="text"
              value={newWalrusBlob}
              onChange={(e) => setNewWalrusBlob(e.target.value)}
              placeholder="-bQnLAEmESM3z88M…"
              className="w-full rounded-sm border border-divider bg-paper-strong px-3 py-2 font-mono text-[11px] outline-none focus:border-ink"
            />
          </Field>
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="font-display text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="font-mono text-[10px] text-ink-mute">{hint}</span>}
    </label>
  );
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('Hex string must have even length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
