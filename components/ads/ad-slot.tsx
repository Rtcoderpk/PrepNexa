import { cn } from "@/lib/utils";

/**
 * AdSlot — placeholder for a legitimate ad provider (e.g. Google AdSense).
 * Renders nothing when ads are disabled, and is intentionally unobtrusive.
 * Premium users never see these (the caller gates on premium status).
 */
export function AdSlot({
  slot = "homepage",
  className,
}: {
  /** Semantic placement name, used to target different slot IDs. */
  slot?: string;
  className?: string;
}) {
  const enabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

  if (!enabled) return null;

  return (
    <div
      className={cn(
        "my-6 flex min-h-[90px] w-full items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-secondary/30",
        className,
      )}
      aria-label="Advertisement"
    >
      {/* AdSense integration point: replace this inner block with the real ad
          unit markup for `slot` once the account is approved. */}
      <span className="px-4 text-center text-[11px] uppercase tracking-wide text-muted-foreground/50">
        Advertisement
      </span>
    </div>
  );
}
