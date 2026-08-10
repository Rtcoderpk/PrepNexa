import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * robots.txt — allow public SEO pages, block private user areas.
 * Private paths are also noindexed via metadata in their layouts.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/setup",
          "/history",
          "/interview/",
          "/reset-password",
          "/api/",
          "/login",
          "/signup",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}