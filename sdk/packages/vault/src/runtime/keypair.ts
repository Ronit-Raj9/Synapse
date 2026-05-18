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

  // Accept the dashboard's JSON download format. Contains the keypair
  // alongside metadata; we pull out `suiPrivateKey` (the canonical
  // Sui CLI form) and fall back to `secretBase64` if the older field
  // is the only one present.
  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value) as {
        suiPrivateKey?: unknown;
        secretBase64?: unknown;
      };
      const sui = typeof parsed.suiPrivateKey === 'string' ? parsed.suiPrivateKey.trim() : '';
      if (sui.startsWith('suiprivkey')) {
        return Ed25519Keypair.fromSecretKey(sui);
      }
      const b64 = typeof parsed.secretBase64 === 'string' ? parsed.secretBase64.trim() : '';
      if (b64) {
        const bytes = Buffer.from(b64, 'base64');
        if (bytes.length === 32) return Ed25519Keypair.fromSecretKey(new Uint8Array(bytes));
      }
      throw new Error(
        'Session key JSON file is missing a usable `suiPrivateKey` or `secretBase64` field.',
      );
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error('Session key file looks like JSON but failed to parse.');
      }
      throw err;
    }
  }

  if (value.startsWith('suiprivkey')) {
    return Ed25519Keypair.fromSecretKey(value);
  }

  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 32) {
    throw new Error(
      `Session key must be a suiprivkey string, base64 32-byte Ed25519 secret, or the dashboard's JSON .key file; got ${bytes.length} bytes`,
    );
  }
  return Ed25519Keypair.fromSecretKey(new Uint8Array(bytes));
}
