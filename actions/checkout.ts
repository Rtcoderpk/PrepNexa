"use server";

import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/payments/provider";
import { PRO_MONTHLY_PRICE_PKR } from "@/lib/pricing";

export interface CheckoutResult {
  checkoutUrl?: string;
  error?: string;
}

/** Server action: create a checkout session and return its redirect URL. */
export async function startCheckoutAction(): Promise<CheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to upgrade." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email ?? "",
      plan: "pro",
      amountPkr: PRO_MONTHLY_PRICE_PKR,
      successUrl: `${appUrl}/dashboard?upgraded=true`,
      cancelUrl: `${appUrl}/pricing`,
    });
    return { checkoutUrl: session.checkoutUrl };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not start checkout. Please try again.",
    };
  }
}