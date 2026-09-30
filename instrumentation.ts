// Runs once when the Next server boots. In the desktop app the server is an
// Electron utilityProcess; the main process pushes license changes (activate /
// trial expiry) here so the AI routes' isEntitled() sees them without a restart.
export function register() {
  if (process.env.CARDNEWS_DESKTOP !== "1" || process.env.NEXT_RUNTIME !== "nodejs") return;
  const port = (process as unknown as {
    parentPort?: { on: (ev: "message", fn: (e: { data: unknown }) => void) => void };
  }).parentPort;
  port?.on("message", (e) => {
    const m = e.data as { type?: string; entitled?: boolean };
    if (m?.type === "entitlement") process.env.CARDNEWS_ENTITLED = m.entitled ? "1" : "0";
  });
}
