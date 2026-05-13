#!/usr/bin/env node
import { VaultRuntime } from '../runtime.js';
import { loadFromEnv } from '../config.js';
import { createLogger } from '../logger.js';

const logger = createLogger('synapse-vault-runtime-cli');

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadFromEnv({
    ...process.env,
    ...(args.agentId ? { SYNAPSE_AGENT_ID: args.agentId } : {}),
    ...(args.packageId ? { SYNAPSE_PACKAGE_ID: args.packageId } : {}),
    ...(args.sessionKeyPath ? { SYNAPSE_SESSION_KEY_PATH: args.sessionKeyPath } : {}),
    ...(args.memwalDelegate ? { MEMWAL_DELEGATE_KEY: args.memwalDelegate } : {}),
  });
  const runtime = new VaultRuntime(config);
  if (args.once) {
    const receipt = await runtime.tickOnce();
    logger.info(
      receipt
        ? {
            txDigest: receipt.txDigest,
            walrusBlobId: receipt.reportWalrusBlobId,
            artifactSlot: receipt.artifactSlot.toString(),
            planId: receipt.planId,
          }
        : { noop: true },
      'runtime once completed',
    );
    return;
  }

  runtime.start();
  const stop = async () => {
    logger.info('stopping runtime');
    await runtime.stop();
  };
  process.once('SIGINT', () => {
    void stop();
  });
  process.once('SIGTERM', () => {
    void stop();
  });
}

interface CliArgs {
  once: boolean;
  agentId?: string;
  packageId?: string;
  sessionKeyPath?: string;
  memwalDelegate?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = { once: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--once') {
      parsed.once = true;
      continue;
    }
    const next = argv[i + 1];
    if (!next) throw new Error(`${arg} requires a value`);
    if (arg === '--agent-id') parsed.agentId = next;
    else if (arg === '--package-id') parsed.packageId = next;
    else if (arg === '--session-key-path') parsed.sessionKeyPath = next;
    else if (arg === '--memwal-delegate') parsed.memwalDelegate = next;
    else throw new Error(`Unknown argument ${arg}`);
    i += 1;
  }
  return parsed;
}

main().catch((err: unknown) => {
  logger.error({ err }, 'runtime failed');
  process.exitCode = 1;
});
