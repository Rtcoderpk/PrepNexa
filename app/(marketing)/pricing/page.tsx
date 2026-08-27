import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PLANS } from "@/lib/pricing";
import { PricingJsonLd } from "@/components/marketing/pricing-jsonld";
import { CheckoutButton } from "@/components/payments/checkout-button";
import { createClient } from "@/lib/supabase/server";
import { getUsageStatus } from "@/lib/usage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing — PrepNexa Pro (PKR 499/month) or Free",
  description:
    "PrepNexa pricing: start free with 3 AI mock interviews and 3 ATS resume checks, or upgrade to Pro for PKR 499/month for unlimited practice, advanced feedback, and job matching.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing — PrepNexa",
    description:
      "3 free AI mock interviews + 3 resume checks, or PrepNexa Pro for PKR 499/month.",
    type: "website",
    url: "/pricing",
  },
};

export default async function PricingPage() {
  let isPremium = false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    try {
      const status = await getUsageStatus(user.id);
      isPremium = status.isPremium;
    } catch {
      // Defaults stand.
    }
  }

  const free = PLANS.free;
  const pro = PLANS.pro;

  return (
    <>
      <PricingJsonLd />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Simple pricing, <span className="text-gradient">serious results</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free. Upgrade to Pro when you&apos;re ready to go further.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            All prices in PKR. Cancel anytime.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          {/* Free */}
          <Card className="glass">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="text-xl font-bold">Free</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Everything you need to try PrepNexa.
                </p>
                <p className="mt-4 text-3xl font-extrabold">
                  PKR 0
                  <span className="text-base font-normal text-muted-foreground">
                    / forever
                  </span>
                </p>
              </div>
              <ul className="space-y-2 text-sm">
                {free.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {isPremium ? (
                <Button disabled className="w-full" variant="outline">
                  You&apos;re on Pro
                </Button>
              ) : (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/signup">
                    Start Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className="glass relative overflow-hidden border-primary/40">
            <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
            <CardContent className="relative space-y-6 p-6">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 py-1 text-xs font-medium text-white">
                  Popular
                </span>
                <h2 className="mt-3 text-xl font-bold">{pro.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  For serious job seekers.
                </p>
                <p className="mt-4 text-3xl font-extrabold">
                  PKR {pro.priceMonthlyPkr}
                  <span className="text-base font-normal text-muted-foreground">
                    / month
                  </span>
                </p>
              </div>
              <ul className="space-y-2 text-sm">
                {pro.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {user ? (
                <CheckoutButton
                  className="w-full"
                  isPremium={isPremium}
                  label={isPremium ? "Go to dashboard" : "Upgrade to Pro"}
                />
              ) : (
                <Button asChild variant="gradient" className="w-full" size="lg">
                  <Link href="/signup">
                    Start Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Unlimited practice subject to fair-use limits.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mx-auto mt-12 max-w-3xl text-center text-sm text-muted-foreground">
          <p>
            Need help choosing? Every new account gets 3 free AI mock interviews
            and 3 free resume checks — no credit card required.
          </p>
        </div>
      </div>
    </>
  );
}