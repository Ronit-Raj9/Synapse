/**
 * Single source of truth for script-side configuration. Every standalone
 * script imports from here so a package upgrade is a one-line change
 * (this file) rather than a multi-file find-and-replace.
 *
 * Override at the shell with:
 *   PACKAGE_ID=0x… SYNAPSE_NETWORK=mainnet npx tsx scripts/<name>.ts
 */

export const DEFAULT_PACKAGE_ID =
  '0x5da36d892956a4659415e245126a3964dd5aa6cf19ec2fdf6332bf828a4c58ed';

export const PACKAGE_ID = process.env['PACKAGE_ID'] ?? DEFAULT_PACKAGE_ID;

export type Network = 'testnet' | 'mainnet';

export const NETWORK: Network =
  (process.env['SYNAPSE_NETWORK'] as Network) ?? 'testnet';

/** Canonical seeded strategies on testnet. Slug → on-chain Strategy ID. */
export const SEEDED_STRATEGIES = {
  'conservative-rebalancer':
    '0x46996c0f9e692968f55a63c3cbc33eb8d19145c123b7a867a02da342e617d3ec',
  'balanced-yield':
    '0x44c0f7c4f6e04024c9bb1c0ce1eb1965018675cd074e7a410a59c2d43887c679',
  'aggressive-momentum':
    '0xa1d73e17bc4c53484a3254c5ed3c0b24e340524d0014703c072f91d60f02d4a1',
} as const;

/** StrategistCap object IDs that govern the seeded strategies. */
export const SEEDED_STRATEGIST_CAPS = {
  'conservative-rebalancer':
    '0xbd2a46a5e6d18598f5cdbff4002c1229eea048bce35cd54328e779f970eaaca6',
  'balanced-yield':
    '0x37900489b3f11d2d69f7d295931da4f105f503c8ac8229cd1c1656ef7b8ee39e',
  'aggressive-momentum':
    '0x33748b686ad45d109442369aba5e933df28f3ca8becc25822e3637833e7755c7',
} as const;

/** Default DeepBookV3 testnet package — used for vault allowlists. */
export const DEEPBOOK_PACKAGE_ID_TESTNET =
  '0xcaf6ba059d539a97646d47f0b9ddf843e138d215e2a12ca1f4585d386f7aec3a';
