# Autonomous Cross-Agent Product Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the cross-agent messaging + AI-advisor loop run autonomously inside the vault runtime tick, with per-vault API keys and cost-gated LLM calls.

**Architecture:** Four bounded units in the existing single-tenant daemon (`synapse-vault-runtime` → one `VaultRuntime` → `tickOnce()`): (1) a new `runtime/messaging.ts` module wired into `tickOnce` for consume+emit of Seal-encrypted, Walrus-stored signals on persisted on-chain channels; (2) a per-vault Anthropic key via the existing `SecretsProvider` seam; (3) drift/staleness gating around the LLM call; (4) a client-side dashboard key-config generator. All new I/O degrades gracefully — never trips the tick kill-switch.

**Tech Stack:** TypeScript, Node, vitest, `@mysten/messaging` (with the MVR `overrides.packages` fix already landed), `@mysten/sui`, MemWal counters for cross-tick state.

**Spec:** `docs/superpowers/specs/2026-06-02-autonomous-cross-agent-product-loop-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `sdk/packages/vault/src/runtime/secrets.ts` | add `anthropic_api_key` secret | Modify |
| `sdk/packages/vault/tests/secrets.test.ts` | secret tests | Modify |
| `sdk/packages/vault/src/runtime/strategy-resolver.ts` | thread `apiKey` into `buildStrategy`/overrides | Modify |
| `sdk/packages/vault/tests/strategy-resolver.test.ts` | resolver apiKey test | Create |
| `sdk/packages/vault/src/strategies/llm-advisor.ts` | drift/staleness gate + model tiering | Modify |
| `sdk/packages/vault/tests/llm-advisor.test.ts` | gating tests | Modify |
| `sdk/packages/vault/src/runtime/messaging.ts` | all Sui-Stack-Messaging mechanics behind `consumeSignals`/`emitSignal` | Create |
| `sdk/packages/vault/tests/messaging.test.ts` | messaging unit tests (faked client) | Create |
| `sdk/packages/vault/src/runtime/runtime.ts` | call consume before `evaluate`, emit after rebalance | Modify |
| `web/dashboard/app/components/mint/anthropic-key-config.tsx` | client-side key→config generator | Create |

---

## Unit 2 — Per-vault API key (model A)

### Task 1: Add `anthropic_api_key` to the secrets seam

**Files:**
- Modify: `sdk/packages/vault/src/runtime/secrets.ts:16-48`
- Modify: `sdk/packages/vault/tests/secrets.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `sdk/packages/vault/tests/secrets.test.ts` inside the `EnvSecretsProvider` describe block:

```typescript
  it('reads the anthropic api key from ANTHROPIC_API_KEY', async () => {
    const provider = new EnvSecretsProvider({ ANTHROPIC_API_KEY: 'sk-ant-123' });
    expect(await provider.get('anthropic_api_key')).toBe('sk-ant-123');
  });
```

And inside the `FileSecretsProvider` describe block (after the existing file cases):

```typescript
  it('reads the anthropic api key from the anthropic-api-key file', async () => {
    await writeFile(join(dir, 'anthropic-api-key'), '  sk-ant-file  \n');
    expect(await new FileSecretsProvider(dir).get('anthropic_api_key')).toBe('sk-ant-file');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sdk/packages/vault && npx vitest run tests/secrets.test.ts`
Expected: FAIL — TypeScript error, `'anthropic_api_key'` not assignable to `SecretName`.

- [ ] **Step 3: Implement**

In `sdk/packages/vault/src/runtime/secrets.ts`, change the type and both maps:

```typescript
export type SecretName = 'session_key' | 'memwal_delegate' | 'anthropic_api_key';
```

```typescript
const ENV_VAR_BY_SECRET: Record<SecretName, string> = {
  session_key: 'SYNAPSE_SESSION_KEY',
  memwal_delegate: 'MEMWAL_DELEGATE_KEY',
  anthropic_api_key: 'ANTHROPIC_API_KEY',
};
```

```typescript
const FILE_NAME_BY_SECRET: Record<SecretName, string> = {
  session_key: 'session-key',
  memwal_delegate: 'memwal-delegate',
  anthropic_api_key: 'anthropic-api-key',
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sdk/packages/vault && npx vitest run tests/secrets.test.ts`
Expected: PASS (all secret cases).

- [ ] **Step 5: Commit**

```bash
git add sdk/packages/vault/src/runtime/secrets.ts sdk/packages/vault/tests/secrets.test.ts
git commit -m "feat(vault): add anthropic_api_key to the secrets seam"
```

### Task 2: Thread the per-vault key into the LLM advisor build

**Files:**
- Modify: `sdk/packages/vault/src/runtime/strategy-resolver.ts:95-159`
- Create: `sdk/packages/vault/tests/strategy-resolver.test.ts`
- Modify: `sdk/packages/vault/src/runtime/runtime.ts` (overrides block ~313-320)

Context: `buildStrategy(slug, overrides)` builds `llmAdvisor({...})` without `apiKey` today (it falls back to `process.env`). We add `apiKey` to `BuildStrategyOverrides` and pass it through, then resolve it in the runtime via the secrets provider.

- [ ] **Step 1: Write failing test**

Create `sdk/packages/vault/tests/strategy-resolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildStrategy } from '../src/runtime/strategy-resolver.js';
import { LLM_ADVISOR_ID } from '../src/strategies/llm-advisor.js';

describe('buildStrategy apiKey threading', () => {
  it('builds the llm-advisor without throwing when apiKey override is set', () => {
    const s = buildStrategy(LLM_ADVISOR_ID, { apiKey: 'sk-ant-xyz' });
    expect(s.id).toBe(LLM_ADVISOR_ID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sdk/packages/vault && npx vitest run tests/strategy-resolver.test.ts`
Expected: FAIL — `apiKey` not in `BuildStrategyOverrides` type.

- [ ] **Step 3: Implement — add `apiKey` to overrides + pass it through**

Find the `BuildStrategyOverrides` interface in `strategy-resolver.ts` (above `buildStrategy`, ~line 95-105) and add a field:

```typescript
  /** Per-vault Anthropic key for the llm-advisor; falls back to env when unset. */
  apiKey?: string;
```

