"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const NAV_LINKS = [
  { href: "/ai-mock-interview", label: "AI Mock Interview" },
  { href: "/free-ats-resume-checker", label: "ATS Resume Checker" },
  { href: "/ai-resume-analyzer", label: "Resume Analyzer" },
  { href: "/interview-questions", label: "Interview Questions" },
  { href: "/pricing", label: "Pricing" },
];

/** Public marketing header with responsive nav. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="gradient" size="sm">
            <Link href="/signup">Start free</Link>
          </Button>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/50 bg-background/95 p-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              <Button asChild variant="ghost" size="sm" className="flex-1">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="gradient" size="sm" className="flex-1">
                <Link href="/signup">Start free</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
