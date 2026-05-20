import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

/**
 * Read + parse the raw bytes of a session-key source. Used by both
 * `loadSessionKeypair` and `loadMemwalDelegateFromKeyFile` so they
 * agree on parsing semantics (suiprivkey, base64, JSON wrapper).
 *
 * `node:fs/promises` is imported dynamically and only when a
 * `sessionKeyPath` is actually given — this keeps the Node-only
 * filesystem module out of browser bundles (the in-browser runtime
 * passes file contents via `sessionKeyEnv`, never a path).
 */
async function readKeySource(args: {
  sessionKeyPath?: string;
  sessionKeyEnv?: string;
}): Promise<string> {
  if (args.sessionKeyEnv !== undefined) return args.sessionKeyEnv.trim();
  if (args.sessionKeyPath) {
    const { readFile } = await import('node:fs/promises');
    return (await readFile(args.sessionKeyPath, 'utf8')).trim();
  }
  return '';
}

export async function loadSessionKeypair(args: {
  sessionKeyPath?: string;
  sessionKeyEnv?: string;
}): Promise<Ed25519Keypair> {
  const value = await readKeySource(args);
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

/**
 * Extract the MemWal delegate private key (hex, 64 chars, no `0x`)
 * from the same session `.key` JSON file the dashboard downloads at
 * mint time. Returns `null` when the file is plain-text (not JSON)
 * or has no `memwalDelegate` section — supports both old and new
 * `.key` formats without breaking existing operator setups.
 *
 * Call sites should prefer an explicit `MEMWAL_DELEGATE_KEY` env
 * value when both sources are present; this loader is the fallback.
 */
export async function loadMemwalDelegateFromKeyFile(args: {
  sessionKeyPath?: string;
  sessionKeyEnv?: string;
}): Promise<string | null> {
  const value = await readKeySource(args);
  if (!value || !value.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(value) as {
      memwalDelegate?: { privateKeyHex?: unknown };
    };
    const hex = parsed.memwalDelegate?.privateKeyHex;
    if (typeof hex !== 'string') return null;
    const cleaned = hex.trim().replace(/^0x/, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(cleaned)) return null;
    return cleaned;
  } catch {
    return null;
  }
}
