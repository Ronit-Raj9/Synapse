import { Transaction } from '@mysten/sui/transactions';
import type { SuiJsonRpcClient, SuiTransactionBlockResponse } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  createWalrusClient,
  publishArtifactCall,
  uploadBlob,
  type WalrusUploadResult,
} from '@synapse-core/client';
import type { AuditReport } from '../types.js';

export interface PublishReportArgs {
  suiClient: SuiJsonRpcClient;
  walrusNetwork: 'testnet' | 'mainnet';
  signer: Ed25519Keypair;
  packageId: string;
  agentId: string;
  report: AuditReport;
  epochs: number;
}

export interface PublishReportResult {
  walrusBlobId: string;
  walrusObjectId: string;
  artifactSlot: bigint;
  txDigest: string;
}

export async function uploadReportBlob(args: {
  suiClient: SuiJsonRpcClient;
  walrusNetwork: 'testnet' | 'mainnet';
  signer: Ed25519Keypair;
  report: AuditReport;
  epochs: number;
}): Promise<WalrusUploadResult> {
  const walrus = createWalrusClient({ network: args.walrusNetwork, suiClient: args.suiClient });
  return uploadBlob({
    walrus,
    signer: args.signer,
    payload: new TextEncoder().encode(args.report.markdown),
    epochs: args.epochs,
    deletable: false,
    attributes: {
      'synapse.report.plan_id': args.report.planId,
      'synapse.report.strategy_id': args.report.strategyId,
      'synapse.report.vault_id': args.report.vaultId,
    },
  });
}

export async function publishReport(args: PublishReportArgs): Promise<PublishReportResult> {
  const upload = await uploadReportBlob(args);
  const tx = new Transaction();
  publishArtifactCall(tx, args.packageId, {
    agentId: args.agentId,
    walrusBlobId: new TextEncoder().encode(upload.blobId),
    sha256: upload.sha256,
    mimeType: 'text/markdown',
    sizeBytes: BigInt(upload.sizeBytes),
    sealEncrypted: false,
    label: `audit-${args.report.planId}`,
  });

  const result = await args.suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: args.signer,
    options: { showEvents: true, showEffects: true },
  });
  await args.suiClient.waitForTransaction({ digest: result.digest });
  return {
    walrusBlobId: upload.blobId,
    walrusObjectId: upload.blobObjectId,
    artifactSlot: parseArtifactSlot(result),
    txDigest: result.digest,
  };
}

export function parseArtifactSlot(tx: SuiTransactionBlockResponse): bigint {
  for (const event of tx.events ?? []) {
    if (!event.type.includes('::artifacts::ArtifactPublishedEvent')) continue;
    const parsed = event.parsedJson;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) continue;
    const slot = (parsed as Record<string, unknown>).artifact_slot;
    if (typeof slot === 'string' || typeof slot === 'number') return BigInt(slot);
  }
  throw new Error(`Transaction ${tx.digest}: ArtifactPublishedEvent not found`);
}
