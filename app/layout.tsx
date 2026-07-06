import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card News Studio",
  description: "AI-powered card news maker — generate, edit on canvas, export PNG.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (GA opt-out, ColorZilla, …)
    // inject attributes into <html>/<body> before React hydrates — harmless,
    // and this only suppresses attribute mismatches on these two elements.
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
