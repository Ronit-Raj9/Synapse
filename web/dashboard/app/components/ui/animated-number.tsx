'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tween a numeric value over `duration` ms using `requestAnimationFrame`.
 * Renders via `format` so callers control USD vs basis points vs raw
 * formatting. Re-tweens whenever `value` changes; skips animation under
 * `prefers-reduced-motion`.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 700,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const start = performance.now();
    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) {
      setDisplay(value);
      return;
    }

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + delta * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
