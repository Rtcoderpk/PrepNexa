import type { Metadata } from "next";
import { SetupForm } from "@/components/setup/setup-form";

export const metadata: Metadata = {
  title: "Setup Interview",
};

export default function SetupPage() {
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
      <SetupForm />
    </div>
  );
}
