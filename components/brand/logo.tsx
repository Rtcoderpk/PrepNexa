import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** PrepNexa brand mark. Used across the public site and the app shell. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 text-xl font-bold tracking-tight",
        className,
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30">
        <Sparkles className="h-4 w-4" />
      </span>
      <span>
        Prep<span className="text-gradient">Nexa</span>
      </span>
    </Link>
  );
}
