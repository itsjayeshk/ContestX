"use client";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border border-line-strong bg-white/[0.06] p-[2px] transition-colors data-[state=checked]:border-violet/60 data-[state=checked]:bg-violet/80 disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 rounded-full bg-ink shadow transition-transform duration-200 ease-[var(--ease-out-soft)] data-[state=checked]:translate-x-4 data-[state=checked]:bg-white" />
    </SwitchPrimitive.Root>
  );
}
