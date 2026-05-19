// Direct MemWal probe — uses the vault's bundled delegate key to call
// recall on the namespace. Tells us whether tick 1's `remember` actually
// persisted to the relayer.

import { MemWal } from '@mysten-incubation/memwal';
import { readFileSync } from 'node:fs';

const KEY = JSON.parse(
  readFileSync('/home/suyashagrawal/Downloads/synapse-session-ca1cafc7.key', 'utf8'),
);
const ACCOUNT = '0x9366ed4dde4a36c8f76409009e844735d8093d1ddf2487b8f5a4445f4cb379a7';
const NAMESPACE =
  'synapse:vault:0x0d858684fbc9ec3616909b37893673fa0fa2646de837d68a8e3e28595328f433';

const memwal = MemWal.create({
  key: KEY.memwalDelegate.privateKeyHex,
  accountId: ACCOUNT,
  namespace: NAMESPACE,
  serverUrl: 'https://relayer.staging.memwal.ai',
});

console.log('Calling recall…');
try {
  const result = await memwal.recall(
    'recent dca-twap strategy decisions counters and outcomes',
    32,
  );
  console.log('total:', result.total);
  console.log('results length:', result.results?.length ?? 0);
  // Print each outcome's epoch + dca_tick_index so we can see if the
  // counter is actually advancing across ticks.
  for (const r of result.results ?? []) {
    try {
      const parsed = JSON.parse(r.text);
      console.log(
        '  epoch:', parsed.epoch,
        '| kind:', parsed.kind,
        '| dca_tick_index:', parsed.counters?.dca_tick_index ?? '(n/a)',
        '| decisionId:', parsed.decisionId?.slice(0, 30),
      );
    } catch {
      console.log('  (unparseable):', r.text.slice(0, 80));
    }
  }
} catch (err) {
  console.error('recall threw:', err.message);
}
