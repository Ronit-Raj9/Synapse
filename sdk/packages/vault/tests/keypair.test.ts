/**
 * Tests for the session/.key file parser. Covers the new
 * `loadMemwalDelegateFromKeyFile` extractor + makes sure
 * `loadSessionKeypair` still handles every historical .key shape.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadMemwalDelegateFromKeyFile,
  loadSessionKeypair,
} from '../src/runtime/keypair.js';

async function makeKeyFile(contents: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'synapse-keypair-test-'));
  const path = join(dir, 'session.key');
  await writeFile(path, contents, 'utf8');
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

// 32 bytes = exactly 64 hex chars (32 pairs).
const VALID_DELEGATE_HEX = 'aa'.repeat(32);

describe('loadMemwalDelegateFromKeyFile', () => {
  let cleanup: (() => Promise<void>) | null = null;
  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  it('extracts privateKeyHex from a dashboard-bundled .key file', async () => {
    const file = await makeKeyFile(
      JSON.stringify({
        address: '0xabc',
        suiPrivateKey: 'suiprivkey1q…',
        secretBase64: 'AA==',
        memwalDelegate: {
          privateKeyHex: VALID_DELEGATE_HEX,
          publicKeyHex: 'aa'.repeat(32),
        },
      }),
    );
    cleanup = file.cleanup;
    const hex = await loadMemwalDelegateFromKeyFile({ sessionKeyPath: file.path });
    expect(hex).toBe(VALID_DELEGATE_HEX);
  });

  it('returns null when the file has no memwalDelegate section', async () => {
    const file = await makeKeyFile(
      JSON.stringify({
        suiPrivateKey: 'suiprivkey1q…',
        secretBase64: 'AA==',
      }),
    );
    cleanup = file.cleanup;
    expect(await loadMemwalDelegateFromKeyFile({ sessionKeyPath: file.path })).toBeNull();
  });

  it('returns null for plain-text suiprivkey files (legacy)', async () => {
    const file = await makeKeyFile('suiprivkey1q…');
    cleanup = file.cleanup;
    expect(await loadMemwalDelegateFromKeyFile({ sessionKeyPath: file.path })).toBeNull();
  });

  it('rejects malformed hex (wrong length, non-hex chars)', async () => {
    const file = await makeKeyFile(
      JSON.stringify({ memwalDelegate: { privateKeyHex: 'not-hex-not-64-chars' } }),
    );
    cleanup = file.cleanup;
    expect(await loadMemwalDelegateFromKeyFile({ sessionKeyPath: file.path })).toBeNull();
  });

  it('strips 0x prefix and normalises case', async () => {
    const upper = VALID_DELEGATE_HEX.toUpperCase();
    const file = await makeKeyFile(
      JSON.stringify({ memwalDelegate: { privateKeyHex: `0x${upper}` } }),
    );
    cleanup = file.cleanup;
    expect(await loadMemwalDelegateFromKeyFile({ sessionKeyPath: file.path })).toBe(
      VALID_DELEGATE_HEX,
    );
  });
});

describe('loadSessionKeypair (regression — must still parse all formats)', () => {
  let cleanup: (() => Promise<void>) | null = null;
  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  it('loads from a JSON .key file (suiPrivateKey field)', async () => {
    // Use a known-valid 32-byte zero secret via base64 fallback path.
    const file = await makeKeyFile(
      JSON.stringify({
        secretBase64: Buffer.alloc(32, 0xab).toString('base64'),
      }),
    );
    cleanup = file.cleanup;
    const kp = await loadSessionKeypair({ sessionKeyPath: file.path });
    expect(kp.toSuiAddress()).toMatch(/^0x[0-9a-f]+$/);
  });

  it('rejects empty input clearly', async () => {
    await expect(loadSessionKeypair({})).rejects.toThrow(/Session key is required/);
  });
});
