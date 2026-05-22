'use client';

import { useEffect, useRef } from 'react';

const ASSETS = [
  { symbol: 'SUI', color: '#4A9BFF', pct: 42, angle: -30 },
  { symbol: 'USDC', color: '#5BD49C', pct: 35, angle: 30 },
  { symbol: 'DEEP', color: '#FF6B35', pct: 12, angle: 150 },
  { symbol: 'WAL', color: '#9D7AEB', pct: 8, angle: 210 },
  { symbol: 'ETH', color: '#F7C543', pct: 3, angle: -90 },
];

const LOGS = [
  { action: 'rebalance', detail: 'SUI → USDC  2,400 units', status: 'ok' },
  { action: 'recall', detail: 'MemWal: strategy context loaded', status: 'ok' },
  { action: 'audit', detail: 'report → Walrus  blob 0x7f…e3', status: 'ok' },
  { action: 'fetch', detail: 'DeepBook SUI/USDC spread 0.12%', status: 'ok' },
  { action: 'spend', detail: 'policy gate ✓  cap 2.1% / 5%', status: 'ok' },
  { action: 'remember', detail: 'MemWal: rebalance rationale saved', status: 'ok' },
  { action: 'tick', detail: 'next cycle in 14m 32s', status: 'wait' },
];

export function HeroScene() {
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logsRef.current;
    if (!el) return;
    let idx = 0;
    const iv = setInterval(() => {
      const rows = el.querySelectorAll<HTMLElement>('.log-row');
      rows.forEach((r) => r.classList.remove('log-highlight'));
      if (rows[idx]) {
        rows[idx].classList.add('log-highlight');
      }
      idx = (idx + 1) % rows.length;
    }, 2200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="hero-scene">
      <style>{SCENE_CSS}</style>

      {/* Background grid */}
      <div className="hs-grid" />

      {/* Central AI agent node */}
      <div className="hs-agent">
        <div className="hs-agent-pulse" />
        <div className="hs-agent-pulse hs-agent-pulse-2" />
        <div className="hs-agent-core">
          <svg viewBox="0 0 40 40" width="32" height="32">
            <path
              d="M20 4L4 14v12l16 10 16-10V14L20 4z"
              fill="none"
              stroke="#030F1C"
              strokeWidth="1.5"
            />
            <circle cx="20" cy="20" r="5" fill="#4A9BFF" />
            <circle cx="20" cy="20" r="8" fill="none" stroke="#4A9BFF" strokeWidth="0.6" opacity="0.5" />
            <line x1="20" y1="12" x2="20" y2="4" stroke="#030F1C" strokeWidth="0.8" />
            <line x1="12" y1="24" x2="4" y2="20" stroke="#030F1C" strokeWidth="0.8" />
            <line x1="28" y1="24" x2="36" y2="20" stroke="#030F1C" strokeWidth="0.8" />
          </svg>
          <span className="hs-agent-label">AGENT</span>
        </div>
      </div>

      {/* Orbiting asset bubbles */}
      {ASSETS.map((a, i) => (
        <div
          key={a.symbol}
          className="hs-asset"
          style={{
            '--angle': `${a.angle}deg`,
            '--delay': `${i * 0.3}s`,
            '--color': a.color,
          } as React.CSSProperties}
        >
          <div className="hs-asset-dot" />
          <span className="hs-asset-sym">{a.symbol}</span>
          <span className="hs-asset-pct">{a.pct}%</span>
        </div>
      ))}

      {/* Connection lines (SVG) */}
      <svg className="hs-connections" viewBox="0 0 400 400">
        {ASSETS.map((a, i) => {
          const rad = (a.angle * Math.PI) / 180;
          const r = 130;
          const ex = 200 + Math.cos(rad) * r;
          const ey = 200 + Math.sin(rad) * r;
          const mx = 200 + Math.cos(rad) * r * 0.45;
          const my = 200 + Math.sin(rad) * r * 0.45;
          return (
            <g key={a.symbol}>
              <line
                x1="200" y1="200" x2={ex} y2={ey}
                stroke={a.color}
                strokeWidth="1"
                opacity="0.2"
                strokeDasharray="4 4"
              />
              <circle cx={mx} cy={my} r="2.5" fill={a.color} opacity="0.7">
                <animate
                  attributeName="cx"
                  values={`200;${ex};200`}
                  dur={`${3 + i * 0.5}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="cy"
                  values={`200;${ey};200`}
                  dur={`${3 + i * 0.5}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}
        {/* Outer orbit ring */}
        <circle cx="200" cy="200" r="130" fill="none" stroke="#030F1C" strokeWidth="0.5" opacity="0.08" strokeDasharray="6 6" />
        <circle cx="200" cy="200" r="90" fill="none" stroke="#030F1C" strokeWidth="0.5" opacity="0.05" strokeDasharray="4 8" />
      </svg>

      {/* Live activity log */}
      <div className="hs-log" ref={logsRef}>
        <div className="hs-log-header">
          <span className="hs-log-dot hs-log-dot-live" />
          <span>runtime · live</span>
        </div>
        {LOGS.map((l, i) => (
          <div key={i} className="log-row">
            <span className={`hs-log-action hs-log-action--${l.status}`}>{l.action}</span>
            <span className="hs-log-detail">{l.detail}</span>
          </div>
        ))}
      </div>

      {/* Mini allocation donut */}
      <div className="hs-donut-wrap">
        <svg className="hs-donut" viewBox="0 0 80 80">
          {(() => {
            let offset = 0;
            return ASSETS.map((a) => {
              const circumference = Math.PI * 60;
              const dash = (a.pct / 100) * circumference;
              const gap = circumference - dash;
              const el = (
                <circle
                  key={a.symbol}
                  cx="40" cy="40" r="30"
                  fill="none"
                  stroke={a.color}
                  strokeWidth="6"
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 40 40)"
                />
              );
              offset += dash;
              return el;
            });
          })()}
        </svg>
        <span className="hs-donut-label">NAV</span>
        <span className="hs-donut-value">$10.14M</span>
      </div>

      {/* Status pills */}
      <div className="hs-status hs-status-tl">
        <span className="hs-status-dot" style={{ background: '#5BD49C' }} />
        policy gates: <strong>active</strong>
      </div>
      <div className="hs-status hs-status-br">
        <span className="hs-status-dot" style={{ background: '#4A9BFF' }} />
        tick 847 · epoch 405
      </div>
    </div>
  );
}

const SCENE_CSS = `
  .hero-scene {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--paper-strong, #FAF6EE);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* Blueprint grid background */
  .hs-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(3,15,28,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(3,15,28,0.04) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  /* Central agent node */
  .hs-agent {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
  }
  .hs-agent-core {
    position: relative;
    width: 72px;
    height: 72px;
    border: 2px solid #030F1C;
    border-radius: 50%;
    background: #FAF6EE;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    box-shadow: 3px 3px 0 #030F1C;
    z-index: 2;
  }
  .hs-agent-label {
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #030F1C;
  }
  .hs-agent-pulse {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 1.5px solid #4A9BFF;
    transform: translate(-50%, -50%);
    animation: hs-pulse 3s ease-out infinite;
    z-index: 1;
  }
  .hs-agent-pulse-2 {
    animation-delay: 1.5s;
  }

  @keyframes hs-pulse {
    0% { width: 72px; height: 72px; opacity: 0.6; }
    100% { width: 200px; height: 200px; opacity: 0; }
  }

  /* SVG connections layer */
  .hs-connections {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 400px;
    height: 400px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 1;
  }

  /* Orbiting asset nodes */
  .hs-asset {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 10;
    transform:
      translate(-50%, -50%)
      rotate(var(--angle))
      translateX(130px)
      rotate(calc(-1 * var(--angle)));
    display: flex;
    align-items: center;
    gap: 5px;
    background: #FAF6EE;
    border: 1.5px solid #030F1C;
    border-radius: 4px;
    padding: 4px 8px;
    box-shadow: 2px 2px 0 #030F1C;
    animation: hs-float 4s ease-in-out infinite;
    animation-delay: var(--delay);
  }
  .hs-asset-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color);
    flex-shrink: 0;
  }
  .hs-asset-sym {
    font-size: 10px;
    font-weight: 700;
    color: #030F1C;
    letter-spacing: 0.08em;
  }
  .hs-asset-pct {
    font-size: 9px;
    color: rgba(3,15,28,0.5);
  }

  @keyframes hs-float {
    0%, 100% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(130px) rotate(calc(-1 * var(--angle))) translateY(0); }
    50% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(130px) rotate(calc(-1 * var(--angle))) translateY(-6px); }
  }

  /* Activity log panel */
  .hs-log {
    position: absolute;
    bottom: 12px;
    left: 12px;
    width: 230px;
    background: #FAF6EE;
    border: 1.5px solid #030F1C;
    border-radius: 4px;
    padding: 0;
    box-shadow: 3px 3px 0 #030F1C;
    z-index: 20;
    overflow: hidden;
  }
  .hs-log-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-bottom: 1px solid rgba(3,15,28,0.1);
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #030F1C;
  }
  .hs-log-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .hs-log-dot-live {
    background: #5BD49C;
    box-shadow: 0 0 4px #5BD49C;
    animation: hs-blink 2s ease-in-out infinite;
  }
  @keyframes hs-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .log-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 3px 8px;
    font-size: 8px;
    color: rgba(3,15,28,0.55);
    transition: background 0.3s ease, color 0.3s ease;
    border-bottom: 1px solid rgba(3,15,28,0.04);
  }
  .log-row.log-highlight {
    background: rgba(74,155,255,0.08);
    color: #030F1C;
  }
  .hs-log-action {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
    min-width: 52px;
    font-size: 7.5px;
  }
  .hs-log-action--ok { color: #5BD49C; }
  .hs-log-action--wait { color: #F7C543; }
  .hs-log-detail {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Donut chart */
  .hs-donut-wrap {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    z-index: 20;
    background: #FAF6EE;
    border: 1.5px solid #030F1C;
    border-radius: 4px;
    padding: 8px 10px 6px;
    box-shadow: 2px 2px 0 #030F1C;
  }
  .hs-donut {
    width: 64px;
    height: 64px;
    animation: hs-spin 20s linear infinite;
  }
  @keyframes hs-spin {
    to { transform: rotate(360deg); }
  }
  .hs-donut-label {
    font-size: 7px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(3,15,28,0.45);
  }
  .hs-donut-value {
    font-size: 13px;
    font-weight: 800;
    color: #030F1C;
    letter-spacing: -0.02em;
  }

  /* Status pills */
  .hs-status {
    position: absolute;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 8px;
    font-weight: 500;
    color: rgba(3,15,28,0.55);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    background: #FAF6EE;
    border: 1px solid rgba(3,15,28,0.15);
    border-radius: 3px;
    padding: 3px 8px;
  }
  .hs-status strong {
    color: #030F1C;
    font-weight: 700;
  }
  .hs-status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .hs-status-tl {
    top: 12px;
    left: 12px;
  }
  .hs-status-br {
    bottom: 12px;
    right: 12px;
  }

  /* Responsive scaling */
  @media (max-width: 1024px) {
    .hs-connections { width: 320px; height: 320px; }
    .hs-asset { transform: translate(-50%,-50%) rotate(var(--angle)) translateX(100px) rotate(calc(-1 * var(--angle))); }
    @keyframes hs-float {
      0%, 100% { transform: translate(-50%,-50%) rotate(var(--angle)) translateX(100px) rotate(calc(-1 * var(--angle))) translateY(0); }
      50% { transform: translate(-50%,-50%) rotate(var(--angle)) translateX(100px) rotate(calc(-1 * var(--angle))) translateY(-5px); }
    }
  }
  @media (max-width: 640px) {
    .hs-log { display: none; }
    .hs-donut-wrap { top: 8px; right: 8px; }
    .hs-status-tl { top: 8px; left: 8px; }
    .hs-status-br { display: none; }
    .hs-connections { width: 260px; height: 260px; }
    .hs-asset {
      transform: translate(-50%,-50%) rotate(var(--angle)) translateX(80px) rotate(calc(-1 * var(--angle)));
      padding: 3px 6px;
    }
    @keyframes hs-float {
      0%, 100% { transform: translate(-50%,-50%) rotate(var(--angle)) translateX(80px) rotate(calc(-1 * var(--angle))) translateY(0); }
      50% { transform: translate(-50%,-50%) rotate(var(--angle)) translateX(80px) rotate(calc(-1 * var(--angle))) translateY(-4px); }
    }
  }
`;
