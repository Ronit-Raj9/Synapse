import { describe, it, expect } from 'vitest';
import {
  buildStrategy,
  resolveStrategySlug,
  KNOWN_STRATEGIES,
} from '../src/runtime/strategy-resolver.js';
import { CONSERVATIVE_REBALANCER_ID } from '../src/strategies/conservative-rebalancer.js';

describe('built-in strategy resolution', () => {
  it('builds the one built-in (conservative rebalancer)', () => {
    const s = buildStrategy(CONSERVATIVE_REBALANCER_ID, {});
    expect(s.id).toBe(CONSERVATIVE_REBALANCER_ID);
  });

  it('only the conservative rebalancer is a known built-in', () => {
    const slugs = Object.values(KNOWN_STRATEGIES);
    expect(slugs).toEqual([CONSERVATIVE_REBALANCER_ID]);
  });

  it('a non-conservative strategy id is NOT a built-in (Walrus-only)', () => {
    // balanced-yield's on-chain id — no longer mapped to a built-in slug.
    const slug = resolveStrategySlug(
      '0x44c0f7c4f6e04024c9bb1c0ce1eb1965018675cd074e7a410a59c2d43887c679',
    );
    expect(slug).toBeNull();
  });
});
