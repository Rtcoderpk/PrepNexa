import type { Metadata } from "next";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "About PrepNexa",
  description:
    "PrepNexa is an AI career preparation platform — AI mock interviews and a free ATS resume checker, built around you.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        About <span className="text-gradient">PrepNexa</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        AI Career Preparation, Built Around You.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <p>
          PrepNexa exists to close the gap between how people actually prepare
          for interviews and how hiring actually works. Most candidates either
          cram generic questions or skip practice entirely because they don&apos;t
          have a realistic way to rehearse.
        </p>
        <p>
          We built a full AI mock interview experience where the interviewer
          adapts to your role, your resume, and your answers — plus a free ATS
          resume checker and resume analyzer so you can fix your application
          before you send it.
        </p>
        <p>
          Everything runs on cloud AI, so there&apos;s nothing to install and no
          powerful computer required. Our free plan gives you a genuinely useful
          first interview and three resume checks — no credit card needed.
        </p>
        <p>
          We don&apos;t make promises we can&apos;t keep: AI feedback is a tool
          to guide you, not a guarantee of any interview or job.
        </p>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}