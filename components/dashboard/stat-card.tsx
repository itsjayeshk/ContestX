"use client";
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

function AnimatedNumber({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) return setDisplay(value);
    const c = animate(0, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => c.stop();
  }, [value, reduced]);
  return <>{display}</>;
}

/** Statistic tile with a slight 3D tilt toward the pointer (max ~4 degrees). */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  href,
  emptyText,
}: {
  label: string;
  value: number | null;
  unit?: string;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  href?: string;
  emptyText?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [4, -4]), { stiffness: 220, damping: 22 });
  const ry = useSpring(useTransform(mx, [0, 1], [-4, 4]), { stiffness: 220, damping: 22 });
  const glowX = useTransform(mx, (v) => `${v * 100}%`);
  const glowY = useTransform(my, (v) => `${v * 100}%`);
  const Wrapper = href ? "a" : "div";

  return (
    <motion.div
      ref={ref}
      style={reduced ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
      className="group relative"
    >
      <Wrapper href={href} className={cn("panel relative block h-full overflow-hidden p-5 transition-colors", href && "hover:border-line-strong")}>
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: useTransform([glowX, glowY], ([x, y]) => `radial-gradient(220px circle at ${x} ${y}, rgb(139 123 255 / .12), transparent 70%)`) }}
        />
        <div className="relative flex items-center justify-between text-fog">
          <span className="text-[13px]">{label}</span>
          <span className="[&_svg]:size-4">{icon}</span>
        </div>
        <div className="relative mt-5 flex items-baseline gap-2">
          {value === null ? (
            <span className="text-sm text-fog">{emptyText ?? "No data yet"}</span>
          ) : (
            <>
              <span className="display num text-[40px] text-ink">
                <AnimatedNumber value={value} />
              </span>
              {unit && <span className="text-sm text-fog">{unit}</span>}
            </>
          )}
        </div>
        {hint && <div className="relative mt-2 text-xs text-fog">{hint}</div>}
      </Wrapper>
    </motion.div>
  );
}
