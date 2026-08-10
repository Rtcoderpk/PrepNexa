"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { startCheckoutAction } from "@/actions/checkout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Calls the server-side checkout action and redirects to the payment URL.
 * The actual premium activation happens via the webhook — never here.
 */
export function CheckoutButton({
  label = "Upgrade to Pro",
  className,
  isPremium,
}: {
  label?: string;
  className?: string;
  isPremium?: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isPremium) {
      router.push("/dashboard");
      return;
    }
    setIsLoading(true);
    try {
      const result = await startCheckoutAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="gradient"
      className={className}
      size="lg"
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Taking you to checkout…
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}