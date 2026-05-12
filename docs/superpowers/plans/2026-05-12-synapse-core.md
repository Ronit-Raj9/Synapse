# Synapse Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Synapse Core — the identity, policy, and coordination substrate for autonomous AI agents on Sui — by Sui Overflow 2026 deadline (June 21, 2026), targeting the Walrus Specialized Track, with mainnet deployment by August 20 to capture the full $35K prize.

**Architecture:** A single Sui object (`AgentIdentity`) anchors an agent to a human zkLogin parent and composes four sponsor primitives (Walrus, MemWal, Seal, Sui Stack Messaging) plus DeepBookV3. Move VM enforces policy on every action; one-PTB revocation cascade across all subsystems.

**Tech Stack:** Move 2024 + Sui Framework + Walrus SDK + MemWal SDK + Seal + Sui Stack Messaging + DeepBookV3 + TypeScript SDK (LangGraph / Claude Agent SDK / Eliza adapters) + Next.js 15 (dashboard + Memory Inspector) + Sui GraphQL indexer.

**Track:** Walrus Specialized — 1st prize $35,000 · Headline Partner.

---

## Phase 1 — Move Package Foundation (Days 1–14)

### Task 1: Project scaffold (COMPLETED)

**Files created:**
- `/home/suyashagrawal/Desktop/Synapse/.gitignore`
- `/home/suyashagrawal/Desktop/Synapse/package.json` (npm workspaces root)
- `/home/suyashagrawal/Desktop/Synapse/tsconfig.base.json`
- `/home/suyashagrawal/Desktop/Synapse/.prettierrc.json`
- Directory tree: `move/`, `sdk/packages/{client,memwal-bridge,adapters/*,indexer}`, `web/{dashboard,inspector,site}`, `docs/`, `scripts/`

### Task 2: Initialize Move package (COMPLETED)

- Ran `sui move new synapse_core` in `move/`
- Configured `Move.toml` (auto-resolved Sui framework via Sui CLI 1.60+)
- Verified `sui move build` succeeds

### Task 3: `agent.move` — AgentIdentity spine (COMPLETED)

`AgentIdentity` struct with: owner, session_addr, expiry_epoch, revoked, spend_per_epoch + counters, approved_packages, Bag treasury, MemWal bridge fields (account_id, delegate_key_id, namespace), artifact counter, optional messaging channel IDs. Lifecycle (`new`, `attach_messaging`, `fund<T>`, `share`). Governance (`revoke`, `rotate_session_key`, `extend_expiry`, `update_spend_per_epoch`, `add/remove_approved_package`). Read accessors. Package-visible mutators (`assert_can_act`, `record_spend`, `reset_epoch_if_new`, etc.). Events.

### Task 4: `wallet.move` — Spend policy enforcement (COMPLETED)

`spend<T>(identity, target_pkg, amount, ctx): Coin<T>` enforces all four invariants atomically. `withdraw<T>`, `drain<T>` for owner reclamation. `balance_of<T>`, `holds<T>` read-only views. `SpendEvent`, `WithdrawEvent` for audit log.

### Task 5: `artifacts.move` — Direct Walrus blob registry (COMPLETED)

`ArtifactRef` struct (walrus_blob_id, sha256, mime_type, size_bytes, created_at_epoch, seal_encrypted, label). `publish`/`burn`/`borrow` functions. Stored as dynamic fields on AgentIdentity UID (avoids circular module imports). `ArtifactPublishedEvent`, `ArtifactBurnedEvent`.

### Task 6: `coordination.move` + `messaging_bridge.move` (PENDING)

**Files:**
- Create: `move/synapse_core/sources/coordination.move`
- Create: `move/synapse_core/sources/messaging_bridge.move`

- [ ] **coordination.move — Multi-agent capability gates**

```move
module synapse_core::coordination;

use sui::event;
use synapse_core::agent::{Self, AgentIdentity};

const ENotInNamespace: u64 = 300;
const ENamespaceMismatch: u64 = 301;

public struct NamespaceJoinedEvent has copy, drop {
    agent_id: ID,
    namespace: vector<u8>,
    joined_by: address,
}

public struct CrossAgentReadEvent has copy, drop {
    reader_id: ID,
    writer_id: ID,
    namespace: vector<u8>,
    memwal_memory_id: vector<u8>,
}

/// Verify two agents share the same MemWal namespace and the caller is
/// authorized to read writer's memory. Used by multi-agent workflows before
/// they cross-correlate state.
public fun assert_shared_namespace(reader: &AgentIdentity, writer: &AgentIdentity) {
    assert!(agent::memwal_namespace(reader) == agent::memwal_namespace(writer), ENamespaceMismatch);
}

/// Emit a cross-agent read event for the indexer audit log.
public fun record_cross_agent_read(
    reader: &AgentIdentity,
    writer: &AgentIdentity,
    memwal_memory_id: vector<u8>,
    ctx: &TxContext,
) {
    agent::assert_can_act(reader, ctx);
    assert_shared_namespace(reader, writer);
    event::emit(CrossAgentReadEvent {
        reader_id: object::id(reader),
        writer_id: object::id(writer),
        namespace: *agent::memwal_namespace(reader),
        memwal_memory_id,
    });
}
```

