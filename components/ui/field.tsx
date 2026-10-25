import { cn } from "@/lib/cn";
import { forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-white/[0.03] px-3 text-sm text-ink placeholder:text-fog-2 transition-colors hover:border-white/20 focus:border-violet/70 focus:bg-white/[0.05] focus:outline-none aria-[invalid=true]:border-danger/70",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-10 w-full appearance-none rounded-[var(--radius-control)] border border-line-strong bg-white/[0.03] bg-[length:16px] bg-[right_10px_center] bg-no-repeat pl-3 pr-9 text-sm text-ink transition-colors hover:border-white/20 focus:border-violet/70 focus:outline-none [&>option]:bg-graphite",
      "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238b8c9b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-ink-2", className)} {...props} />;
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-[13px] text-danger">
      {children}
    </p>
  );
}
