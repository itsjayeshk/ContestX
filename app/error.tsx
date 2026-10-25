"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24">
      <h1 className="display text-4xl">This page didn&apos;t load.</h1>
      <p className="text-ink-2">
        The server hit an error, often because the database is unreachable. Try again; if it keeps happening, check the server logs
        {error.digest ? ` for reference ${error.digest}` : ""}.
      </p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
