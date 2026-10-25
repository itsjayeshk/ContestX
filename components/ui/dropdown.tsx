"use client";
import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";

export const Dropdown = DM.Root;
export const DropdownTrigger = DM.Trigger;

export function DropdownContent({ className, align = "end", ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={8}
        className={cn(
          "glass z-50 min-w-52 rounded-[12px] p-1.5 shadow-[0_20px_60px_-20px_rgb(0_0_0/.8)] data-[state=open]:animate-[menu-in_160ms_var(--ease-out-soft)]",
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownItem({ className, ...props }: React.ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-ink-2 outline-none data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-ink [&_svg]:size-4 [&_svg]:text-fog",
        className,
      )}
      {...props}
    />
  );
}

export const DropdownSeparator = () => <DM.Separator className="my-1 h-px bg-line" />;
export const DropdownLabel = ({ children }: { children: React.ReactNode }) => <DM.Label className="px-2.5 py-1.5 text-xs text-fog">{children}</DM.Label>;
