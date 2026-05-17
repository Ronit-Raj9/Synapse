/**
 * News-flag Override (wrapper strategy)
 *
 * Wraps an inner strategy. Before evaluating, it checks `memory.facts`
 * for the configured freeze flag (default: `'freeze:risk-off'`). If the
 * flag is present, the wrapper returns NOOP regardless of what the
 * inner strategy would have decided — providing a kill-switch that an
 * off-chain enrichment process (news scraper, oracle, human risk
 * officer) can flip without redeploying any code.
 *
 * Determinism preserved: the strategy is still a pure function of
 * `StrategyInput`. The freeze flag arrives in `memory.facts`, which is
 * persisted in MemWal and queryable by anyone with read access to the
 * vault's namespace.
 */

import type {
  Strategy,
  StrategyInput,
  StrategyDecision,
} from '../types.js';

export const NEWS_FLAG_OVERRIDE_ID = 'news-flag-override' as const;
const STRATEGY_VERSION = '1.0.0';

export interface NewsFlagOverrideConfig {
  /** The inner strategy to wrap. */
  inner: Strategy;
  /** Fact substring that, when present in memory.facts, forces a NOOP. */
  freezeFactPrefix: string;
}

export function newsFlagOverride(config: NewsFlagOverrideConfig): Strategy {
  return {
    id: NEWS_FLAG_OVERRIDE_ID,
    name: `News-flag wrapper (${config.inner.name})`,
    version: STRATEGY_VERSION,
    description:
      `Wraps "${config.inner.name}". NOOPs whenever \`memory.facts\` contains a fact starting ` +
      `with "${config.freezeFactPrefix}" — lets an off-chain news/risk process freeze trading ` +
      `without redeploying the strategy.`,
    evaluate: async (input: StrategyInput): Promise<StrategyDecision> => {
      const frozen = input.memory.facts.some((f) =>
        f.startsWith(config.freezeFactPrefix),
      );
      if (frozen) {
        const triggeringFact =
          input.memory.facts.find((f) => f.startsWith(config.freezeFactPrefix)) ?? '';
        return {
          kind: 'noop',
          rationale: `Risk-off freeze active: "${triggeringFact}". Holding regardless of inner-strategy signal.`,
          signals: { frozen: true, triggeringFact },
        };
      }
      return config.inner.evaluate(input);
    },
  };
}
