import { cn } from "@/lib/cn";

/** Two offset orbits crossing: the same geometry as the landing page object. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-7", className)}>
      <defs>
        <linearGradient id="cxg" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B3A8FF" />
          <stop offset="1" stopColor="#7FE3F0" />
        </linearGradient>
      </defs>
      <ellipse cx="16" cy="16" rx="12.5" ry="5.2" transform="rotate(-35 16 16)" stroke="url(#cxg)" strokeWidth="1.8" />
      <ellipse cx="16" cy="16" rx="12.5" ry="5.2" transform="rotate(35 16 16)" stroke="#E8E8EF" strokeOpacity=".55" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="2.4" fill="#E8E8EF" />
      <circle cx="25.6" cy="9.3" r="1.7" fill="#7FE3F0" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[0.02em]" style={{ fontVariationSettings: '"wdth" 125' }}>
        CONTESTX
      </span>
    </span>
  );
}
