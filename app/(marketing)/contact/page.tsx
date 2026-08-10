import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact PrepNexa",
  description:
    "Get in touch with the PrepNexa team about interviews, resumes, billing, or anything else.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Contact <span className="text-gradient">PrepNexa</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Questions about interviews, resumes, billing, or your account? We&apos;d
        love to help.
      </p>

      <Card className="glass mt-10">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Email us</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Send a note to support@prepnexa.example.com and we&apos;ll get
                back to you within 2 business days.
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            For billing and subscription questions, include your account email
            so we can help you faster. You can manage or cancel your
            subscription any time from your account.
          </p>

          <Button asChild variant="gradient">
            <a href="mailto:support@prepnexa.example.com">Send an email</a>
          </Button>

          <div className="border-t border-border/40 pt-4 text-sm text-muted-foreground">
            <p>
              Prefer self-serve? See the{" "}
              <Link href="/pricing" className="text-primary hover:underline">
                pricing page
              </Link>{" "}
              or the{" "}
              <Link href="/career-resources" className="text-primary hover:underline">
                career resources
              </Link>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}