'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface KeycapProps {
  position: [number, number, number];
  color: string;
  label: string;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  orbitTilt: number;
  size?: number;
  emissive?: string;
}

const INK = '#030F1C';

/**
 * A single isometric "keycap" floating in 3D space — matches the Sui Overflow
 * hero illustration aesthetic. Orbits around the scene origin at the given
 * radius, with a slow wobble and a constant top-bevel highlight.
 */
export function Keycap({
  position,
  color,
  label,
  orbitRadius,
  orbitSpeed,
  orbitPhase,
  orbitTilt,
  size = 1,
  emissive = '#FFFFFF',
}: KeycapProps) {
  const group = useRef<THREE.Group>(null);
  const cap = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!group.current || !cap.current) return;
    const t = clock.getElapsedTime() * orbitSpeed + orbitPhase;
    const x = Math.cos(t) * orbitRadius;
    const z = Math.sin(t) * orbitRadius;
    const y = Math.sin(t * 0.5) * 0.4 + Math.sin(orbitPhase) * 0.6;

    group.current.position.set(position[0] + x, position[1] + y, position[2] + z);
    group.current.rotation.x = orbitTilt + Math.sin(t * 0.3) * 0.05;
    group.current.rotation.y = -t * 0.4;
    group.current.rotation.z = Math.sin(t * 0.6) * 0.03;
  });

  const s = size;

  return (
    <group ref={group}>
      {/* Drop shadow base (dark bottom face) */}
      <mesh position={[0, -0.18 * s, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6 * s, 0.4 * s, 1.6 * s]} />
        <meshStandardMaterial color={INK} roughness={0.6} />
      </mesh>
      {/* Main cap body */}
      <mesh ref={cap} position={[0, 0.32 * s, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5 * s, 0.7 * s, 1.5 * s]} />
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          metalness={0.15}
          emissive={emissive}
          emissiveIntensity={0.08}
        />
      </mesh>
      {/* Inset top bevel ring */}
      <mesh position={[0, 0.69 * s, 0]}>
        <boxGeometry args={[1.46 * s, 0.02 * s, 1.46 * s]} />
        <meshStandardMaterial color={INK} roughness={0.7} />
      </mesh>
      {/* Top face with label */}
      <Text
        position={[0, 0.71 * s, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.5 * s}
        color={INK}
        anchorX="center"
        anchorY="middle"
        fontWeight={900}
      >
        {label}
      </Text>
    </group>
  );
}
