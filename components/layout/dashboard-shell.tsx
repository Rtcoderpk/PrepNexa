"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Sparkles,
  LogOut,
  Menu,
  X,
  Settings,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { signOutAction } from "@/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/setup", label: "New Interview", icon: Sparkles },
  { href: "/history", label: "History", icon: Activity },
];

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() ?? "U";
  }
  return email[0]?.toUpperCase() ?? "U";
}

export function DashboardShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOutAction();
    router.push("/login");
    router.refresh();
  };

  const name =
    (user.user_metadata?.full_name as string | undefined) ?? user.email;
  const initials = getInitials(name, user.email ?? "User");

  const NavLinks = (
    <>
      {navItems.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-gradient-to-r from-indigo-500/15 to-fuchsia-500/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed -top-32 left-1/4 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 right-1/4 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-background/60 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center border-b border-border/60 px-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            Prep<span className="text-gradient">Nexa</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">{NavLinks}</nav>
        <div className="border-t border-border/60 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {name ?? "User"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-2 text-muted-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl lg:hidden">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          Prep<span className="text-gradient">Nexa</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-64 border-l border-border/60 bg-background/95 p-4 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Menu</span>
              <ThemeToggle />
            </div>
            <nav className="space-y-1">{NavLinks}</nav>
            <div className="mt-4 border-t border-border/60 pt-4">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 min-h-screen px-4 pb-16 pt-20 lg:ml-64 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
