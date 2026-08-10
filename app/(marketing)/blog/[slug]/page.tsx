import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { blogPosts, getPostBySlug } from "@/content/blog";
import { Button } from "@/components/ui/button";
import { CTA } from "@/components/marketing/cta";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: `/blog/${post.slug}`,
    },
  };
}

function ArticleJsonLd({ post }: { post: (typeof blogPosts)[number] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      "@type": "Organization",
      name: "PrepNexa",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <>
      <ArticleJsonLd post={post} />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/blog"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← All articles
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {post.category}
          </span>
          <span>{post.readMinutes} min read</span>
          <span>
            {new Date(post.date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="mt-8 space-y-8">
          {post.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold">{section.heading}</h2>
              {section.body.map((paragraph, i) => (
                <p
                  key={i}
                  className="mt-3 leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-3 list-inside list-disc space-y-2 text-muted-foreground">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <p className="font-semibold">Put it into practice</p>
          <Button asChild variant="gradient" className="mt-4">
            <Link href={post.cta.href}>
              {post.cta.label}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {post.faq && (
          <section className="mt-10">
            <h2 className="text-xl font-bold">Frequently asked questions</h2>
            <div className="mt-4 space-y-4">
              {post.faq.map((item) => (
                <div
                  key={item.question}
                  className="rounded-xl border border-border/60 p-4"
                >
                  <p className="font-semibold">{item.question}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <CTA className="mt-12" />
      </article>
    </>
  );
}
