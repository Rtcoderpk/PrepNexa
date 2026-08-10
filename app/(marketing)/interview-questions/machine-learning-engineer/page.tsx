import type { Metadata } from "next";
import { RoleQuestionsPage } from "@/components/marketing/role-questions";

export const metadata: Metadata = {
  title: "Machine Learning Engineer Interview Questions — Top Questions",
  description:
    "Practice ML engineer interview questions: model training, deployment, MLOps, evaluation, and production systems. Get AI feedback on your answers.",
  alternates: { canonical: "/interview-questions/machine-learning-engineer" },
  openGraph: {
    title: "ML Engineer Interview Questions — PrepNexa",
    description: "Practice ML engineering interview questions with AI feedback.",
    type: "website",
    url: "/interview-questions/machine-learning-engineer",
  },
};

const questions = [
  "How do you go from a trained model to a deployed one?",
  "What is model drift and how do you monitor for it?",
  "Explain the difference between training and serving features.",
  "How would you handle a model that performs well offline but badly online?",
  "What is the difference between batch and real-time inference?",
  "How do you decide between retraining and fine-tuning?",
  "Explain how you'd set up an A/B test for a new model.",
  "What is a data leakage problem and how do you avoid it?",
  "How do you make a model explainable?",
  "Describe the full lifecycle of an ML system you've built.",
];

export default function MlEngineerPage() {
  return (
    <RoleQuestionsPage
      heading="ML Engineer Interview"
      accent="Questions"
      intro="ML engineering interviews sit at the intersection of software engineering and data science. Expect questions about deployment, monitoring, and making models reliable in production."
      questions={questions}
      tips={[
        "Have a real end-to-end ML project story: data → model → deployment.",
        "Know the operational side: monitoring, drift, rollback.",
        "Understand offline-vs-online metrics and leakage.",
        "Practice explaining model behavior to non-ML stakeholders.",
      ]}
      ctaLabel="Run an ML engineer mock interview"
      tipsTitle="ML engineering prep tips"
    />
  );
}
