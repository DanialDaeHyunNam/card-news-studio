// Site-wide links. Fill in GITHUB_URL once the public repo exists —
// the header button and the footer star CTA light up automatically.
export const GITHUB_URL: string | null = "https://github.com/DanialDaeHyunNam/card-news-studio";

// This build's version (inlined from package.json by next.config.ts). Bump the
// package.json version on every release so local copies can detect updates.
export const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

// The canonical hosted deployment. A local copy fetches CANONICAL_URL/api/version
// to learn the latest version and prompt an update when it's behind.
export const CANONICAL_URL = "https://card-news-zeta.vercel.app";

// Compare dotted numeric versions ("0.2.0" > "0.1.9"). Returns true if `latest`
// is strictly newer than `current`. Non-numeric parts are treated as 0.
export function isNewerVersion(latest: string, current: string): boolean {
  const a = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

export const SOCIAL = {
  threads: { url: "https://www.threads.com/@all.libertas", handle: "@all.libertas" },
  x: { url: "https://x.com/danialnamkr", handle: "@danialnamkr" },
};
