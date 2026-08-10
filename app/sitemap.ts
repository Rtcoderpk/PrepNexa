import type { MetadataRoute } from "next";
import { blogPosts } from "@/content/blog";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Public sitemap. Only indexable marketing pages. Private user areas
 * (dashboard, setup, interview, results, history, account) are deliberately
 * excluded — they are gated by auth and noindexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/ai-mock-interview",
    "/free-ats-resume-checker",
    "/ai-resume-analyzer",
    "/cv-analyzer",
    "/resume-score-checker",
    "/resume-job-match",
    "/interview-practice",
    "/interview-questions",
    "/behavioral-interview-questions",
    "/technical-interview-questions",
    "/hr-interview-questions",
    "/resume-tips",
    "/career-resources",
    "/pricing",
    "/blog",
    "/about",
    "/privacy",
    "/terms",
    "/cookie-policy",
    "/contact",
  ].map((path) => ({
    url: `${APP_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const roleRoutes = [
    "/interview-questions/software-engineer",
    "/interview-questions/frontend-developer",
    "/interview-questions/backend-developer",
    "/interview-questions/python-developer",
    "/interview-questions/data-scientist",
    "/interview-questions/machine-learning-engineer",
    "/interview-questions/full-stack-developer",
    "/interview-questions/accountant",
    "/interview-questions/marketing-manager",
    "/interview-questions/project-manager",
  ].map((path) => ({
    url: `${APP_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const blogRoutes = blogPosts.map((post) => ({
    url: `${APP_URL}/blog/${post.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...roleRoutes, ...blogRoutes];
}