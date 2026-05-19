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
});

console.log('Calling recall…');
try {
  const result = await memwal.recall(
    'recent dca-twap strategy decisions counters and outcomes',
    16,
  );
  console.log('total:', result.total);
  console.log('results length:', result.results?.length ?? 0);
  if (result.results?.length) {
    console.log('first result text (first 200 chars):', result.results[0].text.slice(0, 200));
  }
} catch (err) {
  console.error('recall threw:', err.message);
}
