import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// Inline the package.json version into the client bundle as NEXT_PUBLIC_APP_VERSION.
// A running local copy compares this against the canonical Vercel deployment's
// /api/version to detect updates. Can be overridden via env (handy for locally
// previewing the "update available" state, e.g. NEXT_PUBLIC_APP_VERSION=0.0.9).
const version = (JSON.parse(readFileSync("package.json", "utf8")).version as string) || "0.0.0";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || version },
};

export default nextConfig;
