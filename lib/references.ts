// Reference library: every reference post the user loaded (history) plus the
// ones they bookmarked ahead of time (favorites). Local dev persists to
// data/references.json via /api/references; hosted falls back to localStorage
// (small ≤240px slide thumbs there, to respect the ~5MB quota).
import type { Project } from "./types";
import type { ReferencePost } from "./reference";
import { shrinkDataUrl, uploadAttachment } from "./image";

export interface RefEntry {
  id: string;
  url: string; // "" for screenshot uploads
  platform: ReferencePost["platform"];
  author: string;
  caption: string;
  kind: ReferencePost["kind"];
  stats: ReferencePost["stats"];
  slides: string[]; // small copies: /uploads URLs (local) or ≤240px data URLs (hosted)
  slideTexts?: string[];
  transcript?: string;
  totalSlides: number;
  favorite: boolean;
  addedAt: number;
  lastUsedAt?: number; // last time a set was generated from it
  useCount: number;
}

const KEY = "cardnews.references.v1";
const BACKFILLED = "cardnews.references.backfilled.v1";
let mode: "fs" | "local" = "local";

export async function loadLibrary(projects: Project[]): Promise<RefEntry[]> {
  let list: RefEntry[] = [];
  try {
    const res = await fetch("/api/references");
    if (res.ok) {
      mode = "fs";
      list = ((await res.json()).references ?? []) as RefEntry[];
    } else throw new Error();
  } catch {
    mode = "local";
    try {
      list = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    } catch {
      list = [];
    }
  }
  // One-time backfill: references saved inside existing projects join the library.
  if (!window.localStorage.getItem(BACKFILLED)) {
    for (const p of projects) {
      const r = p.reference;
      if (!r?.slides.length || list.some((e) => r.url && e.url === r.url)) continue;
      list.push({
        id: crypto.randomUUID(),
        url: r.url,
        platform: r.platform as RefEntry["platform"],
        author: r.author,
        caption: r.caption,
        kind: r.slides.length > 1 ? "carousel" : "image",
        stats: {},
        slides: r.slides,
        totalSlides: r.slides.length,
        favorite: false,
        addedAt: p.createdAt,
        lastUsedAt: p.createdAt,
        useCount: 1,
      });
    }
    try {
      window.localStorage.setItem(BACKFILLED, "1");
    } catch {
      /* best effort */
    }
    if (list.length) saveLibrary(list);
  }
  return list;
}

export function saveLibrary(list: RefEntry[]) {
  if (mode === "fs") {
    void fetch("/api/references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ references: list }),
    }).catch(() => {});
    return;
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota — the library is a convenience, never block on it */
  }
}

// Small, storable copies of a post's slides (uploads locally; tiny data URLs hosted).
async function storableSlides(slides: string[]): Promise<string[]> {
  const size = mode === "fs" ? 480 : 240;
  return Promise.all(
    slides.map(async (s) => {
      const small = await shrinkDataUrl(s, size).catch(() => s);
      return mode === "fs" ? uploadAttachment(small) : small;
    }),
  );
}

// Add a freshly loaded post (or refresh an existing one with the same link).
export async function upsertPost(
  list: RefEntry[],
  post: ReferencePost,
  opts: { favorite?: boolean; used?: boolean } = {},
): Promise<RefEntry[]> {
  const existing = post.url ? list.find((e) => e.url === post.url) : undefined;
  const slides = await storableSlides(post.slides);
  const base: RefEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    url: post.url,
    platform: post.platform,
    author: post.author,
    caption: post.caption.slice(0, 2000),
    kind: post.kind,
    stats: post.stats,
    slides,
    slideTexts: post.slideTexts,
    transcript: post.transcript?.slice(0, 6000),
    totalSlides: post.totalSlides,
    favorite: opts.favorite ?? existing?.favorite ?? false,
    addedAt: existing?.addedAt ?? Date.now(),
    lastUsedAt: opts.used ? Date.now() : existing?.lastUsedAt,
    useCount: (existing?.useCount ?? 0) + (opts.used ? 1 : 0),
  };
  return [base, ...list.filter((e) => e.id !== base.id)];
}

export function markUsed(list: RefEntry[], url: string): RefEntry[] {
  return list.map((e) => (url && e.url === url ? { ...e, lastUsedAt: Date.now(), useCount: e.useCount + 1 } : e));
}

// Library entry → a ReferencePost the model can read (slides back to data URLs).
export async function entryToPost(e: RefEntry): Promise<ReferencePost> {
  const slides = await Promise.all(e.slides.map((s) => shrinkDataUrl(s, 720).catch(() => s)));
  return {
    platform: e.platform,
    url: e.url,
    author: e.author,
    caption: e.caption,
    kind: e.kind,
    slides,
    slideTexts: e.slideTexts,
    transcript: e.transcript,
    totalSlides: e.totalSlides,
    stats: e.stats,
  };
}

// Favorites first, then most recently used/added.
export function sortLibrary(list: RefEntry[]): RefEntry[] {
  const t = (e: RefEntry) => Math.max(e.lastUsedAt ?? 0, e.addedAt);
  return list.slice().sort((a, b) => Number(b.favorite) - Number(a.favorite) || t(b) - t(a));
}