- [ ] **messaging_bridge.move — Sui Stack Messaging integration**

`MessageSentEvent`, `MessageReceivedEvent` for unified audit. `record_send`, `record_receive` callable by session key. The actual messaging objects live in `MystenLabs/sui-stack-messaging`; we only emit correlation events.

- [ ] **Verify build:** `sui move build`
  Expected: clean, no warnings.

- [ ] **Commit:** `git add move/synapse_core/sources/coordination.move move/synapse_core/sources/messaging_bridge.move && git commit -m "feat(move): add coordination and messaging_bridge modules"`

### Task 7: `attestation.move` + `deepbook_adapter.move` (PENDING)

**Files:**
- Create: `move/synapse_core/sources/attestation.move`
- Create: `move/synapse_core/sources/deepbook_adapter.move`

- [ ] **attestation.move — Unified action log**

Generic `log_action(identity, action_kind, payload_hash, ctx)` that emits a `ActionLogEvent` with a `kind` discriminant (spend, memory_write, artifact_publish, message_send, swap, custom). Used by adapters to log non-spend actions in the same event stream.

- [ ] **deepbook_adapter.move — Typed DeepBookV3 wrapper**

Add DeepBookV3 dependency to `Move.toml`:
```toml
DeepBook = { git = "https://github.com/MystenLabs/deepbookv3.git", subdir = "packages/deepbook", rev = "mainnet" }
```

Implement `swap_exact_base_for_quote<Base, Quote>(identity, pool, base_coin, min_quote_out, ctx): Coin<Quote>` and the reverse. Both call `agent::assert_can_act` + `agent::assert_package_allowed(DEEPBOOK_PKG)` + emit `SwapEvent`. Wraps the official `deepbook::pool::swap_exact_quantity` call.

- [ ] **Verify build with DeepBook dep:** `sui move build`
- [ ] **Commit:** `git commit -m "feat(move): add attestation log and deepbook adapter"`

### Task 8: Move tests (PENDING)

**Files:**
- Create: `move/synapse_core/tests/e2e_test.move`
- Create: `move/synapse_core/tests/agent_test.move`
- Create: `move/synapse_core/tests/wallet_test.move`
- Create: `move/synapse_core/tests/artifacts_test.move`

- [ ] **Per-module unit tests using `#[test]` annotations and `sui::test_scenario`.**

Each test scenario should: build an AgentIdentity with `test_scenario::ctx`, exercise the function under test, assert state changes. Include negative tests (revoked agent rejected, expired agent rejected, non-allowlisted package rejected, over-budget aborts).

- [ ] **e2e_test.move — Full lifecycle test**

Mint → fund → publish artifact → spend → revoke. Verify each event emits correctly, all state transitions are atomic.

- [ ] **Run:** `sui move test`
  Expected: all tests pass, no warnings.

- [ ] **Commit:** `git commit -m "test(move): full e2e and unit test coverage"`

---

## Phase 2 — TypeScript SDK & Adapters (Days 15–28)

### Task 9: TypeScript monorepo bootstrap (PENDING)

**Files:**
- Create: `sdk/packages/client/package.json`, `tsconfig.json`, `src/index.ts`
- Create: `sdk/packages/memwal-bridge/package.json`, `src/index.ts`
- Create: `sdk/packages/adapters/{langgraph,claude-sdk,eliza}/package.json`, `src/index.ts`
- Create: `sdk/packages/indexer/package.json`, `src/index.ts`

Each package: ESM-only, strict TS, exports defined in `package.json` `exports` field. Shared `tsconfig.base.json` extended.

- [ ] **Install workspaces:** `npm install` (verifies workspace symlinks).
- [ ] **Verify build:** `npm run typecheck` from root.

### Task 10: `sdk/packages/client` — Core client (PENDING)

**Files:**
- `src/types.ts` — AgentIdentity TypeScript mirror, event types
- `src/agent.ts` — mint/fund/revoke/governance PTB builders
- `src/wallet.ts` — spend / withdraw / drain PTB builders
- `src/artifacts.ts` — publish (Walrus upload + on-chain register), fetch, burn
- `src/walrus.ts` — direct Walrus blob upload using `@mysten/walrus`
- `src/seal.ts` — Seal encryption wrapper for sensitive artifacts
- `src/zklogin.ts` — Google OAuth → ephemeral key → zkLogin proof flow
- `src/session-key.ts` — agent ephemeral keypair generation + Sui address derivation
- `src/index.ts` — public API

Dependencies (real, pinned versions):
- `@mysten/sui` (latest)
- `@mysten/walrus` (latest)
- `@mysten/seal` (latest)
- `@mysten/zklogin` (latest)

- [ ] **Test:** integration test against Sui testnet — mint an agent, fund 1 SUI, publish a Walrus blob, verify on-chain artifact pointer.
- [ ] **Commit per file** as it lands.

### Task 11: `sdk/packages/memwal-bridge` — MemWal integration (PENDING)

