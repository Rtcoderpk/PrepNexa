import type { Metadata } from "next";
import { RoleQuestionsPage } from "@/components/marketing/role-questions";

export const metadata: Metadata = {
  title: "Frontend Developer Interview Questions — Top Questions",
  description:
    "Practice frontend developer interview questions: JavaScript, React, CSS, accessibility, and performance. Get AI feedback on your answers.",
  alternates: { canonical: "/interview-questions/frontend-developer" },
  openGraph: {
    title: "Frontend Developer Interview Questions — PrepNexa",
    description: "Practice frontend interview questions with AI feedback.",
    type: "website",
    url: "/interview-questions/frontend-developer",
  },
};

const questions = [
  "Explain the difference between the DOM and the virtual DOM.",
  "How does React decide when to re-render a component?",
  "What is the CSS box model?",
  "Explain debouncing and throttling, and when to use each.",
  "How would you make a website accessible to screen readers?",
  "What is a closure in JavaScript?",
  "How do you optimize a slow page load?",
  "Explain the difference between `display: none` and `visibility: hidden`.",
  "What is a higher-order component?",
  "How do you handle state across many components?",
];

export default function FrontendDeveloperPage() {
  return (
    <RoleQuestionsPage
      heading="Frontend Developer Interview"
      accent="Questions"
      intro="Frontend interviews test your JavaScript fundamentals, your framework knowledge, and your ability to build fast, accessible, responsive UIs. Practice explaining how the browser actually renders your code."
      questions={questions}
      tips={[
        "Know the fundamentals — closures, promises, event loop — cold.",
        "Practice explaining layout and rendering at the browser level.",
        "Have a real project story where you improved performance.",
        "Understand accessibility and responsive design basics.",
      ]}
      ctaLabel="Run a frontend mock interview"
      tipsTitle="Frontend prep tips"
    />
  );
}
