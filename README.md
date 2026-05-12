# Synapse Core

> **Sovereign Agents on Walrus.**
> The identity, policy, and coordination layer that turns MemWal-backed agents into autonomous economic actors — composing Walrus, MemWal, Seal, and Sui Stack Messaging into one programmable substrate that enterprises can actually deploy.

**Sui Overflow 2026 Submission** — Walrus Specialized Track (Headline Partner)
**Building Period:** May 7 – June 21, 2026 · **Submission Deadline:** June 21, 2026
**Demo Day:** July 20–21, 2026 · **Winners Announced:** August 27, 2026

---

## TL;DR

AI agents are stateless, fragmented, and unsafe to deploy autonomously with money attached. Memory is siloed in local SQLite. Wallets are either custodial (Coinbase AgentKit) or unguarded. There is no atomic kill switch when an agent goes rogue. **Enterprise AI deployment is blocked on this gap, not on model quality.**

**Synapse Core is the missing substrate.** A single Sui object — `AgentIdentity` — anchors a non-custodial agent to a human zkLogin parent and gives it:

- **A semantic memory** via MemWal (long-term, verifiable, vector-searchable).
- **A file system** via direct Walrus blob storage for artifacts: reports, datasets, logs.
- **A communication channel** via Sui Stack Messaging, encrypted with Seal, for inter-agent task delegation.
- **A policy-bounded wallet** with spend limits, contract allowlists, expiry epochs, and a `Bag` treasury for any token.
- **A unified audit trail** correlating memory writes, file artifacts, messages, and on-chain actions.
- **A one-PTB revocation cascade** that simultaneously freezes the wallet, invalidates the MemWal delegate key, queues Walrus blobs for eviction, and closes messaging channels.

Spawn two agents. Watch ResearchAgent generate a markdown report, store it on Walrus, and message TraderAgent via Sui Stack Messaging. Watch TraderAgent fetch the file, recall the semantic context from MemWal, and execute a DeepBookV3 swap atomically. Open the Memory Inspector dev tool and see the entire chain in a single timeline. Click revoke and watch the whole graph go dark in one transaction. **That is what enterprise AI deployment has been waiting for.**

---

## Track & Prizes

Per Sui Overflow 2026 rules, projects are submitted to a single track. **Synapse Core targets the Walrus Specialized Track** because Walrus is the headline partner, this track has the highest depth-to-density ratio for our scope, and our architecture exercises every Walrus-stack primitive non-trivially.

| Place | Prize |
|---|---|
| **1st** | **$35,000** |
| 2nd | $15,000 |
| 3rd | $7,500 |
| 4th | $5,000 |

**Award structure:** 50% paid on winner announcement, 50% paid after mainnet deployment. **100% paid upfront if mainnet is deployed by August 27, 2026.** Our plan captures the full prize. See "Award Capture Plan" below.

---

## The Problem (Why This Matters in 2026)

The agentic web is real. LangGraph workflows, Claude/GPT agent loops, and Eliza-style autonomous swarms are in production. The moment they touch money or persistent state, they hit four walls:

1. **No native identity.** Agents borrow human keys or sit behind custodial APIs (Coinbase AgentKit, Crossmint). Humans carry unlimited liability for actions they didn't authorize.
2. **No verifiable memory or file storage.** Agent state lives in Pinecone, Mem0, local SQLite, or vendor APIs. There is no proof of what was learned, when, or by whom.
3. **No coordination primitive.** Multi-agent setups duct-tape together pub-sub, RPC, and shared databases. There is no on-chain proof of what was delegated to whom, with what authority.
4. **No revocation.** When an agent goes rogue, there is no atomic kill switch. Wallets, memory, and comms live in different systems with different semantics. Cleanup takes hours and proves nothing.

Each of these is a deal-killer for enterprise AI deployment. Goldman Sachs, JPMorgan, and BlackRock have publicly stated interest in agentic workflows and equally publicly cited compliance and audit gaps as the blocker. Tokenized RWA fund managers want autonomous rebalancers and can't deploy them. Healthcare networks want AI care assistants and can't satisfy HIPAA. SaaS companies want autonomous billing agents and can't bound the spend.

