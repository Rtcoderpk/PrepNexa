import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "InterviewIQ AI — Master Your Next Interview",
    template: "%s | InterviewIQ AI",
  },
  description:
    "Practice real interviews with Alex, your AI interviewer. Get personalized feedback, scores, and a detailed report to level up before your next big interview.",
  keywords: [
    "AI interview",
    "mock interview",
    "interview practice",
    "AI interviewer",
    "career",
  ],
  openGraph: {
    title: "InterviewIQ AI",
    description:
      "Master your next interview with Alex, your personal AI interviewer.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
