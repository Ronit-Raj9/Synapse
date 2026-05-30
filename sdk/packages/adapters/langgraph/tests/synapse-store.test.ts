import { describe, it, expect } from 'vitest';
import type { MemWal } from '@mysten-incubation/memwal';
import { SynapseStore } from '../src/index.js';

/**
 * In-memory fake of the MemWal client surface the adapter uses
 * (`rememberAndWait` + `recall`). A legitimate network double — it lets us
 * exercise the real SynapseStore logic (encoding, namespace matching, tombstones,
 * filters) without a live relayer. `recall` returns every memory in the
 * namespace at distance 0 so the adapter's own filtering is what's under test.
 */
class FakeMemWal {
  private seq = 0;
  readonly mem = new Map<string, { blobId: string; text: string }[]>();

  async rememberAndWait(text: string, namespace?: string): Promise<{ blob_id: string }> {
    const ns = namespace ?? 'default';
    const blobId = `blob-${this.seq++}`;
    const arr = this.mem.get(ns) ?? [];
    arr.push({ blobId, text });
    this.mem.set(ns, arr);
    return { blob_id: blobId };
  }

  async recall(
    _query: string,
    limit?: number,
    namespace?: string,
  ): Promise<{ results: { blob_id: string; text: string; distance: number }[]; total: number }> {
    const ns = namespace ?? 'default';
    const arr = (this.mem.get(ns) ?? []).slice().reverse(); // newest first
    const results = arr
      .slice(0, limit ?? 5)
      .map((m) => ({ blob_id: m.blobId, text: m.text, distance: 0 }));
    return { results, total: results.length };
  }
}

function makeStore(): { store: SynapseStore; fake: FakeMemWal } {
  const fake = new FakeMemWal();
  const store = new SynapseStore({
    identity: {} as never,
    credentials: { delegateKeyHex: '00' },
    client: fake as unknown as MemWal,
  });
  return { store, fake };
}

describe('SynapseStore', () => {
  it('put then get returns the stored value (cache hit path)', async () => {
    const { store } = makeStore();
    await store.put(['agents', 'alpha'], 'k1', { signal: 'buy', size: 3 });
    const item = await store.get(['agents', 'alpha'], 'k1');
    expect(item?.value).toEqual({ signal: 'buy', size: 3 });
  });

  it('recovers a value via recall when the key index is cold (new store, shared backend)', async () => {
    const { store, fake } = makeStore();
    await store.put(['agents', 'alpha'], 'k1', { signal: 'sell' });
    // Second store with an empty key index but the same backend → must recall.
    const cold = new SynapseStore({
      identity: {} as never,
      credentials: { delegateKeyHex: '00' },
      client: fake as unknown as MemWal,
    });
    const item = await cold.get(['agents', 'alpha'], 'k1');
    expect(item?.value).toEqual({ signal: 'sell' });
  });

  it('returns null for a key that was never written', async () => {
    const { store } = makeStore();
    expect(await store.get(['ns'], 'missing')).toBeNull();
  });

  it('treats a null put as a tombstone — get returns null afterward', async () => {
    const { store, fake } = makeStore();
    await store.put(['ns'], 'k', { v: 1 });
    await store.put(['ns'], 'k', null);
    // Cold store forces the recall path to see the tombstone record.
    const cold = new SynapseStore({
      identity: {} as never,
      credentials: { delegateKeyHex: '00' },
      client: fake as unknown as MemWal,
    });
    expect(await cold.get(['ns'], 'k')).toBeNull();
  });

  it('search filters by namespace prefix', async () => {
    const { store } = makeStore();
    await store.put(['team', 'a'], 'k1', { x: 1 });
    await store.put(['team', 'b'], 'k2', { x: 2 });
    const hits = await store.search(['team', 'a']);
    expect(hits.map((h) => h.key)).toEqual(['k1']);
  });

  it('search applies a numeric comparator filter', async () => {
    const { store } = makeStore();
    await store.put(['m'], 'lo', { score: 1 });
    await store.put(['m'], 'hi', { score: 9 });
    const hits = await store.search(['m'], { filter: { score: { $gt: 5 } } });
    expect(hits.map((h) => h.key)).toEqual(['hi']);
  });

  it('lists namespaces observed by this store', async () => {
    const { store } = makeStore();
    await store.put(['team', 'a'], 'k', { x: 1 });
    await store.put(['team', 'b'], 'k', { x: 2 });
    const ns = await store.listNamespaces();
    expect(ns).toEqual(expect.arrayContaining([['team', 'a'], ['team', 'b']]));
  });

  it('ignores non-Synapse memory text during recall', async () => {
    const { store, fake } = makeStore();
    // Inject a foreign memory directly into the backend namespace.
    await fake.rememberAndWait('not json at all', 'junk');
    await store.put(['junk'], 'real', { ok: true });
    const cold = new SynapseStore({
      identity: {} as never,
      credentials: { delegateKeyHex: '00' },
      client: fake as unknown as MemWal,
    });
    const hits = await cold.search(['junk']);
    expect(hits.map((h) => h.key)).toEqual(['real']);
  });
});