**Sui in 2026 has the exact primitives needed to solve this end-to-end** — programmable storage (Walrus), persistent agent memory (MemWal), client-side encryption (Seal), object-level capabilities, zkLogin for human anchoring, parallel-execution-safe shared objects, atomic multi-effect PTBs, DeepBookV3 for autonomous economic action, and Sui Stack Messaging for inter-agent comms. Nobody has assembled them all into one substrate. We have.

---

## Real-World Application

> *Sui Overflow 2026 weights "Real-World Application" at 50% of total score. Synapse Core was designed for this judging criterion.*

### The Five Concrete Use Cases We're Building For

#### 1. Tokenized Treasury Agent (Crypto-Native, Highest-Fit)

**Customer profile:** Tokenized RWA fund manager (Ondo / Maple / Centrifuge category) operating $10M+ AUM in stablecoins, T-bill tokens, or private credit positions on-chain.

**Pain:** Institutional LPs require operational audit trails for any AI involvement in fund decisions. Coinbase AgentKit's policy enforcement is centralized and off-chain — auditors won't accept it. Self-hosted multisig is bottlenecked on human signers.

**Synapse fit:** Fund manager mints an `AgentIdentity` with `spend_per_epoch` capped at daily rebalance volume, `approved_packages` restricted to specific DeepBookV3 pools, and 24-hour `expiry_epoch`. Move VM enforces every constraint. Per-action audit log is on-chain and immutable. Revocation is one PTB.

**Why now:** RWA TVL crossed $24B in 2026 and is growing. Fund operators are actively asking for this primitive. We can credibly pilot with a tokenized fund design partner within 90 days post-hackathon.

#### 2. Compliance-Bound Research Desk (TradFi Bridge)

**Customer profile:** Asset manager or sell-side research desk deploying AI research assistants that generate reports cited in client-facing materials.

**Pain:** SEC and FCA are actively drafting rules requiring tamper-proof provenance for AI-generated investment research. Today's vector DBs and chat logs cannot satisfy "show me what this agent knew at this timestamp."

**Synapse fit:** Every research artifact (markdown reports, datasets, model outputs) is a Walrus blob with a Synapse `ArtifactRef`. Every recall is signed by the agent's session key. Memory Inspector lets compliance officers query by agent ID and epoch range and reconstruct the agent's exact knowledge state at any past moment.

**Why now:** Regulatory pressure is the trigger. First mover with auditable AI research provenance wins regulated-market integrations.

#### 3. Healthcare AI with Memory Audit (HIPAA Pathway)

**Customer profile:** Digital health company deploying AI care-team assistants that read patient records and produce care recommendations.

**Pain:** HIPAA requires access logs and deletion proofs. Today these live in fragmented vendor systems with no unified audit. "Right to be forgotten" requests take weeks.

**Synapse fit:** Patient context lives Seal-encrypted in MemWal namespaces. Agent access is delegate-key gated and on-chain logged. Patient deletion request → one PTB revokes the relevant `AgentIdentity` → MemWal delegate invalidated → Walrus blobs queued for eviction. Cryptographic proof of compliance.

**Why now:** AI in healthcare is bottlenecked on compliance, not technology. The first compliance substrate gets the regulated deployments.

#### 4. Autonomous SaaS Operator (Enterprise General)

**Customer profile:** Any enterprise deploying agents that operate SaaS instances — billing reconciliation, vendor procurement, customer support escalation, invoice dispute.

**Pain:** Agents operating with corporate credit cards or AWS API keys carry unbounded liability. CFOs cannot approve deployment without spending controls. CISOs cannot approve without revocation guarantees.

**Synapse fit:** `AgentIdentity` with $X spend cap per epoch, allowlist of approved vendors/contracts, automatic expiry. Compromised agent? One revoke transaction. Forensic audit trail per agent for SOC2.

**Why now:** Anthropic's computer-use and OpenAI's agent products are pushing enterprises toward agentic deployment. Enterprises need guardrails before they can adopt.

#### 5. DAO Treasury Multi-Agent (Crypto-Native)

**Customer profile:** DAO with $10M+ treasury seeking professional management without single-multisig trust assumptions.