In the `LLM_ADVISOR_ID` case (line 149-157) add the `apiKey` only when present (keeps `exactOptionalPropertyTypes` happy):

```typescript
    case LLM_ADVISOR_ID:
      // AI-driven: needs an Anthropic key on the runtime (per-vault via the
      // secrets provider, else ANTHROPIC_API_KEY). Degrades to a transparent
      // noop without one. Server-side only.
      return llmAdvisor({
        baseTypeTag: commonPair.baseTypeTag,
        baseSymbol: commonPair.baseSymbol,
        quoteTypeTag: commonPair.quoteTypeTag,
        quoteSymbol: commonPair.quoteSymbol,
        poolId: commonPair.poolId,
        slippageTolerance: 0.005,
        driftThreshold: 0.05,
        ...(overrides.apiKey ? { apiKey: overrides.apiKey } : {}),
      });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd sdk/packages/vault && npx vitest run tests/strategy-resolver.test.ts`
Expected: PASS.

- [ ] **Step 5: Resolve the key in the runtime and put it in overrides**

In `sdk/packages/vault/src/runtime/runtime.ts`, find the `overrides` object built around line 313-320. Immediately after `if (this.#config.poolIdOverride) overrides.poolId = this.#config.poolIdOverride;` add:

```typescript
    // Per-vault Anthropic key (model A): resolve from the configured secrets
    // provider, else the runtime's own ANTHROPIC_API_KEY env. Threaded into the
    // llm-advisor build so the key flows explicitly per runtime rather than
    // being read implicitly inside the strategy.
    const anthropicKey =
      (await this.#secrets.get('anthropic_api_key')) ?? process.env.ANTHROPIC_API_KEY ?? null;
    if (anthropicKey) overrides.apiKey = anthropicKey;
```

Add the `apiKey` field to the local `overrides` type annotation on that same object (currently `{ quoteTypeTag?: string; quoteSymbol?: string; poolId?: string }`):

```typescript
    const overrides: { quoteTypeTag?: string; quoteSymbol?: string; poolId?: string; apiKey?: string } = {};
```

If the class has no `#secrets` field yet, add one. Near the other private fields at the top of the `VaultRuntime` class add:

```typescript
  readonly #secrets: SecretsProvider;
```

In the constructor, initialise it (default to env so existing callers are unaffected):

```typescript
    this.#secrets = config.secretsProvider ?? new EnvSecretsProvider();
```

Add the import at the top of `runtime.ts`:

```typescript
import { EnvSecretsProvider, type SecretsProvider } from './secrets.js';
```

Add the optional field to `RuntimeConfig` in `sdk/packages/vault/src/runtime/config.ts` (in the `interface RuntimeConfig`, near `strategy: Strategy;` line 44):

```typescript
  /** Pluggable secret source; defaults to env. Used for the per-vault API key. */
  secretsProvider?: SecretsProvider;
```

And import the type at the top of `config.ts`:

```typescript
import type { SecretsProvider } from './secrets.js';
```

- [ ] **Step 6: Typecheck + full vault test suite**

