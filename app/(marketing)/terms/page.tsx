import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of PrepNexa — including AI feedback, subscriptions, and fair-use limits.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            1. The service
          </h2>
          <p>
            PrepNexa provides AI mock interviews, resume analysis, ATS checking,
            and job-description matching to help you prepare for job
            applications. AI-generated output is educational and informational
            only.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            2. No guarantees
          </h2>
          <p>
            We do not guarantee interviews, job offers, or hiring outcomes. ATS
            scores and resume scores are AI-based estimates, not vendor
            guarantees. AI feedback can be imperfect.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            3. Accounts & fair use
          </h2>
          <p>
            Free accounts receive 1 AI mock interview and 3 resume checks.
            Premium (Pro) users get more interviews subject to reasonable
            fair-use limits. Creating multiple accounts to bypass limits is not
            permitted.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            4. Subscriptions & refunds
          </h2>
          <p>
            PrepNexa Pro is a monthly subscription billed at the price shown on
            the pricing page. You can cancel anytime; access continues until the
            end of the paid period. Refund policy varies by payment provider.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            5. Acceptable use
          </h2>
          <p>
            Do not attempt to access another user&apos;s data, abuse the AI
            system, upload harmful files, or use the service for unlawful
            purposes. We may suspend accounts that violate these terms.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            6. Changes
          </h2>
          <p>
            We may update these terms from time to time. Continued use of the
            service after changes means you accept the updated terms.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            7. Contact
          </h2>
          <p>
            Questions? Use the{" "}
            <a className="text-primary hover:underline" href="/contact">contact page</a>.
          </p>
        </section>
      </div>
    </div>
  );
}