import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24">
      <p className="num text-sm text-fog">404</p>
      <h1 className="display text-4xl">This page doesn&apos;t exist.</h1>
      <p className="text-ink-2">The link may be old, or the page may need different permissions.</p>
      <Link href="/dashboard" className={buttonVariants({ variant: "primary" })}>
        Go to dashboard
      </Link>
    </div>
  );
}
