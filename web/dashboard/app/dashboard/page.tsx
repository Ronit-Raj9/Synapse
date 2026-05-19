import { Navbar } from '../components/ui/navbar';
import { DashboardShell } from '../components/dashboard/dashboard-shell';
import { DashboardAutoRedirect } from '../components/dashboard/dashboard-auto-redirect';

export const metadata = {
  title: 'Vault Dashboard · Synapse Vault',
};

/**
 * No-id entry point. The auto-redirect client island detects the
 * connected wallet's newest owned vault and pushes the user to
 * `/dashboard/<vaultId>` so every viewer ends up on a per-vault,
 * shareable URL. If no vault is owned, the shell stays in
 * "connect wallet / mint a vault" mode.
 */
export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <DashboardAutoRedirect />
      <div className="blueprint-grid relative">
        <div className="absolute inset-0 bg-paper/40" aria-hidden />
        <main className="relative mx-auto max-w-[1440px] px-6 py-10 lg:px-10 lg:py-14">
          <DashboardShell />
        </main>
      </div>
    </>
  );
}