Wrapper around `@mysten-incubation/memwal` (the official MemWal SDK package per the GitHub repo) that:
- Reads `memwal_delegate_key_id` + `memwal_namespace` from an `AgentIdentity`
- Constructs MemWal SDK calls using the agent's delegate key
- Provides `remember(agent, content)`, `recall(agent, query, k)`, `forget(agent, memory_id)`
- Subscribes to `AgentRevokedEvent` and calls MemWal revocation API to invalidate the delegate

### Task 12: Adapter — LangGraph (PENDING)

Implements `BaseStore` / `BaseCheckpointSaver` interfaces from `@langchain/langgraph` using Synapse as the memory + identity backend. An agent built with LangGraph automatically gets policy-bounded actions, MemWal memory, and Walrus artifact storage.

### Task 13: Adapter — Claude Agent SDK (PENDING)

Implements the memory hook + tool authorization interface from `@anthropic-ai/claude-agent-sdk` so a Claude agent's tool calls route through Synapse `spend<T>` (with the policy gate enforcing every action).

### Task 14: Adapter — Eliza (PENDING)

Eliza Plugin (`@elizaos/core`-compatible) registering Synapse as the persistence + payment provider. Plug-and-play.

### Task 15: Indexer (PENDING)

GraphQL service correlating events across all Synapse modules + MemWal events + Walrus blob lifecycle. Schema: `agent(id) { actions(since, until) { kind, payload, txDigest } }`. Used by Memory Inspector + dashboard.

---

## Phase 3 — Frontend & Dev Tools (Days 29–35)

### Task 16: Overflow design system tokens (PENDING)

**Files:**
- Create: `sdk/packages/design-tokens/package.json`
- Create: `sdk/packages/design-tokens/src/tokens.ts` — CSS variables + Tailwind config

Capture the overflow.sui.io theme: cream background (#F5F0E6 region), dark navy text (#030F1C region), vibrant accent palette (orange, purple, green, blue, pink, yellow), bold grotesque typography, blueprint grid motif.

### Task 17: Memory Inspector dev tool (PENDING)

Standalone Next.js 15 app at `web/inspector`. Single-page tool — paste a MemWal namespace ID + Walrus aggregator URL, see a unified timeline of memories, artifacts, messages, payments, swaps. Pluggable to any agent (not just Synapse-spawned).

### Task 18: User dashboard (PENDING)

Next.js 15 app at `web/dashboard`. zkLogin onboarding, agent spawning UI, live action stream per agent, revoke button.

### Task 19: Marketing site (PENDING)

Walrus Sites deployable at `web/site`. Landing page using the Overflow theme.

---

## Phase 4 — Submission Prep (Days 36–42)

### Task 20: Demo video (PENDING)

≤ 5 min, single take. Lifecycle: sign in → spawn ResearchAgent + TraderAgent → research workflow → trader workflow → Memory Inspector → revoke → audit timeline.

### Task 21: Pitch deck (PENDING)

10–12 slides for Demo Day (in case shortlisted). Generated initially via Claude Design, polished manually.

### Task 22: Threat model doc (PENDING)

`docs/threat-model.md` — compromised session keys, MemWal relayer compromise, malicious allowlisted packages, oracle manipulation, replay attacks.

### Task 23: Final README polish + submission (PENDING)

GitHub repo public. Demo video uploaded to YouTube. Submission portal filled. Package ID recorded. Deadline: June 21, 2026.

---

## Phase 5 — Demo Day Prep (Days July 8–20, conditional)

- [ ] If shortlisted by July 8, prep live pitch deck v2 with anticipated Q&A
- [ ] Polish hosted demo URL
- [ ] Three live demo rehearsals (3 min pitch + 2 min Q&A)
- [ ] Backup recorded demo

---

## Phase 6 — Mainnet & Award Capture (July 22 – August 27)

- [ ] July 22 – August 5: Internal security review, threat model finalized, optional OpenZeppelin / OtterSec audit
- [ ] August 5 – August 15: Mainnet deployment with conservative configs
- [ ] August 15 – August 20: First 5+ external `AgentIdentity` mints (ecosystem testers + framework adapter users)
- [ ] **August 20:** Mainnet deployment fully live → captures full 100% upfront prize
- [ ] August 27: Winners announced

---

## Self-Review Checklist

**Spec coverage:** README has 12-row Walrus track requirement checklist. Each row maps to a task in this plan. Verified.

**Placeholder scan:** Phases 2, 3, 4 contain higher-level task descriptions rather than full code. This is intentional — Phase 1 code lands first and informs the exact API surface Phase 2 implements against. Each Phase 2+ task will be expanded into bite-sized steps before execution.

**Type consistency:** AgentIdentity struct fields match across `agent.move`, `wallet.move`, `artifacts.move`. Event names consistent. Error code ranges non-overlapping: agent (0–99), wallet (100–199), artifacts (200–299), coordination (300–399), messaging (400–499), attestation (500–599), deepbook (600–699).

---

## Execution

Phase 1 Tasks 1–5 already completed inline. Tasks 6–8 should be executed next in this session or the next, depending on session length. Phase 2 onward should be executed via fresh subagent dispatch per task (using `superpowers:subagent-driven-development`) to keep context windows clean.
