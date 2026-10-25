"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { Wordmark } from "@/components/layout/logo";
import { api } from "@/lib/api-client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        json: mode === "login" ? { email, password } : { email, password, name: name || undefined, timezone },
      });
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : mode === "register" ? "/settings" : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 py-16">
      <Wordmark />
      <div>
        <h1 className="display text-4xl">{mode === "login" ? "Welcome back." : "Create your account."}</h1>
        <p className="mt-3 text-sm text-fog">
          {mode === "login" ? "Sign in to manage reminders and saved contests." : "Pick your platforms and reminder times once. ContestX schedules the rest."}
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {mode === "register" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" maxLength={60} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!error} aria-describedby={error ? "auth-error" : undefined} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={mode === "register" ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-invalid={!!error}
            aria-describedby={mode === "register" ? "pw-hint" : undefined}
          />
          {mode === "register" && (
            <p id="pw-hint" className="text-xs text-fog">
              At least 10 characters.
            </p>
          )}
        </div>
        <FieldError id="auth-error">{error}</FieldError>
        <Button type="submit" variant="primary" size="lg" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="text-sm text-fog">
        {mode === "login" ? (
          <>
            New here? <Link href="/register" className="text-violet-soft hover:text-ink">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href="/login" className="text-violet-soft hover:text-ink">Sign in</Link>
          </>
        )}
      </p>
    </div>
  );
}
