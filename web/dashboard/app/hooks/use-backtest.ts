'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  loadBacktest,
  loadBacktestIndex,
  type BacktestIndex,
  type BacktestSummary,
} from '@/lib/backtests';

export function useBacktestIndex(): UseQueryResult<BacktestIndex | null> {
  return useQuery({
    queryKey: ['synapse-backtest-index'],
    queryFn: () => loadBacktestIndex(),
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useBacktest(slug: string | null): UseQueryResult<BacktestSummary | null> {
  return useQuery({
    queryKey: ['synapse-backtest', slug],
    queryFn: () => (slug ? loadBacktest(slug) : Promise.resolve(null)),
    enabled: slug !== null,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
