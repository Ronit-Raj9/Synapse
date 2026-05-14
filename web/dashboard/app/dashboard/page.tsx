import { Navbar } from '../components/ui/navbar';
import { DashboardShell } from '../components/dashboard/dashboard-shell';

export const metadata = {
  title: 'Vault Dashboard · Synapse Vault',
};

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <div className="blueprint-grid relative">
        <div className="absolute inset-0 bg-paper/40" aria-hidden />
        <main className="relative mx-auto max-w-[1440px] px-6 py-10 lg:px-10 lg:py-14">
          <DashboardShell />
        </main>
      </div>
    </>
  );
}
