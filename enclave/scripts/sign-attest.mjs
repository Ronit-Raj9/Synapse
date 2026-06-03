import fs from 'fs';
import { sign, getPublicKey, hashes } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { serializeDecisionIntent } from '../src/payload.js';
hashes.sha256 = sha256; hashes.hmacSha256 = (k,m)=>hmac(sha256,k,m);

const VAULT = '0xa7d06b248126ebdc2fea3a400e2eab5761bc6aff1dbf6324423fca584107637a';
const EPOCH = 1119n;
const WEIGHT = 600n;            // target base weight ×1000 = 60%
const sk = new Uint8Array(fs.readFileSync('./signing-key'));

const inputsHash = sha256(new TextEncoder().encode(`live-test ${VAULT} e${EPOCH}`));
const timestampMs = BigInt(Date.now());
const msg = serializeDecisionIntent({ vaultId: VAULT, epoch: EPOCH, targetWeightMilli: WEIGHT, inputsHash, timestampMs });
const sig = sign(sha256(msg), sk, { prehash:false });

const arr = (b)=>'['+Array.from(b).join(',')+']';
console.log('ENCLAVE  =', '0x361b7a26380d5312247ff0afca78086c996ecc159bd30ca3b0a5ee4bf949ab9f');
console.log('VAULT    =', VAULT);
console.log('EPOCH    =', EPOCH.toString());
console.log('WEIGHT   =', WEIGHT.toString());
console.log('TIMESTAMP=', timestampMs.toString());
console.log('HASH     =', arr(inputsHash));
console.log('SIG      =', arr(sig));
