/**
 * zkLogin parent identity flow.
 *
 * Synapse uses zkLogin to anchor an `AgentIdentity` to a human Google/Apple
 * account without ever holding a seed phrase. The parent identity (zkLogin)
 * is the only address authorized to mint, revoke, or govern its agents.
 *
 * Reference: https://docs.sui.io/guides/developer/cryptography/zklogin
 *
 * Flow (frontend):
 *   1. Generate ephemeral keypair (Ed25519).
 *   2. Build a randomness + nonce using `generateNonce`.
 *   3. Redirect user to OAuth provider with nonce in `nonce` param.
 *   4. Receive JWT back via redirect.
 *   5. Get a user salt (from your salt-service or generate locally).
 *   6. Derive the user's Sui address via `jwtToAddress(jwt, salt)`.
 *   7. Request a zk proof from a prover service.
 *   8. Sign transactions with the ephemeral key + `getZkLoginSignature(proof, ...)`.
 *
 * This module exposes type-safe helpers wrapping the underlying `@mysten/sui/zklogin`
 * primitives so callers don't need to know the exact function names.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  computeZkLoginAddressFromSeed,
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  jwtToAddress,
  type ZkLoginSignatureInputs,
} from '@mysten/sui/zklogin';

/**
 * Inputs the OAuth flow needs to seed a nonce. The redirect URL routes the
 * JWT back to your frontend.
 */
export interface ZkLoginNonceContext {
  /** Ephemeral keypair generated client-side; held until the JWT returns. */
  ephemeralKeypair: Ed25519Keypair;
  /** Epoch the ephemeral key remains valid through (e.g., current + 2). */
  maxEpoch: bigint;
  /** Randomness committed inside the nonce. */
  randomness: string;
  /** The OAuth `nonce` parameter to forward to the provider. */
  nonce: string;
}

/**
 * Step 1+2 — generate a fresh ephemeral keypair and the OAuth nonce.
 */
export function createZkLoginNonceContext(maxEpoch: bigint): ZkLoginNonceContext {
  const ephemeralKeypair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const nonce = generateNonce(ephemeralKeypair.getPublicKey(), Number(maxEpoch), randomness);
  return { ephemeralKeypair, maxEpoch, randomness, nonce };
}

/**
 * Step 5+6 — derive the user's Sui address from the JWT and user salt.
 *
 * `legacyAddress` should be `false` for any address minted after the zkLogin
 * cryptography upgrade (mid-2024). Only set to `true` to recover legacy
 * pre-upgrade addresses.
 */
export function deriveZkLoginAddress(
  jwt: string,
  userSalt: string | bigint,
  legacyAddress = false,
): string {
  return jwtToAddress(jwt, userSalt, legacyAddress);
}

/**
 * Step 7 — extended ephemeral public key used as input to the prover service.
 */
export function extendedEphemeralPublicKey(keypair: Ed25519Keypair): string {
  return getExtendedEphemeralPublicKey(keypair.getPublicKey());
}

/**
 * Step 8 — assemble the zkLogin signature for a transaction. The
 * `userSignature` is the Ed25519 signature produced by the ephemeral key over
 * the transaction bytes.
 */
export function assembleZkLoginSignature(args: {
  inputs: ZkLoginSignatureInputs;
  maxEpoch: bigint;
  userSignature: string | Uint8Array;
}): string {
  return getZkLoginSignature({
    inputs: args.inputs,
    maxEpoch: args.maxEpoch,
    userSignature: args.userSignature,
  });
}

/**
 * Compute a Sui address from an already-derived address seed (avoids
 * re-decoding the JWT every call). Use when you've cached the seed.
 */
export function addressFromSeed(args: {
  addressSeed: bigint;
  iss: string;
  legacyAddress?: boolean;
}): string {
  return computeZkLoginAddressFromSeed(args.addressSeed, args.iss, args.legacyAddress ?? false);
}
