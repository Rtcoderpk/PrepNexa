import type { Metadata } from "next";
import { RoleQuestionsPage } from "@/components/marketing/role-questions";

export const metadata: Metadata = {
  title: "Marketing Manager Interview Questions — Top Questions",
  description:
    "Practice marketing manager interview questions: strategy, campaigns, metrics, and leadership. Get AI feedback on your answers.",
  alternates: { canonical: "/interview-questions/marketing-manager" },
  openGraph: {
    title: "Marketing Manager Interview Questions — PrepNexa",
    description: "Practice marketing management interview questions with AI feedback.",
    type: "website",
    url: "/interview-questions/marketing-manager",
  },
};

const questions = [
  "Tell me about a campaign you led from concept to results.",
  "How do you measure the ROI of a marketing channel?",
  "Describe how you build a marketing strategy for a new product.",
  "How do you balance brand building with demand generation?",
  "Tell me about a time a campaign underperformed. What did you do?",
  "How do you prioritize marketing channels with a limited budget?",
  "How do you collaborate with sales and product teams?",
  "What metrics do you track to evaluate a campaign's success?",
  "Describe your approach to content marketing and SEO.",
  "How do you keep your team motivated during a difficult quarter?",
];

export default function MarketingManagerPage() {
  return (
    <RoleQuestionsPage
      heading="Marketing Manager Interview"
      accent="Questions"
      intro="Marketing manager interviews test strategic thinking, data fluency, and leadership. Interviewers want proof you can run campaigns that hit measurable business goals."
      questions={questions}
      tips={[
        "Have real campaign stories with concrete numbers (ROI, CAC, conversion).",
        "Show you can tie marketing activity to revenue.",
        "Demonstrate cross-team collaboration and leadership.",
        "Be ready to discuss budget tradeoffs and prioritization.",
      ]}
      ctaLabel="Run a marketing manager mock interview"
      tipsTitle="Marketing prep tips"
    />
  );
}