**Pain:** DAO treasury operations are committee-bottlenecked. Hiring a professional treasury team requires trust, contracts, and slow turnaround.

**Synapse fit:** DAO governance spawns multiple `AgentIdentity` objects with distinct mandates — yield farming agent (DeFi pools allowlist), OTC desk agent (DeepBookV3 limit orders), market-making agent (liquidity pools). Capability-scoped, all revocable by governance vote. Multi-agent coordination via Sui Stack Messaging for cross-mandate consistency.

**Why now:** Top 50 DAOs hold $5B+. Treasury professionalization is the next frontier; AI-managed treasury is the path.

### Market Sizing

| Segment | Estimated TAM | Synapse Wedge |
|---|---|---|
| AI agent infrastructure (general) | $50B+ by 2028 (industry estimates) | Identity + audit substrate |
| RWA tokenization | $24B TVL in 2026, growing rapidly | Treasury agent operations |
| Web3 agent frameworks (LangGraph/Eliza/Claude SDK users) | ~150K developers (combined ecosystems) | Adapter distribution |
| Enterprise AI deployment | $200B+ TAM, mostly stalled on compliance | Audit + revocation + spending controls |

### Go-to-Market: Three Wedges in Sequence

1. **Crypto-native pilots (Q3 2026, post-hackathon).** Two design partners: one tokenized RWA fund manager, one DAO treasury. Smallest legal lift, fastest sales cycle, validators of the technical model. Output: case studies and integration evidence.
2. **Developer adoption (Q4 2026).** Open-source LangGraph, Claude Agent SDK, and Eliza adapters distributed via npm and the official MemWal sample apps repo. Bottoms-up adoption through ~150K agent developers. Output: 1000+ AgentIdentities minted on mainnet.
3. **Enterprise design partners (2027).** Two financial-services firms via design partner programs. Full OpenZeppelin / OtterSec audit. SOC2 Type II path. Output: regulated-market integrations and the Synapse standard becoming the default for compliance-bound agent deployments.

### Long-Term Vision

- **Synapse Core becomes the agent identity standard for the Walrus ecosystem.** Every Walrus-track project that follows ours plugs `AgentIdentity` in as their identity primitive — we ship the substrate they don't have to rebuild.
- **Memory Inspector becomes the canonical MemWal dev tool.** Hosted SaaS for production debugging.
- **SuiAIP standard for agent capability tokens.** Push a Sui Improvement Proposal for `AgentIdentity` so other projects build against a shared interface.
- **Cross-chain agent identity portability.** Phase 2 expansion: an `AgentIdentity` minted on Sui issues capability proofs usable on Solana, EVM, Cosmos.

---

## Why Synapse Doesn't Compete with MemWal — It Stands on It

MemWal already exists. It ships persistent semantic memory, delegate keys, Seal encryption, a TypeScript SDK, and adapters for Vercel AI SDK and OpenClaw. Re-implementing memory primitives would compete with the sponsor and waste two weeks of our build.

Synapse Core uses MemWal as the memory layer and adds the layers MemWal doesn't:

| What MemWal Provides | What Synapse Adds On Top |
|---|---|
| Persistent semantic memory on Walrus | Direct Walrus file artifacts (separate from semantic memory) |
| Delegate keys per agent | On-chain `AgentIdentity` anchoring delegate to a zkLogin parent |
| Seal encryption | Policy-bounded wallet (spend limits, allowlist, expiry) |
| TypeScript SDK | LangGraph + Claude Agent SDK + Eliza adapters MemWal doesn't yet have |
| Vercel AI / OpenClaw plugins | Multi-agent coordination via shared namespaces + Sui Stack Messaging |
| Single-agent samples | One-PTB revocation cascade across all subsystems |
| Smart contract for ownership | Compliance-grade unified audit log |
| Memory CRUD | DeepBookV3 integration for autonomous economic actions |

**Synapse becomes the canonical example of what to build *on top of* MemWal.**

---

## Walrus Track Requirements — Twelve-for-Twelve

The Walrus track problem statement enumerates twelve specific signals. Synapse hits all twelve:

