// Build-time deployment flags shared by app/layout.tsx and app/page.tsx.
//   HOSTED — a public deployment (Vercel sets VERCEL=1; HOSTED_DEMO=1 previews it locally)
//   SITE   — since the desktop app (v0.12) a hosted deploy serves the PRODUCT
//            SITE at / instead of the BYOK web editor; HOSTED_APP=1 brings the
//            web editor back (e.g. for a separate demo deployment)
export const HOSTED = process.env.VERCEL === "1" || process.env.HOSTED_DEMO === "1";
export const SITE = HOSTED && process.env.HOSTED_APP !== "1";
