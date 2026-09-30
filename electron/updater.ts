// Auto-update (electron-updater), ported from ZTO.
//
// The channel isn't in electron-builder.yml: official builds get
// `-c.publish.provider=generic -c.publish.url=$CARDNEWS_UPDATE_URL` injected by
// CI, which bakes app-update.yml into the app. Source builds have no
// app-update.yml → the updater reports "disabled" instead of erroring.
// ⚠️ macOS auto-update only works on SIGNED apps (Squirrel.Mac).
//
// Download is automatic; the restart is the user's click (or it installs on
// the next quit) — never yank the window away mid-edit.
import { app, type BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
import { existsSync } from "node:fs";
import { join } from "node:path";

const { autoUpdater } = electronUpdater;

export type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "ready" | "error";

export interface UpdateStatus {
  phase: UpdatePhase;
  version: string;
  newVersion?: string;
  percent?: number;
  error?: string;
  disabled?: boolean;
}

const CHECK_EVERY = 30 * 60 * 1000;
const FOCUS_MIN_GAP = 10 * 60 * 1000; // don't hit the release server on every alt-tab

export function createUpdater(getWindow: () => BrowserWindow | null) {
  let status: UpdateStatus = { phase: "idle", version: app.getVersion() };
  const enabled = app.isPackaged && existsSync(join(process.resourcesPath, "app-update.yml"));

  const push = (next: Partial<UpdateStatus>): void => {
    status = { ...status, ...next };
    const w = getWindow();
    if (w && !w.isDestroyed()) w.webContents.send("update:status", status);
  };

  if (!enabled) status.disabled = true;

  if (enabled) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => push({ phase: "checking", error: undefined }));
    autoUpdater.on("update-available", (i) => push({ phase: "available", newVersion: i.version }));
    autoUpdater.on("update-not-available", () => push({ phase: "idle" }));
    autoUpdater.on("download-progress", (p) => push({ phase: "downloading", percent: Math.round(p.percent) }));
    autoUpdater.on("update-downloaded", (i) => push({ phase: "ready", newVersion: i.version }));
    // A missing/unreadable feed must never break the app — record why, quietly.
    autoUpdater.on("error", (e) => push({ phase: "error", error: String(e).slice(0, 200) }));
  }

  let lastCheck = 0;
  let started = false;

  const check = async (): Promise<UpdateStatus> => {
    if (!enabled) return status;
    lastCheck = Date.now();
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      push({ phase: "error", error: String(e).slice(0, 200) });
    }
    return status;
  };

  // Already downloading / ready → don't flip the badge back to "checking".
  const busy = (): boolean => status.phase === "downloading" || status.phase === "ready";
  const checkIfIdle = (): void => {
    if (!busy()) void check();
  };

  const start = (): void => {
    // The badge only shows after a real release, so dev can fake one:
    // CARDNEWS_FAKE_UPDATE=9.9.9 bun run desktop:dev
    if (!app.isPackaged && process.env.CARDNEWS_FAKE_UPDATE) {
      setTimeout(() => push({ phase: "ready", newVersion: process.env.CARDNEWS_FAKE_UPDATE, disabled: false }), 1500);
      return;
    }
    if (!enabled || started) return;
    started = true;
    setTimeout(checkIfIdle, 20_000);
    setInterval(checkIfIdle, CHECK_EVERY);
    getWindow()?.on("focus", () => {
      if (Date.now() - lastCheck >= FOCUS_MIN_GAP) checkIfIdle();
    });
  };

  const install = (): void => {
    if (!enabled || status.phase !== "ready") return;
    autoUpdater.quitAndInstall();
  };

  return { info: (): UpdateStatus => status, check, start, install };
}
