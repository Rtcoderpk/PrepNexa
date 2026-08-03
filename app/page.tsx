import Link from "next/link";
import {
  ArrowRight,
  Brain,
  BarChart3,
  FileText,
  Mic,
  Sparkles,
  Star,
  Volume2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const features = [
  {
    icon: Brain,
    title: "Realistic AI Interviewer",
    description:
      "Meet Alex — a senior-level interviewer who adapts to your answers, asks follow-ups, and challenges you like a real hiring manager.",
  },
  {
    icon: Mic,
    title: "Talk It Out",
    description:
      "Use your voice to answer. Alex listens, transcribes, and responds out loud for a truly immersive experience.",
  },
  {
    icon: BarChart3,
    title: "Detailed Feedback",
    description:
      "Get a score out of 10, strengths, improvement areas, and per-question notes after every interview.",
  },
  {
    icon: FileText,
    title: "Resume-Aware",
    description:
      "Upload your resume and Alex will tailor questions to your actual experience and the role you're targeting.",
  },
  {
    icon: Volume2,
    title: "Natural Conversations",
    description:
      "Questions progress from introduction to technical to problem-solving — just like a real interview loop.",
  },
  {
    icon: ShieldCheck,
    title: "Private & Secure",
    description:
      "Your data is protected with row-level security, encrypted sessions, and a polished, professional experience.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-fuchsia-500/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.25)_100%)]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xl font-bold tracking-tight"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>
            Interview<span className="text-gradient">IQ</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="gradient">
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6">
        <section className="flex flex-col items-center py-20 text-center sm:py-28">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-4 py-1.5 text-xs font-medium backdrop-blur">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            Practice real interviews with an AI that feels human
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Master your next interview with{" "}
            <span className="text-gradient">Alex</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            InterviewIQ AI simulates Google, Microsoft, and Amazon-style
            interviews. Answer with your voice, get personalized feedback, and
            walk into your real interview with confidence.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg" variant="gradient">
              <Link href="/signup">
                Start practicing free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in to dashboard</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group glass rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-primary transition-colors group-hover:from-indigo-500 group-hover:to-fuchsia-500 group-hover:text-white">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} InterviewIQ AI. Built for your next big
        interview.
      </footer>
    </div>
  );
}
