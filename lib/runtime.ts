// Server-only: where this copy is running, and where its files live.
//
// Three runtimes share one codebase:
//   - dev      `bun dev` — the original local mode (fs store, keys in .env.local)
//   - desktop  the Electron app (electron/main.ts) runs the Next standalone
//              server with CARDNEWS_DESKTOP=1 and CARDNEWS_DATA_DIR=<userData>
//   - hosted   a Vercel deploy — none of the local-only routes answer
// "Local" = dev or desktop: the user's own machine, so filesystem storage, the
// Claude CLI and macOS `sips` are fair game.
import { join } from "node:path";

export const isDesktopRuntime = (): boolean => process.env.CARDNEWS_DESKTOP === "1";
export const isLocalRuntime = (): boolean =>
  process.env.NODE_ENV === "development" || isDesktopRuntime();

// Root for data/ (projects, trash, references). In dev it's the repo (unchanged
// paths: data/ is gitignored); on desktop it's the app's userData folder,
// because the installed app bundle is read-only.
export function dataRoot(): string {
  return isDesktopRuntime() && process.env.CARDNEWS_DATA_DIR
    ? process.env.CARDNEWS_DATA_DIR
    : process.cwd();
}

export const dataDir = (...parts: string[]): string => join(dataRoot(), "data", ...parts);

// Uploaded images. Dev keeps public/uploads (Next dev serves it directly); a
// production server only serves files that were in public/ at BUILD time, so
// desktop stores them in userData and app/uploads/[name]/route.ts serves them.
export function uploadsDir(): string {
  return isDesktopRuntime() ? join(dataRoot(), "uploads") : join(process.cwd(), "public", "uploads");
}

export const LOCAL_ONLY_ERROR = "로컬 앱(데스크톱 또는 bun dev)에서만 사용할 수 있습니다.";

// Official desktop builds gate AI on a license or the trial. electron/main.ts
// sets CARDNEWS_ENTITLED at spawn and pushes changes over parentPort
// (instrumentation.ts applies them). Everything else — dev, hosted, source
// builds — is always entitled.
export const isEntitled = (): boolean => !isDesktopRuntime() || process.env.CARDNEWS_ENTITLED !== "0";

export function notEntitledResponse(): Response {
  return Response.json(
    { error: "무료 사용 기간이 끝났어요. 라이선스 키를 입력하면 계속 쓸 수 있어요.", code: "license_required" },
    { status: 402 },
  );
}
