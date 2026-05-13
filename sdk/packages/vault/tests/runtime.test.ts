import { describe, expect, it } from 'vitest';
import { Transaction } from '@mysten/sui/transactions';
import { sha256 } from '@noble/hashes/sha2.js';
import { ActionKind, publishArtifactCall, target } from '@synapse-core/client';
import { buildRebalancePTB } from '../src/executor.js';
import type { AuditReport, RebalancePlan } from '../src/types.js';
import {
  DEEPBOOK_PACKAGE_ID_TESTNET,
  SUI_TYPE_TAG_TESTNET,
  SUI_USDC_POOL_ID_TESTNET,
  USDC_TYPE_TAG_TESTNET,
  deepbookSwap,
} from '../src/runtime/deepbook.js';

const PACKAGE_ID = '0x70db8ce760ac41322284f1fab73016438639e4f5ab5ae2ad6f5362cb3f50ec16';
const AGENT_ID = '0xa758924d6ac5db6680ae7a32011f759af3d991fbc58e0c5c8637680ff824138f';

describe('vault runtime PTB construction', () => {
  it('constructs the noop artifact publish + action log PTB', () => {
    const report = makeReport('noop-fixed');
    const tx = new Transaction();
    publishArtifactCall(tx, PACKAGE_ID, {
      agentId: AGENT_ID,
      walrusBlobId: new TextEncoder().encode('walrus-noop-blob'),
      sha256: report.sha256,
      mimeType: 'text/markdown',
      sizeBytes: BigInt(report.markdown.length),
      sealEncrypted: false,
      label: `audit-${report.planId}`,
    });
    tx.moveCall({
      target: target(PACKAGE_ID, 'attestation', 'log_action'),
      arguments: [
        tx.object(AGENT_ID),
        tx.pure.u8(ActionKind.ArtifactPublish),
        tx.pure.string(`noop ${report.planId}`),
        tx.pure.vector('u8', Array.from(report.sha256)),
      ],
    });

    const calls = moveCalls(tx);
    expect(calls.map((call) => `${call.module}::${call.function}`)).toEqual([
      'artifacts::publish',
      'attestation::log_action',
    ]);
  });

  it('constructs the rebalance PTB with Synapse gates, DeepBook swap, artifact, and log', () => {
    const report = makeReport('plan-fixed');
    const plan: RebalancePlan = {
      kind: 'rebalance',
      planId: 'plan-fixed',
      summary: 'sell SUI for DBUSDC',
      rationaleMarkdown: 'deterministic test rationale',
      signals: { drift: 0.12 },
      trades: [
        {
          poolId: SUI_USDC_POOL_ID_TESTNET,
          fromTypeTag: SUI_TYPE_TAG_TESTNET,
          toTypeTag: USDC_TYPE_TAG_TESTNET,
          amountIn: 1_000_000n,
          minAmountOut: 1n,
          direction: 0,
        },
      ],
    };
    const tx = new Transaction();
    buildRebalancePTB({
      tx,
      synapsePackageId: PACKAGE_ID,
      vaultId: AGENT_ID,
      plan,
      report,
      reportWalrusBlobId: 'walrus-rebalance-blob',
      deepbookPkg: DEEPBOOK_PACKAGE_ID_TESTNET,
      swap: deepbookSwap,
    });

    const calls = moveCalls(tx).map((call) => `${call.package}::${call.module}::${call.function}`);
    expect(calls).toContain(`${PACKAGE_ID}::deepbook_adapter::authorize_swap`);
    expect(calls).toContain(`${PACKAGE_ID}::wallet::spend`);
    expect(calls).toContain(`${DEEPBOOK_PACKAGE_ID_TESTNET}::pool::swap_exact_base_for_quote`);
    expect(calls).toContain(`${PACKAGE_ID}::wallet::deposit`);
    expect(calls).toContain(`${PACKAGE_ID}::deepbook_adapter::record_swap`);
    expect(calls).toContain(`${PACKAGE_ID}::artifacts::publish`);
    expect(calls).toContain(`${PACKAGE_ID}::attestation::log_action`);
  });
});

function makeReport(planId: string): AuditReport {
  const markdown = `# ${planId}`;
  return {
    planId,
    vaultId: AGENT_ID,
    strategyId: 'test-strategy',
    renderedAt: '2026-05-13T00:00:00.000Z',
    epoch: 1n,
    markdown,
    sha256: sha256(new TextEncoder().encode(markdown)),
  };
}

function moveCalls(tx: Transaction) {
  return tx
    .getData()
    .commands.flatMap((command) => (command.$kind === 'MoveCall' ? [command.MoveCall] : []));
}
