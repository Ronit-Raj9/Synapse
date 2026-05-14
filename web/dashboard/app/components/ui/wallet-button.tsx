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
      className="btn-flat"
      data-variant="primary"
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
      <span className="live-dot" />
      <span className="font-mono text-xs">{shortenAddress(account.address)}</span>
    </button>
  );
}
