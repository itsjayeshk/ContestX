"use client";
import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export interface OrbitInput {
  color: string;
  /** 0..1 position of the platform's next contest within the next 7 days, or null if none. */
  progress: number | null;
}

const RING_TILTS: [number, number, number][] = [
  [1.15, 0.0, 0.35],
  [1.05, 0.9, -0.5],
  [0.35, -0.8, 0.2],
];
const RADII = [1.55, 1.85, 2.15];

function Ring({ index, orbit, reduced }: { index: number; orbit: OrbitInput; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const bead = useRef<THREE.Mesh>(null);
  const r = RADII[index];
  // Angle 0 is "now" at the top of the ring; a full turn is seven days.
  const target = orbit.progress === null ? null : Math.PI / 2 - orbit.progress * Math.PI * 2;
  const angle = useRef(Math.PI / 2);

  useFrame((_, dt) => {
    if (!group.current) return;
    if (!reduced) group.current.rotation.z += dt * (0.04 + index * 0.015) * (index % 2 ? -1 : 1);
    if (bead.current && target !== null) {
      angle.current += (target - angle.current) * Math.min(1, dt * 1.4);
      bead.current.position.set(Math.cos(angle.current) * r, Math.sin(angle.current) * r, 0);
    }
  });

  return (
    <group rotation={RING_TILTS[index]}>
      <group ref={group}>
        <mesh>
          <torusGeometry args={[r, 0.022 + index * 0.004, 24, 220]} />
          <meshStandardMaterial color="#d7d7e2" metalness={1} roughness={0.22} envMapIntensity={1.4} />
        </mesh>
        {target !== null && (
          <mesh ref={bead} position={[0, r, 0]}>
            <sphereGeometry args={[0.075, 24, 24]} />
            <meshBasicMaterial color={orbit.color} toneMapped={false} />
            <pointLight color={orbit.color} intensity={2.2} distance={1.6} decay={2} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Core({ reduced, lowPower }: { reduced: boolean; lowPower: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!mesh.current || reduced) return;
    mesh.current.rotation.y += dt * 0.12;
    mesh.current.rotation.x += dt * 0.05;
  });
  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[0.78, 1]} />
      {lowPower ? (
        <meshStandardMaterial color="#9d8fff" metalness={0.6} roughness={0.25} transparent opacity={0.55} flatShading />
      ) : (
        <meshPhysicalMaterial color="#c8c0ff" transmission={1} thickness={1.1} roughness={0.12} ior={1.45} iridescence={0.6} iridescenceIOR={1.3} clearcoat={1} flatShading envMapIntensity={1.2} />
      )}
    </mesh>
  );
}

function Particles({ count, reduced }: { count: number; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const rad = 2.6 + Math.random() * 3.2;
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      arr.set([rad * s * Math.cos(t), rad * u * 0.7, rad * s * Math.sin(t)], i * 3);
    }
    return arr;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current && !reduced) ref.current.rotation.y += dt * 0.015;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.018} color="#b9c6ff" transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/** Eases the whole rig toward the pointer for a gentle parallax. */
function Rig({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  useFrame((_, dt) => {
    if (!ref.current || reduced) return;
    const k = Math.min(1, dt * 2);
    ref.current.rotation.y += (pointer.x * 0.35 - ref.current.rotation.y) * k;
    ref.current.rotation.x += (-pointer.y * 0.22 - ref.current.rotation.x) * k;
  });
  return <group ref={ref}>{children}</group>;
}

export default function OrbitalScene({ orbits, reduced, lowPower }: { orbits: OrbitInput[]; reduced: boolean; lowPower: boolean }) {
  // Pause rendering when the canvas is off-screen.
  const wrap = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        dpr={lowPower ? [1, 1.25] : [1, 1.75]}
        camera={{ position: [0, 0, 6.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: lowPower ? "low-power" : "high-performance" }}
        frameloop={reduced ? "demand" : "always"}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.setClearColor(0x000000, 0);
        }}
        aria-hidden
      >
        <ambientLight intensity={0.15} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} color="#ffffff" />
        <pointLight position={[-4, -2, 2]} intensity={14} color="#8b7bff" distance={12} />
        <pointLight position={[4, 1, -2]} intensity={10} color="#7fe3f0" distance={12} />
        <Environment resolution={lowPower ? 64 : 256} frames={1}>
          <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 4, -6]} scale={[10, 2, 1]} />
          <Lightformer form="rect" intensity={3} color="#8b7bff" position={[-6, 0, 2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 4, 1]} />
          <Lightformer form="rect" intensity={2} color="#7fe3f0" position={[6, -1, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 3, 1]} />
          <Lightformer form="ring" intensity={1.5} color="#ffffff" position={[0, 0, 6]} scale={3} />
        </Environment>
        <Rig reduced={reduced}>
          <Core reduced={reduced} lowPower={lowPower} />
          {orbits.slice(0, 3).map((o, i) => (
            <Ring key={i} index={i} orbit={o} reduced={reduced} />
          ))}
          <Particles count={lowPower ? 220 : 650} reduced={reduced} />
        </Rig>
      </Canvas>
    </div>
  );
}
