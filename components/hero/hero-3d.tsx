"use client";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { OrbitInput } from "./orbital-scene";

const OrbitalScene = dynamic(() => import("./orbital-scene"), { ssr: false, loading: () => <StaticOrbits /> });

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Flat SVG version of the orbital object: used while loading and when WebGL is unavailable. */
export function StaticOrbits({ orbits }: { orbits?: OrbitInput[] }) {
  const tilts = [-32, 28, 74];
  const radii = [150, 178, 206];
  return (
    <svg viewBox="-250 -250 500 500" className="absolute inset-0 m-auto h-full w-full max-w-[560px]" aria-hidden>
      <defs>
        <radialGradient id="core" cx="40%" cy="35%">
          <stop offset="0" stopColor="#d6d0ff" stopOpacity=".9" />
          <stop offset="1" stopColor="#6c5ce7" stopOpacity=".25" />
        </radialGradient>
      </defs>
      {radii.map((r, i) => (
        <g key={r} transform={`rotate(${tilts[i]})`}>
          <ellipse rx={r} ry={r * 0.36} fill="none" stroke="#d7d7e2" strokeOpacity={0.35 - i * 0.06} strokeWidth="1.6" />
          {orbits?.[i]?.progress != null && (
            <circle
              cx={Math.cos(Math.PI / 2 - orbits[i].progress! * Math.PI * 2) * r}
              cy={-Math.sin(Math.PI / 2 - orbits[i].progress! * Math.PI * 2) * r * 0.36}
              r="6"
              fill={orbits[i].color}
            />
          )}
        </g>
      ))}
      <polygon points="0,-72 62,-36 62,36 0,72 -62,36 -62,-36" fill="url(#core)" stroke="#ffffff" strokeOpacity=".15" />
    </svg>
  );
}

export function Hero3D({ orbits }: { orbits: OrbitInput[] }) {
  const reduced = useReducedMotion() ?? false;
  const [mode, setMode] = useState<"pending" | "webgl" | "static">("pending");
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    const small = window.matchMedia("(max-width: 768px)").matches;
    const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
    setLowPower(small || weak);
    setMode(webglAvailable() ? "webgl" : "static");
  }, []);

  return (
    <div className="relative aspect-square w-full max-w-[600px]">
      {mode === "webgl" ? <OrbitalScene orbits={orbits} reduced={reduced} lowPower={lowPower} /> : <StaticOrbits orbits={orbits} />}
    </div>
  );
}
