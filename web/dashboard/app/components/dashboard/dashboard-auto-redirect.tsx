'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnedVaults } from '../../hooks/use-owned-vaults';

/**
 * Client-only side effect for the no-id `/dashboard` entry point.
 * Once the connected wallet's owned-vaults list resolves, push the
 * user to `/dashboard/<newest-vault-id>` so they end up on a
 * shareable per-vault URL. Renders nothing.
 *
 * Renders nothing when there are no owned vaults (the shell already
 * shows "connect wallet / mint a vault" copy in that case) so the
 * user can still complete the connect/mint flow without being
 * bounced around.
 */
export function DashboardAutoRedirect() {
  const router = useRouter();
  const query = useOwnedVaults();
  const newest = query.data?.[0]?.agentId;

  useEffect(() => {
    if (newest) router.replace(`/dashboard/${newest}`);
  }, [newest, router]);

  return null;
}
