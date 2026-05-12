// Synapse Core — Direct Walrus blob registry (file artifacts).
//
// `ArtifactRef` records the on-chain pointer to a file artifact stored
// directly on Walrus (not via MemWal). This is the "file system" half of the
// agent: raw markdown reports, datasets, logs, intermediate outputs.
//
// Storage scheme: dynamic fields on the AgentIdentity UID, keyed by a
// monotonically increasing u64 slot ID. This avoids a Move circular import
// (artifacts.move uses AgentIdentity; agent.move would otherwise need to
// know about ArtifactRef in its struct definition).

module synapse_core::artifacts;

use std::string::String;
use sui::dynamic_field as df;
use sui::event;

use synapse_core::agent::{Self, AgentIdentity};

// === Error codes ===

const EArtifactNotFound: u64 = 200;
const EEmptyBlobId: u64 = 201;
const EEmptyHash: u64 = 202;
const EZeroSize: u64 = 203;
const EPermissionDenied: u64 = 204;

// === Types ===

/// An on-chain pointer to a Walrus blob produced by the agent. Includes
/// integrity (SHA256), provenance (created_at_epoch), and metadata for the
/// indexer / Memory Inspector to reconstruct artifact timelines.
public struct ArtifactRef has store, copy, drop {
    walrus_blob_id: vector<u8>,
    sha256: vector<u8>,
    mime_type: String,
    size_bytes: u64,
    created_at_epoch: u64,
    seal_encrypted: bool,
    label: String,
}

// === Events ===

public struct ArtifactPublishedEvent has copy, drop {
    agent_id: ID,
    artifact_slot: u64,
    walrus_blob_id: vector<u8>,
    sha256: vector<u8>,
    mime_type: String,
    size_bytes: u64,
    label: String,
    seal_encrypted: bool,
    epoch: u64,
}

public struct ArtifactBurnedEvent has copy, drop {
    agent_id: ID,
    artifact_slot: u64,
    walrus_blob_id: vector<u8>,
    epoch: u64,
}

// === Public API ===

/// Publish a Walrus-stored artifact under the agent's registry. The session
/// key must be the transaction sender. Slot ID is assigned monotonically.
public fun publish(
    identity: &mut AgentIdentity,
    walrus_blob_id: vector<u8>,
    sha256: vector<u8>,
    mime_type: String,
    size_bytes: u64,
    seal_encrypted: bool,
    label: String,
    ctx: &mut TxContext,
): u64 {
    agent::assert_can_act(identity, ctx);
    assert!(walrus_blob_id.length() > 0, EEmptyBlobId);
    assert!(sha256.length() == 32, EEmptyHash);
    assert!(size_bytes > 0, EZeroSize);

    let slot = agent::next_artifact_slot(identity);
    let agent_id = object::id(identity);
    let epoch = ctx.epoch();

    let artifact = ArtifactRef {
        walrus_blob_id,
        sha256,
        mime_type,
        size_bytes,
        created_at_epoch: epoch,
        seal_encrypted,
        label,
    };

    df::add(agent::uid_mut(identity), slot, artifact);

    event::emit(ArtifactPublishedEvent {
        agent_id,
        artifact_slot: slot,
        walrus_blob_id,
        sha256,
        mime_type,
        size_bytes,
        label,
        seal_encrypted,
        epoch,
    });

    slot
}

/// Burn an artifact pointer. The Walrus blob itself is evicted by the
/// off-chain indexer listening for `ArtifactBurnedEvent`. Caller may be the
/// session key (agent self-pruning) or the owner (governance pruning).
public fun burn(identity: &mut AgentIdentity, slot: u64, ctx: &TxContext) {
    let is_session = ctx.sender() == agent::session_addr(identity);
    let is_owner = ctx.sender() == agent::owner(identity);
    assert!(is_session || is_owner, EPermissionDenied);
    assert!(df::exists_(agent::uid(identity), slot), EArtifactNotFound);

    let artifact: ArtifactRef = df::remove(agent::uid_mut(identity), slot);
    let blob_id = artifact.walrus_blob_id;

    agent::decrement_artifact_count(identity);

    event::emit(ArtifactBurnedEvent {
        agent_id: object::id(identity),
        artifact_slot: slot,
        walrus_blob_id: blob_id,
        epoch: ctx.epoch(),
    });
}

// === Read-only views ===

public fun exists(identity: &AgentIdentity, slot: u64): bool {
    df::exists_(agent::uid(identity), slot)
}

/// Read an artifact by slot ID. Aborts if absent.
public fun borrow(identity: &AgentIdentity, slot: u64): &ArtifactRef {
    assert!(df::exists_(agent::uid(identity), slot), EArtifactNotFound);
    df::borrow(agent::uid(identity), slot)
}

// === ArtifactRef accessors ===

public fun walrus_blob_id(artifact: &ArtifactRef): &vector<u8> { &artifact.walrus_blob_id }

public fun sha256(artifact: &ArtifactRef): &vector<u8> { &artifact.sha256 }

public fun mime_type(artifact: &ArtifactRef): &String { &artifact.mime_type }

public fun size_bytes(artifact: &ArtifactRef): u64 { artifact.size_bytes }

public fun created_at_epoch(artifact: &ArtifactRef): u64 { artifact.created_at_epoch }

public fun is_seal_encrypted(artifact: &ArtifactRef): bool { artifact.seal_encrypted }

public fun label(artifact: &ArtifactRef): &String { &artifact.label }