| # | Track Requirement | Synapse Implementation |
|---|---|---|
| 1 | Long-term memory via MemWal | `AgentIdentity` holds a MemWal delegate key + namespace; agent SDK uses MemWal `remember()` / `recall()` |
| 2 | Direct Walrus file access | `ArtifactRegistry` on `AgentIdentity` for raw file blobs (reports, datasets, logs, intermediate outputs) |
| 3 | Integrations/tooling for adoption | LangGraph adapter (P0), Claude Agent SDK adapter (P0), Eliza adapter (P0) |
| 4 | Long-running workflows | ResearchAgent + TraderAgent persist state across sessions; demo shows seamless resume |
| 5 | Multi-agent coordination | Two agents share a MemWal namespace and exchange task delegations via Sui Stack Messaging |
| 6 | Artifact-driven workflows | ResearchAgent generates a real markdown report → stored as a Walrus blob → consumed by TraderAgent |
| 7 | Adapters for existing frameworks | LangGraph + Claude Agent SDK + Eliza plug Synapse in as their memory + identity backend |
| 8 | Workflow orchestration (memory + messaging + execution) | Unified across MemWal, Sui Stack Messaging, and policy-gated execution PTBs |
| 9 | Cross-tool/cross-agent memory sharing | Shared MemWal namespace gated by Move capability checks in `coordination.move` |
| 10 | Inspection/debug dev tool | Standalone Memory Inspector — paste any namespace ID, get a unified timeline |
| 11 | Working systems, not just demos | LangGraph + Claude Agent SDK + Eliza adapters are real, runnable, contributable |
| 12 | Seal for privacy | Direct Seal usage for sensitive artifacts and Sui Stack Messaging payloads |

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │  Human (zkLogin via Google OAuth)   │
                    └─────────────────┬───────────────────┘
                                      │ mints (PTB)
                                      ▼
                    ┌─────────────────────────────────────┐
                    │     AgentIdentity (Sui object)      │
                    │                                     │
                    │  Identity:                          │
                    │    owner, session_addr, expiry      │
                    │                                     │
                    │  MemWal bridge (semantic memory):   │
                    │    delegate_key_id, namespace       │
                    │                                     │
                    │  Walrus bridge (file artifacts):    │
                    │    artifacts: Table<id, ArtifactRef>│
                    │                                     │
                    │  Messaging bridge:                  │
                    │    inbox_id, outbox_id              │
                    │                                     │
                    │  Wallet:                            │
                    │    treasury (Bag), spend_per_epoch, │
                    │    spent_this_epoch,                │
                    │    approved_packages                │
                    │                                     │
                    │  Kill switch:                       │
                    │    revoked: bool                    │
                    └─────────────────┬───────────────────┘
                                      │
        ┌─────────┬─────────┬─────────┼─────────┬─────────┐
        ▼         ▼         ▼         ▼         ▼         ▼
   MemWal     Walrus     Sui Stack   spend()  DeepBook  Revoke
   (semantic) (raw       Messaging   gate +   swap      cascade
              files)     (Seal-      audit
                         encrypted)
```

### Move Package Layout

```
synapse_core/
├── sources/
│   ├── agent.move              // AgentIdentity + lifecycle
│   ├── wallet.move             // spend, swap, policy enforcement
│   ├── artifacts.move          // direct Walrus blob registry
│   ├── messaging_bridge.move   // Sui Stack Messaging integration
│   ├── coordination.move       // multi-agent capability gates
│   ├── deepbook_adapter.move   // typed wrappers for DeepBookV3
│   └── attestation.move        // unified action log + events
├── tests/
│   └── e2e.move                // full lifecycle e2e test
└── Move.toml
```

### Core Struct

```move
public struct AgentIdentity has key {
    id: UID,
    owner: address,                          // zkLogin-derived parent
    session_addr: address,                   // agent's ephemeral Sui address
    expiry_epoch: u64,
    spend_per_epoch: u64,
    spent_this_epoch: u64,
    last_epoch_seen: u64,
    approved_packages: vector<address>,      // contracts the agent may call
    treasury: Bag,                           // multi-token balances

