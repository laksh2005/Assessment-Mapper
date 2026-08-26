import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VedaAI - Assessment Extraction & Answer Mapping",
  description:
    "Upload a question paper and a student's answer sheet to map answers to questions, highlight them on the sheet, and grade them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Extensions (Grammarly, ColorZilla) inject attributes onto <body> before
    // React hydrates, which otherwise reports as a hydration mismatch.
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
