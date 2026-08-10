import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How PrepNexa uses cookies for authentication, sessions, and advertising.",
  alternates: { canonical: "/cookie-policy" },
};

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Cookie Policy
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            What cookies we use
          </h2>
          <ul className="list-inside list-disc space-y-2">
            <li>
              <span className="font-medium text-foreground">Essential:</span>{" "}
              authentication and session cookies required for you to sign in and
              use the app.
            </li>
            <li>
              <span className="font-medium text-foreground">Preference:</span>{" "}
              theme and UI preferences stored locally.
            </li>
            <li>
              <span className="font-medium text-foreground">Advertising:</span>{" "}
              free accounts may receive ads served by third-party networks that
              use cookies to personalize ads. Premium (Pro) accounts are
              ad-free and do not receive ad cookies.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            Managing cookies
          </h2>
          <p>
            You can block or delete cookies in your browser settings. Blocking
            essential cookies may prevent you from signing in.
          </p>
        </section>
      </div>
    </div>
  );
}