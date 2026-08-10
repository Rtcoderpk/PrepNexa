import type { Metadata } from "next";
import { RoleQuestionsPage } from "@/components/marketing/role-questions";

export const metadata: Metadata = {
  title: "Accountant Interview Questions — Top Questions",
  description:
    "Practice accountant interview questions: financial statements, accounting principles, tax, and audit. Get AI feedback on your answers.",
  alternates: { canonical: "/interview-questions/accountant" },
  openGraph: {
    title: "Accountant Interview Questions — PrepNexa",
    description: "Practice accounting interview questions with AI feedback.",
    type: "website",
    url: "/interview-questions/accountant",
  },
};

const questions = [
  "Explain the difference between accrual and cash accounting.",
  "Walk me through the three main financial statements.",
  "What is the accounting equation?",
  "How do you handle a discrepancy in the books?",
  "Explain depreciation and the methods used to calculate it.",
  "What is a trial balance and why is it important?",
  "How would you reconcile a bank statement?",
  "What are internal controls and why do they matter?",
  "Explain the difference between a debit and a credit.",
  "How do you stay current with changes in accounting standards?",
];

export default function AccountantPage() {
  return (
    <RoleQuestionsPage
      heading="Accountant Interview"
      accent="Questions"
      intro="Accounting interviews test technical fundamentals plus accuracy and ethics. Interviewers want to confirm you can be trusted with a company's numbers."
      questions={questions}
      tips={[
        "Know the three financial statements and how they link.",
        "Be ready to walk through a reconciliation process step by step.",
        "Demonstrate attention to detail and a systematic approach.",
        "Understand basic internal controls and fraud prevention.",
      ]}
      ctaLabel="Run an accountant mock interview"
      tipsTitle="Accounting prep tips"
    />
  );
}
