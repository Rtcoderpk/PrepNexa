import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUsageStatus } from "@/lib/usage";
import { ProCtaCard } from "@/components/marketing/pro-cta-card";
import { SetupForm } from "@/components/setup/setup-form";

export const metadata: Metadata = {
  title: "Setup Interview",
};

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Server-side paywall: surface the upgrade CTA instead of the form when a
  // free user has used all their free interviews.
  let canStart = true;
  if (user) {
    try {
      const status = await getUsageStatus(user.id);
      canStart = status.canStartInterview;
    } catch {
      // Non-blocking — the start action enforces the gate anyway.
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Set up your interview
        </h1>
        <p className="mt-1 text-muted-foreground">
          Tell Alex what role you&apos;re targeting so the interview feels
          real.
        </p>
      </div>
      {canStart ? (
        <SetupForm />
      ) : (
        <ProCtaCard
          title="You've used all 3 free mock interviews"
          description="Upgrade your plan to continue practicing with advanced feedback, resume analysis, and job matching."
        />
      )}
    </div>
  );
}
