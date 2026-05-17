/**
 * Time-of-Day (epoch-gated) wrapper strategy
 *
 * Wraps an inner strategy and only allows it to run during specific Sui
 * epochs (modulo a configurable cycle length). Maps roughly to "trade
 * during market hours" semantics.
 *
 * For Sui (~24 epochs per day on testnet ≈ 1 epoch/hour), pass:
 *   cycleLength: 24
 *   allowedSlots: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]  // 8am–5pm
 *
 * Outside the allowed slots the strategy returns NOOP regardless of
 * inner-strategy signal. Inside the slots, behavior is unchanged.
 */

import type {
  Strategy,
  StrategyInput,
  StrategyDecision,
} from '../types.js';

export const TIME_OF_DAY_ID = 'time-of-day' as const;
const STRATEGY_VERSION = '1.0.0';

export interface TimeOfDayConfig {
  inner: Strategy;
  /** Number of epochs per cycle (e.g. 24 for "epoch-as-hour"). */
  cycleLength: number;
  /** Epoch indices (mod cycleLength) during which trading is allowed. */
  allowedSlots: number[];
}

export function timeOfDay(config: TimeOfDayConfig): Strategy {
  validate(config);
  return {
    id: TIME_OF_DAY_ID,
    name: `Time-of-day wrapper (${config.inner.name})`,
    version: STRATEGY_VERSION,
    description:
      `Wraps "${config.inner.name}". Only acts when (currentEpoch mod ${config.cycleLength}) ∈ ` +
      `{${config.allowedSlots.join(',')}}. Outside the window: hold.`,
    evaluate: async (input: StrategyInput): Promise<StrategyDecision> => {
      const slot = Number(input.currentEpoch % BigInt(config.cycleLength));
      if (!config.allowedSlots.includes(slot)) {
        return {
          kind: 'noop',
          rationale: `Epoch ${input.currentEpoch} → slot ${slot} not in trading window {${config.allowedSlots.join(',')}}.`,
          signals: { slot, allowed: config.allowedSlots.join(',') },
        };
      }
      return config.inner.evaluate(input);
    },
    // Delegate per-tick memory writes to the inner strategy so its
    // counters/facts advance even when wrapped. The wrapper itself adds
    // no state of its own.
    ...(config.inner.prepareMemoryWrite
      ? { prepareMemoryWrite: (args) => config.inner.prepareMemoryWrite!(args) }
      : {}),
  };
}

function validate(c: TimeOfDayConfig): void {
  if (c.cycleLength < 1 || c.cycleLength > 10_000) {
    throw new Error('timeOfDay: cycleLength must be in [1, 10000]');
  }
  if (c.allowedSlots.length === 0) {
    throw new Error('timeOfDay: at least one allowed slot required');
  }
  for (const s of c.allowedSlots) {
    if (s < 0 || s >= c.cycleLength || !Number.isInteger(s)) {
      throw new Error(`timeOfDay: slot ${s} out of range [0, ${c.cycleLength})`);
    }
  }
}
