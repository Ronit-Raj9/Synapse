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
import {
  StrategyBundlerPanel,
  type BundlerCallbackArgs,
} from '../marketplace/strategy-bundler-panel';

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
  const [newWalrusBlob, setNewWalrusBlob] = useState('');
  const [newCodeHashHex, setNewCodeHashHex] = useState('');
  const [bundleSizeBytes, setBundleSizeBytes] = useState<number | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    /^0x[0-9a-fA-F]{64}$/.test(newCodeHashHex.trim()) &&
    newWalrusBlob.trim().length > 0 &&
    newCodeHashHex.trim().slice(2) !== strategy.codeHashHex.toLowerCase().replace(/^0x/, '');

  function onBundled(result: BundlerCallbackArgs) {
    setNewWalrusBlob(result.walrusBlobId);
    setNewCodeHashHex(result.codeHashHex);
    setBundleSizeBytes(result.sizeBytes);
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
      size="xl"
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
            <span className="font-mono">v{(strategy.version + 1n).toString()}</span>. Same on-chain
            Strategy ID, new <code className="font-mono text-[11px]">code_hash</code> + Walrus
            pointer. Vaults hiring this strategy pick up the new bundle on their next runtime tick.
          </p>
          <StrategyBundlerPanel onBundled={onBundled} disabled={isPending} />
          {bundleSizeBytes !== null && (
            <dl className="grid gap-1.5 rounded-sm border border-divider bg-paper p-3 text-[11px]">
              <Row label="New Walrus blob" value={shortenHash(newWalrusBlob)} />
              <Row
                label="New code_hash"
                value={`${newCodeHashHex.slice(0, 12)}…${newCodeHashHex.slice(-6)}`}
              />
              <Row label="Bundle size" value={`${bundleSizeBytes} bytes`} />
              <Row
                label="Differs from current"
                value={
                  newCodeHashHex.trim().slice(2) ===
                  strategy.codeHashHex.toLowerCase().replace(/^0x/, '')
                    ? '⚠ same as v' + strategy.version.toString() + ' — change something first'
                    : '✓ yes — safe to bump'
                }
              />
            </dl>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-divider/50 pb-1 last:border-0">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
        {label}
      </span>
      <span className="num font-mono text-[10px] text-ink">{value}</span>
    </div>
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
