import { Navbar } from '../components/ui/navbar';
import { CodeTag } from '../components/ui/code-tag';
import { MintWizard } from '../components/mint/mint-wizard';

export const metadata = {
  title: 'Mint a vault · Synapse Vault',
};

export default function MintPage() {
  return (
    <>
      <Navbar />
      <main className="blueprint-grid relative">
        <div className="absolute inset-0 bg-paper/30" aria-hidden />
        <section className="relative mx-auto max-w-[1280px] px-6 py-20 lg:px-10 lg:py-28">
          <div className="mb-12 flex flex-col gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute">
              <CodeTag>setup</CodeTag> · 04 steps · ≈ 3 minutes
            </span>
            <h1 className="font-display text-6xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
              Mint your
              <br />
              <span className="font-serif italic">first vault</span>.
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-ink-soft">
              Every constraint you configure here becomes Move VM enforcement at mint time. The
              wallet, memory, and revocation policies are baked into the AgentIdentity from the
              first PTB.
            </p>
          </div>

          <MintWizard />
        </section>
      </main>
    </>
  );
}
