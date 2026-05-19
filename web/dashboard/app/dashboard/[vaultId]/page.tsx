import { Navbar } from '../../components/ui/navbar';
import { DashboardShell } from '../../components/dashboard/dashboard-shell';

export const metadata = {
  title: 'Vault Dashboard · Synapse Vault',
};

interface VaultPageProps {
  params: Promise<{ vaultId: string }>;
}

export default async function VaultDashboardPage({ params }: VaultPageProps) {
  const { vaultId } = await params;
  return (
    <>
      <Navbar />
      <div className="blueprint-grid relative">
        <div className="absolute inset-0 bg-paper/40" aria-hidden />
        <main className="relative mx-auto max-w-[1440px] px-6 py-10 lg:px-10 lg:py-14">
          <DashboardShell forcedVaultId={vaultId} />
        </main>
      </div>
    </>
  );
}
