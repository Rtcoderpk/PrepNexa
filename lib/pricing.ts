/**
 * Central pricing + plan configuration. The single source of truth for plan
 * limits and pricing — never hardcode plan values in components/pages.
 */

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyPkr: 0,
    freeInterviews: 3,
    freeResumeChecks: 3,
    ads: true,
    features: [
      "3 complete AI mock interviews",
      "Basic interview score",
      "Basic feedback",
      "3 free ATS resume checks",
      "Basic resume analysis",
      "Public interview questions",
      "Career resources",
      "Advertisements",
    ],
  },
  pro: {
    id: "pro",
    name: "PrepNexa Pro",
    priceMonthlyPkr: 499,
    ads: false,
    features: [
      "More AI mock interviews",
      "Advanced interview feedback",
      "Detailed answer analysis",
      "Interview history",
      "Performance analytics",
      "Full ATS resume analysis",
      "Resume improvement recommendations",
      "Job description matching",
      "Resume keyword optimization",
      "Ad-free experience",
      "Priority access to available AI capacity",
      "Premium career tools",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const PRO_MONTHLY_PRICE_PKR = PLANS.pro.priceMonthlyPkr;

/** Highest reasonable AI-interview count before fair-use limits apply. */
export const PRO_FAIR_USE_LIMIT = 30;

