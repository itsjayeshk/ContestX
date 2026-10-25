import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getCurrentUser } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ContestX: never miss a contest", template: "%s · ContestX" },
  description: "One calendar for LeetCode, Codeforces and CodeChef contests, with automatic email, push and in-app reminders.",
  applicationName: "ContestX",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#050508", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="en">
      <body>
        <div className="ambient" aria-hidden />
        <div className="relative z-10 flex min-h-dvh flex-col">
          <Navbar user={user ? { email: user.email, name: user.name, role: user.role } : null} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
        <Toaster theme="dark" position="bottom-right" toastOptions={{ classNames: { toast: "!bg-graphite !border-line-strong !text-ink", description: "!text-fog" } }} />
      </body>
    </html>
  );
}
