import { PLATFORM_META } from "@/lib/platforms";
import { cn } from "@/lib/cn";
import type { PlatformId } from "@/types/contest";

/** Monogram badge for a platform. Tinted, never full-saturation, so platforms don't dominate. */
export function PlatformMark({ platform, size = "md", withName, className }: { platform: PlatformId; size?: "sm" | "md" | "lg"; withName?: boolean; className?: string }) {
  const m = PLATFORM_META[platform];
  const dims = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-[13px]" : "size-8 text-[11px]";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn("grid shrink-0 place-items-center rounded-[8px] font-semibold tracking-tight", dims)}
        style={{ color: m.color, background: `color-mix(in oklab, ${m.color} 13%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${m.color} 28%, transparent)`, fontVariationSettings: '"wdth" 120' }}
      >
        {m.short}
      </span>
      {withName && <span className="text-[13px] text-ink-2">{m.name}</span>}
      {!withName && <span className="sr-only">{m.name}</span>}
    </span>
  );
}

export function PlatformDot({ platform, className }: { platform: PlatformId; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", className)} style={{ background: PLATFORM_META[platform].color }} />;
}
