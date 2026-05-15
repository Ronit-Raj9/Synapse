import { Navbar } from '../components/ui/navbar';
import { CodeTag } from '../components/ui/code-tag';
import { StrategistConsole } from '../components/strategist/strategist-console';

export const metadata = {
  title: 'Strategist console · Synapse Vault',
};

export default function StrategistPage() {
  return (
    <>
      <Navbar />
      <main className="blueprint-grid relative">
        <div className="absolute inset-0 bg-paper/30" aria-hidden />
        <section className="relative mx-auto max-w-[1200px] px-6 py-16 lg:px-10 lg:py-20">
          <header className="mb-10 flex flex-col gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute">
              <CodeTag>strategist</CodeTag> · capability-gated controls
            </span>
            <h1 className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight md:text-5xl">
              Your <span className="font-serif italic">strategies</span>.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-ink-soft">
              Everything below is signed by your wallet directly against the deployed
              <code className="ml-1 font-mono text-[12px]">strategy_registry</code> module on Sui
              testnet. Deprecate, version-bump, or transfer your strategist capability — the Move
              VM enforces that only the cap-holder can act, with no Synapse-side override.
            </p>
          </header>
          <StrategistConsole />
        </section>
      </main>
    </>
  );
}
