/**
 * Walrus direct-blob client wrapper.
 *
 * Provides a thin convenience layer over `@mysten/walrus`'s `WalrusClient` so
 * the rest of Synapse only has to think about "upload a payload, get a blob
 * ID + SHA256". For Seal-encrypted artifacts, encrypt the payload BEFORE
 * calling `uploadBlob`.
 *
 * Reference: https://docs.wal.app/docs/
 */

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import type { Signer } from '@mysten/sui/cryptography';
import { sha256 } from '@noble/hashes/sha2.js';
import { WalrusClient } from '@mysten/walrus';

export interface WalrusUploadResult {
  /** Walrus blob ID (used to read the blob back via aggregator). */
  blobId: string;
  /** SHA256 hash of the uploaded payload (32 bytes). */
  sha256: Uint8Array;
  /** Size of the payload in bytes. */
  sizeBytes: number;
  /** On-chain Blob object ID (for governance / extension / deletion). */
  blobObjectId: string;
  /** Epoch at which the blob was registered. */
  registeredEpoch: number;
}

export interface WalrusClientWrapperOptions {
  network: 'mainnet' | 'testnet';
  suiClient: SuiJsonRpcClient;
  /** WASM URL override (only needed in restrictive runtimes). */
  wasmUrl?: string;
}

/**
 * Construct a Walrus client bound to a Sui RPC client. Reuse one instance per
 * process — internal caches benefit from continuity.
 */
export function createWalrusClient(opts: WalrusClientWrapperOptions): WalrusClient {
  return new WalrusClient({
    network: opts.network,
    suiClient: opts.suiClient,
    ...(opts.wasmUrl ? { wasmUrl: opts.wasmUrl } : {}),
  });
}

/**
 * Upload a raw payload to Walrus and return everything Synapse needs to
 * register an `ArtifactRef` on-chain.
 *
 * @param walrus      A `WalrusClient` (typically from `createWalrusClient`).
 * @param signer      The Sui signer that will own the Blob object (usually
 *                    the agent's session keypair).
 * @param payload     The bytes to upload. Encrypt with Seal first if private.
 * @param epochs      How many Walrus epochs to keep the blob alive for.
 * @param deletable   If true, the blob may be deleted by its owner before
 *                    epoch expiry.
 * @param attributes  Optional Walrus attributes attached at registration.
 */
export async function uploadBlob(args: {
  walrus: WalrusClient;
  signer: Signer;
  payload: Uint8Array;
  epochs: number;
  deletable: boolean;
  attributes?: Record<string, string | null>;
  signal?: AbortSignal;
}): Promise<WalrusUploadResult> {
  const { walrus, signer, payload, epochs, deletable, attributes, signal } = args;
  const digest = sha256(payload);

  const result = await walrus.writeBlob({
    blob: payload,
    deletable,
    epochs,
    signer,
    ...(attributes ? { attributes } : {}),
    ...(signal ? { signal } : {}),
  });

  return {
    blobId: result.blobId,
    sha256: digest,
    sizeBytes: payload.byteLength,
    blobObjectId: result.blobObject.id,
    registeredEpoch: result.blobObject.registered_epoch,
  };
}

/**
 * Read a blob payload back from Walrus by blob ID. Verifies the SHA256 if a
 * digest is supplied.
 */
export async function fetchBlob(args: {
  walrus: WalrusClient;
  blobId: string;
  expectedSha256?: Uint8Array;
  signal?: AbortSignal;
}): Promise<Uint8Array> {
  const { walrus, blobId, expectedSha256, signal } = args;
  const payload = await walrus.readBlob({ blobId, ...(signal ? { signal } : {}) });
  if (expectedSha256) {
    const actual = sha256(payload);
    if (!constantTimeEquals(actual, expectedSha256)) {
      throw new Error(`Walrus blob ${blobId}: SHA256 mismatch after fetch`);
    }
  }
  return payload;
}

/**
 * Constant-time byte comparison. Resistant to timing attacks when comparing
 * cryptographic hashes.
 */
function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}
