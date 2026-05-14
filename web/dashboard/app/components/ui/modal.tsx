'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  accent?: string;
}

/**
 * Y2K flat-shadow modal with escape-key dismiss, scrim click-out, and
 * focus return to the previously focused element on close.
 */
export function Modal({ open, onClose, title, children, footer, accent }: ModalProps) {
  const lastFocused = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      lastFocused.current?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <button
            aria-label="Close modal"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-ink/55"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal
            tabIndex={-1}
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-md border-2 border-ink bg-paper-strong shadow-[6px_6px_0_0_var(--ink)]"
          >
            {accent && (
              <span
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ backgroundColor: accent }}
                aria-hidden
              />
            )}
            <div className="border-b-2 border-ink px-6 py-4">
              <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
            </div>
            <div className="px-6 py-5">{children}</div>
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-divider bg-paper/50 px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
