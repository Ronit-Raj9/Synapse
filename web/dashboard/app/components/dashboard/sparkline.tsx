'use client';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}

/**
 * A pure SVG sparkline for NAV / PnL series. Renders a closed area + line,
 * with the last point emphasized. No deps.
 */
export function Sparkline({
  data,
  width = 320,
  height = 80,
  stroke = '#030F1C',
  fill = 'rgba(91, 212, 156, 0.18)',
  className = '',
}: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 4;

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y];
  });

  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const areaPath = `${linePath} L ${pts.at(-1)![0]} ${height} L ${pts[0]![0]} ${height} Z`;
  const last = pts.at(-1)!;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none">
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={stroke} />
      <circle cx={last[0]} cy={last[1]} r="6" fill={stroke} fillOpacity="0.15" />
    </svg>
  );
}
