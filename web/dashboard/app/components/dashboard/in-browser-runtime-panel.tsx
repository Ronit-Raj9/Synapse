'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CodeTag } from '../ui/code-tag';
import { useToast } from '../ui/toast';
import { shortenHash } from '@/lib/format';
import {
  startBrowserRuntime,
  type BrowserRuntimeEvent,
  type BrowserRuntimeHandle,
} from '@/lib/browser-runtime';

const TICK_INTERVAL_OPTIONS = [
  { label: '30 sec', value: 30_000 },
  { label: '1 min', value: 60_000 },
  { label: '5 min', value: 300_000 },
  { label: '10 min (default)', value: 600_000 },
] as const;

const MAX_EVENTS = 200;

interface Props {
  vaultId: string;
}

/**
 * In-tab runtime. Lets a vault owner click "Start" and watch their
 * strategy tick live, with full logs streaming to the page. The
 * runtime runs on the main thread (not a Web Worker) — simpler, and
 * the loop is I/O-bound so it doesn't block the UI.
 *
 * Trust model: the session keypair never leaves the browser. It's
 * loaded from the .key file via the File API, held in a closure
 * inside the runtime instance, and discarded when the user stops or
 * navigates away. Production deployments use the same TypeScript
 * runtime in a long-lived Docker/Fargate process.
 */
