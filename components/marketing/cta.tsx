import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Reusable final CTA band for marketing/SEO pages. */
export function CTA({
  title = "Ready to become job-ready?",
  subtitle = "Get 1 free AI mock interview and 3 free ATS resume checks. No credit card required.",
  className,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "glass relative overflow-hidden rounded-3xl p-8 text-center sm:p-12",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
      <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <p className="relative mx-auto mt-3 max-w-xl text-muted-foreground">
        {subtitle}
      </p>
      <div className="relative mt-8 flex flex-col justify-center gap-4 sm:flex-row">
        <Button asChild size="lg" variant="gradient">
          <Link href="/signup">
            Start Free Interview
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/free-ats-resume-checker">Check My Resume Free</Link>
        </Button>
      </div>
      <p className="relative mt-4 text-sm text-muted-foreground">
        1 Free AI Interview + 3 Free Resume Checks
      </p>
    </section>
  );
}
