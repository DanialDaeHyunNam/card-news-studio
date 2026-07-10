// Project export/import — a portable, self-contained .json per project.
//
// The filesystem store (data/projects + public/uploads) is machine-local, so
// "open this on my other computer" needs a carry format. Export inlines every
// /uploads image as a data URL (the file works anywhere on its own); import
// re-uploads those data URLs through /api/asset so they become short /uploads
// URLs again on the target machine (or stay inline on hosted, where the
// dev-only route can't write).
import type { ChatMessage, Project, RoleStyle } from "./types";
import { FORMATS, defaultTheme, type Format, type Theme } from "./types";
import { newId, normalizeCard } from "./ops";
import { uploadAttachment } from "./image";

// url(/uploads/x.png) inside a background string, or a bare element src.
// Data URLs never contain ')' or quotes (base64 charset), so [^)'"]+ is safe
// for both directions.
const BG_UPLOAD_RE = /url\((['"]?)(\/uploads\/[^)'"]+)\1\)/g;
const BG_DATA_RE = /url\((['"]?)(data:image\/[^)'"]+)\1\)/g;

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type")?.split(";")[0] || "image/png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

// The portable form of a project: a deep copy with every /uploads image
// inlined. Split from exportProject (which just downloads it) so it's testable
// outside a browser.
export async function projectToPortable(project: Project): Promise<Project> {
  const p: Project = JSON.parse(JSON.stringify(project));
  const urls = new Set<string>();
  for (const c of p.cards) {
    for (const m of c.background.matchAll(BG_UPLOAD_RE)) urls.add(m[2]);
    for (const e of c.elements) {
      if (e.type === "image" && e.src.startsWith("/uploads/")) urls.add(e.src);
    }
  }
  const inline = new Map<string, string>();
  for (const u of urls) {
    const d = await toDataUrl(u);
    if (d) inline.set(u, d); // missing file → keep the path, still opens without the image
  }
  for (const c of p.cards) {
    c.background = c.background.replace(BG_UPLOAD_RE, (m, q, u) =>
      inline.has(u) ? `url(${q}${inline.get(u)}${q})` : m,
    );
    for (const e of c.elements) {
      if (e.type === "image" && inline.has(e.src)) e.src = inline.get(e.src)!;
    }
  }
  return p;
}

export async function exportProject(project: Project): Promise<void> {
  const p = await projectToPortable(project);
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const safeName = (p.name || "cardnews").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40).trim();
  a.download = `${safeName || "cardnews"}.cardnews.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function isChatMessage(m: unknown): m is ChatMessage {
  const c = m as ChatMessage;
  return !!c && (c.role === "user" || c.role === "assistant") && typeof c.text === "string";
}

// Parse + sanitize a .cardnews.json file into a fresh Project. Foreign JSON
// goes through normalizeCard (same gate as AI output): ids are regenerated,
// unknown fields dropped, numbers clamped. Inlined data-URL images are pushed
// back through /api/asset to become local /uploads files.
export async function importProjectFile(file: File, fallbackName: string): Promise<Project> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error("parse");
  }
  const src = raw as Partial<Project>;
  if (!src || typeof src !== "object" || !Array.isArray(src.cards)) throw new Error("format");

  const theme: Theme = { ...defaultTheme(), ...(typeof src.theme === "object" ? src.theme : {}) };
  const format: Format = src.format && src.format in FORMATS ? src.format : "1:1";
  const cards = src.cards.map((c) =>
    normalizeCard((c ?? {}) as unknown as { background?: string; elements?: Record<string, unknown>[] }, theme),
  );

  // Rehydrate inlined images into local files (dev). uploadAttachment falls
  // back to the data URL itself when the store can't write, so this never fails.
  const dataUrls = new Set<string>();
  for (const c of cards) {
    for (const m of c.background.matchAll(BG_DATA_RE)) dataUrls.add(m[2]);
    for (const e of c.elements) {
      if (e.type === "image" && e.src.startsWith("data:image/")) dataUrls.add(e.src);
    }
  }
  const local = new Map<string, string>();
  for (const d of dataUrls) local.set(d, await uploadAttachment(d));
  for (const c of cards) {
    c.background = c.background.replace(BG_DATA_RE, (m, q, u) =>
      local.has(u) ? `url(${q}${local.get(u)}${q})` : m,
    );
    for (const e of c.elements) {
      if (e.type === "image" && local.has(e.src)) e.src = local.get(e.src)!;
    }
  }

  return {
    id: newId(), // always fresh — re-importing must not clobber an existing project
    name: typeof src.name === "string" && src.name.trim() ? src.name : fallbackName,
    format,
    theme,
    cards,
    chat: Array.isArray(src.chat) ? src.chat.filter(isChatMessage) : [],
    styles:
      src.styles && typeof src.styles === "object" ? (src.styles as Record<string, RoleStyle>) : undefined,
    model: typeof src.model === "string" ? src.model : undefined,
    ignoreBrand: !!src.ignoreBrand,
    usage: src.usage && typeof src.usage === "object" ? src.usage : undefined,
    createdAt: typeof src.createdAt === "number" ? src.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
}
