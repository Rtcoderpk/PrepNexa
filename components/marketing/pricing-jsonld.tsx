import { PLANS } from "@/lib/pricing";

/** JSON-LD for the pricing page (Offer + offers). */
export function PricingJsonLd() {
  const pro = PLANS.pro;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: pro.name,
    priceCurrency: "PKR",
    price: pro.priceMonthlyPkr,
    description: "Premium AI career preparation — unlimited practice, advanced feedback, and job matching.",
    offers: {
      "@type": "Offer",
      priceCurrency: "PKR",
      price: pro.priceMonthlyPkr,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}