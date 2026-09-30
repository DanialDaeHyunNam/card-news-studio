import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// Inline the package.json version into the client bundle as NEXT_PUBLIC_APP_VERSION.
// A running local copy compares this against the canonical Vercel deployment's
// /api/version to detect updates. Can be overridden via env (handy for locally
// previewing the "update available" state, e.g. NEXT_PUBLIC_APP_VERSION=0.0.9).
const version = (JSON.parse(readFileSync("package.json", "utf8")).version as string) || "0.0.0";

// Content-Security-Policy — the enforcement layer behind the BYOK disclaimer:
// scripts only from ourselves (no third-party trackers, ever), and network
// calls only to ourselves + the three AI providers the hosted BYOK path talks
// to + the canonical deploy (local copies' update check). If a key tried to
// travel anywhere else, the browser itself would block it.
//   - unsafe-inline (script): Next's bootstrap inline scripts need it (no nonce
//     plumbing here); there are still no external script hosts.
//   - unsafe-eval + ws: + va.vercel-scripts.com: dev server only (bundler
//     runtime, HMR socket, analytics debug script) — never shipped in prod,
//     where the analytics script is served same-origin under /_vercel/insights.
const isDev = process.env.NODE_ENV === "development";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://api.anthropic.com",
    "https://api.openai.com",
    "https://generativelanguage.googleapis.com",
    "https://card-news-zeta.vercel.app", // CANONICAL_URL update check (lib/site.ts)
    isDev ? "https://va.vercel-scripts.com ws:" : "",
  ]
    .filter(Boolean)
    .join(" "),
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
].join("; ");

// The desktop app (electron/) embeds Next's standalone server. Only its build
// sets CARDNEWS_STANDALONE (scripts/build-desktop.mjs) — Vercel and `bun dev`
// keep the default output. The tracing root is pinned to this folder so the
// standalone tree doesn't nest under a parent workspace directory. Routes that
// read under process.cwd() make the tracer pull in the whole repo — the server
// needs none of it (sources are compiled into .next; user data lives in
// userData), so it's excluded here. .env* never ships.
const standalone = process.env.CARDNEWS_STANDALONE === "1";
const TRACE_EXCLUDES = [
  "./app/**", "./components/**", "./lib/**", "./electron/**", "./scripts/**", "./build/**",
  "./data/**", "./public/**", "./release/**", "./dist-electron/**", "./.git/**",
  "./*.md", "./.env*", "./LICENSE", "./bun.lock", "./tsconfig*", "./electron-builder.yml",
  "./instrumentation.ts", "./next.config.ts",
  "./.vercel/**", "./.gstack/**", "./.omniscitus/**", "./.gitignore", "./.vercelignore", "./.tool-versions",
];

const nextConfig: NextConfig = {
  ...(standalone ? {
        output: "standalone" as const,
        outputFileTracingRoot: process.cwd(),
        outputFileTracingExcludes: { "*": TRACE_EXCLUDES },
      } : {}),
  env: { NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || version },
  async headers() {
    return [{ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: csp }] }];
  },
};

export default nextConfig;
