"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { Bell, LogOut, Menu, Search, Settings, Shield, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { relativeAgo } from "@/lib/time";
import { Wordmark } from "./logo";
import { SearchDialog } from "./search-dialog";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contests", label: "All contests" },
  { href: "/calendar", label: "Calendar" },
  { href: "/analytics", label: "Analytics" },
  { href: "/reminders", label: "Reminders" },
  { href: "/settings", label: "Settings" },
];

export interface NavUser {
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
}

export function Navbar({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-violet focus:px-3 focus:py-1.5 focus:text-void">
        Skip to content
      </a>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="ContestX home" className="shrink-0 rounded-md">
          <Wordmark />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <li key={n.href} className="relative">
              <Link
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={cn("relative block rounded-md px-3 py-2 text-[13.5px] transition-colors", isActive(n.href) ? "text-ink" : "text-fog hover:text-ink-2")}
              >
                {n.label}
                {isActive(n.href) && (
                  <motion.span layoutId="nav-indicator" className="absolute inset-x-3 -bottom-[13px] h-px bg-gradient-to-r from-violet to-cyan" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                )}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-9 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-white/[0.02] pl-3 pr-2 text-[13px] text-fog transition-colors hover:border-line-strong hover:text-ink-2 md:inline-flex"
          >
            <Search className="size-4" /> Search
            <kbd className="ml-3 rounded border border-line px-1.5 text-[11px] text-fog-2">Ctrl K</kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search contests" onClick={() => setSearchOpen(true)}>
            <Search />
          </Button>
          {user ? (
            <>
              <NotificationBell />
              <ProfileMenu user={user} />
            </>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <Link href="/register" className={buttonVariants({ variant: "primary", size: "sm" })}>
                Create account
              </Link>
            </div>
          )}
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms]" />
              <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(20rem,88vw)] flex-col gap-6 border-l border-line bg-graphite p-6 data-[state=open]:animate-[slide-in_260ms_var(--ease-out-soft)]">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-sm text-fog">Menu</Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close menu">
                      <X />
                    </Button>
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
                <ul className="flex flex-col gap-1">
                  {NAV.map((n) => (
                    <li key={n.href}>
                      <Link href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className={cn("block rounded-lg px-3 py-2.5 text-[15px]", isActive(n.href) ? "bg-white/[0.06] text-ink" : "text-ink-2 hover:bg-white/[0.04]")}>
                        {n.label}
                      </Link>
                    </li>
                  ))}
                  {user?.role === "ADMIN" && (
                    <li>
                      <Link href="/admin" className="block rounded-lg px-3 py-2.5 text-[15px] text-ink-2 hover:bg-white/[0.04]">
                        Admin
                      </Link>
                    </li>
                  )}
                </ul>
                {!user && (
                  <div className="mt-auto flex flex-col gap-2">
                    <Link href="/register" className={buttonVariants({ variant: "primary" })}>
                      Create account
                    </Link>
                    <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
                      Sign in
                    </Link>
                  </div>
                )}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </nav>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}

interface NotifItem {
  id: string;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
  readAt: string | null;
}

function NotificationBell() {
  const [data, setData] = useState<{ items: NotifItem[]; unread: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    api<{ items: NotifItem[]; unread: number }>("/api/notifications")
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
    const id = setInterval(() => document.visibilityState === "visible" && void load(), 60_000);
    return () => clearInterval(id);
  }, []);

  const onOpen = async (open: boolean) => {
    if (open && data?.unread) {
      await api("/api/notifications/read", { method: "POST" }).catch(() => undefined);
      setData((d) => (d ? { ...d, unread: 0 } : d));
    }
  };

  return (
    <Dropdown onOpenChange={onOpen}>
      <DropdownTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")} aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`}>
        <Bell />
        {!!data?.unread && <span className="absolute right-2 top-2 size-2 rounded-full bg-cyan ring-2 ring-graphite" />}
      </DropdownTrigger>
      <DropdownContent className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm font-medium">Notifications</span>
          <Link href="/reminders" className="text-xs text-fog hover:text-ink">
            All reminders
          </Link>
        </div>
        <div className="max-h-96 overflow-y-auto p-1.5">
          {error && <p className="px-3 py-4 text-[13px] text-danger">{error}</p>}
          {!error && !data && <div className="skeleton m-2 h-16" />}
          {data && data.items.length === 0 && <p className="px-3 py-6 text-[13px] text-fog">In-app reminders show up here when a contest is about to start.</p>}
          {data?.items.map((n) => (
            <DropdownItem key={n.id} asChild className="flex-col items-start gap-0.5">
              <a href={n.url ?? "/reminders"} target={n.url ? "_blank" : undefined} rel="noopener noreferrer">
                <span className="text-[13px] text-ink">{n.title}</span>
                <span className="text-xs text-fog">{n.body}</span>
                <span className="text-[11px] text-fog-2">{relativeAgo(n.createdAt)}</span>
              </a>
            </DropdownItem>
          ))}
        </div>
      </DropdownContent>
    </Dropdown>
  );
}

function ProfileMenu({ user }: { user: NavUser }) {
  const router = useRouter();
  const initials = (user.name ?? user.email).slice(0, 1).toUpperCase();
  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign out");
    }
  };
  return (
    <Dropdown>
      <DropdownTrigger className="ml-1 grid size-8 place-items-center rounded-full bg-gradient-to-br from-violet/70 to-cyan/50 text-[13px] font-semibold text-void ring-1 ring-white/10" aria-label="Account menu">
        {initials}
      </DropdownTrigger>
      <DropdownContent>
        <DropdownLabel>
          <span className="block truncate text-ink-2">{user.name ?? "Signed in"}</span>
          <span className="block truncate">{user.email}</span>
        </DropdownLabel>
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link href="/settings#account">
            <User /> Account
          </Link>
        </DropdownItem>
        {user.role === "ADMIN" && (
          <DropdownItem asChild>
            <Link href="/admin">
              <Shield /> Admin
            </Link>
          </DropdownItem>
        )}
        <DropdownSeparator />
        <DropdownItem onSelect={logout}>
          <LogOut /> Sign out
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