    // MemWal bridge (semantic memory)
    memwal_account_id: vector<u8>,
    memwal_delegate_key_id: vector<u8>,
    memwal_namespace: vector<u8>,

    // Walrus bridge (raw file artifacts)
    artifacts: Table<u64, ArtifactRef>,

    // Sui Stack Messaging bridge
    messaging_inbox: ID,
    messaging_outbox: ID,

    revoked: bool,
}

public struct ArtifactRef has store {
    walrus_blob_id: vector<u8>,
    sha256: vector<u8>,
    mime_type: String,
    size_bytes: u64,
    created_at_epoch: u64,
    seal_encrypted: bool,
}
```

Three deliberate choices:
- `key` only on `AgentIdentity` (no `store`) — cannot be wrapped in another object; revocation guarantees stay intact.
- `Bag` for treasury — supports SUI, USDC, DEEP, anything.
- `Table` for artifacts — O(1) lookup, no gas blowup.

---

## How It Works: Full Lifecycle

### 1. Mint — signed by human via zkLogin

The human authenticates with Google OAuth (zkLogin). The client generates an ephemeral keypair for the agent. A single PTB:

```
1. SplitCoins(gas_coin, [allowance_amount])           → funding_coin

2. Off-chain: call MemWal SDK to create a delegate key
   → returns memwal_account_id, memwal_delegate_key_id, namespace

3. Off-chain: provision Sui Stack Messaging inbox + outbox channels

4. MoveCall: synapse::agent::new(
     session_addr, expiry_epoch, spend_per_epoch,
     approved_packages, memwal_account_id,
     memwal_delegate_key_id, namespace,
     inbox_id, outbox_id, ctx
   )                                                  → AgentIdentity (hot potato)

5. MoveCall: synapse::agent::fund<SUI>(
     &mut identity, funding_coin
   )

