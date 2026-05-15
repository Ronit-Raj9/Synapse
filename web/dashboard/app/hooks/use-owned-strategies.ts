'use client';

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  loadOwnedStrategistCaps,
  type OwnedStrategistCap,
} from '@/lib/strategist-caps';

/**
 * Strategies the currently-connected wallet owns (via holding a
 * StrategistCap). Returns an empty array when no wallet is connected.
 */
export function useOwnedStrategies(): UseQueryResult<OwnedStrategistCap[]> {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const owner = account?.address ?? null;
  return useQuery({
    queryKey: ['synapse-owned-strategies', owner],
    queryFn: async () => {
      if (!owner) return [];
      return loadOwnedStrategistCaps({ client, owner });
    },
    enabled: owner !== null,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
