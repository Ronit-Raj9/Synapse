// Direct test of the dashboard's consent + budget readers against the
// live vault. Bypasses React, dev server, browser cache — runs the
// same RPC calls the dashboard would make.

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
const SuiClient = SuiJsonRpcClient;
const getFullnodeUrl = getJsonRpcFullnodeUrl;

const VAULT = '0x69b52b5353acb1ed74247ad6771778e86ae1f358ec666aed422dfbecb7e203b6';

const SYNAPSE_PACKAGE_HISTORY = [
  '0xd849b7b281cdc030daf4e2269a36e85e285edd44849b481eb6da49aed1978f01', // v3
  '0x5da36d892956a4659415e245126a3964dd5aa6cf19ec2fdf6332bf828a4c58ed', // v2
  '0x7b3f59e42edbf2189df644e63162d0b9a2c2984755bab9d3e9557c4ddd4aa67c', // v1
];

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

async function readConsent() {
  for (const pkg of SYNAPSE_PACKAGE_HISTORY) {
    try {
      const obj = await client.getDynamicFieldObject({
        parentId: VAULT,
        name: {
          type: `${pkg}::agent::WalrusConsentKey`,
          value: { dummy_field: false },
        },
      });
      const content = obj.data?.content;
      console.log(`[${pkg.slice(0, 10)}…] consent fetch:`, {
        error: obj.error,
        type: content?.type,
        fields: content?.fields,
      });
      if (!content || content.dataType !== 'moveObject') continue;
      // Mirror what the dashboard reader does (post-fix): drill into
      // content.fields.value.fields.accept
      const outer = content.fields;
      const wrapper = outer?.value ?? outer;
      const valueFields = wrapper?.fields ?? wrapper;
      const accept = valueFields?.accept;
      console.log('  → accept =', accept);
      if (typeof accept === 'boolean') return accept;
    } catch (err) {
      console.log(`[${pkg.slice(0, 10)}…] threw:`, err.message);
    }
  }
  return false;
}

async function readBudget() {
  for (const pkg of SYNAPSE_PACKAGE_HISTORY) {
    try {
      const obj = await client.getDynamicFieldObject({
        parentId: VAULT,
        name: {
          type: `${pkg}::agent::OperationalBudgetKey`,
          value: { dummy_field: false },
        },
      });
      const content = obj.data?.content;
      console.log(`[${pkg.slice(0, 10)}…] budget fetch:`, {
        error: obj.error,
        type: content?.type,
      });
      if (!content || content.dataType !== 'moveObject') continue;
      const value = content.fields?.value ?? content.fields;
      console.log('  → fields =', value?.fields ?? value);
    } catch (err) {
      console.log(`[${pkg.slice(0, 10)}…] threw:`, err.message);
    }
  }
}

console.log('=== Consent ===');
const accept = await readConsent();
console.log('Final accept =', accept);
console.log('\n=== Budget ===');
await readBudget();