6. MoveCall: synapse::agent::share(identity)          → emits AgentMintedEvent
```

### 2. Act — Atomic Multi-Effect PTB

The killer agent PTB chains memory, artifacts, messaging, payments, and trades atomically. For TraderAgent acting on a research thesis:

```
1. messaging_bridge::receive(inbox)             → message bytes
2. artifacts::fetch(artifact_id)                → walrus_blob_id
3. (off-chain: MemWal recall + Seal decrypt + LLM reasoning)
4. wallet::spend<USDC>(amount, target=DeepBook) → coin
5. deepbook_adapter::swap(pool, coin)           → swapped_coin
6. attestation::log_action(action_summary)      → event
```

Single PTB. All policy-gated. All correlated in the audit log.

### 3. Revoke — One-PTB Cascade

```move
public entry fun revoke(
    identity: &mut AgentIdentity,
    inbox: &mut MessagingChannel,
    outbox: &mut MessagingChannel,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == identity.owner, ENotOwner);
    identity.revoked = true;
    messaging_bridge::close(inbox);
    messaging_bridge::close(outbox);
    event::emit(AgentRevokedEvent {
        agent_id: object::id(identity),
        memwal_delegate_key_id: identity.memwal_delegate_key_id,
        artifact_ids: identity.artifacts_keys(),
    });
    // Off-chain indexer subscribes to AgentRevokedEvent → calls MemWal
    // delegate revocation API + signals Walrus epoch eviction.
}
```

One transaction. Wallet dead. Memory delegate revoked. Artifacts queued for eviction. Messaging channels closed.

---

## End-to-End Workflow (User Perspective)

1. **Sign in with Google.** zkLogin mints `RootIdentity`. No seed phrase.
2. **Spawn ResearchAgent.** 5 USDC budget, 3-epoch expiry, allowlist = `[OpenAI proxy]`. Mint PTB fires; MemWal delegate provisioned; Sui Stack Messaging channels opened.
3. **Spawn TraderAgent.** 10 USDC budget, allowlist = `[DeepBookV3 SUI/USDC]`. Same MemWal namespace as ResearchAgent. Linked outbox→inbox channel.
4. **ResearchAgent runs (LangGraph workflow).**
   - Calls OpenAI via the proxy contract (0.10 USDC, gated by wallet)
   - Generates `eth_outlook_2026.md`
   - Stores file directly on Walrus → registers `ArtifactRef`
   - Stores semantic summary on MemWal via delegate key
   - Sends task delegation to TraderAgent via Sui Stack Messaging (Seal-encrypted)
5. **TraderAgent runs (Claude Agent SDK workflow).**
   - Receives message, decrypts with Seal
   - Fetches `eth_outlook_2026.md` from Walrus
   - Recalls semantic context via MemWal
   - Executes single PTB: spend gate → DeepBookV3 swap → unified audit event
6. **Open Memory Inspector dev tool.** Paste namespace ID. See unified timeline: messages, memories, artifacts, payments, swaps — all correlated.
7. **Click "Revoke."** Single PTB cascades across all subsystems. Dashboard updates immediately.
8. **Audit.** Indexer surfaces complete signed history per agent — every dollar moved, every memory written, every artifact published, every message sent, every contract touched.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | **Move 2024**, Sui Framework |
| Semantic memory | **MemWal** (delegate keys, vector search, Seal-encrypted) |
| File artifacts | **Walrus** TypeScript SDK (direct blob storage) |
| Privacy | **Seal** (artifact + messaging encryption) |
| Inter-agent comms | **Sui Stack Messaging** |
| Identity | **zkLogin** (Google OAuth); ephemeral Sui keypairs for agents |
| Trading | **DeepBookV3** (parallel-execution CLOB) |
| Indexer | Sui GraphQL custom indexer (TypeScript) |
| Frontend | **Next.js 15**, Tailwind, shadcn/ui |
| Agent adapters | **LangGraph** (P0), **Claude Agent SDK** (P0), **Eliza** (P0) |
| Demo agents | Claude (Anthropic) via Claude Agent SDK |
| Hosted demo | Walrus Sites + Vercel |

---

## The Demo (≤5 min, single take)

The Sui Overflow handbook permits demo videos up to 5 minutes. Our submission video is structured as a 4-minute end-to-end walkthrough:

1. **0:00–0:30** — Problem framing: enterprise AI is blocked on agent identity, audit, and revocation. Real customer quote (RWA fund operator or DAO treasurer).
2. **0:30–0:45** — Google sign-in. zkLogin mints `RootIdentity`.
3. **0:45–1:15** — Mint ResearchAgent + TraderAgent. Shared MemWal namespace, paired messaging channels.
4. **1:15–2:15** — ResearchAgent runs. Pays OpenAI. Generates `eth_outlook_2026.md`. Stores on Walrus. Stores summary in MemWal. Messages TraderAgent via Sui Stack Messaging.
5. **2:15–3:00** — TraderAgent receives message → decrypts → fetches Walrus file → recalls MemWal context → executes DeepBookV3 swap. Single PTB. Sui explorer shows all effects.
6. **3:00–3:30** — Open Memory Inspector. Paste namespace. Unified timeline visualizes message → artifact → memory → payment → swap.
7. **3:30–3:50** — User clicks Revoke. One PTB. Wallets frozen, MemWal delegates invalidated, artifacts queued for eviction, channels closed.
8. **3:50–4:00** — Closing: Synapse Core is the substrate every Walrus-track agent project plugs into. Long-term vision.

---

## 6-Week Build Plan

The handbook gives us May 7 – June 21 to build. Today is May 10. **We have ~6 weeks of runway.**

### Phase 1: Foundation (May 10 – May 24)

- [ ] Day 1–2: Architecture lock-in (this doc), MemWal SDK + Walrus SDK + Sui Stack Messaging + Seal exploration. Confirm MemWal delegate revocation API surface via Walrus Builder Telegram.
- [ ] Day 3–5: Move package — `agent.move`, `wallet.move`, `artifacts.move`. Unit tests with `sui move test`.
- [ ] Day 6–8: Move package — `coordination.move`, `messaging_bridge.move`, `attestation.move`, `deepbook_adapter.move`. Full e2e Move test.
- [ ] Day 9–10: Move package security review (internal). Threat model doc. Testnet deployment of Move package.
- [ ] Day 11–14: TypeScript core SDK — Sui client wrapper, MemWal bridge, direct Walrus artifact SDK, Seal integration.

### Phase 2: Adapters & Frontend (May 25 – June 7)

- [ ] Day 15–16: Sui Stack Messaging integration in TypeScript SDK.
- [ ] Day 17–19: LangGraph adapter — Synapse as memory + identity backend.
- [ ] Day 20–22: Claude Agent SDK adapter.
- [ ] Day 23–25: Eliza adapter.
- [ ] Day 26–28: zkLogin onboarding flow + Next.js dashboard skeleton.

### Phase 3: Polish & Mainnet Prep (June 8 – June 14)

- [ ] Day 29–30: Custom indexer (correlates all subsystems). GraphQL endpoint.
- [ ] Day 31–32: Memory Inspector standalone dev tool.
- [ ] Day 33–34: Multi-agent demo wiring. End-to-end demo dry-runs.
- [ ] Day 35: Marketing website (Walrus Sites). Project logo. Onboarding copy.

### Phase 4: Submission (June 15 – June 21)

- [ ] Day 36–37: Demo video recording. Multiple takes. Editing.
- [ ] Day 38: Pitch deck v1 for Demo Day (in case we're shortlisted).
- [ ] Day 39: Threat model document. Security audit checklist self-pass.
- [ ] Day 40–41: README polish, GitHub repo cleanup, submission checklist verification.
- [ ] **Day 42 (June 21): Submit before deadline.**

### Phase 5: Demo Day Prep (July 8 – July 20, conditional on shortlist)

- [ ] Pitch deck v2 with judges' Q&A anticipated
- [ ] Hosted demo URL polished
- [ ] Live demo rehearsals (target: 3-minute pitch + 2-minute Q&A)
- [ ] Backup recorded demo in case of network issues

### Phase 6: Mainnet & Award Capture (July 22 – August 27)

See "Award Capture Plan" below.

---

## Award Capture Plan — Capturing the Full $35K

The Sui Overflow 2026 award structure pays 50% on winner announcement and 50% after mainnet deployment, **unless mainnet deployment is complete by August 27, 2026 — in which case 100% is paid upfront.**

We commit to mainnet deployment by August 20, 2026 to capture the full prize.

| Date | Milestone |
|---|---|
| **June 21** | Testnet deployment + submission |
| July 8 | Shortlist announcement |
| July 20–21 | Demo Day live pitch |
| **July 22 – August 5** | Internal security review using the OpenZeppelin / OtterSec sponsor materials. Threat model finalized. External feedback from Walrus team via Telegram. |
| **August 5 – August 15** | Mainnet deployment with conservative configs (low spend caps, short expiries, narrow allowlists). Beta with internal test agents only. |
| **August 15 – August 20** | First external `AgentIdentity` mints from design partner (target: a tokenized RWA fund manager). Live mainnet usage data. |
| **August 27** | Winners announced. **100% prize paid upfront** because mainnet is live. |

### Mainnet Minimum Functional Requirements (Self-Defined)

Per handbook: *"Mainnet deployment must meet the minimum functional requirements as defined by the Sui team and/or track sponsors."* We commit to the following self-defined floor before claiming "mainnet deployed":

- Move package deployed to mainnet with verified source
- At least 5 `AgentIdentity` objects minted by external users (not the team)
- At least 1 multi-agent workflow executed mainnet-to-mainnet (not team simulated)
- At least 1 successful revocation cascade demonstrated on mainnet
- Memory Inspector dev tool publicly hosted and functional against mainnet

---

## Why This Wins (Mapped to Judging Criteria)

| Criterion | Weight | How Synapse Wins |
|---|---|---|
| **Real-World Application** | **50%** | Five concrete enterprise use cases with named market segments. RWA + DAO treasury + healthcare + research desk + SaaS operator. Market sizing with credible TAMs. Three-wedge GTM plan. Credible long-term vision (standards body, cross-chain, regulated-market integrations). |
| **Product & UX** | **20%** | One-click Google sign-in, two-click agent spawn, single-button revocation. Memory Inspector polished as a standalone dev tool. Hosted demo on Walrus Sites. Production-grade Next.js dashboard. |
| **Technical Implementation** | **20%** | Composes 4 sponsor primitives non-trivially (Walrus + MemWal + Seal + Sui Stack Messaging). Move VM enforces every policy. Atomic multi-effect PTBs. One-PTB revocation cascade. Three working agent framework adapters. |
| **Presentation & Vision** | **10%** | 4-minute polished demo video. Pitch deck for Demo Day. README with depth on real-world application, technical architecture, and mainnet plan. Clear long-term vision and standards-body framing. |

### Differentiation Versus Other Walrus Track Submissions

Most submissions will hit 4–6 of the track's 12 listed signals. We hit all 12. Beyond that:

- **Policy-bounded agent wallets** — no other Walrus track project will solve agent finance.
- **Atomic revocation cascade across memory + files + messaging + wallet** — impossible without Sui's object model + PTBs + Walrus on the same chain.
- **Compliance-grade unified audit log** — correlates MemWal events with on-chain actions.
- **Three working framework adapters** — LangGraph, Claude Agent SDK, Eliza, all P0.
- **Mainnet deployment by August 20** — captures full prize, demonstrates real-world readiness.

---

## Security Posture

- **Threat model document** ships with submission. Covers: compromised session keys, MemWal relayer compromise, malicious allowlisted packages, replay attacks on revocation, oracle manipulation in DeepBookV3 swaps.
- **Self-audit checklist** before submission: capability hot-potato semantics, parallel-execution safety on shared objects, no unbounded vector growth, gas-bounded operations on all entry functions.
- **External review path**: post-submission, request audit credit time from OpenZeppelin and OtterSec (Sui Overflow sponsors). Mainnet deployment gated on at least one external review pass.

---

## Special Considerations

### University Award Eligibility

The Sui Overflow handbook offers ten University Awards of $2,500 each for teams with ≥50% student participation. If our team composition qualifies, we apply for this award in addition to the track prize. To be evaluated based on team makeup at submission.

### Post-Hackathon Resources

The handbook offers $250K+ in post-hackathon value to winning projects (audit credits, ecosystem support, mentorship, accelerator introductions). Our long-term plan assumes capture of these resources to fund Phase 5 and Phase 6 of the GTM plan.

---

## Repository Structure

```
synapse-core/
├── README.md                 (this file)
├── move/
│   └── synapse_core/         Move package (agent, wallet, artifacts, messaging, coordination)
├── sdk/
│   └── packages/
│       ├── client/           TypeScript client (Sui + Walrus + MemWal + Messaging)
│       ├── memwal-bridge/    Synapse-aware MemWal wrapper
│       ├── adapters/
│       │   ├── langgraph/    LangGraph memory + identity backend
│       │   ├── claude-sdk/   Claude Agent SDK adapter
│       │   └── eliza/        Eliza adapter
│       └── indexer/          Cross-subsystem GraphQL indexer
├── web/
│   ├── dashboard/            Next.js 15 user dashboard
│   ├── inspector/            Standalone Memory Inspector dev tool
│   └── site/                 Marketing website (Walrus Sites deployable)
└── docs/
    ├── architecture.md
    ├── ptb-flows.md
    ├── threat-model.md
    ├── adapter-guide.md
    └── go-to-market.md
```

---

## References

- [Sui Overflow 2026](https://overflow.sui.io/) · [Participant Handbook](./handbook.txt)
- [Walrus Docs](https://docs.wal.app/) · [Walrus Sites](https://docs.wal.app/docs/sites)
- [MemWal Docs](https://docs.memwal.ai/) · [MemWal GitHub](https://github.com/MystenLabs/MemWal)
- [Seal Docs](https://seal-docs.wal.app/)
- [Sui Stack Messaging](https://github.com/MystenLabs/sui-stack-messaging)
- [DeepBookV3 Docs](https://docs.sui.io/onchain-finance/deepbookv3/deepbook)
- [Walrus Builder Telegram](https://go.sui.io/ofw-walrus-tg) · [Sui Overflow Telegram](https://go.sui.io/suioverflow2026-tg)

---

*Built for Sui Overflow 2026 · Walrus Specialized Track · Headline Partner*
