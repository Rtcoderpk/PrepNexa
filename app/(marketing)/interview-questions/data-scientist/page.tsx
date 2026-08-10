import type { Metadata } from "next";
import { RoleQuestionsPage } from "@/components/marketing/role-questions";

export const metadata: Metadata = {
  title: "Data Scientist Interview Questions — Top Questions",
  description:
    "Practice data scientist interview questions: statistics, machine learning, SQL, and case studies. Get AI feedback on your answers.",
  alternates: { canonical: "/interview-questions/data-scientist" },
  openGraph: {
    title: "Data Scientist Interview Questions — PrepNexa",
    description: "Practice data science interview questions with AI feedback.",
    type: "website",
    url: "/interview-questions/data-scientist",
  },
};

const questions = [
  "Explain the bias-variance tradeoff.",
  "What is overfitting and how do you prevent it?",
  "How would you handle missing data?",
  "Explain the difference between supervised and unsupervised learning.",
  "What is a p-value and how would you explain it to a non-technical person?",
  "How do you choose between precision and recall for a given problem?",
  "Explain cross-validation and when to use it.",
  "How would you design an A/B test?",
  "What is feature engineering? Give an example.",
  "How would you evaluate an imbalanced classification problem?",
];

export default function DataScientistPage() {
  return (
    <RoleQuestionsPage
      heading="Data Scientist Interview"
      accent="Questions"
      intro="Data science interviews blend statistics, ML fundamentals, SQL, and business judgment. Interviewers want you to reason about tradeoffs, not recite formulas."
      questions={questions}
      tips={[
        "Be able to explain ML concepts to a business stakeholder.",
        "Practice the math behind common models, not just the API calls.",
        "Have a case study story with real metrics and decisions.",
        "Know how to design experiments and interpret uncertainty.",
      ]}
      ctaLabel="Run a data scientist mock interview"
      tipsTitle="Data science prep tips"
    />
  );
}
