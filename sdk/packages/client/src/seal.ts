/**
 * Seal encryption wrapper for sensitive artifacts.
 *
 * Use this BEFORE uploading to Walrus when the payload contains private
 * information. The encrypted bytes go into Walrus; decryption requires the
 * agent's session key plus a Seal `seal_approve*` PTB.
 *
 * Reference: https://seal-docs.wal.app/
 */

import type { SealClientOptions, EncryptOptions, DecryptOptions } from '@mysten/seal';
import { SealClient, SessionKey } from '@mysten/seal';

export interface SealEncryptArgs {
  /** Bytes to encrypt. */
  payload: Uint8Array;
  /** Synapse Core package ID (provides the seal_approve namespace). */
  packageId: string;
  /** Identity bytes that gate access — typically agent_id or namespace. */
  id: string;
  /** TSS threshold (number of key servers required). Default 2. */
  threshold?: number;
}

export interface SealDecryptArgs {
  /** Encrypted bytes (the EncryptedObject blob). */
  encrypted: Uint8Array;
  /** Session key established via SessionKey.create(...). */
  sessionKey: SessionKey;
  /** Encoded PTB bytes calling `seal_approve*` for this identity. */
  txBytes: Uint8Array;
}

/** Create a SealClient. Reuse one per process. */
export function createSealClient(options: SealClientOptions): SealClient {
  return new SealClient(options);
}

/** Convenience encrypt using sensible defaults. */
export async function sealEncrypt(
  client: SealClient,
  args: SealEncryptArgs,
): Promise<Uint8Array> {
  const opts: EncryptOptions = {
    threshold: args.threshold ?? 2,
    packageId: args.packageId,
    id: args.id,
    data: args.payload,
  };
  const result = await client.encrypt(opts);
  return result.encryptedObject;
}

export async function sealDecrypt(
  client: SealClient,
  args: SealDecryptArgs,
): Promise<Uint8Array> {
  const opts: DecryptOptions = {
    data: args.encrypted,
    sessionKey: args.sessionKey,
    txBytes: args.txBytes,
  };
  return client.decrypt(opts);
}

export { SessionKey as SealSessionKey };
