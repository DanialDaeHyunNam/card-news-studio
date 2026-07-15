import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card News Studio",
  description: "AI-powered card news maker — generate, edit on canvas, export PNG.",
};

// "Hosted" = this is a public deployment (e.g. Vercel), NOT the user's own
// machine. Since v0.8.0 the hosted deploy runs for real: projects live in
// localStorage and AI runs BYOK — the user's key, kept in their browser, sent
// straight to the provider (lib/ai-client.ts). Local installs keep .env.local
// keys + filesystem projects. Vercel sets VERCEL=1 automatically; HOSTED_DEMO=1
// lets you preview the hosted behavior locally. Stamped on <html> server-side
// so the client knows on first paint (see useHosted()).
const HOSTED = process.env.VERCEL === "1" || process.env.HOSTED_DEMO === "1";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (GA opt-out, ColorZilla, …)
    // inject attributes into <html>/<body> before React hydrates — harmless,
    // and this only suppresses attribute mismatches on these two elements.
    <html lang="ko" data-hosted={HOSTED ? "1" : undefined} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        {/* Cookieless anonymous page views (works on all plans). Custom click
            events go through lib/analytics.ts — see the rules there. */}
        <Analytics />
      </body>
    </html>
  );
}
