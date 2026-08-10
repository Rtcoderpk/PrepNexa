import type { Metadata } from "next";
import { RoleQuestionsPage } from "@/components/marketing/role-questions";

export const metadata: Metadata = {
  title: "Python Developer Interview Questions — Top Questions",
  description:
    "Practice Python developer interview questions: language fundamentals, data structures, GIL, and libraries. Get AI feedback on your answers.",
  alternates: { canonical: "/interview-questions/python-developer" },
  openGraph: {
    title: "Python Developer Interview Questions — PrepNexa",
    description: "Practice Python interview questions with AI feedback.",
    type: "website",
    url: "/interview-questions/python-developer",
  },
};

const questions = [
  "What is the difference between a list and a tuple?",
  "Explain the Global Interpreter Lock (GIL).",
  "What is a decorator and when would you use one?",
  "How do you manage memory in Python?",
  "Explain generators and when they're useful.",
  "What is the difference between `is` and `==`?",
  "How does multiprocessing differ from threading in Python?",
  "What are `*args` and `**kwargs`?",
  "How would you optimize a slow Python script?",
  "Explain how you'd structure a large Python project.",
];

export default function PythonDeveloperPage() {
  return (
    <RoleQuestionsPage
      heading="Python Developer Interview"
      accent="Questions"
      intro="Python interviews test language fluency, not just syntax. Expect questions about the GIL, memory model, and how you write clean, idiomatic code."
      questions={questions}
      tips={[
        "Understand Python's data model — what makes objects hashable, mutable, etc.",
        "Practice explaining the GIL without memorizing a script.",
        "Have real examples of using decorators, generators, and context managers.",
        "Be ready to discuss your project architecture.",
      ]}
      ctaLabel="Run a Python mock interview"
      tipsTitle="Python prep tips"
    />
  );
}
