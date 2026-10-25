"use client";
import { cn } from "@/lib/cn";

/** Toggle chip for filters. aria-pressed communicates state to assistive tech. */
export function Chip({ active, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
        active ? "border-violet/50 bg-violet/15 text-ink" : "border-line bg-transparent text-fog hover:border-line-strong hover:text-ink-2",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-[10px] border border-line bg-white/[0.02] p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] transition-colors [&_svg]:size-4",
            value === o.value ? "bg-white/[0.08] text-ink" : "text-fog hover:text-ink-2",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
