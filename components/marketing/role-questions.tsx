import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

/**
 * Shared layout for role-specific interview question pages. Each page supplies
 * its own title, intro, curated questions, prep tips, and metadata — so every
 * role page has genuinely useful, unique content.
 */
export function RoleQuestionsPage({
  heading,
  accent,
  intro,
  questions,
  tips,
  ctaLabel,
  ctaHref = "/signup",
  tipsTitle = "Interview prep tips",
}: {
  heading: string;
  accent: string;
  intro: string;
  questions: string[];
  tips: string[];
  ctaLabel: string;
  ctaHref?: string;
  tipsTitle?: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {heading} <span className="text-gradient">{accent}</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{intro}</p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {questions.map((q, i) => (
          <Card key={q} className="glass">
            <CardContent className="flex gap-3 pt-6">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">{q}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <h2 className="text-lg font-bold">{tipsTitle}</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {tips.map((tip) => (
            <li key={tip}>• {tip}</li>
          ))}
        </ul>
      </div>

      <div className="mt-10 text-center">
        <Button asChild variant="gradient" size="lg">
          <Link href={ctaHref}>
            {ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
