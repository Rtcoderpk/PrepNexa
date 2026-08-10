import { APP_URL } from "@/lib/constants";

/** Organization + WebApplication structured data for the homepage. */
export function LogoJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "PrepNexa",
        url: APP_URL,
        description:
          "AI Career Preparation, Built Around You. AI mock interviews and a free ATS resume checker.",
      },
      {
        "@type": "WebApplication",
        name: "PrepNexa",
        url: APP_URL,
        applicationCategory: "EducationApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "PKR",
        },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}