// @-mentions in the editor chat: "@카드3" / "@사진2" tokens the user picks from a
// preview popover. Cards resolve to their id; images resolve to their src and
// are sent to the model as look-able attachments (so it can SEE what "@사진2"
// is and reuse it via attachment:N). Pure — no React, no fetch.
import type { Card, Project } from "./types";
import { backgroundImageUrl } from "./color";

export type Mentionable =
  | { kind: "card"; token: string; n: number; cardId: string; card: Card }
  | { kind: "image"; token: string; n: number; src: string; usedIn: number[] };

const LABEL = {
  ko: { card: "카드", image: "사진" },
  en: { card: "slide", image: "img" },
} as const;

// Every image a card shows (image elements + a url() background), in card order.
function cardImages(card: Card): string[] {
  const out: string[] = [];
  for (const el of card.elements) if (el.type === "image") out.push(el.src);
  const bg = backgroundImageUrl(card.background);
  if (bg) out.push(bg);
  return out;
}

// Cards first, then the project's images (deduped, numbered in card order),
// then recent uploads not already in the project.
export function buildMentionables(project: Project, uploads: string[], lang: "ko" | "en"): Mentionable[] {
  const L = LABEL[lang];
  const items: Mentionable[] = project.cards.map((card, i) => ({
    kind: "card",
    token: `@${L.card}${i + 1}`,
    n: i + 1,
    cardId: card.id,
    card,
  }));
  const images = new Map<string, number[]>();
  project.cards.forEach((card, i) => {
    for (const src of cardImages(card)) images.set(src, [...(images.get(src) ?? []), i + 1]);
  });
  for (const url of uploads) if (!images.has(url)) images.set(url, []);
  let n = 0;
  for (const [src, usedIn] of images) {
    n++;
    items.push({ kind: "image", token: `@${L.image}${n}`, n, src, usedIn: [...new Set(usedIn)] });
  }
  return items;
}

export function filterMentionables(items: Mentionable[], query: string, limit = 14): Mentionable[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, limit);
  return items.filter((m) => m.token.slice(1).toLowerCase().includes(q)).slice(0, limit);
}

// The "@partial" being typed right before the caret, if any.
export function activeMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  return m ? { start: caret - m[2].length - 1, query: m[2] } : null;
}

// Exact-token match: "@사진3" must not match inside "@사진30".
// `tail` is appended raw (unescaped) — used to also swallow one trailing space.
function tokenRe(token: string, flags = "", tail = ""): RegExp {
  return new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)${tail}`, flags);
}
export const hasToken = (text: string, token: string) => tokenRe(token).test(text);
export const removeToken = (text: string, token: string) => text.replace(tokenRe(token, "g", " ?"), "");

// Split text into plain + mention-token runs, for highlighting in bubbles.
export const MENTION_TOKEN_RE = /(@(?:카드|사진|slide|card|img)\d+)/g;
