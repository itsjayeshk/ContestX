import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background,color,border-color,transform,box-shadow] duration-200 ease-[var(--ease-out-soft)] disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-violet text-[#0b0a14] hover:bg-violet-soft shadow-[0_0_0_1px_rgb(139_123_255/.5),0_8px_30px_-8px_rgb(139_123_255/.55)]",
        secondary: "bg-white/[0.04] text-ink border border-line-strong hover:bg-white/[0.08] hover:border-white/20",
        ghost: "text-ink-2 hover:text-ink hover:bg-white/[0.05]",
        danger: "bg-danger/10 text-danger border border-danger/25 hover:bg-danger/15",
        link: "text-violet-soft hover:text-ink underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-[13px] rounded-[var(--radius-control)]",
        md: "h-10 px-4 text-sm rounded-[var(--radius-control)]",
        lg: "h-12 px-6 text-[15px] rounded-[11px]",
        icon: "size-9 rounded-[var(--radius-control)]",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

