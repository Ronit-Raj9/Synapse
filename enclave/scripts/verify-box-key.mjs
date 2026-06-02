import fs from 'fs';
import { sign, getPublicKey, hashes } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { serializeDecisionIntent } from '../src/payload.js';
hashes.sha256 = sha256; hashes.hmacSha256 = (k,m)=>hmac(sha256,k,m);

// Use the SAME key file the running box loaded.
const sk = new Uint8Array(fs.readFileSync('./signing-key'));
const pk = getPublicKey(sk, true);
console.log('box pubkey (should match /public-key):', Buffer.from(pk).toString('hex'));

// Sign a sample decision exactly as /decide does.
const inputsHash = sha256(new TextEncoder().encode('sample-inputs'));
const msg = serializeDecisionIntent({
  vaultId: '0xa7d06b248126ebdc2fea3a400e2eab5761bc6aff1dbf6324423fca584107637a',
  epoch: 1118n, targetWeightMilli: 600n, inputsHash, timestampMs: BigInt(Date.now()),
});
const sig = sign(sha256(msg), sk, { prehash:false });
console.log('signature len:', sig.length, '(64 = valid compact secp256k1)');
console.log('verify locally:', (await import('@noble/secp256k1')).verify(sig, sha256(msg), pk));