Run: `cd sdk/packages/vault && npx tsc --noEmit && npx vitest run`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add sdk/packages/vault/src/runtime/strategy-resolver.ts sdk/packages/vault/src/runtime/runtime.ts sdk/packages/vault/src/runtime/config.ts sdk/packages/vault/tests/strategy-resolver.test.ts
git commit -m "feat(vault): thread per-vault anthropic key into llm-advisor"
```

---

## Unit 3 — LLM tick-gating

### Task 3: Gate the Claude call by drift + staleness, with model tiering

**Files:**
- Modify: `sdk/packages/vault/src/strategies/llm-advisor.ts`
- Modify: `sdk/packages/vault/tests/llm-advisor.test.ts`

Context: `llmAdvisor(config, { advise })` calls `advise(input, config)` every tick (line 102). We insert a gate: skip the call and reuse the last target weight unless the base price moved past a threshold OR enough epochs passed. State lives in `input.memory.counters` and is written back via `prepareMemoryWrite`.

- [ ] **Step 1: Write failing tests**

Add to `sdk/packages/vault/tests/llm-advisor.test.ts` a new describe block (the `makeInput`/`build` helpers already exist at the top of the file):

```typescript
describe('llmAdvisor tick-gating', () => {
  it('does NOT call advise when within idle epochs and under drift', async () => {
    let calls = 0;
    const advise: AdviseFn = async () => {
      calls += 1;
      return { targetBaseWeight: 0.5, confidence: 0.9, rationale: 'r' };
    };
    const s = llmAdvisor(
      {
        baseTypeTag: BASE, baseSymbol: 'SUI', quoteTypeTag: QUOTE, quoteSymbol: 'USDC',
        poolId: POOL, slippageTolerance: 0.005, driftThreshold: 0.05,
        llmRecallThreshold: 0.015, llmMaxIdleEpochs: 5,
      },
      { advise },
    );
    // Prior state: called at epoch 100 at price 1.0, target 0.5.
    const input = makeInput({
      currentEpoch: 101n,
      memory: {
        strategyId: 'llm-advisor',
        counters: { lastLlmEpoch: 100, lastLlmPriceMilli: 1000, lastTargetWeightMilli: 500 },
        facts: [],
      },
    });
    const d = await s.evaluate(input);
    expect(calls).toBe(0);
    expect(d.signals?.llmGated).toBe(true);
  });

  it('calls advise when price drift exceeds the recall threshold', async () => {
    let calls = 0;
    const advise: AdviseFn = async () => {
      calls += 1;
      return { targetBaseWeight: 0.7, confidence: 0.9, rationale: 'r' };
    };
    const s = llmAdvisor(
      {
        baseTypeTag: BASE, baseSymbol: 'SUI', quoteTypeTag: QUOTE, quoteSymbol: 'USDC',
        poolId: POOL, slippageTolerance: 0.005, driftThreshold: 0.05,
        llmRecallThreshold: 0.015, llmMaxIdleEpochs: 5,
      },
      { advise },
    );
    // Price moved 1.0 -> 1.1 (10% > 1.5% threshold), same epoch window.
    const input = makeInput({
      currentEpoch: 101n,
      market: {
        prices: { SUI: 1.1, USDC: 1 },
        pools: [{ poolId: POOL, baseTypeTag: BASE, quoteTypeTag: QUOTE, bestBid: 1.09, bestAsk: 1.11, mid: 1.1, volume24h: 1000 }],
        asOf: new Date().toISOString(),
      },
      holdings: [
        { coinTypeTag: BASE, symbol: 'SUI', amount: 80_000_000_000n, decimals: 9, priceUsd: 1.1, valueUsd: 88 },
        { coinTypeTag: QUOTE, symbol: 'USDC', amount: 20_000_000n, decimals: 6, priceUsd: 1, valueUsd: 20 },
      ],
      memory: {
        strategyId: 'llm-advisor',
        counters: { lastLlmEpoch: 100, lastLlmPriceMilli: 1000, lastTargetWeightMilli: 500 },
        facts: [],
      },
    });
    await s.evaluate(input);
    expect(calls).toBe(1);
  });

  it('calls advise on first run (no prior state)', async () => {
    let calls = 0;
    const advise: AdviseFn = async () => {
      calls += 1;
      return { targetBaseWeight: 0.5, confidence: 0.9, rationale: 'r' };
    };
    const s = build(advise); // build() uses no gating config -> defaults
    await s.evaluate(makeInput());
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sdk/packages/vault && npx vitest run tests/llm-advisor.test.ts`
Expected: FAIL — `llmRecallThreshold`/`llmMaxIdleEpochs` not in config type; `llmGated` signal absent.

- [ ] **Step 3: Implement the gate**

In `sdk/packages/vault/src/strategies/llm-advisor.ts`, add gating fields + tiering to `LlmAdvisorConfig` (after `apiKey?: string;` line 65):

```typescript
  /** Base-price move (fraction, e.g. 0.015 = 1.5%) since the last LLM call that
   *  forces a fresh call. Default 0.015. */
  llmRecallThreshold?: number;
  /** Max epochs between LLM calls regardless of drift. Default 1. */
  llmMaxIdleEpochs?: number;
  /** Model used on a large-drift escalation; falls back to `model`. */
  escalateModel?: string;
}
```

Add module constants near `DEFAULT_MODEL` (line 34):

```typescript
const DEFAULT_RECALL_THRESHOLD = 0.015;
const DEFAULT_MAX_IDLE_EPOCHS = 1;
```

Replace the body of `evaluate` from the `let rec` block (lines 100-116) so it gates first. Insert this BEFORE the existing `let rec: AdvisorRecommendation | null = null;` line:

```typescript
      // --- Cost gate: only spend an LLM call when something material changed.
      const basePrice =
        input.holdings.find((h) => h.coinTypeTag === config.baseTypeTag)?.priceUsd ??
        input.market.prices[config.baseSymbol] ??
        0;
      const lastEpoch = input.memory.counters['lastLlmEpoch'];
      const lastPriceMilli = input.memory.counters['lastLlmPriceMilli'];
      const lastWeightMilli = input.memory.counters['lastTargetWeightMilli'];
      const recallThreshold = config.llmRecallThreshold ?? DEFAULT_RECALL_THRESHOLD;
      const maxIdle = config.llmMaxIdleEpochs ?? DEFAULT_MAX_IDLE_EPOCHS;
      const hasPrior =
        typeof lastEpoch === 'number' &&
        typeof lastPriceMilli === 'number' &&
        typeof lastWeightMilli === 'number';
      const epochsSince = hasPrior ? Number(input.currentEpoch) - lastEpoch : Infinity;
      const drift =
        hasPrior && lastPriceMilli > 0
          ? Math.abs(basePrice - lastPriceMilli / 1000) / (lastPriceMilli / 1000)
          : Infinity;
      const mustCall = !hasPrior || epochsSince >= maxIdle || drift >= recallThreshold;

      if (!mustCall) {
        // Reuse the last AI target — no API spend. Run the deterministic
        // rebalancer with the cached weight so policy gates still apply.
        const reusedWeight = clamp01(lastWeightMilli / 1000);
        const rebalReuse = conservativeRebalancer({
          baseTypeTag: config.baseTypeTag,
          baseSymbol: config.baseSymbol,
          quoteTypeTag: config.quoteTypeTag,
          quoteSymbol: config.quoteSymbol,
          targetBaseWeight: reusedWeight,
          driftThreshold: config.driftThreshold,
          poolId: config.poolId,
          slippageTolerance: config.slippageTolerance,
        });
        const reuseDecision = await rebalReuse.evaluate(input);
        const gatedSignals = { llmGated: true, llmTargetBaseWeight: reusedWeight };
        if (reuseDecision.kind === 'rebalance') {
          return { ...reuseDecision, signals: { ...reuseDecision.signals, ...gatedSignals } };
        }
        return {
          ...reuseDecision,
          rationale: `AI (cached, no material change): ${reuseDecision.rationale}`,
          signals: { ...(reuseDecision.signals ?? {}), ...gatedSignals },
        };
      }
      // Escalate to the heavier model on a large move.
      const effectiveModel =
        drift >= recallThreshold * 4 && config.escalateModel ? config.escalateModel : config.model;
      const callConfig: LlmAdvisorConfig = { ...config, ...(effectiveModel ? { model: effectiveModel } : {}) };
```

Then change the existing advise call to use `callConfig`:

```typescript
      let rec: AdvisorRecommendation | null = null;
      try {
        rec = await advise(input, callConfig);
```

- [ ] **Step 4: Persist gate state in `prepareMemoryWrite`**

Replace `prepareMemoryWrite` (lines 158-168) so it records the LLM call point. The target weight comes from the decision's `signals.llmTargetBaseWeight` (set on both rebalance and noop paths):

```typescript
    prepareMemoryWrite: async ({ input, decision }): Promise<MemoryWrite> => {
      const prior = input.memory.counters['llmTicks'] ?? 0;
      const gated = decision.signals?.llmGated === true;
      const basePrice =
        input.holdings.find((h) => h.coinTypeTag === config.baseTypeTag)?.priceUsd ??
        input.market.prices[config.baseSymbol] ??
        0;
      const targetWeight =
        typeof decision.signals?.llmTargetBaseWeight === 'number'
          ? decision.signals.llmTargetBaseWeight
          : (input.memory.counters['lastTargetWeightMilli'] ?? 0) / 1000;
      // On a gated tick we keep the prior call's epoch/price so staleness keeps
      // counting from the real last call; on a real call we stamp now.
      const counters: Record<string, number> = {
        llmTicks: prior + 1,
        lastTargetWeightMilli: Math.round(clamp01(targetWeight) * 1000),
        lastLlmEpoch: gated
          ? (input.memory.counters['lastLlmEpoch'] ?? Number(input.currentEpoch))
          : Number(input.currentEpoch),
        lastLlmPriceMilli: gated
          ? (input.memory.counters['lastLlmPriceMilli'] ?? Math.round(basePrice * 1000))
          : Math.round(basePrice * 1000),
      };
      const fact =
        decision.kind === 'rebalance'
          ? `epoch ${input.currentEpoch}: AI rebalanced — ${decision.summary}`
          : `epoch ${input.currentEpoch}: AI held — ${decision.rationale.slice(0, 160)}`;
      return { counters, facts: [fact] };
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd sdk/packages/vault && npx vitest run tests/llm-advisor.test.ts`
Expected: PASS (gating + existing tests).

- [ ] **Step 6: Typecheck**

Run: `cd sdk/packages/vault && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add sdk/packages/vault/src/strategies/llm-advisor.ts sdk/packages/vault/tests/llm-advisor.test.ts
git commit -m "feat(vault): gate llm-advisor calls by drift + staleness with model tiering"
```

---

## Unit 1 — Cross-agent messaging in the tick

### Task 4: `messaging.ts` module + `consumeSignals` (faked client)

**Files:**
- Create: `sdk/packages/vault/src/runtime/messaging.ts`
- Create: `sdk/packages/vault/tests/messaging.test.ts`

Design for isolation: the module depends on a minimal `MessagingLike` interface (not the concrete SDK client), so it's unit-testable without network and the SDK stays a runtime detail.

- [ ] **Step 1: Write failing test for `consumeSignals`**

Create `sdk/packages/vault/tests/messaging.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { consumeSignals, type MessagingLike } from '../src/runtime/messaging.js';

function fakeClient(messages: { text: string; sender: string }[]): MessagingLike {
  return {
    messaging: {
      getChannelMessages: async () => ({
        messages: messages.map((m) => ({ text: m.text, sender: m.sender, createdAtMs: '0' })),
        cursor: BigInt(messages.length),
        hasNextPage: false,
        direction: 'forward' as const,
      }),
      getUserMemberCap: async () => ({ id: { id: '0xcap' } }) as never,
      getChannelObjectsByChannelIds: async () => [] as never,
      executeSendMessageTransaction: async () => ({ digest: '0xd' }) as never,
    },
  };
}

describe('consumeSignals', () => {
  it('returns peer messages as fact strings and advances the cursor', async () => {
    const client = fakeClient([{ text: 'rotate 5% SUI->USDC', sender: '0xpeer' }]);
    const res = await consumeSignals({
      client,
      inboxChannelId: '0xchan',
      userAddress: '0xme',
      lastCursor: null,
    });
    expect(res.facts).toHaveLength(1);
    expect(res.facts[0]).toContain('rotate 5% SUI->USDC');
    expect(res.facts[0]).toContain('0xpeer');
    expect(res.newCursor).toBe(1n);
  });

  it('no-ops cleanly when inboxChannelId is null', async () => {
    const res = await consumeSignals({
      client: fakeClient([]),
      inboxChannelId: null,
      userAddress: '0xme',
      lastCursor: null,
    });
    expect(res.facts).toEqual([]);
    expect(res.newCursor).toBeNull();
  });

  it('degrades to empty facts when the client throws', async () => {
    const throwing: MessagingLike = {
      messaging: {
        getChannelMessages: async () => {
          throw new Error('relayer down');
        },
        getUserMemberCap: async () => null,
        getChannelObjectsByChannelIds: async () => [] as never,
        executeSendMessageTransaction: async () => ({ digest: '0xd' }) as never,
      },
    };
    const res = await consumeSignals({
      client: throwing,
      inboxChannelId: '0xchan',
      userAddress: '0xme',
      lastCursor: null,
    });
    expect(res.facts).toEqual([]);
    expect(res.newCursor).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sdk/packages/vault && npx vitest run tests/messaging.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `messaging.ts` (interface + `consumeSignals`)**

Create `sdk/packages/vault/src/runtime/messaging.ts`:

```typescript
/**
 * Cross-agent signalling for the runtime tick.
 *
 * Wraps Sui Stack Messaging behind two functions the tick calls — `consumeSignals`
 * (read peers' Seal-decrypted messages from the on-chain inbox channel, turn them
 * into memory facts) and `emitSignal` (send one Seal-encrypted, Walrus-stored
 * message to the outbox channel on a rebalance). Channels are PERSISTED on-chain
 * (`messaging_inbox` / `messaging_outbox` on the vault) — this module never
 * creates channels. All I/O degrades to a no-op on failure so a flaky relayer
 * never trips the tick kill-switch.
 *
 * The module depends on `MessagingLike`, the minimal slice of the messaging SDK
 * client it actually uses, so it is unit-testable without a live network.
 */

/** Minimal Seal symmetric-key envelope the SDK's send path expects. */
export interface EncryptedSymmetricKeyLike {
  $kind: 'Encrypted';
  encryptedBytes: Uint8Array;
  version: number;
}

/** The slice of the `@mysten/messaging` client extension this module uses. */
export interface MessagingLike {
  messaging: {
    getChannelMessages(req: {
      channelId: string;
      userAddress: string;
      cursor?: bigint | null;
      limit?: number;
      direction?: 'backward' | 'forward';
    }): Promise<{ messages: { text: string; sender: string; createdAtMs: string }[]; cursor: bigint | null; hasNextPage: boolean }>;
    getUserMemberCap(userAddress: string, channelId: string): Promise<{ id: { id: string } } | null>;
    getChannelObjectsByChannelIds(req: {
      channelIds: string[];
      userAddress: string;
    }): Promise<{ encryption_key_history: { latest: ArrayLike<number>; latest_version: number } }[]>;
    executeSendMessageTransaction(req: {
      signer: unknown;
      channelId: string;
      memberCapId: string;
      message: string;
      encryptedKey: EncryptedSymmetricKeyLike;
    }): Promise<{ digest: string }>;
  };
}

export interface ConsumeArgs {
  client: MessagingLike;
  inboxChannelId: string | null;
  userAddress: string;
  lastCursor: bigint | null;
  limit?: number;
}

export interface ConsumeResult {
  facts: string[];
  newCursor: bigint | null;
}

/**
 * Read new inbox messages since `lastCursor`, returning them as memory-fact
 * strings to inject into the strategy input. Degrades to `{ facts: [], newCursor:
 * lastCursor }` on any failure or when no channel is attached.
 */
export async function consumeSignals(args: ConsumeArgs): Promise<ConsumeResult> {
  if (!args.inboxChannelId) return { facts: [], newCursor: null };
  try {
    const res = await args.client.messaging.getChannelMessages({
      channelId: args.inboxChannelId,
      userAddress: args.userAddress,
      cursor: args.lastCursor,
      direction: 'forward',
      ...(args.limit ? { limit: args.limit } : {}),
    });
    const facts = res.messages.map(
      (m) => `peer ${m.sender.slice(0, 10)}: ${m.text}`,
    );
    return { facts, newCursor: res.cursor ?? args.lastCursor };
  } catch {
    // Degrade: no peer facts this tick. Keep the old cursor so nothing is skipped.
    return { facts: [], newCursor: args.lastCursor };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd sdk/packages/vault && npx vitest run tests/messaging.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sdk/packages/vault/src/runtime/messaging.ts sdk/packages/vault/tests/messaging.test.ts
git commit -m "feat(vault): add messaging module with consumeSignals"
```

### Task 5: `emitSignal`

**Files:**
- Modify: `sdk/packages/vault/src/runtime/messaging.ts`
- Modify: `sdk/packages/vault/tests/messaging.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `sdk/packages/vault/tests/messaging.test.ts`:

```typescript
import { emitSignal } from '../src/runtime/messaging.js';

function emitClient(sent: { message: string }[]): MessagingLike {
  return {
    messaging: {
      getChannelMessages: async () => ({ messages: [], cursor: null, hasNextPage: false, direction: 'forward' as const }),
      getUserMemberCap: async () => ({ id: { id: '0xcap' } }),
      getChannelObjectsByChannelIds: async () => [
        { encryption_key_history: { latest: [1, 2, 3], latest_version: 0 } },
      ],
      executeSendMessageTransaction: async (req) => {
        sent.push({ message: req.message });
        return { digest: '0xsenddigest' };
      },
    },
  };
}

describe('emitSignal', () => {
  it('sends one message and returns the digest', async () => {
    const sent: { message: string }[] = [];
    const res = await emitSignal({
      client: emitClient(sent),
      outboxChannelId: '0xout',
      userAddress: '0xme',
      signer: {},
      message: 'rebalanced 5% SUI->USDC',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].message).toContain('rebalanced');
    expect(res?.digest).toBe('0xsenddigest');
  });

  it('no-ops (returns null) when outboxChannelId is null', async () => {
    const sent: { message: string }[] = [];
    const res = await emitSignal({
      client: emitClient(sent),
      outboxChannelId: null,
      userAddress: '0xme',
      signer: {},
      message: 'x',
    });
    expect(res).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('degrades to null when the member cap is missing', async () => {
    const client: MessagingLike = {
      messaging: {
        getChannelMessages: async () => ({ messages: [], cursor: null, hasNextPage: false, direction: 'forward' as const }),
        getUserMemberCap: async () => null,
        getChannelObjectsByChannelIds: async () => [
          { encryption_key_history: { latest: [1], latest_version: 0 } },
        ],
        executeSendMessageTransaction: async () => ({ digest: '0xd' }),
      },
    };
    const res = await emitSignal({
      client,
      outboxChannelId: '0xout',
      userAddress: '0xme',
      signer: {},
      message: 'x',
    });
    expect(res).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sdk/packages/vault && npx vitest run tests/messaging.test.ts`
Expected: FAIL — `emitSignal` not exported.

- [ ] **Step 3: Implement `emitSignal`**

Append to `sdk/packages/vault/src/runtime/messaging.ts`:

```typescript
export interface EmitArgs {
  client: MessagingLike;
  outboxChannelId: string | null;
  userAddress: string;
  signer: unknown;
  message: string;
}

export interface EmitResult {
  digest: string;
}

/**
 * Send ONE Seal-encrypted, Walrus-stored message to the outbox channel. The
 * current channel DEK is read from the on-chain channel's `encryption_key_history`
 * (latest entry) — the same path the SDK uses internally. Returns null (degrades)
 * when no channel is attached, the member cap is missing, or send fails.
 */
export async function emitSignal(args: EmitArgs): Promise<EmitResult | null> {
  if (!args.outboxChannelId) return null;
  try {
    const cap = await args.client.messaging.getUserMemberCap(args.userAddress, args.outboxChannelId);
    if (!cap) return null;

    const [channel] = await args.client.messaging.getChannelObjectsByChannelIds({
      channelIds: [args.outboxChannelId],
      userAddress: args.userAddress,
    });
    if (!channel) return null;

    const encryptedKey: EncryptedSymmetricKeyLike = {
      $kind: 'Encrypted',
      encryptedBytes: new Uint8Array(Array.from(channel.encryption_key_history.latest)),
      version: channel.encryption_key_history.latest_version,
    };

    const res = await args.client.messaging.executeSendMessageTransaction({
      signer: args.signer,
      channelId: args.outboxChannelId,
      memberCapId: cap.id.id,
      message: args.message,
      encryptedKey,
    });
    return { digest: res.digest };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd sdk/packages/vault && npx vitest run tests/messaging.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sdk/packages/vault/src/runtime/messaging.ts sdk/packages/vault/tests/messaging.test.ts
git commit -m "feat(vault): add emitSignal to the messaging module"
```

### Task 6: Build the messaging client in the runtime and wire consume + emit into `tickOnce`

**Files:**
- Modify: `sdk/packages/vault/src/runtime/messaging.ts` (add `buildMessagingClient`)
- Modify: `sdk/packages/vault/src/runtime/runtime.ts`

Context: `tickOnce` flow is in `runtime.ts`. We (a) build a messaging-extended client once per runtime, (b) read `agent.identity.messagingInbox/Outbox`, (c) consume before `evaluate` and merge facts into `input.memory.facts`, (d) emit after a rebalance lands. The read-cursor persists as a MemWal counter `msgCursor`.

- [ ] **Step 1: Add a `buildMessagingClient` factory (no new test — exercised by the live smoke + typecheck)**

Append to `sdk/packages/vault/src/runtime/messaging.ts`:

```typescript
import { SuiClient } from '@mysten/sui/client';
import { SealClient } from '@mysten/seal';
import {
  messaging,
  TESTNET_MESSAGING_PACKAGE_CONFIG,
  TESTNET_WALRUS_STORAGE_CONFIG,
} from '@mysten/messaging';
import { TESTNET_SEAL_KEY_SERVER_OBJECT_IDS } from '@mysten/seal';

export interface BuildMessagingClientArgs {
  url: string;
  ownerAddress: string;
  signer: unknown;
  walrusEpochs: number;
}

/**
 * Build a Sui client extended with Seal + Sui Stack Messaging, using the MVR
 * `overrides.packages` fix so `@local-pkg/sui-stack-messaging` resolves without
 * an MVR API URL. Returns the messaging-capable client as `MessagingLike`.
 */
export function buildMessagingClient(args: BuildMessagingClientArgs): MessagingLike {
  const client = new SuiClient({
    url: args.url,
    mvr: {
      overrides: {
        packages: {
          '@local-pkg/sui-stack-messaging': TESTNET_MESSAGING_PACKAGE_CONFIG.packageId,
        },
      },
    },
  })
    .$extend(
      SealClient.asClientExtension({
        serverConfigs: TESTNET_SEAL_KEY_SERVER_OBJECT_IDS.map((objectId) => ({ objectId, weight: 1 })),
      }),
    )
    .$extend(
      messaging({
        packageConfig: TESTNET_MESSAGING_PACKAGE_CONFIG,
        walrusStorageConfig: { ...TESTNET_WALRUS_STORAGE_CONFIG, epochs: args.walrusEpochs },
        sessionKeyConfig: { address: args.ownerAddress, ttlMin: 30, signer: args.signer as never },
        sealConfig: { threshold: 2 },
      }),
    );
  return client as unknown as MessagingLike;
}
```

NOTE: confirm the exact export names `TESTNET_WALRUS_STORAGE_CONFIG` and `TESTNET_SEAL_KEY_SERVER_OBJECT_IDS` against `examples/messaging-demo/src/send-message.ts` (that file already imports the working names — copy them verbatim). If they differ, use the names from that file.

- [ ] **Step 2: Verify the imports resolve (typecheck)**

Run: `cd sdk/packages/vault && npx tsc --noEmit`
Expected: no errors. If an import name is wrong, fix it from `examples/messaging-demo/src/send-message.ts` and re-run.

If `@mysten/messaging` / `@mysten/seal` are not dependencies of the vault package, add them:

Run: `cd sdk/packages/vault && npm pkg get dependencies` — if missing, `npm install @mysten/messaging@0.3.0 @mysten/seal --save` from the package dir, then re-run typecheck.

- [ ] **Step 3: Wire consume into `tickOnce` before `evaluate`**

In `runtime.ts`, locate where `input: StrategyInput` is built (~line 460) — just before `const decision = await activeStrategy.evaluate(input);` (line 472). Insert a consume block that augments `input.memory.facts`. Add this immediately AFTER the `const input: StrategyInput = {...};` object is constructed:

```typescript
    // --- Cross-agent consume: read peers' signals from the on-chain inbox
    // channel and inject them as memory facts so the strategy/LLM sees them.
    // Persisted channel ids come from the vault's on-chain state; the cursor
    // persists as a MemWal counter. All failures degrade to no peer facts.
    const inboxId = agent.identity.messagingInbox ?? null;
    const outboxId = agent.identity.messagingOutbox ?? null;
    let msgClient: import('./messaging.js').MessagingLike | null = null;
    let consumed: { facts: string[]; newCursor: bigint | null } = { facts: [], newCursor: null };
    if (inboxId || outboxId) {
      try {
        msgClient = buildMessagingClient({
          url: this.#config.fullnodeUrl,
          ownerAddress: signer.toSuiAddress(),
          signer,
          walrusEpochs: this.#config.walrusEpochs ?? DEFAULT_WALRUS_EPOCHS,
        });
        const lastCursorNum = input.memory.counters['msgCursor'];
        consumed = await consumeSignals({
          client: msgClient,
          inboxChannelId: inboxId,
          userAddress: signer.toSuiAddress(),
          lastCursor: typeof lastCursorNum === 'number' ? BigInt(lastCursorNum) : null,
        });
        if (consumed.facts.length > 0) {
          input.memory.facts = [...input.memory.facts, ...consumed.facts];
          this.#logger.info(
            { count: consumed.facts.length, inbox: inboxId },
            'consumed cross-agent signals into strategy memory',
          );
        }
      } catch (err) {
        this.#logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'cross-agent consume failed; proceeding without peer signals',
        );
      }
    }
```

Add the imports at the top of `runtime.ts`:

```typescript
import { buildMessagingClient, consumeSignals, emitSignal } from './messaging.js';
```

Confirm `this.#config.fullnodeUrl` is the correct field name for the RPC URL on `RuntimeConfig` (grep `config.ts` for the URL field — it may be `fullnodeUrl`). Use the actual name.

- [ ] **Step 4: Wire emit + cursor persistence after a rebalance lands**

The rebalance path executes a PTB and returns a receipt (after line 555+, where `buildRebalancePTB` runs and the tx executes). After the rebalance transaction has executed successfully and BEFORE the function returns its receipt, add:

```typescript
    // --- Cross-agent emit: broadcast this rebalance to peers as a Seal-encrypted,
    // Walrus-stored message on the outbox channel. Only fires on rebalance (noops
    // stay silent → bounds WAL cost). Degrades to no broadcast on failure.
    if (msgClient && outboxId) {
      try {
        const summary =
          decision.kind === 'rebalance' ? decision.summary : 'rebalance';
        const emitted = await emitSignal({
          client: msgClient,
          outboxChannelId: outboxId,
          userAddress: signer.toSuiAddress(),
          signer,
          message: `signal @${currentEpoch}: ${summary}`,
        });
        if (emitted) {
          this.#logger.info({ digest: emitted.digest, outbox: outboxId }, 'emitted cross-agent signal');
        }
      } catch (err) {
        this.#logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'cross-agent emit failed; rebalance already landed',
        );
      }
    }
```

Persist the advanced cursor via the strategy memory write. In BOTH the noop branch (`rememberStrategyOutcome` call ~line 509) and the rebalance branch's memory write, merge the new cursor into the counters. The cleanest single change: just before each `rememberStrategyOutcome(...)`/memory persistence, fold the cursor into `memoryWrite`:

```typescript
    // Fold the advanced message cursor into the strategy's memory write so the
    // next tick resumes after the messages we just consumed.
    const memoryWriteWithCursor =
      consumed.newCursor !== null
        ? {
            ...(memoryWrite ?? {}),
            counters: {
              ...(memoryWrite?.counters ?? {}),
              msgCursor: Number(consumed.newCursor),
            },
          }
        : memoryWrite;
```

Then replace `memoryWrite` with `memoryWriteWithCursor` in the `rememberStrategyOutcome({ ... memoryWrite })` calls (both noop and rebalance paths).

- [ ] **Step 5: Typecheck + full suite**

Run: `cd sdk/packages/vault && npx tsc --noEmit && npx vitest run`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add sdk/packages/vault/src/runtime/messaging.ts sdk/packages/vault/src/runtime/runtime.ts sdk/packages/vault/package.json
git commit -m "feat(vault): wire cross-agent consume + emit into the tick loop"
```

### Task 7: On-chain send/receive audit records

**Files:**
- Modify: `sdk/packages/vault/src/runtime/messaging.ts` (add `recordReceivePTB` / `recordSendPTB` helpers)
- Modify: `sdk/packages/vault/src/runtime/runtime.ts`

Context: `examples/messaging-demo/src/send-message.ts` shows the exact Move targets — `messaging_bridge::record_send` / `record_receive`, args `[vault, channelId (id), digest (vector<u8>)]`, signed by the session key. We record one `record_receive` per consumed message and one `record_send` after emit, as the audit edge the indexer/dashboard render.

- [ ] **Step 1: Add digest + PTB helpers to `messaging.ts`**

Append to `sdk/packages/vault/src/runtime/messaging.ts`:

```typescript
import { Transaction } from '@mysten/sui/transactions';

/** sha256(text) as a byte array — the on-chain correlation digest. */
export async function messageDigest(text: string): Promise<number[]> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(bytes);
}

/** Append a `messaging_bridge::record_receive` call to `tx`. */
export function recordReceivePTB(
  tx: Transaction,
  packageId: string,
  vaultId: string,
  channelId: string,
  digest: number[],
): void {
  tx.moveCall({
    target: `${packageId}::messaging_bridge::record_receive`,
    arguments: [tx.object(vaultId), tx.pure.id(channelId), tx.pure.vector('u8', digest)],
  });
}

/** Append a `messaging_bridge::record_send` call to `tx`. */
export function recordSendPTB(
  tx: Transaction,
  packageId: string,
  vaultId: string,
  channelId: string,
  digest: number[],
): void {
  tx.moveCall({
    target: `${packageId}::messaging_bridge::record_send`,
    arguments: [tx.object(vaultId), tx.pure.id(channelId), tx.pure.vector('u8', digest)],
  });
}
```

- [ ] **Step 2: Write a unit test for digest + PTB shape**

Append to `sdk/packages/vault/tests/messaging.test.ts`:

```typescript
import { messageDigest, recordSendPTB } from '../src/runtime/messaging.js';
import { Transaction } from '@mysten/sui/transactions';

describe('audit records', () => {
  it('messageDigest returns a 32-byte array', async () => {
    const d = await messageDigest('hello');
    expect(d).toHaveLength(32);
    expect(d.every((b) => b >= 0 && b <= 255)).toBe(true);
  });

  it('recordSendPTB adds a moveCall to the transaction', () => {
    const tx = new Transaction();
    recordSendPTB(tx, '0xpkg', '0xvault', '0xchan', [1, 2, 3]);
    const data = tx.getData();
    expect(data.commands.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails then passes**

Run: `cd sdk/packages/vault && npx vitest run tests/messaging.test.ts`
First expected: FAIL (helpers not exported) → after Step 1 already added them, expected: PASS. If Step 1 was committed in this task, just run and expect PASS.

- [ ] **Step 4: Record receives after consume, send after emit (runtime)**

In `runtime.ts`, after the consume block (Task 6 Step 3) — when `consumed.facts.length > 0` — submit one `record_receive` per consumed message in a single PTB signed by the session key. Inside the `if (consumed.facts.length > 0) { ... }` block add:

```typescript
          try {
            const recvTx = new Transaction();
            for (const fact of consumed.facts) {
              const digest = await messageDigest(fact);
              recordReceivePTB(recvTx, this.#config.packageId, this.#config.agentId, inboxId!, digest);
            }
            await this.#client.signAndExecuteTransaction({ signer, transaction: recvTx });
          } catch (err) {
            this.#logger.warn(
              { err: err instanceof Error ? err.message : String(err) },
              'record_receive failed; signals still consumed in-memory',
            );
          }
```

In the emit block (Task 6 Step 4), after a successful `emitted`, record the send:

```typescript
        if (emitted) {
          this.#logger.info({ digest: emitted.digest, outbox: outboxId }, 'emitted cross-agent signal');
          try {
            const sendTx = new Transaction();
            const digest = await messageDigest(`signal @${currentEpoch}: ${decision.kind === 'rebalance' ? decision.summary : 'rebalance'}`);
            recordSendPTB(sendTx, this.#config.packageId, this.#config.agentId, outboxId, digest);
            await this.#client.signAndExecuteTransaction({ signer, transaction: sendTx });
          } catch (err) {
            this.#logger.warn(
              { err: err instanceof Error ? err.message : String(err) },
              'record_send failed; message already sent',
            );
          }
        }
```

Add `recordReceivePTB`, `recordSendPTB`, `messageDigest` to the existing messaging import in `runtime.ts`:

```typescript
import {
  buildMessagingClient, consumeSignals, emitSignal,
  recordReceivePTB, recordSendPTB, messageDigest,
} from './messaging.js';
import { Transaction } from '@mysten/sui/transactions';
```

(If `Transaction` is already imported in `runtime.ts`, don't duplicate the import.)

- [ ] **Step 5: Typecheck + full suite**

Run: `cd sdk/packages/vault && npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add sdk/packages/vault/src/runtime/messaging.ts sdk/packages/vault/src/runtime/runtime.ts sdk/packages/vault/tests/messaging.test.ts
git commit -m "feat(vault): record_send/record_receive audit edges for cross-agent signals"
```

---

## Unit 4 — Dashboard demo affordance

### Task 8: Client-side Anthropic key → runtime-config generator

**Files:**
- Create: `web/dashboard/app/components/mint/anthropic-key-config.tsx`

Context: a self-contained client component. The user pastes their key; it never leaves the browser. The component renders a copy-paste `.env` block and a download for the `anthropic-api-key` secret file. Follow the dashboard's existing component conventions (read `node_modules/next/dist/docs/` per `web/dashboard/AGENTS.md` before writing Next-specific code).

- [ ] **Step 1: Read the dashboard component conventions**

Run: `sed -n '1,40p' web/dashboard/app/components/mint/mint-wizard.tsx`
Note: the styling tokens (`font-display`, `text-ink`, `border-ink/12`, `bg-paper`) and that components are `'use client'`.

- [ ] **Step 2: Implement the component**

Create `web/dashboard/app/components/mint/anthropic-key-config.tsx`:

```tsx
'use client';

import { useState } from 'react';

/**
 * Model A "Bring your Anthropic key" panel. The key is templated into runtime
 * config entirely client-side — it is never sent to any server. The DAO runs
 * its own `synapse-vault-runtime` with this config, so it pays its own
 * inference and we never custody the key.
 */
export function AnthropicKeyConfig() {
  const [key, setKey] = useState('');
  const [copied, setCopied] = useState(false);

  const envBlock = `# synapse-vault-runtime — your vault's Anthropic key (model A)\nANTHROPIC_API_KEY=${key || 'sk-ant-...'}\n`;

  const copy = async () => {
    await navigator.clipboard.writeText(envBlock);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([key], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anthropic-api-key';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-ink/12 bg-paper p-4">
      <h3 className="font-display text-sm font-semibold text-ink">Bring your Anthropic key</h3>
      <p className="mt-1 text-xs text-ink-soft">
        Your vault&rsquo;s AI advisor runs on your own key. It never leaves your browser — paste it
        to generate the runtime config you drop into your <code>synapse-vault-runtime</code>.
      </p>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="sk-ant-..."
        className="mt-3 w-full rounded-md border border-ink/15 bg-paper-strong px-3 py-2 font-mono text-xs text-ink"
      />
      <pre className="mt-3 overflow-x-auto rounded-md border border-divider bg-paper-strong p-3 font-mono text-[11px] text-ink-soft">
        {envBlock}
      </pre>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={!key}
          className="rounded-md border-2 border-ink bg-accent-orange px-3 py-1.5 font-display text-xs font-semibold text-paper disabled:opacity-40"
        >
          {copied ? 'Copied' : 'Copy .env'}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={!key}
          className="rounded-md border border-ink/20 bg-paper px-3 py-1.5 font-display text-xs font-semibold text-ink disabled:opacity-40"
        >
          Download secret file
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build the dashboard to verify it compiles**

Run: `cd web/dashboard && npx tsc --noEmit`
Expected: no errors. (Wire the panel into the mint wizard / vault settings as a follow-up placement step — it's a standalone component now.)

- [ ] **Step 4: Commit**

```bash
git add web/dashboard/app/components/mint/anthropic-key-config.tsx
git commit -m "feat(dashboard): client-side anthropic key config generator (model A)"
```

---

## Final: live smoke test (manual, testnet)

### Task 9: End-to-end daemon tick on the paired demo vaults

Not an automated test — a manual verification using the two vaults already wired (`0x4310c67c…` / `0x70d2d8d4…`, paired channel attached).

- [ ] **Step 1: Seed one inbound message** so consume has something to read:

Run: `bash /home/suyashagrawal/Desktop/Synapse/run-messaging.sh`
Expected: the existing demo sends a message + `record_send`/`record_receive` land (already verified working).

- [ ] **Step 2: Run a single daemon tick** against the recipient vault with messaging enabled. From `sdk/packages/vault`, with the recipient vault's env (`SYNAPSE_AGENT_ID`, session `.key`, `ANTHROPIC_API_KEY`, fullnode URL) set, run the runtime bin for one tick (use the existing `synapse-vault-runtime` with a once flag if present, else let it tick once and Ctrl-C):

Run: `node dist/runtime/bin/run.js` (after `npm run build -w @synapse-core/vault`)
Expected logs: `consumed cross-agent signals into strategy memory` (count ≥ 1), and on a rebalance, `emitted cross-agent signal` with a digest. If the advisor is gated, expect `llmGated` in the decision signals and NO Anthropic spend.

- [ ] **Step 3: Confirm on-chain** the `record_receive` (and `record_send` if it rebalanced) digests landed, and that a fresh Walrus message blob exists (resolves on the testnet aggregator). Capture the tx digests for the demo.

- [ ] **Step 4: Note any gaps** — if the live run surfaces an SDK shape mismatch (e.g. an import name or the `encryption_key_history` field), fix inline, add a regression note, re-run.

---

## Notes / follow-ups (out of scope, flagged)

- **Republish the Walrus llm-advisor blob** so the live demo vault (which hires the published copy) picks up tick-gating. Separate task: rebuild the bundle, re-publish to Walrus, update the on-chain `code_hash`.
- **Bump `DEFAULT_WALRUS_EPOCHS`** (runtime.ts:87) to cover the judging window (e.g. 183 ≈ ~6 months) so message/report blobs don't expire mid-demo — independent one-liner.
- **Managed key custody (model B)** — operator-custodied per-vault keys via Seal — future tier.
