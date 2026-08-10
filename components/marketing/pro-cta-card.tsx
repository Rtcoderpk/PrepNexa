import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Premium conversion card shown after a free user hits a limit (used up the
 * free interview or the free resume checks). Server components should only
 * render this when the user is not premium.
 */
export function ProCtaCard({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="glass relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 p-8">
      <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="relative">
        <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
        {description && (
          <p className="mt-2 text-muted-foreground">{description}</p>
        )}
        <ul className="mt-5 grid max-w-lg gap-2 text-sm sm:grid-cols-2">
          {[
            "More AI mock interviews",
            "Advanced feedback",
            "Full resume analysis",
            "Job matching",
            "Ad-free experience",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {item}
            </li>
          ))}
        </ul>
        <Button asChild variant="gradient" className="mt-6" size="lg">
          <Link href="/pricing">
            Unlock Pro — PKR 499/month
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}