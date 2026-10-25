import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
