'use client';

import Link from 'next/link';
import { useToast } from '../ui/toast';

/**
 * Top-of-page actions: breadcrumb navigation + share / export buttons that
 * actually do something (clipboard copy, toast feedback).
 */
export function DashboardToolbar() {
  const toast = useToast();

  async function onShare() {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.push({
          variant: 'success',
          title: 'Vault URL copied',
          body: url.length > 56 ? `${url.slice(0, 56)}…` : url,
        });
      } else {
        toast.push({
          variant: 'warn',
          title: 'Clipboard unavailable',
          body: 'Copy the address bar URL manually.',
        });
      }
    } catch {
      toast.push({
        variant: 'danger',
        title: 'Could not access clipboard',
        body: 'Browser blocked the operation. Try copying from the URL bar.',
      });
    }
  }

  function onExport() {
    if (typeof window === 'undefined') return;
    toast.push({
      variant: 'info',
      title: 'Opening print dialog',
      body: 'Choose "Save as PDF" to export this view.',
      durationMs: 3500,
    });
    // The print stylesheet (`@media print` in globals.css) reformats the
    // dashboard for a clean PDF render — no external library required.
    window.print();
  }

  return (
    <div className="flex items-center justify-between">
      <nav className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
        <Link href="/" className="hover:text-ink">
          Synapse
        </Link>
        <span>/</span>
        <Link href="/dashboard" className="hover:text-ink">
          Vaults
        </Link>
        <span>/</span>
        <span className="text-ink">Helios Treasury</span>
      </nav>
      <div className="flex items-center gap-3">
        <button className="btn-flat" data-variant="ghost" onClick={onShare}>
          Share
        </button>
        <button className="btn-flat" data-variant="ghost" onClick={onExport}>
          Export PDF
        </button>
      </div>
    </div>
  );
}
