import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";

export function GuestGate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel flex max-w-xl flex-col items-start gap-4 p-8">
      <LockKeyhole className="size-5 text-violet-soft" aria-hidden />
      <h2 className="heading text-xl">{title}</h2>
      <div className="text-sm leading-relaxed text-fog">{children}</div>
      <div className="flex gap-2">
        <Link href="/register" className={buttonVariants({ variant: "primary" })}>
          Create account
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
          Sign in
        </Link>
      </div>
    </div>
  );
}
