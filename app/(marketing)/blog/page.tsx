import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { blogPosts } from "@/content/blog";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "PrepNexa Blog — Interview Prep, Resume & Career Advice",
  description:
    "Practical articles on interview preparation, resume writing, ATS optimization, and career growth — with examples and tools to act on them.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "PrepNexa Blog",
    description: "Practical interview, resume, and career advice.",
    type: "website",
    url: "/blog",
  },
};

export default function BlogIndexPage() {
  const posts = [...blogPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          PrepNexa <span className="text-gradient">Blog</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Practical, example-rich advice on interviews, resumes, and career
          growth.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`}>
            <Card className="glass h-full transition-all hover:border-primary/40">
              <CardContent className="pt-6">
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {post.category}
                  </span>
                  <span>{post.readMinutes} min read</span>
                  <span>
                    {new Date(post.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <h2 className="text-lg font-bold">{post.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {post.description}
                </p>
                <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Read article
                  <ArrowRight className="h-4 w-4" />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <CTA className="mt-12" />
    </div>
  );
}