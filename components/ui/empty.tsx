import { cn } from "@/lib/cn";

export function EmptyState({ title, children, action, className, icon }: { title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-[var(--radius-panel)] border border-dashed border-line-strong px-6 py-10", className)}>
      {icon && <div className="text-fog [&_svg]:size-5">{icon}</div>}
      <h3 className="heading text-lg">{title}</h3>
      {children && <div className="max-w-prose text-sm text-fog">{children}</div>}
      {action}
    </div>
  );
}
