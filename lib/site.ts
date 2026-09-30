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
  threads: { url: "https://www.threads.com/@build_useful", handle: "@build_useful" },
  x: { url: "https://x.com/build_useful", handle: "@build_useful" },
};

// ---------- product (desktop app) ----------
// Desktop downloads: fixed "latest" URLs (electron-builder artifactName has no
// version), so these never change between releases.
const RELEASES = "https://github.com/DanialDaeHyunNam/card-news-studio/releases/latest/download";
export const DOWNLOAD_MAC_ARM = `${RELEASES}/CardNewsStudio-arm64.dmg`;
export const DOWNLOAD_MAC_INTEL = `${RELEASES}/CardNewsStudio-x64.dmg`;
// One-time price of the official build (owner: confirm before launch — mirrors
// ZTO's $5 lifetime BYO tier) and its Lemon Squeezy checkout. The checkout URL
// is the store root until the product exists (owner TODO: /checkout/buy/<id>).
export const PRICE_ONE_TIME = "$5";
export const BUY_URL = "https://all-libertas.lemonsqueezy.com";
export const CONTACT_EMAIL = "libertas.kr@gmail.com";