export function InBrowserRuntimePanel({ vaultId }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [keyFileText, setKeyFileText] = useState<string | null>(null);
  const [keyFileName, setKeyFileName] = useState<string | null>(null);
  const [tickIntervalMs, setTickIntervalMs] = useState<number>(60_000);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<BrowserRuntimeEvent[]>([]);

  const runtimeRef = useRef<BrowserRuntimeHandle | null>(null);

  const appendEvent = useCallback((ev: BrowserRuntimeEvent) => {
    setEvents((prev) => {
      const next = [...prev, ev];
      // Cap to MAX_EVENTS so a long-running session doesn't grow
      // the DOM unbounded. Newest events stay; oldest scroll out.
      return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
    });
    // Whenever the runtime emits a tick-completion event, invalidate
    // the live-vault query so the rest of the dashboard refreshes
    // its holdings / artifacts / NAV without a hard reload.
    if (
      ev.msg === 'rebalance executed' ||
      ev.msg === 'noop tick recorded on-chain'
    ) {
      void queryClient.invalidateQueries({ queryKey: ['synapse-vault', vaultId] });
      void queryClient.invalidateQueries({ queryKey: ['synapse-latest-tick', vaultId] });
    }
  }, [queryClient, vaultId]);

  const onPickKeyFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.key') && !file.name.endsWith('.json')) {
      toast.push({
        variant: 'warn',
        title: 'Wrong file type',
        body: 'Expected the .key file the mint wizard downloaded.',
      });
      return;
    }
    if (file.size > 32_768) {
      toast.push({
        variant: 'warn',
        title: 'File too large for a .key file',
        body: `Got ${file.size} bytes — expected < 32 KiB. Did you pick the wrong file?`,
      });
      return;
    }
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { address?: unknown };
      if (typeof parsed.address !== 'string') throw new Error('missing `address` field');
    } catch (err) {
      toast.push({
        variant: 'danger',
        title: 'Not a valid .key file',
        body: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    setKeyFileText(text);
    setKeyFileName(file.name);
    toast.push({
      variant: 'success',
      title: 'Session key loaded',
      body: `${file.name} loaded into memory — never leaves your browser.`,
      durationMs: 5000,
    });
  }, [toast]);

  const onStart = useCallback(async () => {
    if (!keyFileText) {
      toast.push({ variant: 'warn', title: 'Pick a .key file first', body: '' });
      return;
    }
    try {
      const handle = await startBrowserRuntime({
        agentId: vaultId,
        sessionKeyFileContents: keyFileText,
        tickIntervalMs,
        onEvent: appendEvent,
      });
      runtimeRef.current = handle;
      setRunning(true);
      toast.push({
        variant: 'success',
        title: 'Runtime started in this tab',
        body: `Ticking every ${formatInterval(tickIntervalMs)}. Closing the tab pauses.`,
        durationMs: 6000,
      });
    } catch (err) {
      toast.push({
        variant: 'danger',
        title: 'Runtime failed to start',
        body: err instanceof Error ? err.message : String(err),
        durationMs: 10000,
      });
    }
  }, [keyFileText, tickIntervalMs, vaultId, appendEvent, toast]);

  const onStop = useCallback(async () => {
    if (!runtimeRef.current) return;
    await runtimeRef.current.stop();
    runtimeRef.current = null;
    setRunning(false);
    toast.push({
      variant: 'info',
      title: 'Runtime stopped',
      body: 'Strategy paused. Press Start to resume.',
    });
  }, [toast]);

  // Stop the runtime on unmount so navigation doesn't leak a
  // ticking instance into memory. (Closing the tab kills the
  // process anyway, but client-side route changes wouldn't.)
  useEffect(() => {
    return () => {
      void runtimeRef.current?.stop();
      runtimeRef.current = null;
    };
  }, []);

  return (
    <div className="card-flat p-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-2xl font-bold">Runtime</h3>
        <CodeTag>{running ? 'live · in-tab' : 'idle'}</CodeTag>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-ink-soft">
        Run this vault&rsquo;s strategy directly in your browser. Pick the{' '}
        <code className="font-mono text-[10px]">.key</code> file you downloaded
        at mint, choose a tick interval, and press Start — the runtime ticks
        right here, no CLI, no servers. Closing the tab pauses; reopening
        resumes. (Production deployments use the same runtime in a
        long-lived process.)
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="grid gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            Session .key file
          </span>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".key,.json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickKeyFile(f);
              }}
              disabled={running}
              className="block w-full text-xs file:mr-3 file:rounded-sm file:border file:border-ink file:bg-paper-strong file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-paper"
            />
          </div>
          {keyFileName && (
            <span className="font-mono text-[10px] text-state-active">
              ✓ {keyFileName}
            </span>
          )}
        </label>
        <label className="grid gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            Tick interval
          </span>
          <select
            value={tickIntervalMs}
            onChange={(e) => setTickIntervalMs(Number(e.target.value))}
            disabled={running}
            className="rounded-sm border border-divider bg-paper-strong px-3 py-2 font-mono text-xs outline-none focus:border-ink"
          >
            {TICK_INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="btn-flat"
            data-variant="danger"
          >
            Stop runtime
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={!keyFileText}
            className="btn-flat"
            data-variant="accent"
          >
            Start runtime
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-2">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            Live log ({events.length} event{events.length === 1 ? '' : 's'})
          </span>
          {events.length > 0 && (
            <button
              type="button"
              onClick={() => setEvents([])}
              className="font-mono text-[10px] text-ink-mute hover:text-ink hover:underline"
            >
              clear
            </button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto rounded-sm border border-divider bg-paper p-3 font-mono text-[11px]">
          {events.length === 0 ? (
            <p className="text-ink-mute">No events yet. Start the runtime above.</p>
          ) : (
            <ul className="grid gap-1.5">
              {events.slice().reverse().map((ev, i) => (
                <li key={`${ev.at}-${i}`} className="grid grid-cols-[88px_56px_1fr] gap-2">
                  <span className="text-ink-mute">
                    {new Date(ev.at).toLocaleTimeString()}
                  </span>
                  <span
                    className={
                      ev.level === 'error'
                        ? 'text-state-danger'
                        : ev.level === 'warn'
                          ? 'text-accent-orange'
                          : 'text-state-active'
                    }
                  >
                    {ev.level}
                  </span>
                  <span className="text-ink">
                    {ev.msg}
                    {ev.details['txDigest'] ? (
                      <span className="ml-2 text-ink-mute">
                        tx {shortenHash(String(ev.details['txDigest']))}
                      </span>
                    ) : null}
                    {ev.details['err'] ? (
                      <span className="ml-2 text-ink-soft">
                        — {String(ev.details['err']).slice(0, 120)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function formatInterval(ms: number): string {
  if (ms < 60_000) return `${ms / 1000}s`;
  return `${ms / 60_000} min`;
}
