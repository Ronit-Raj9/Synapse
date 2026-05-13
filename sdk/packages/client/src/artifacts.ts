/**
 * PTB builders for `synapse_core::artifacts` + end-to-end publish helper that
 * combines a Walrus upload with the on-chain `publish` call.
 *
 * Reference Move source: `move/synapse_core/sources/artifacts.move`.
 */

import type { Transaction, TransactionResult } from '@mysten/sui/transactions';
import type { Signer } from '@mysten/sui/cryptography';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

import { target } from './config.js';
import { createWalrusClient, uploadBlob, type WalrusUploadResult } from './walrus.js';

// ---------------------------------------------------------------------------
// Pure PTB calls
// ---------------------------------------------------------------------------

export interface PublishArtifactCallArgs {
  agentId: string;
  walrusBlobId: Uint8Array;
  sha256: Uint8Array;
  mimeType: string;
  sizeBytes: bigint;
  sealEncrypted: boolean;
  label: string;
}

/**
 * Append `synapse_core::artifacts::publish(...)` to `tx`. Returns the artifact
 * slot ID as a `TransactionResult` (a `u64`).
 */
export function publishArtifactCall(
  tx: Transaction,
  packageId: string,
  args: PublishArtifactCallArgs,
): TransactionResult {
  return tx.moveCall({
    target: target(packageId, 'artifacts', 'publish'),
    arguments: [
      tx.object(args.agentId),
      tx.pure.vector('u8', Array.from(args.walrusBlobId)),
      tx.pure.vector('u8', Array.from(args.sha256)),
      tx.pure.string(args.mimeType),
      tx.pure.u64(args.sizeBytes),
      tx.pure.bool(args.sealEncrypted),
      tx.pure.string(args.label),
    ],
  });
}

export function burnArtifactCall(
  tx: Transaction,
  packageId: string,
  args: { agentId: string; slot: bigint },
): TransactionResult {
  return tx.moveCall({
    target: target(packageId, 'artifacts', 'burn'),
    arguments: [tx.object(args.agentId), tx.pure.u64(args.slot)],
  });
}

// ---------------------------------------------------------------------------
// End-to-end publish (Walrus upload + on-chain register)
// ---------------------------------------------------------------------------

export interface PublishArtifactArgs {
  /** Configured Sui RPC client. */
  suiClient: SuiJsonRpcClient;
  /** Network this artifact is bound to. */
  network: 'mainnet' | 'testnet';
  /** Signer (typically the agent's session keypair). */
  signer: Signer;
  /** Synapse `synapse_core` package ID. */
  packageId: string;
  /** Target AgentIdentity object ID. */
  agentId: string;
  /** Raw bytes to upload (encrypt with Seal first if private). */
  payload: Uint8Array;
  /** Walrus storage epochs. */
  walrusEpochs: number;
  /** Whether the Walrus blob is deletable by its owner. */
  deletable: boolean;
  /** MIME type (e.g., 'text/markdown'). */
  mimeType: string;
  /** Whether `payload` is Seal-encrypted. */
  sealEncrypted: boolean;
  /** Human-readable label for dashboards. */
  label: string;
  /** Optional Walrus attributes. */
  walrusAttributes?: Record<string, string | null>;
  signal?: AbortSignal;
}

export interface PublishArtifactResult {
  walrus: WalrusUploadResult;
  /** The Sui transaction digest of the on-chain publish PTB. */
  txDigest: string;
}

/**
 * End-to-end: upload to Walrus → submit a PTB that calls `artifacts::publish`
 * to record the on-chain pointer. Two transactions under the hood (Walrus
 * Sui transactions handle their own signing); they share the same signer.
 *
 * Note: this helper builds and submits the publish PTB itself. If the caller
 * wants to bundle `publish` with other Synapse operations in a single PTB,
 * use `uploadBlob` + `publishArtifactCall` separately.
 */
export async function publishArtifact(
  args: PublishArtifactArgs,
): Promise<PublishArtifactResult> {
  const {
    suiClient,
    network,
    signer,
    packageId,
    agentId,
    payload,
    walrusEpochs,
    deletable,
    mimeType,
    sealEncrypted,
    label,
    walrusAttributes,
    signal,
  } = args;

  const walrus = createWalrusClient({ network, suiClient });
  const upload = await uploadBlob({
    walrus,
    signer,
    payload,
    epochs: walrusEpochs,
    deletable,
    ...(walrusAttributes ? { attributes: walrusAttributes } : {}),
    ...(signal ? { signal } : {}),
  });

  const { Transaction } = await import('@mysten/sui/transactions');
  const tx = new Transaction();
  publishArtifactCall(tx, packageId, {
    agentId,
    walrusBlobId: new TextEncoder().encode(upload.blobId),
    sha256: upload.sha256,
    mimeType,
    sizeBytes: BigInt(upload.sizeBytes),
    sealEncrypted,
    label,
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
  });

  return { walrus: upload, txDigest: result.digest };
}
