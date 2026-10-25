"use client";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import Link from "next/link";
import { buttonVariants } from "./button-variants";
import { cn } from "@/lib/cn";

/** Primary CTA that leans a few pixels toward the pointer. */
export function MagneticButton({ href, children, variant = "primary", className }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary"; className?: string }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 20 });
  const sy = useSpring(y, { stiffness: 300, damping: 20 });
  return (
    <motion.div
      style={reduced ? undefined : { x: sx, y: sy }}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * 8);
        y.set(((e.clientY - r.top) / r.height - 0.5) * 6);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <Link href={href} className={cn(buttonVariants({ variant, size: "lg" }), className)}>
        {children}
      </Link>
    </motion.div>
  );
}
