import type { Metadata } from "next";
import { RoleQuestionsPage } from "@/components/marketing/role-questions";

export const metadata: Metadata = {
  title: "Full-Stack Developer Interview Questions — Top Questions",
  description:
    "Practice full-stack developer interview questions spanning frontend, backend, databases, and deployment. Get AI feedback on your answers.",
  alternates: { canonical: "/interview-questions/full-stack-developer" },
  openGraph: {
    title: "Full-Stack Developer Interview Questions — PrepNexa",
    description: "Practice full-stack interview questions with AI feedback.",
    type: "website",
    url: "/interview-questions/full-stack-developer",
  },
};

const questions = [
  "How would you architect a feature that spans frontend, API, and database?",
  "Explain how a request flows through a full-stack app.",
  "How do you decide between client-side and server-side rendering?",
  "What are the tradeoffs of a monolith vs microservices?",
  "How do you handle authentication across a frontend and API?",
  "Explain how you'd secure user data end to end.",
  "How do you debug a bug that only happens in production?",
  "How would you improve a slow full-stack page load?",
  "Explain database migrations and why they matter.",
  "How do you keep a full-stack codebase maintainable?",
];

export default function FullStackDeveloperPage() {
  return (
    <RoleQuestionsPage
      heading="Full-Stack Developer Interview"
      accent="Questions"
      intro="Full-stack interviews test breadth: frontend, backend, data, and deployment all in one. Interviewers want to see that you can reason across the whole stack."
      questions={questions}
      tips={[
        "Be ready to trace a feature end-to-end, from UI to database.",
        "Know your authentication and security fundamentals.",
        "Practice explaining rendering and caching choices.",
        "Have a project where you owned the whole stack.",
      ]}
      ctaLabel="Run a full-stack mock interview"
      tipsTitle="Full-stack prep tips"
    />
  );
}
