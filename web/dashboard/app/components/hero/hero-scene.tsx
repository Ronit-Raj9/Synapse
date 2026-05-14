'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Keycap } from './keycap';
import { TradeFlow } from './trade-flow';

const KEYCAPS = [
  { label: 'SUI', color: '#4A9BFF', orbitRadius: 3.4, orbitSpeed: 0.18, orbitPhase: 0, size: 1.2 },
  { label: 'USDC', color: '#5BD49C', orbitRadius: 3.0, orbitSpeed: 0.22, orbitPhase: 1.7, size: 1.1 },
  { label: 'DEEP', color: '#FF6B35', orbitRadius: 3.6, orbitSpeed: 0.16, orbitPhase: 3.1, size: 1.0 },
  { label: 'WAL', color: '#9D7AEB', orbitRadius: 2.6, orbitSpeed: 0.26, orbitPhase: 4.4, size: 0.9 },
  { label: 'ETH', color: '#F7C543', orbitRadius: 4.2, orbitSpeed: 0.12, orbitPhase: 5.5, size: 1.0 },
  { label: 'BTC', color: '#FF8FA3', orbitRadius: 3.8, orbitSpeed: 0.2, orbitPhase: 2.3, size: 0.9 },
] as const;

const FLOWS = [
  { from: [0, 0, 0] as [number, number, number], to: [3, 1, 0] as [number, number, number], color: '#FF6B35' },
  { from: [0, 0, 0] as [number, number, number], to: [-2.5, 1.2, 1.5] as [number, number, number], color: '#5BD49C' },
  { from: [0, 0, 0] as [number, number, number], to: [1.6, 0.8, -2.4] as [number, number, number], color: '#9D7AEB' },
  { from: [0, 0, 0] as [number, number, number], to: [-1.4, 1.6, -1.9] as [number, number, number], color: '#4A9BFF' },
];

/**
 * The hero 3D scene. Orbiting keycap-tokens around a central node, with
 * animated dotted "trade flow" lines connecting them. Suspends gracefully
 * server-side and renders progressively client-side.
 */
export function HeroScene() {
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [4.5, 3.2, 6.5], fov: 38, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        style={{ background: 'transparent' }}
      >
        <color attach="background" args={['#F5F0E6']} />
        <fog attach="fog" args={['#F5F0E6', 12, 26]} />

        {/* Lighting kit */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[8, 12, 6]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-6, 4, -8]} intensity={0.4} color="#9D7AEB" />
        <directionalLight position={[2, -6, 4]} intensity={0.3} color="#5BC0EB" />

        <Suspense fallback={null}>
          <Environment preset="apartment" background={false} />
        </Suspense>

        {/* Center node — represents the AgentIdentity */}
        <CenterCore />

        {/* Orbiting tokens */}
        {KEYCAPS.map((kc, i) => (
          <Keycap
            key={kc.label}
            position={[0, 0, 0]}
            color={kc.color}
            label={kc.label}
            orbitRadius={kc.orbitRadius}
            orbitSpeed={kc.orbitSpeed}
            orbitPhase={kc.orbitPhase}
            orbitTilt={0.1 * (i - 2)}
            size={kc.size}
          />
        ))}

        {/* Animated trade flows */}
        {FLOWS.map((f, i) => (
          <TradeFlow key={i} from={f.from} to={f.to} color={f.color} speed={0.4 + i * 0.15} />
        ))}

        {/* Blueprint grid floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, 0]} receiveShadow>
          <planeGeometry args={[40, 40, 40, 40]} />
          <meshStandardMaterial color="#F5F0E6" roughness={1} />
        </mesh>
        <gridHelper args={[40, 40, '#D6E4F5', '#D6E4F5']} position={[0, -2.39, 0]} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.4}
          minPolarAngle={Math.PI / 3.4}
          maxPolarAngle={Math.PI / 2.15}
        />
      </Canvas>
    </div>
  );
}

/**
 * The central glowing core representing the AgentIdentity Sui object.
 * A pulsing octahedron with two inner rings.
 */
function CenterCore() {
  return (
    <group>
      <mesh>
        <octahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial
          color="#030F1C"
          emissive="#5BC0EB"
          emissiveIntensity={0.7}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.03, 64]} />
        <meshBasicMaterial color="#FF6B35" side={2} transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[1.4, 1.42, 64]} />
        <meshBasicMaterial color="#9D7AEB" side={2} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
