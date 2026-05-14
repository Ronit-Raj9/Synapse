'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';

type ToastVariant = 'info' | 'success' | 'warn' | 'danger';

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  body?: string;
  durationMs: number;
  createdAt: number;
}

interface ToastApi {
  push: (t: { variant?: ToastVariant; title: string; body?: string; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastApi['push']>((t) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: Toast = {
      id,
      variant: t.variant ?? 'info',
      title: t.title,
      ...(t.body !== undefined ? { body: t.body } : {}),
      durationMs: t.durationMs ?? 4500,
      createdAt: Date.now(),
    };
    setToasts((cur) => [...cur, toast]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = toasts[0]!;
    const remaining = t.durationMs - (Date.now() - t.createdAt);
    const timer = setTimeout(() => dismiss(t.id), Math.max(remaining, 200));
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);

  const api = useMemo<ToastApi>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastRail toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  info: 'var(--accent-blue)',
  success: 'var(--accent-green)',
  warn: 'var(--accent-yellow)',
  danger: 'var(--accent-orange)',
};

function ToastRail({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-8">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto relative max-w-[420px] overflow-hidden rounded-md border-2 border-ink bg-paper-strong shadow-[4px_4px_0_0_var(--ink)]"
          >
            <span
              className="absolute inset-y-0 left-0 w-1.5"
              style={{ backgroundColor: VARIANT_ACCENT[t.variant] }}
              aria-hidden
            />
            <div className="flex items-start gap-3 py-3 pl-4 pr-3">
              <div className="flex-1">
                <p className="font-display text-sm font-bold text-ink">{t.title}</p>
                {t.body && (
                  <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-ink-soft">
                    {t.body}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="font-mono text-[12px] text-ink-mute hover:text-ink"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
