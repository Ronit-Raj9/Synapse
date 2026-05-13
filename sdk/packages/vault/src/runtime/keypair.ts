import { readFile } from 'node:fs/promises';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

export async function loadSessionKeypair(args: {
  sessionKeyPath?: string;
  sessionKeyEnv?: string;
}): Promise<Ed25519Keypair> {
  const raw =
    args.sessionKeyEnv ?? (args.sessionKeyPath ? await readFile(args.sessionKeyPath, 'utf8') : '');
  const value = raw.trim();
  if (!value) {
    throw new Error('Session key is required. Set SYNAPSE_SESSION_KEY or SYNAPSE_SESSION_KEY_PATH.');
  }

  if (value.startsWith('suiprivkey')) {
    return Ed25519Keypair.fromSecretKey(value);
  }

  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 32) {
    throw new Error(
      `Session key must be a suiprivkey string or base64 32-byte Ed25519 secret; got ${bytes.length} bytes`,
    );
  }
  return Ed25519Keypair.fromSecretKey(new Uint8Array(bytes));
}
