import type { Metadata } from "next";
import { RoleQuestionsPage } from "@/components/marketing/role-questions";

export const metadata: Metadata = {
  title: "Backend Developer Interview Questions — Top Questions",
  description:
    "Practice backend developer interview questions: databases, APIs, caching, concurrency, and system design. Get AI feedback on your answers.",
  alternates: { canonical: "/interview-questions/backend-developer" },
  openGraph: {
    title: "Backend Developer Interview Questions — PrepNexa",
    description: "Practice backend interview questions with AI feedback.",
    type: "website",
    url: "/interview-questions/backend-developer",
  },
};

const questions = [
  "How would you design a REST API for a blogging platform?",
  "Explain database indexing and when indexes hurt performance.",
  "What is the difference between synchronous and asynchronous processing?",
  "How do you handle a sudden spike in traffic?",
  "Explain connection pooling and why it matters.",
  "What is eventual consistency?",
  "How would you secure an API endpoint?",
  "Explain how you would design a caching strategy.",
  "What is the difference between a message queue and a pub/sub system?",
  "How do you debug a slow database query?",
];

export default function BackendDeveloperPage() {
  return (
    <RoleQuestionsPage
      heading="Backend Developer Interview"
      accent="Questions"
      intro="Backend interviews focus on data, concurrency, and reliability. Interviewers want to see how you think about systems that scale, fail, and recover."
      questions={questions}
      tips={[
        "Be ready to design a system end-to-end, from API to database.",
        "Know your database internals — indexes, transactions, isolation.",
        "Practice explaining caching and queue-based architectures.",
        "Always mention failure modes and how you'd recover.",
      ]}
      ctaLabel="Run a backend mock interview"
      tipsTitle="Backend prep tips"
    />
  );
}
