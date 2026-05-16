/**
 * Real PTB builders for the dashboard. These construct the exact same
 * Move calls the Move tests exercise — `agent::new + fund + share` for
 * minting, `agent::revoke` for revocation. Every call targets the
 * deployed package on Sui testnet.
 *
 * Coin types are real:
 *   - 0x2::sui::SUI is the gas + funding coin for the v1 demo.
 *
 * Returns a `Transaction` ready to pass into `useSignAndExecuteTransaction`.
 */

import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { synapseTarget } from './synapse-config';

/**
 * The Sui-canonical SUI coin type. Used both as gas and as the v1 funding
 * coin in the dashboard mint flow.
 */
export const SUI_COIN_TYPE_TAG = '0x2::sui::SUI';

export interface MintAgentParams {
  /** ID of the published Strategy this vault is being minted against. */
  strategyId: string;
  /** Address of the agent's ephemeral session key. */
  sessionAddr: string;
  /** Epoch the agent expires at. Must be strictly greater than current epoch. */
  expiryEpoch: bigint;
  /** Per-epoch spend cap in MIST (1 SUI = 1e9 MIST). */
  spendPerEpochMist: bigint;
  /** Contract package allowlist. */
  approvedPackages: string[];
  /**
   * MemWal account ID bytes. For the v1 demo this is filled with a stable
   * placeholder; production wires it to a real MemWal relayer-issued ID.
   */
  memwalAccountId: Uint8Array;
  /** MemWal delegate-key ID bytes. */
  memwalDelegateKeyId: Uint8Array;
  /** MemWal namespace bytes. */
  memwalNamespace: Uint8Array;
  /** Amount of SUI to seed the treasury with (in MIST). */
  fundingMist: bigint;
  /**
   * One-time SUI buffer transferred to the session address as part of
   * the mint PTB. The session needs *some* gas to sign its first
   * pull_operational_funds call (chicken-and-egg) — this breaks the
   * cycle. Default 0.02 SUI ≈ 4 tick signatures' worth of gas.
   */
  sessionGasSeedMist: bigint;
  /**
   * Per-epoch cap on `pull_operational_funds<SUI>`. Set as part of mint
   * so the runtime can auto-refuel from tick 1. Zero disables auto-refuel
   * (legacy behavior — owner refuels manually). Defaults to 0.05 SUI/epoch
   * which covers ~10 ticks at testnet gas prices.
   */
  operationalCapMist: bigint;
}

/**
 * Build the canonical mint PTB:
 *   1. `splitCoins(gas, [funding, sessionGasSeed])` → 2 Coin<SUI> handles
 *   2. `agent::new(...)`                            → hot-potato `AgentIdentity`
 *   3. `agent::fund<SUI>(identity, fundingCoin)`
 *   4. (optional) `agent::set_operational_cap(identity, cap)`
 *   5. `transfer(sessionGasCoin, sessionAddr)`     → seed session for first tick
 *   6. `agent::share(identity)`                    → shared object on-chain
 *
 * Steps 4–5 enable the auto-refuel loop from the very first tick — no
 * post-mint owner refueling required. The session's first
 * `pull_operational_funds` call is paid by the seed coin from step 5,
 * which itself was paid by the owner via the mint tx gas.
 */
export function buildMintPTB(params: MintAgentParams): Transaction {
  const tx = new Transaction();

  // Split off two SUI coins from the owner's gas: one funds the treasury,
  // one seeds the session's gas for its first auto-refuel call.
  const splits =
    params.sessionGasSeedMist > 0n
      ? tx.splitCoins(tx.gas, [params.fundingMist, params.sessionGasSeedMist])
      : tx.splitCoins(tx.gas, [params.fundingMist]);
  const fundingCoin = splits[0];
  const sessionGasCoin = params.sessionGasSeedMist > 0n ? splits[1] : null;
  if (!fundingCoin) throw new Error('splitCoins did not return a funding coin');
  if (params.sessionGasSeedMist > 0n && !sessionGasCoin) {
    throw new Error('splitCoins did not return a session gas coin');
  }

  const identity = tx.moveCall({
    target: synapseTarget('agent', 'new'),
    arguments: [
      tx.object(params.strategyId),
      tx.pure.address(params.sessionAddr),
      tx.pure.u64(params.expiryEpoch),
      tx.pure.u64(params.spendPerEpochMist),
      tx.pure.vector('address', params.approvedPackages),
      tx.pure.vector('u8', Array.from(params.memwalAccountId)),
      tx.pure.vector('u8', Array.from(params.memwalDelegateKeyId)),
      tx.pure.vector('u8', Array.from(params.memwalNamespace)),
    ],
  });

  tx.moveCall({
    target: synapseTarget('agent', 'fund'),
    typeArguments: [SUI_COIN_TYPE_TAG],
    arguments: [identity, fundingCoin],
  });

  if (params.operationalCapMist > 0n) {
    tx.moveCall({
      target: synapseTarget('agent', 'set_operational_cap'),
      arguments: [identity, tx.pure.u64(params.operationalCapMist)],
    });
  }

  if (sessionGasCoin) {
    tx.transferObjects([sessionGasCoin], tx.pure.address(params.sessionAddr));
  }

  tx.moveCall({
    target: synapseTarget('agent', 'share'),
    arguments: [identity],
  });

  return tx;
}

/** Build the revoke PTB against a known AgentIdentity object ID. */
export function buildRevokePTB(args: { agentId: string; strategyId: string }): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: synapseTarget('agent', 'revoke'),
    arguments: [tx.object(args.agentId), tx.object(args.strategyId)],
  });
  return tx;
}

/**
 * Generate a fresh ephemeral Ed25519 session keypair. The agent runtime
 * uses this to sign transactions on behalf of the agent; the human owner
 * never needs to hold it past the mint PTB.
 *
 * Returns the keypair, address, and a base64-encoded 32-byte secret so
 * downstream code can persist it (Seal-encrypted, or via the agent runtime).
 */
export function generateSessionKeypair(): { keypair: Ed25519Keypair; address: string; secretBase64: string } {
  const keypair = new Ed25519Keypair();
  const address = keypair.toSuiAddress();
  const secret = keypair.getSecretKey();
  const base64 = secret.replace(/^suiprivkey/, '');
  return { keypair, address, secretBase64: base64 };
}
