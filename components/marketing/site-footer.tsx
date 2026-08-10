import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const toolLinks = [
  { href: "/ai-mock-interview", label: "AI Mock Interview" },
  { href: "/free-ats-resume-checker", label: "Free ATS Resume Checker" },
  { href: "/ai-resume-analyzer", label: "AI Resume Analyzer" },
  { href: "/resume-job-match", label: "Resume Job Matcher" },
  { href: "/cv-analyzer", label: "CV Analyzer" },
  { href: "/resume-score-checker", label: "Resume Score Checker" },
];

const questionLinks = [
  { href: "/interview-questions", label: "Interview Questions" },
  { href: "/behavioral-interview-questions", label: "Behavioral Questions" },
  { href: "/technical-interview-questions", label: "Technical Questions" },
  { href: "/hr-interview-questions", label: "HR Questions" },
  { href: "/interview-practice", label: "Interview Practice" },
];

const resourceLinks = [
  { href: "/resume-tips", label: "Resume Tips" },
  { href: "/career-resources", label: "Career Resources" },
  { href: "/blog", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cookie-policy", label: "Cookie Policy" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/50 bg-background/60">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="text-sm text-muted-foreground">
              AI Career Preparation, Built Around You. Practice realistic AI mock
              interviews and check your resume for ATS compatibility — free.
            </p>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Tools</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {toolLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Interview Prep</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {questionLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Resources</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} PrepNexa. AI career preparation, built
            around you.
          </p>
          <div className="flex flex-wrap gap-4">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
