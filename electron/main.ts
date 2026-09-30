// Electron main process — Card News Studio desktop.
//
// The app IS the local-mode Next app: this process starts Next's standalone
// server (a utilityProcess, Electron's own Node) on a fixed loopback port and
// points a window at it. Everything local mode already does — filesystem
// projects, the Claude CLI subscription path, HEIC via `sips`, the scrapers —
// runs unchanged in that server (lib/runtime.ts: CARDNEWS_DESKTOP=1).
//
// Why a FIXED port: UI prefs (language, brand color) live in localStorage,
// which is per-origin. A random port would forget them on every launch.
import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell, utilityProcess, type UtilityProcess } from "electron";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { createLicense } from "./license";
import { createUpdater } from "./updater";

const PORT = 3458;
const ORIGIN = `http://127.0.0.1:${PORT}`;
// Baked at build time by scripts/build-desktop.mjs (CI release only).
// Unpackaged runs can force it (CARDNEWS_FORCE_OFFICIAL=1) to test the trial /
// lock UI without a signed build; a packaged app never reads that variable.
const OFFICIAL =
  process.env.CARDNEWS_OFFICIAL_BUILD === "1" || (!app.isPackaged && process.env.CARDNEWS_FORCE_OFFICIAL === "1");
// `bun run desktop:dev` points the window at a running `bun dev` instead.
const DEV_URL = process.env.CARDNEWS_DEV_URL;
const KEY_ENV_VARS = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"];

app.setName("Card News Studio");
// Source builds get their own data folder so trying one never touches the
// official app's projects (same split as ZTO).
if (!OFFICIAL) app.setPath("userData", join(app.getPath("appData"), "Card News Studio (source)"));

if (!app.requestSingleInstanceLock()) app.quit();

const userData = (): string => app.getPath("userData");
const keysFile = (): string => join(userData(), "keys.json");

let win: BrowserWindow | null = null;
let server: UtilityProcess | null = null;
let quitting = false;

