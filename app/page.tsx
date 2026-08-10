import Link from "next/link";
import {
  ArrowRight,
  Brain,
  BarChart3,
  FileText,
  Mic,
  Sparkles,
  Star,
  ShieldCheck,
  Search,
  Target,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdSlot } from "@/components/ads/ad-slot";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { LogoJsonLd } from "@/components/marketing/logo-jsonld";

const features = [
  {
    icon: Brain,
    title: "Adaptive AI Interviewer",
    description:
      "Meet Alex — a senior-level interviewer who adapts to your answers, asks follow-ups, and challenges you like a real hiring manager.",
  },
  {
    icon: Search,
    title: "Free ATS Resume Checker",
    description:
      "Upload your resume and get an ATS compatibility score, keyword analysis, and improvements you can apply today.",
  },
  {
    icon: Target,
    title: "Job Description Matching",
    description:
      "Paste a job description and see exactly how well your resume matches — and what's missing.",
  },
  {
    icon: Mic,
    title: "Answer with Your Voice",
    description:
      "Speak your answers and get transcribed, or type them out. Alex listens and responds naturally.",
  },
  {
    icon: BarChart3,
    title: "Detailed Feedback",
    description:
      "Score out of 10, strengths, improvement areas, and per-question notes after every interview.",
  },
  {
    icon: ShieldCheck,
    title: "Private & Secure",
    description:
      "Row-level security, server-side AI keys, and encrypted sessions. Your data stays yours.",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Set your target",
    desc: "Pick a job role, paste a job description, or upload your resume.",
  },
  {
    step: "2",
    title: "Practice the interview",
    desc: "Answer up to 5 progressive questions — with your voice or typing.",
  },
  {
    step: "3",
    title: "Get scored feedback",
    desc: "Instant scores, strengths, weaknesses, and an improvement roadmap.",
  },
  {
    step: "4",
    title: "Polish your resume",
    desc: "Check ATS compatibility, fix weak bullets, and match job descriptions.",
  },
];

export default function LandingPage() {
  return (
    <>
      <LogoJsonLd />
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-fuchsia-500/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.25)_100%)]" />

        <SiteHeader />

        {/* Hero */}
        <main className="relative z-10 mx-auto max-w-6xl px-6">
          <section className="flex flex-col items-center py-20 text-center sm:py-28">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-4 py-1.5 text-xs font-medium backdrop-blur">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              1 Free AI Interview + 3 Free Resume Checks
            </span>
            <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
              AI Mock Interviews &{" "}
              <span className="text-gradient">Free ATS Resume Checker</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Practice realistic interviews, analyze your resume, discover your
              weaknesses, and become job-ready with AI.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" variant="gradient">
                <Link href="/signup">
                  Start Free Interview
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/free-ats-resume-checker">
                  Check My Resume Free
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              No credit card required · Cancel anytime
            </p>
          </section>

          {/* Trusted / value indicators */}
          <section className="grid gap-4 pb-16 sm:grid-cols-3">
            {[
              { icon: Sparkles, label: "AI-Powered Feedback" },
              { icon: Search, label: "Instant ATS Analysis" },
              { icon: Target, label: "Job Match Score" },
            ].map((item) => (
              <div
                key={item.label}
                className="glass flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-medium text-muted-foreground"
              >
                <item.icon className="h-4 w-4 text-primary" />
                {item.label}
              </div>
            ))}
          </section>

          {/* Features */}
          <section className="grid gap-6 pb-16 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Link
                key={feature.title}
                href={
                  feature.title === "Free ATS Resume Checker"
                    ? "/free-ats-resume-checker"
                    : "/ai-mock-interview"
                }
                className="group glass rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-primary transition-colors group-hover:from-indigo-500 group-hover:to-fuchsia-500 group-hover:text-white">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </Link>
            ))}
          </section>

          <AdSlot slot="homepage" />

          {/* How it works */}
          <section className="pb-16">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                How PrepNexa works
              </h2>
              <p className="mt-3 text-muted-foreground">
                From first practice to final offer — a clear path.
              </p>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {howItWorks.map((item, i) => (
                <div
                  key={item.step}
                  className="glass relative rounded-2xl p-6"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-bold text-white">
                    {item.step}
                  </span>
                  <h3 className="mb-2 mt-4 font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Free vs Pro */}
          <section className="pb-16">
            <div className="glass overflow-hidden rounded-3xl">
              <div className="grid gap-8 p-8 md:grid-cols-2 md:p-12">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Free vs <span className="text-gradient">Pro</span>
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Start free, upgrade when you&apos;re ready. Everything you
                    keep matters.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm">
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      3 free ATS resume checks
                    </li>
                    <li className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      1 complete AI mock interview
                    </li>
                    <li className="flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-primary" />
                      Ad-free, unlimited practice with Pro
                    </li>
                  </ul>
                  <Button asChild variant="gradient" className="mt-8">
                    <Link href="/pricing">
                      See pricing
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="glass rounded-2xl p-6">
                  <p className="text-sm font-semibold">PrepNexa Pro</p>
                  <p className="mt-1 text-3xl font-extrabold">
                    PKR 499<span className="text-base font-normal text-muted-foreground">/month</span>
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {[
                      "More AI mock interviews (fair-use)",
                      "Advanced interview feedback",
                      "Full ATS resume analysis",
                      "Resume improvement recommendations",
                      "Job description matching",
                      "Ad-free experience",
                    ].map((item) => (
                      <li key={item} className="flex gap-2">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="pb-16">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Frequently asked questions
              </h2>
            </div>
            <div className="mx-auto mt-10 max-w-3xl space-y-4">
              {[
                {
                  q: "Is PrepNexa really free?",
                  a: "Yes — every new account gets 1 complete AI mock interview and 3 free ATS resume checks, with no credit card.",
                },
                {
                  q: "Do I need a powerful computer or GPU?",
                  a: "No. Everything runs on cloud AI — you only need a browser. No downloads, no model installation.",
                },
                {
                  q: "Is my resume and data private?",
                  a: "Your data is protected with row-level security, and AI analysis happens server-side. Resumes are only accessible to you.",
                },
                {
                  q: "What does the ATS score mean?",
                  a: "The ATS score is an AI-based compatibility estimate, not a guaranteed score from a specific ATS vendor. It helps you prioritize fixes.",
                },
                {
                  q: "How does the free interview compare to Pro?",
                  a: "The free interview is a complete, genuinely useful mock interview. Pro unlocks more interviews, advanced feedback, and the full resume suite.",
                },
              ].map((faq) => (
                <details
                  key={faq.q}
                  className="glass group rounded-2xl bg-background/50 p-5"
                >
                  <summary className="cursor-pointer list-none font-medium">
                    {faq.q}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="pb-24">
            <div className="glass relative overflow-hidden rounded-3xl p-10 text-center sm:p-14">
              <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
              <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">
                Prepare smarter. Interview better. Get job-ready.
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-muted-foreground">
                One platform for your next interview and your next application.
              </p>
              <div className="relative mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" variant="gradient">
                  <Link href="/signup">
                    Start Free Interview
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/free-ats-resume-checker">
                    Check My Resume Free
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}