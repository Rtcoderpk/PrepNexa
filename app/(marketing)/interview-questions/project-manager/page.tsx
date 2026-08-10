import type { Metadata } from "next";
import { RoleQuestionsPage } from "@/components/marketing/role-questions";

export const metadata: Metadata = {
  title: "Project Manager Interview Questions — Top Questions",
  description:
    "Practice project manager interview questions: scope, timelines, stakeholders, risk, and leadership. Get AI feedback on your answers.",
  alternates: { canonical: "/interview-questions/project-manager" },
  openGraph: {
    title: "Project Manager Interview Questions — PrepNexa",
    description: "Practice project management interview questions with AI feedback.",
    type: "website",
    url: "/interview-questions/project-manager",
  },
};

const questions = [
  "Tell me about a project that went over budget. What happened?",
  "How do you define project scope and prevent scope creep?",
  "How do you manage competing priorities from different stakeholders?",
  "Describe how you build and communicate a project timeline.",
  "How do you handle a risk that materializes mid-project?",
  "Tell me about a time you had to push back on an unrealistic deadline.",
  "How do you keep a remote team aligned?",
  "What's your process for running a project kickoff?",
  "How do you measure project success beyond delivery?",
  "Describe a time a project failed. What did you learn?",
];

export default function ProjectManagerPage() {
  return (
    <RoleQuestionsPage
      heading="Project Manager Interview"
      accent="Questions"
      intro="Project management interviews focus on how you plan, communicate, and handle pressure. Interviewers want real examples of delivering through ambiguity."
      questions={questions}
      tips={[
        "Have concrete stories with scope, timeline, and outcomes.",
        "Show stakeholder management and clear communication.",
        "Demonstrate risk thinking and contingency planning.",
        "Be honest about failures and what you learned.",
      ]}
      ctaLabel="Run a project manager mock interview"
      tipsTitle="Project management prep tips"
    />
  );
}