// ---------- API keys (OS keychain via safeStorage) ----------
function readKeys(): Record<string, string> {
  try {
    const raw = JSON.parse(readFileSync(keysFile(), "utf8")) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!KEY_ENV_VARS.includes(k)) continue;
      try {
        out[k] = safeStorage.decryptString(Buffer.from(v, "base64"));
      } catch {
        /* unreadable (keychain reset) — the user re-enters it */
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveKey(envVar: string, value: string): void {
  if (!KEY_ENV_VARS.includes(envVar) || !safeStorage.isEncryptionAvailable()) return;
  let raw: Record<string, string> = {};
  try {
    raw = JSON.parse(readFileSync(keysFile(), "utf8"));
  } catch {
    /* first key */
  }
  raw[envVar] = safeStorage.encryptString(value).toString("base64");
  writeFileSync(keysFile(), JSON.stringify(raw, null, 2));
}

// ---------- License ----------
const license = createLicense(join(userData(), "license.json"), OFFICIAL);

// The server gates AI routes on this (lib/runtime.ts isEntitled). Source builds
// are always entitled.
function pushEntitlement(): void {
  const info = license.info();
  server?.postMessage({ type: "entitlement", entitled: info.entitled });
  win?.webContents.send("license:changed", info);
}

// ---------- Next server ----------
function serverEntry(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "server", "server.js")
    : join(app.getAppPath(), ".next", "standalone", "server.js");
}

// Finder-launched apps don't inherit the shell PATH; the Claude CLI and its
// helpers usually live in one of these.
function guiPath(): string {
  const extra = ["/opt/homebrew/bin", "/usr/local/bin", join(homedir(), ".local/bin"), join(homedir(), ".claude/local")];
  return [...extra, process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin"].join(":");
}

function startServer(): void {
  const dataDir = userData();
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  server = utilityProcess.fork(serverEntry(), [], {
    serviceName: "Card News Studio server",
    stdio: "pipe",
    env: {
      ...process.env,
      ...readKeys(),
      PATH: guiPath(),
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      CARDNEWS_DESKTOP: "1",
      CARDNEWS_DATA_DIR: dataDir,
      CARDNEWS_ENTITLED: license.info().entitled ? "1" : "0",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  server.stdout?.on("data", (d) => process.stdout.write(`[server] ${d}`));
  server.stderr?.on("data", (d) => process.stderr.write(`[server] ${d}`));
  server.on("message", (m: { type?: string; envVar?: string; value?: string }) => {
    if (m?.type === "key:set" && m.envVar && m.value) saveKey(m.envVar, m.value);
  });
  server.on("exit", (code) => {
    server = null;
    if (quitting) return;
    dialog.showErrorBox("Card News Studio", `The local server stopped (code ${code}). The app will close.`);
    app.quit();
  });
}

async function waitForServer(): Promise<boolean> {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(`${ORIGIN}/api/version`);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

// ---------- Window ----------
function isAppUrl(url: string): boolean {
  const base = DEV_URL ?? ORIGIN;
  return url.startsWith(base);
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: "#050505",
    titleBarStyle: "hiddenInset",
    show: false,
    webPreferences: {
      // NOT __dirname: bun's bundler bakes it in as the SOURCE folder's absolute
      // path (verified — the preload silently failed to load). getAppPath() is
      // the project root unpackaged and app.asar when packaged.
      preload: join(app.getAppPath(), "dist-electron", "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win?.show());
  // Links to anywhere else (GitHub, the post a reference came from, checkout)
  // open in the user's browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) && !isAppUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!isAppUrl(url)) {
      e.preventDefault();
      if (/^https?:/.test(url)) void shell.openExternal(url);
    }
  });
  win.on("closed", () => (win = null));
  win.webContents.on("preload-error", (_e, p, err) => console.error("[preload-error]", p, String(err)));
  // Dev-only visual check: CARDNEWS_SCREENSHOT=/path.png captures the window
  // a few seconds after load (unpackaged runs only).
  const shot = !app.isPackaged ? process.env.CARDNEWS_SCREENSHOT : undefined;
  if (shot) {
    win.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        console.log(
          "[screenshot] bridge:",
          await win?.webContents.executeJavaScript("typeof window.cardnewsDesktop"),
        );
        // CARDNEWS_SCREENSHOT_JS runs first (e.g. open a modal), then 800ms settle.
        if (process.env.CARDNEWS_SCREENSHOT_JS) {
          await win?.webContents.executeJavaScript(process.env.CARDNEWS_SCREENSHOT_JS).catch(() => {});
          await new Promise((r) => setTimeout(r, 800));
        }
        const img = await win?.webContents.capturePage();
        if (img) writeFileSync(shot, img.toPNG());
      }, Number(process.env.CARDNEWS_SCREENSHOT_DELAY ?? 4000));
    });
  }
  void win.loadURL(DEV_URL ?? ORIGIN);
}

// Standard menu — without Edit roles, ⌘C/⌘V/⌘Z don't reach the page on macOS.
function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: "appMenu" },
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        ...(app.isPackaged ? [] : [{ role: "toggleDevTools" as const }]),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Open data folder",
          click: () => void shell.openPath(userData()),
        },
        {
          label: "GitHub",
          click: () => void shell.openExternal("https://github.com/DanialDaeHyunNam/card-news-studio"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- IPC (preload.ts is the only caller) ----------
const updater = createUpdater(() => win);

ipcMain.handle("license:info", () => license.info());
ipcMain.handle("license:activate", async (_e, key: string) => {
  const r = await license.activate(String(key ?? ""), hostname());
  pushEntitlement();
  return r;
});
ipcMain.handle("license:deactivate", async () => {
  const r = await license.deactivate();
  pushEntitlement();
  return r;
});
ipcMain.handle("update:status", () => updater.info());
ipcMain.handle("update:check", () => updater.check());
ipcMain.handle("update:install", () => updater.install());
ipcMain.handle("app:openExternal", (_e, url: string) => {
  if (typeof url === "string" && /^https:\/\//.test(url)) void shell.openExternal(url);
});
ipcMain.handle("app:openDataFolder", () => void shell.openPath(userData()));
ipcMain.handle("app:info", () => ({ version: app.getVersion(), dataDir: userData(), official: OFFICIAL }));
// "Your data never leaves this computer" needs its pair: a way to delete it
// here (trashing the app leaves userData behind on macOS). Projects, the
// reference library and uploads go; the license + trial record and API keys
// stay (removed from License / AI keys instead).
ipcMain.handle("data:wipe", () => {
  let n = 0;
  for (const p of ["data", "uploads"]) {
    const t = join(userData(), p);
    if (existsSync(t)) {
      rmSync(t, { recursive: true, force: true });
      n++;
    }
  }
  return n;
});
ipcMain.handle("app:relaunch", () => {
  app.relaunch();
  app.quit();
});

// ---------- Lifecycle ----------
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(async () => {
  buildMenu();
  if (OFFICIAL) license.startTrial();
  if (!DEV_URL) {
    startServer();
    if (!(await waitForServer())) {
      dialog.showErrorBox(
        "Card News Studio",
        `The local server didn't start on port ${PORT}. Is another copy of the app (or something else) using it?`,
      );
      app.quit();
      return;
    }
  }
  createWindow();
  updater.start();
  // Re-check the license in the background (24h throttle inside), then tell the
  // server and the window if the answer changed.
  void license.revalidate().then(pushEntitlement);
  // The trial can run out while the app is open.
  setInterval(pushEntitlement, 10 * 60 * 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  server?.kill();
});
