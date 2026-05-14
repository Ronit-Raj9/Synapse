'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TradeFlowProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  speed?: number;
}

/**
 * An animated dotted-line "trade flow" between two points in 3D space, used
 * to represent an in-flight swap or memory write between agents/assets.
 * Each dash slides along the line on a loop.
 */
export function TradeFlow({ from, to, color, speed = 0.6 }: TradeFlowProps) {
  const lineRef = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions: number[] = [];
    const segments = 24;
    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const t2 = (i + 0.5) / segments;
      positions.push(
        lerp(from[0], to[0], t1),
        lerp(from[1], to[1], t1),
        lerp(from[2], to[2], t1),
        lerp(from[0], to[0], t2),
        lerp(from[1], to[1], t2),
        lerp(from[2], to[2], t2),
      );
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [from, to]);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const mat = lineRef.current.material as THREE.LineDashedMaterial;
    mat.opacity = 0.5 + 0.3 * Math.sin(clock.getElapsedTime() * speed * 2);
  });

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineDashedMaterial color={color} linewidth={2} transparent opacity={0.6} dashSize={0.4} gapSize={0.2} />
    </lineSegments>
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
