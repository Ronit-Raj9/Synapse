import pino, { type Logger } from 'pino';

export type VaultLogger = Logger;

export function createLogger(name = 'synapse-vault-runtime'): VaultLogger {
  return pino({
    name,
    level: process.env.SYNAPSE_LOG_LEVEL ?? 'info',
    base: {
      service: name,
    },
  });
}
