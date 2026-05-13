/**
 * PTB builders for `synapse_core::wallet`.
 *
 * `spend<T>` returns a `Coin<T>` handle that the caller wires into downstream
 * Move calls in the same PTB (e.g., paying a DeepBookV3 swap, an OpenAI proxy
 * contract, or any allowlisted package). `withdraw<T>` and `drain<T>` are
 * owner-only retraction paths.
 *
 * Reference Move source: `move/synapse_core/sources/wallet.move`.
 */

import type { Transaction, TransactionResult } from '@mysten/sui/transactions';
import { target } from './config.js';

/**
 * Append `synapse_core::wallet::spend<T>(identity, target_pkg, amount, ctx)`
 * to `tx`. Returns the `Coin<T>` handle for downstream PTB use.
 *
 * Reverts on policy violation (revoked, expired, wrong sender, non-allowlisted
 * package, over-budget).
 */
export function spend(
  tx: Transaction,
  packageId: string,
  args: {
    agentId: string;
    targetPkg: string;
    amount: bigint;
    coinTypeTag: string;
  },
): TransactionResult {
  return tx.moveCall({
    target: target(packageId, 'wallet', 'spend'),
    typeArguments: [args.coinTypeTag],
    arguments: [
      tx.object(args.agentId),
      tx.pure.address(args.targetPkg),
      tx.pure.u64(args.amount),
    ],
  });
}

/**
 * Owner-only withdrawal: pulls `amount` of `T` back from the agent and returns
 * it as a `Coin<T>` handle. Bypasses session-key gating because only the human
 * parent should be able to retract funds.
 */
export function withdraw(
  tx: Transaction,
  packageId: string,
  args: {
    agentId: string;
    amount: bigint;
    to: string;
    coinTypeTag: string;
  },
): TransactionResult {
  return tx.moveCall({
    target: target(packageId, 'wallet', 'withdraw'),
    typeArguments: [args.coinTypeTag],
    arguments: [tx.object(args.agentId), tx.pure.u64(args.amount), tx.pure.address(args.to)],
  });
}

/**
 * Owner-only drain: removes the entire balance of `T` from the agent and
 * transfers it to the owner. Useful at end-of-life before revocation.
 */
export function drain(
  tx: Transaction,
  packageId: string,
  args: { agentId: string; coinTypeTag: string },
): TransactionResult {
  return tx.moveCall({
    target: target(packageId, 'wallet', 'drain'),
    typeArguments: [args.coinTypeTag],
    arguments: [tx.object(args.agentId)],
  });
}

/**
 * Deposit any-token funds into the agent's treasury (re-export of
 * `agent::fund` via the wallet module for symmetric ergonomics).
 */
export function deposit(
  tx: Transaction,
  packageId: string,
  args: { agentId: string; coin: TransactionResult; coinTypeTag: string },
): TransactionResult {
  return tx.moveCall({
    target: target(packageId, 'wallet', 'deposit'),
    typeArguments: [args.coinTypeTag],
    arguments: [tx.object(args.agentId), args.coin],
  });
}
