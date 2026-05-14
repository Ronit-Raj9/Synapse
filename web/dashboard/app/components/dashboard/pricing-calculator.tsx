'use client';

import { useState } from 'react';
import { formatUsd } from '@/lib/format';
import { CodeTag } from '../ui/code-tag';

const PRESET_AUM = [1_000_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000];

/**
 * Pricing calculator. Slider over AUM size + management/performance basis-
 * point inputs; outputs projected ARR. Renders the revenue story visually
 * for prospective DAO clients.
 */
export function PricingCalculator() {
  const [aum, setAum] = useState(10_000_000);
  const [mgmtBps, setMgmtBps] = useState(100);
  const [perfBps, setPerfBps] = useState(50);
  const [annualReturnPct, setAnnualReturnPct] = useState(8);
  const [benchmarkReturnPct, setBenchmarkReturnPct] = useState(3);

  const mgmtFeeUsd = (aum * mgmtBps) / 10_000;
  const alpha = Math.max(0, annualReturnPct - benchmarkReturnPct) / 100;
  const perfFeeUsd = aum * alpha * (perfBps / 10_000);
  const totalArr = mgmtFeeUsd + perfFeeUsd;

  return (
    <div className="card-flat grid grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      {/* Inputs */}
      <div className="border-b-2 border-ink p-8 lg:border-b-0 lg:border-r-2">
        <div className="mb-6 flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute">
            <CodeTag>inputs</CodeTag>
          </span>
        </div>

        <Field label="Treasury AUM" sublabel="Assets under management">
          <div className="grid gap-3">
            <input
              type="range"
              min={500_000}
              max={250_000_000}
              step={500_000}
              value={aum}
              onChange={(e) => setAum(Number(e.target.value))}
              className="w-full accent-ink"
            />
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_AUM.map((v) => (
                <button
                  key={v}
                  onClick={() => setAum(v)}
                  className={`rounded-sm border-2 px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition ${
                    v === aum
                      ? 'border-ink bg-ink text-paper'
                      : 'border-divider bg-paper text-ink-soft hover:border-ink'
                  }`}
                >
                  {v >= 1_000_000 ? `${v / 1_000_000}M` : `${v / 1000}K`}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Field label="Management fee" sublabel="Annual, accrued continuously">
          <BpsSlider value={mgmtBps} onChange={setMgmtBps} max={250} />
        </Field>

        <Field label="Performance fee" sublabel="Of realized alpha vs benchmark">
          <BpsSlider value={perfBps} onChange={setPerfBps} max={200} />
        </Field>

        <Field label="Expected return %" sublabel="Strategy gross annualised">
          <PercentSlider value={annualReturnPct} onChange={setAnnualReturnPct} max={25} />
        </Field>

        <Field label="Benchmark %" sublabel="SUI/USD index, USDC yield curve, etc.">
          <PercentSlider value={benchmarkReturnPct} onChange={setBenchmarkReturnPct} max={15} />
        </Field>
      </div>

      {/* Outputs */}
      <div className="relative bg-paper-strong p-8">
        <div className="dot-grid absolute inset-0 opacity-30" aria-hidden />
        <div className="relative">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute">
            <CodeTag>annual revenue</CodeTag>
          </span>
          <p className="num-display mt-3 text-6xl">{formatUsd(totalArr)}</p>
          <p className="mt-1 font-serif italic text-ink-mute">per Vault, at this configuration</p>

          <hr className="divider-dashed my-8" />

          <Breakdown
            label="Management fee"
            value={mgmtFeeUsd}
            sublabel={`${mgmtBps / 100}% of ${formatUsd(aum)}`}
            accent="var(--accent-blue)"
          />
          <Breakdown
            label="Performance fee"
            value={perfFeeUsd}
            sublabel={`${perfBps / 100}% of ${(alpha * 100).toFixed(2)}% alpha`}
            accent="var(--accent-orange)"
          />

          <div className="mt-10 rounded-sm border-2 border-ink bg-paper p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              <CodeTag>five vault portfolio</CodeTag>
            </p>
            <p className="num-display mt-2 text-3xl">{formatUsd(totalArr * 5)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              Five comparable DAO treasuries =
              <span className="font-serif italic"> {formatUsd(totalArr * 5)} ARR ceiling</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="font-display text-sm font-semibold text-ink">{label}</label>
        {sublabel && <span className="font-mono text-[10px] text-ink-mute">{sublabel}</span>}
      </div>
      {children}
    </div>
  );
}

function BpsSlider({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={max}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-ink"
      />
      <span className="num w-20 rounded-sm border-2 border-ink bg-paper px-2 py-1 text-right text-sm">
        {value} bps
      </span>
    </div>
  );
}

function PercentSlider({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-ink"
      />
      <span className="num w-20 rounded-sm border-2 border-ink bg-paper px-2 py-1 text-right text-sm">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function Breakdown({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: number;
  sublabel: string;
  accent: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm border border-ink" style={{ backgroundColor: accent }} />
        <span className="font-display font-semibold">{label}</span>
        <span className="num ml-auto font-semibold">{formatUsd(value)}</span>
      </div>
      <p className="ml-5 mt-0.5 font-mono text-[11px] text-ink-mute">{sublabel}</p>
    </div>
  );
}
