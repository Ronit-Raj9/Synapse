'use client';

import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useToast } from './toast';
import { shortenAddress } from '@/lib/format';

/**
 * Sui wallet connect/disconnect button. Wraps `@mysten/dapp-kit`'s
 * `ConnectButton` so the styling matches the rest of the dashboard's
 * flat-shadow aesthetic.
 *
 * When connected, shows the truncated address with a click-to-disconnect.
 * When disconnected, renders the dapp-kit `ConnectButton` (which itself
 * opens a wallet picker modal listing all detected browser wallets).
 */
export function WalletButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const toast = useToast();

  if (!account) {
    return (
      <div className="syn-wallet-slot">
        <ConnectButton connectText="Connect wallet" />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md border-2 border-ink bg-ink px-3 font-mono text-[11px] text-paper transition-all hover:-translate-y-px hover:shadow-[2px_2px_0_0_var(--accent-orange)]"
      onClick={() => {
        disconnect();
        toast.push({
          variant: 'info',
          title: 'Wallet disconnected',
          body: shortenAddress(account.address),
        });
      }}
      title="Click to disconnect"
    >
      <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-state-active">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-state-active" />
      </span>
      {shortenAddress(account.address)}
    </button>
  );
}
