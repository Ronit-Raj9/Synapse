/**
 * GraphQL Yoga server bound to a `SynapseIndexer`. Defaults to port 4000.
 *
 * Use as a library:
 *   const indexer = new SynapseIndexer({ network: 'testnet', packageId });
 *   indexer.start();
 *   await startServer({ indexer, port: 4000 });
 *
 * Or run directly: `tsx src/server.ts`.
 */

import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import type { SynapseIndexer } from './indexer.js';
import { buildSchema } from './schema.js';

export interface StartServerOptions {
  indexer: SynapseIndexer;
  port?: number;
  host?: string;
}

export interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

export async function startServer(opts: StartServerOptions): Promise<RunningServer> {
  const port = opts.port ?? 4000;
  const host = opts.host ?? '127.0.0.1';
  const yoga = createYoga({ schema: buildSchema(opts.indexer) });
  const server = createServer(yoga);
  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const url = `http://${host}:${port}/graphql`;
  console.log(`[synapse-indexer] GraphQL listening at ${url}`);
  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
