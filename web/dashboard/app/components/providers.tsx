'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { ToastProvider } from './ui/toast';
import { NETWORK } from '@/lib/synapse-config';

type DappKitNetwork = 'mainnet' | 'testnet' | 'devnet';
const dappKitNetwork: DappKitNetwork = NETWORK === 'localnet' ? 'testnet' : NETWORK;

import '@mysten/dapp-kit/dist/index.css';

const { networkConfig } = createNetworkConfig({
  testnet: { url: 'https://fullnode.testnet.sui.io:443', network: 'testnet' },
  mainnet: { url: 'https://fullnode.mainnet.sui.io:443', network: 'mainnet' },
  devnet: { url: 'https://fullnode.devnet.sui.io:443', network: 'devnet' },
});

/**
 * Top-level client providers: React Query (used internally by dapp-kit for
 * RPC caching), SuiClientProvider (binds network selection), WalletProvider
 * (manages connected wallet state + signing), ToastProvider (UI feedback).
 *
 * Mounted from the root layout so every page has access to all of these.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={dappKitNetwork}>
        <WalletProvider autoConnect>
          <ToastProvider>{children}</ToastProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
