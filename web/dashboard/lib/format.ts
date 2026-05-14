/**
 * Number / address / time formatting helpers used across the dashboard.
 * Kept dependency-free for tree-shake friendliness in client bundles.
 */

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usdFineFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(amount: number, opts: { fine?: boolean } = {}): string {
  if (!Number.isFinite(amount)) return '—';
  return (opts.fine ? usdFineFormatter : usdFormatter).format(amount);
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return compactFormatter.format(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return percentFormatter.format(value);
}

export function shortenAddress(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

export function shortenHash(hash: string, n = 6): string {
  if (!hash) return '';
  if (hash.length <= n * 2 + 1) return hash;
  return `${hash.slice(0, n)}…${hash.slice(-4)}`;
}

const TIME_DIVISIONS = [
  { amount: 60, name: 'sec' },
  { amount: 60, name: 'min' },
  { amount: 24, name: 'hr' },
  { amount: 7, name: 'day' },
  { amount: 4.34524, name: 'wk' },
  { amount: 12, name: 'mo' },
  { amount: Number.POSITIVE_INFINITY, name: 'yr' },
];

export function timeAgo(date: Date | number): string {
  const now = Date.now();
  const then = typeof date === 'number' ? date : date.getTime();
  let duration = (then - now) / 1000;
  if (Math.abs(duration) < 1) return 'just now';
  for (const div of TIME_DIVISIONS) {
    if (Math.abs(duration) < div.amount) {
      const value = Math.round(duration);
      return `${value > 0 ? 'in ' : ''}${Math.abs(value)} ${div.name}${Math.abs(value) === 1 ? '' : 's'}${value < 0 ? ' ago' : ''}`;
    }
    duration /= div.amount;
  }
  return 'a long time ago';
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return dateFormatter.format(d);
}
