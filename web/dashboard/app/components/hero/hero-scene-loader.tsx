'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only wrapper for the Three.js hero scene. Required because
 * Next 16 no longer allows `ssr: false` from Server Components.
 */
const HeroScene = dynamic(() => import('./hero-scene').then((m) => m.HeroScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute">
        loading topology…
      </span>
    </div>
  ),
});

export function HeroSceneLoader() {
  return <HeroScene />;
}
