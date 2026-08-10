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
    default:
      "PrepNexa — AI Mock Interviews & Free ATS Resume Checker",
    template: "%s | PrepNexa",
  },
  description:
    "Practice AI mock interviews, analyze your resume, check ATS compatibility, match your CV to job descriptions, and improve your chances of getting hired.",
  keywords: [
    "AI mock interview",
    "free AI mock interview",
    "ATS resume checker",
    "free resume analyzer",
    "AI resume analyzer",
    "free CV checker",
    "interview practice",
    "AI interviewer",
    "career preparation",
  ],
  openGraph: {
    title: "PrepNexa — AI Career Preparation, Built Around You",
    description:
      "Practice AI mock interviews, check your resume for ATS compatibility, and become job-ready with PrepNexa.",
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
