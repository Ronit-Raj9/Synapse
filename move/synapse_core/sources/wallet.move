// Synapse Core — Wallet & spend policy enforcement.
//
// The wallet module is the financial enforcement layer for the agent. Every
// outflow goes through `spend<T>`, which checks four invariants atomically:
//   1. The agent is not revoked.
//   2. The transaction sender is the agent's registered session address.
//   3. The current epoch is before the agent's expiry epoch.
//   4. The target package is on the agent's allowlist.
// Plus a per-epoch spend cap with automatic counter reset across epoch boundaries.
//
// All policy is enforced in the Move VM. The agent's session key could be
// fully compromised and the protocol would still reject out-of-policy actions.

module synapse_core::wallet;

use std::type_name;
use sui::balance::Balance;
use sui::coin::{Self, Coin};
use sui::event;

use synapse_core::agent::{Self, AgentIdentity};

// === Error codes ===

const EInsufficientFunds: u64 = 100;
const ETokenNotFound: u64 = 101;
const EZeroAmount: u64 = 102;

// === Events ===

/// Emitted on every successful spend. The indexer correlates these with
/// MemWal writes, artifact publishes, and DeepBook swaps to build the
/// unified per-agent audit log.
public struct SpendEvent has copy, drop {
    agent_id: ID,
    target_pkg: address,
    token_type: std::type_name::TypeName,
    amount: u64,
    epoch: u64,
    remaining_budget: u64,
}

/// Emitted when the owner pulls funds back out of the agent treasury.
public struct WithdrawEvent has copy, drop {
    agent_id: ID,
    token_type: std::type_name::TypeName,
    amount: u64,
    to: address,
}

// === Public API ===

/// Authorized spend: the session-keyed agent withdraws `amount` of token `T`
/// from its treasury for use against `target_pkg`. Caller is responsible for
/// actually invoking the target package with the returned coin in the same
/// PTB. The policy check happens here; the actual call composes downstream.
public fun spend<T>(
    identity: &mut AgentIdentity,
    target_pkg: address,
    amount: u64,
    ctx: &mut TxContext,
): Coin<T> {
    assert!(amount > 0, EZeroAmount);

    // Four-layer policy gate.
    agent::assert_can_act(identity, ctx);
    agent::assert_package_allowed(identity, target_pkg);
    // Nautilus: if this vault requires attestation, a valid enclave-signed
    // decision must have been stamped this epoch (decision_attestation::
    // attest_decision) — otherwise abort. No-op for non-attested vaults.
    agent::assert_attested_if_required(identity, ctx);

    // Roll epoch counter, charge against per-epoch budget.
    agent::reset_epoch_if_new(identity, ctx);
    agent::record_spend(identity, amount);

    let token_type = type_name::with_defining_ids<T>();
    let treasury = agent::treasury_mut(identity);
    assert!(treasury.contains_with_type<_, Balance<T>>(token_type), ETokenNotFound);

    let bal: &mut Balance<T> = treasury.borrow_mut(token_type);
    assert!(bal.value() >= amount, EInsufficientFunds);
    let coin = coin::from_balance(bal.split(amount), ctx);

    event::emit(SpendEvent {
        agent_id: object::id(identity),
        target_pkg,
        token_type,
        amount,
        epoch: ctx.epoch(),
        remaining_budget: agent::remaining_budget(identity, ctx),
    });

    coin
}

/// Anyone may top up the agent's treasury — this is identical to `agent::fund`
/// and is re-exported here for ergonomic symmetry with `spend` and `withdraw`.
public fun deposit<T>(identity: &mut AgentIdentity, coin: Coin<T>) {
    agent::fund(identity, coin)
}

/// Owner-only withdrawal: pulls funds back to a specified recipient and
/// terminates that fraction of the agent's budget. Bypasses session-key gating
/// because only the human parent should be able to retract funds.
public fun withdraw<T>(
    identity: &mut AgentIdentity,
    amount: u64,
    to: address,
    ctx: &mut TxContext,
): Coin<T> {
    assert!(amount > 0, EZeroAmount);
    agent::assert_owner(identity, ctx);

    let token_type = type_name::with_defining_ids<T>();
    let treasury = agent::treasury_mut(identity);
    assert!(treasury.contains_with_type<_, Balance<T>>(token_type), ETokenNotFound);

    let bal: &mut Balance<T> = treasury.borrow_mut(token_type);
    assert!(bal.value() >= amount, EInsufficientFunds);
    let coin = coin::from_balance(bal.split(amount), ctx);

    event::emit(WithdrawEvent {
        agent_id: object::id(identity),
        token_type,
        amount,
        to,
    });

    coin
}

/// Owner-only drain: removes the entire balance of token `T` and transfers it
/// to the owner. Useful at end-of-life when revoking and reclaiming residuals.
public fun drain<T>(identity: &mut AgentIdentity, ctx: &mut TxContext) {
    agent::assert_owner(identity, ctx);

    let token_type = type_name::with_defining_ids<T>();
    let treasury = agent::treasury_mut(identity);
    if (!treasury.contains_with_type<_, Balance<T>>(token_type)) {
        return
    };

    let bal: Balance<T> = treasury.remove(token_type);
    let amount = bal.value();
    if (amount == 0) {
        bal.destroy_zero();
        return
    };

    let owner = agent::owner(identity);
    let coin = coin::from_balance(bal, ctx);
    transfer::public_transfer(coin, owner);

    event::emit(WithdrawEvent {
        agent_id: object::id(identity),
        token_type,
        amount,
        to: owner,
    });
}

// === Read-only views ===

/// Return the balance of token `T` held in the agent's treasury (0 if absent).
public fun balance_of<T>(identity: &AgentIdentity): u64 {
    let token_type = type_name::with_defining_ids<T>();
    let treasury = agent::treasury(identity);
    if (treasury.contains_with_type<_, Balance<T>>(token_type)) {
        let bal: &Balance<T> = treasury.borrow(token_type);
        bal.value()
    } else {
        0
    }
}

/// True if the treasury holds any non-zero amount of `T`.
public fun holds<T>(identity: &AgentIdentity): bool {
    balance_of<T>(identity) > 0
}
