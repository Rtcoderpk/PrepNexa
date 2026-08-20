import Link from "next/link";
import {
  Crown,
  FileText,
  Mic,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UsageStatus } from "@/lib/usage";

/** Plan + usage summary banner shown at the top of the dashboard. */
export function UsageSummary({ usage }: { usage: UsageStatus }) {
  if (usage.isPremium) {
    return (
      <div className="glass rounded-2xl border border-primary/30 bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 p-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <p className="font-semibold">PREPNEXA PRO</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Ad-free · Advanced feedback · Full resume analysis · Job matching
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Mic className="h-4 w-4 text-primary" />
              Unlimited interviews
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              Unlimited resume checks
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-border/60 p-5">
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">
            Your Career Progress
          </p>
          <div className="mt-3 flex flex-wrap gap-6 text-sm">
            <div>
              <p className="flex items-center gap-1.5 font-medium">
                <Mic className="h-4 w-4 text-primary" />
                Interview
              </p>
              <p className="mt-1 text-muted-foreground">
                {usage.freeInterviewsUsed} / {usage.freeInterviewLimit} free
                interviews used
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 font-medium">
                <FileText className="h-4 w-4 text-primary" />
                Resume
              </p>
              <p className="mt-1 text-muted-foreground">
                {usage.resumeChecksRemaining} / {usage.resumeCheckLimit} free
                checks remaining
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Button asChild variant="gradient">
            <Link href="/pricing">
              Unlock Pro — PKR 499/month
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Ad-free · More interviews · Advanced feedback
          </p>
        </div>
      </div>
    </div>
  );
}