/**
 * Blog content registry. Each article has genuinely useful, hand-written
 * content with internal links and a CTA to a relevant tool. No AI-generated
 * spam. Articles render as static pages in app/(marketing)/blog/[slug].
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readMinutes: number;
  category: string;
  cta: {
    href: string;
    label: string;
  };
  sections: Array<{
    heading: string;
    body: string[];
    bullets?: string[];
  }>;
  faq?: Array<{ question: string; answer: string }>;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-pass-ats-resume-checker",
    title: "How to Pass an ATS Resume Checker (With Examples)",
    description:
      "Learn what ATS software actually looks for and how to optimize your resume so it gets parsed, matched, and seen by a recruiter.",
    date: "2026-07-20",
    readMinutes: 7,
    category: "Resume",
    cta: { href: "/free-ats-resume-checker", label: "Check your resume free" },
    sections: [
      {
        heading: "What an ATS actually does",
        body: [
          "Applicant Tracking Systems (ATS) are the software companies use to collect and rank resumes. Before any human reads your application, the ATS parses your resume into fields — name, experience, skills, education — and scores how well it matches the job description.",
          "A resume that fails parsing or misses keywords can be filtered out before a recruiter ever sees it. That's why an ATS check is one of the highest-leverage things you can do before applying.",
        ],
      },
      {
        heading: "The 5 things ATS software looks for",
        bullets: [
          "Parseable structure — standard headings and no tables, images, or text boxes.",
          "Relevant keywords — the exact terms from the job description, used naturally.",
          "A clear format — reverse-chronological experience with dates and role titles.",
          "Contact information — a professional email and phone number at the top.",
          "Relevant content — skills and experience that match the role you're applying for.",
        ],
        body: [
          "The most common reason a good resume scores low on an ATS is missing keywords. If the job says 'React' and your resume says 'frontend framework', the ATS can't connect them.",
        ],
      },
      {
        heading: "How to improve your ATS score",
        body: [
          "Mirror the language of the job description. Use the exact skill names, tools, and phrases where they genuinely describe your experience. Start each bullet with a strong action verb and include numbers where possible.",
          "Keep formatting simple: one column, standard headings like 'Experience' and 'Education', and a standard font. Avoid headers/footers with contact info, because many parsers skip them.",
        ],
      },
      {
        heading: "One honest caveat",
        body: [
          "No tool can guarantee a specific ATS vendor's score. Our ATS score is an AI-based estimate designed to help you prioritize fixes — use it as a guide, not a promise.",
        ],
      },
    ],
    faq: [
      {
        question: "What is a good ATS resume score?",
        answer:
          "Treat 75+ out of 100 as a strong resume, 50–75 as needing targeted fixes, and under 50 as a sign to restructure. Scores are estimates, not absolutes.",
      },
      {
        question: "Should I use a photo or table on my resume?",
        answer:
          "Avoid them. Many ATS parsers can't read images or tables, which can cause your content to be dropped.",
      },
    ],
  },
  {
    slug: "star-method-behavioral-interviews",
    title: "The STAR Method: Answer Behavioral Questions Like a Pro",
    description:
      "Situation, Task, Action, Result. Learn the STAR framework with a complete example answer and common mistakes to avoid.",
    date: "2026-07-28",
    readMinutes: 6,
    category: "Interview",
    cta: { href: "/behavioral-interview-questions", label: "Practice behavioral questions" },
    sections: [
      {
        heading: "Why interviewers ask behavioral questions",
        body: [
          "Past behavior is the best predictor of future behavior. When an interviewer asks 'tell me about a time...', they want a real story that shows how you work under pressure, in teams, and when things go wrong.",
        ],
      },
      {
        heading: "The STAR framework",
        bullets: [
          "Situation — set the scene in one or two sentences.",
          "Task — describe your responsibility in that situation.",
          "Action — explain what you specifically did, step by step.",
          "Result — share the outcome, with numbers when possible.",
        ],
        body: [
          "The most common mistake is spending 80% of the answer on the situation and forgetting the action. Interviewers hire you for what YOU did, not the context you were in.",
        ],
      },
      {
        heading: "A complete example",
        body: [
          "Question: 'Tell me about a time you had to meet a tight deadline.'",
          "Situation: 'We had a product launch in two weeks and our lead engineer unexpectedly left.' Task: 'As the only remaining engineer, I owned the entire delivery.' Action: 'I cut the scope with product, set up daily standups, and automated the test suite so we could ship faster.' Result: 'We launched on time with zero critical bugs, and the release lifted signups by 15%.'",
        ],
      },
      {
        heading: "Practice makes the difference",
        body: [
          "You can read about STAR all day, but you'll only get better by speaking answers out loud. Run a mock behavioral interview and get scored feedback on clarity, structure, and impact.",
        ],
      },
    ],
    faq: [
      {
        question: "How long should a STAR answer be?",
        answer: "Keep it between 60 and 90 seconds — enough for detail, short enough to stay engaging.",
      },
    ],
  },
  {
    slug: "common-cv-mistakes-and-fixes",
    title: "10 Common CV Mistakes (And How to Fix Each One)",
    description:
      "From vague bullet points to missing keywords — the most common CV mistakes we see, with a before-and-after fix for each.",
    date: "2026-08-02",
    readMinutes: 8,
    category: "Resume",
    cta: { href: "/free-ats-resume-checker", label: "Get your CV scored free" },
    sections: [
      {
        heading: "Vague bullet points",
        body: [
          "Before: 'Worked on website development.' After: 'Developed and optimized responsive web applications using React and REST APIs, improving page performance and user experience.'",
          "Specific, quantified language beats generic descriptions every time. A recruiter scanning for impact should be able to see your contribution in seconds.",
        ],
      },
      {
        heading: "Missing keywords",
        body: [
          "If your target role uses a skill you have but don't name it, the ATS and the recruiter both miss it. Use the exact terminology for your tools, frameworks, and methodologies.",
        ],
      },
      {
        heading: "Unclear formatting",
        body: [
          "Tables, multi-column layouts, and graphics are the #1 cause of ATS parsing failure. Keep one column, standard headings, and a clean hierarchy.",
        ],
      },
      {
        heading: "Filler language",
        body: [
          "'Results-oriented team player with strong communication skills' tells the reader nothing. Cut clichés and replace them with evidence: what you did and what happened.",
        ],
      },
    ],
    faq: [
      {
        question: "Should my CV be one page?",
        answer:
          "For most roles, one page is ideal; two is fine for senior or academic roles. Never pad to fill space.",
      },
    ],
  },
  {
    slug: "how-to-prepare-for-a-technical-interview",
    title: "How to Prepare for a Technical Interview in 30 Days",
    description:
      "A month-by-week technical interview prep plan: fundamentals, practice, system design, and mock interviews.",
    date: "2026-08-05",
    readMinutes: 9,
    category: "Interview",
    cta: { href: "/technical-interview-questions", label: "Practice technical questions" },
    sections: [
      {
        heading: "Week 1: Refresh fundamentals",
        body: [
          "Start with the basics you'll be tested on: data structures (arrays, linked lists, hash maps, trees, graphs) and core algorithms (sorting, searching, recursion). Rebuild them from scratch so the patterns become automatic.",
        ],
      },
      {
        heading: "Week 2: Practice problems out loud",
        body: [
          "Solve problems while verbalizing your reasoning. Interviews reward the thought process, not just the answer. Restate the problem, ask clarifying questions, propose a naive solution, then optimize.",
        ],
      },
      {
        heading: "Week 3: System design",
        body: [
          "Practice designing systems end to end: REST APIs, databases, caching, and queues. You don't need to be an expert — interviewers want a structured, reasoned approach.",
        ],
      },
      {
        heading: "Week 4: Mock interviews",
        body: [
          "Run timed mock interviews and review your feedback. Focus on your weakest categories and do a final pass over your real project stories.",
        ],
      },
    ],
    faq: [
      {
        question: "How many practice problems do I need?",
        answer:
          "Quality beats quantity. 50–80 well-understood problems, practiced out loud, prepare most candidates well for a generalist loop.",
      },
    ],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
